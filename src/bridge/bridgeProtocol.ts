// src/bridge/bridgeProtocol.ts

/** 브라우저 → VS Code 메시지 */
export type BrowserToVSCodeMessage =
  | { type: 'ping' }
  | { type: 'codeBlocks'; blocks: BridgeCodeBlock[]; source: string }
  | { type: 'ai_response'; payload: string; source: string }   // 신규
  | { type: 'send_to_ai'; payload: string }                     // 신규 (역방향: VS Code가 보낸 것을 브라우저가 echo)
  | { type: 'getStatus' };

/** VS Code → 브라우저 메시지 */
export type VSCodeToBrowserMessage =
  | { type: 'pong' }
  | { type: 'status'; watching: boolean; port: number }
  | { type: 'applyResult'; applied: number; results: unknown[] }
  | { type: 'clipboardReady'; count: number }
  | { type: 'send_to_ai'; payload: string }                     // 신규: VS Code → 브라우저 → AI챗 입력창
  | { type: 'error_context'; payload: string }                   // 신규: 에이전트 루프 에러 컨텍스트
  | { type: 'agent_loop_status'; iteration: number; maxIterations: number; status: string }; // 신규

export interface BridgeCodeBlock {
  language?: string;
  filePath?: string;
  content: string;
}

export const DEFAULT_AGENT_LOOP_MAX_ITERATIONS = 5;
