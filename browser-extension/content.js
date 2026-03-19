// content.js — AI챗 페이지에서 코드 블록 감지 + 입력창 자동화

(() => {
  'use strict';

  // ── Site-specific selectors with fallback chains ──
  const SITE_CONFIG = {
    'genspark.ai': {
      version: '2026-03-18',
      responseContainer: [
        '.message-content, .response-content, [class*="answer"]',
        '[class*="message"][class*="bot"], [class*="message"][class*="assistant"]',
        '[class*="response"], [class*="reply"]',
      ],
      codeBlockSelector: ['pre code', 'pre', '[class*="code-block"] code', '[class*="code"] pre'],
      inputSelector: [
        'textarea',
        '[contenteditable="true"]',
        '[class*="input"] textarea',
        '[role="textbox"]',
      ],
      sendButtonSelector: [
        'button[type="submit"]',
        'button[class*="send"]',
        'button[aria-label*="send" i]',
        'button[class*="submit"]',
      ],
    },
    'chat.openai.com': {
      version: '2026-03-18',
      responseContainer: [
        '[data-message-author-role="assistant"]',
        '[class*="assistant"][class*="message"]',
      ],
      codeBlockSelector: ['pre code', 'pre'],
      inputSelector: ['#prompt-textarea', 'textarea'],
      sendButtonSelector: ['[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
    },
    'chatgpt.com': {
      version: '2026-03-18',
      responseContainer: [
        '[data-message-author-role="assistant"]',
        '[class*="assistant"][class*="message"]',
      ],
      codeBlockSelector: ['pre code', 'pre'],
      inputSelector: ['#prompt-textarea', 'textarea'],
      sendButtonSelector: ['[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
    },
    'claude.ai': {
      version: '2026-03-18',
      responseContainer: [
        '[class*="message"][class*="assistant"], .font-claude-message',
        '[data-role="assistant"]',
      ],
      codeBlockSelector: ['pre code', 'pre'],
      inputSelector: ['[contenteditable="true"]', 'textarea', '[class*="input"][contenteditable]'],
      sendButtonSelector: ['button[aria-label="Send"]', 'button[class*="send"]'],
    },
    'gemini.google.com': {
      version: '2026-03-18',
      responseContainer: [
        '.model-response-text, [class*="response"]',
        '[class*="model"][class*="text"]',
      ],
      codeBlockSelector: ['pre code', 'pre'],
      inputSelector: ['.ql-editor', 'textarea', '[contenteditable="true"]'],
      sendButtonSelector: ['button[aria-label="Send message"]', 'button[class*="send"]'],
    },
  };

  const hostname = window.location.hostname;
  const config = Object.entries(SITE_CONFIG).find(([key]) => hostname.includes(key))?.[1];
  if (!config) return;

  let lastProcessedHTML = '';
  let observer = null;

  // ── Fallback selector helper ──
  function queryWithFallback(root, selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of selectorList) {
      try {
        const result = root.querySelectorAll(sel);
        if (result.length > 0) return result;
      } catch {
        /* invalid selector, try next */
      }
    }
    return root.querySelectorAll('__never_match__');
  }

  function queryOneWithFallback(root, selectors) {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of selectorList) {
      try {
        const el = root.querySelector(sel);
        if (el) return el;
      } catch {
        /* invalid selector, try next */
      }
    }
    return null;
  }

  // ── Code block extraction with fallback selectors ──
  function extractCodeBlocks(container) {
    const blocks = [];
    const codeSelectors = config.codeBlockSelector || ['pre code', 'pre'];
    const selectorList = Array.isArray(codeSelectors) ? codeSelectors : [codeSelectors];

    // Try each selector until we find code blocks
    let codeElements = [];
    for (const sel of selectorList) {
      try {
        const found = container.querySelectorAll(sel);
        if (found.length > 0) {
          codeElements = Array.from(found);
          break;
        }
      } catch {
        /* try next */
      }
    }

    // Final fallback: generic code selectors
    if (codeElements.length === 0) {
      const fallback = container.querySelectorAll(
        'pre > code, [class*="code-block"], [class*="codeBlock"]'
      );
      if (fallback.length > 0) codeElements = Array.from(fallback);
    }

    const seen = new Set();
    codeElements.forEach((el) => {
      const codeEl = el.tagName === 'PRE' ? el.querySelector('code') || el : el;
      const content = codeEl.textContent?.trim();
      if (!content || content.length < 10) return;

      // Deduplicate (pre > code may match both pre and code)
      if (seen.has(content)) return;
      seen.add(content);

      // 언어 감지: class="language-typescript" 또는 "hljs typescript"
      const langClass = codeEl.className.match(/(?:language-|hljs\s+)(\w+)/);
      const language = langClass ? langClass[1] : '';

      // 파일 경로 감지: 코드 블록 위의 span/div에서 파일명 추출
      const header = el.closest('pre')?.previousElementSibling;
      let filePath = null;
      if (header) {
        const headerText = header.textContent?.trim() || '';
        const fpMatch = headerText.match(/(?:^|\s)([\w./\\-]+\.\w{1,10})(?:\s|$)/);
        if (fpMatch) filePath = fpMatch[1];
      }

      // content 자체에서 인라인 파일 경로 감지: 첫 줄에 // filepath: ... 패턴
      if (!filePath) {
        const firstLine = content.split('\n')[0];
        const inlineMatch = firstLine.match(/\/\/\s*(?:filepath|file):\s*(.+)/i);
        if (inlineMatch) filePath = inlineMatch[1].trim();
      }

      blocks.push({ language, filePath, content });
    });
    return blocks;
  }

  // ── MutationObserver for response detection ──
  function startObserving() {
    const targetNode = document.body;
    let debounceTimer = null;

    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const containers = queryWithFallback(document, config.responseContainer);
        if (containers.length === 0) return;

        const lastContainer = containers[containers.length - 1];
        const currentHTML = lastContainer.innerHTML;

        if (currentHTML === lastProcessedHTML) return;

        // 응답이 아직 스트리밍 중인지 확인 (typing indicator)
        const isStreaming = !!document.querySelector(
          '.typing-indicator, [class*="streaming"], [class*="loading"], .result-streaming'
        );
        if (isStreaming) return;

        lastProcessedHTML = currentHTML;
        const blocks = extractCodeBlocks(lastContainer);

        if (blocks.length > 0) {
          chrome.runtime.sendMessage({
            action: 'codeBlocksDetected',
            blocks,
            source: hostname,
          });
        }

        // 전체 응답 텍스트도 전송
        chrome.runtime.sendMessage({
          action: 'aiResponse',
          payload: lastContainer.textContent || '',
          source: hostname,
        });
      }, 1500);
    });

    observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
  }

  // ── Receive message: VS Code → browser → AI chat input ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'sendToAIChat') {
      const input = queryOneWithFallback(document, config.inputSelector);
      if (!input) return;

      if (input.tagName === 'TEXTAREA') {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        ).set;
        nativeInputValueSetter.call(input, msg.payload);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        // contenteditable
        input.textContent = msg.payload;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      }

      // 자동 Send (설정에 따라)
      if (msg.autoSend) {
        setTimeout(() => {
          const sendBtn = queryOneWithFallback(document, config.sendButtonSelector);
          if (sendBtn && !sendBtn.disabled) sendBtn.click();
        }, 300);
      }
    }

    // Selector test request from popup
    if (msg.action === 'testSelectors') {
      const results = {
        version: config.version,
        responseContainers: queryWithFallback(document, config.responseContainer).length,
        inputField: !!queryOneWithFallback(document, config.inputSelector),
        sendButton: !!queryOneWithFallback(document, config.sendButtonSelector),
        codeBlocks: 0,
      };
      const containers = queryWithFallback(document, config.responseContainer);
      containers.forEach((c) => {
        results.codeBlocks += extractCodeBlocks(c).length;
      });
      chrome.runtime.sendMessage({ action: 'selectorTestResult', results });
    }
  });

  // ── Init ──
  startObserving();
  console.log(`[CodeBreeze] Content script loaded for ${hostname} (selectors v${config.version})`);

  // B-026: clean up observer and timers on page unload
  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });
})();
