/** 直近のストリームリクエストの Pi sessionId（Phase 2 の session スコープ release 用） */
let activeStreamSessionId: string | undefined;

export function setActiveStreamSessionId(sessionId: string | undefined): void {
  activeStreamSessionId = sessionId;
}

export function getActiveStreamSessionId(): string | undefined {
  return activeStreamSessionId;
}

/** テスト用 */
export function resetActiveStreamSessionId(): void {
  activeStreamSessionId = undefined;
}
