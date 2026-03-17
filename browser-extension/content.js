// content.js — AI챗 페이지에서 코드 블록 감지 + 입력창 자동화

(() => {
  'use strict';

  // ── Site-specific selectors ──
  const SITE_CONFIG = {
    'genspark.ai': {
      responseContainer: '.message-content, .response-content, [class*="answer"]',
      inputSelector: 'textarea, [contenteditable="true"]',
      sendButtonSelector: 'button[type="submit"], button[class*="send"]',
    },
    'chat.openai.com': {
      responseContainer: '[data-message-author-role="assistant"]',
      inputSelector: '#prompt-textarea',
      sendButtonSelector: '[data-testid="send-button"]',
    },
    'chatgpt.com': {
      responseContainer: '[data-message-author-role="assistant"]',
      inputSelector: '#prompt-textarea',
      sendButtonSelector: '[data-testid="send-button"]',
    },
    'claude.ai': {
      responseContainer: '[class*="message"][class*="assistant"], .font-claude-message',
      inputSelector: '[contenteditable="true"], textarea',
      sendButtonSelector: 'button[aria-label="Send"], button[class*="send"]',
    },
    'gemini.google.com': {
      responseContainer: '.model-response-text, [class*="response"]',
      inputSelector: '.ql-editor, textarea',
      sendButtonSelector: 'button[aria-label="Send message"]',
    },
  };

  const hostname = window.location.hostname;
  const config = Object.entries(SITE_CONFIG).find(([key]) => hostname.includes(key))?.[1];
  if (!config) return;

  let lastProcessedHTML = '';
  let observer = null;

  // ── Code block extraction ──
  function extractCodeBlocks(container) {
    const blocks = [];
    // <pre><code> 패턴 (대부분의 AI챗)
    container.querySelectorAll('pre code, pre').forEach((el) => {
      const codeEl = el.tagName === 'PRE' ? el.querySelector('code') || el : el;
      const content = codeEl.textContent?.trim();
      if (!content || content.length < 10) return;

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
        const containers = document.querySelectorAll(config.responseContainer);
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
          // background.js로 전송
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
      }, 1500); // 1.5초 디바운스 (스트리밍 완료 대기)
    });

    observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
  }

  // ── Receive message: VS Code → browser → AI chat input ──
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'sendToAIChat') {
      const input = document.querySelector(config.inputSelector);
      if (!input) return;

      if (input.tagName === 'TEXTAREA') {
        // Native textarea
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
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
          const sendBtn = document.querySelector(config.sendButtonSelector);
          if (sendBtn && !sendBtn.disabled) sendBtn.click();
        }, 300);
      }
    }
  });

  // ── Init ──
  startObserving();
  console.log('[CodeBreeze] Content script loaded for', hostname);
})();
