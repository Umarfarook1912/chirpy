const DEBUG_ENDPOINT = 'http://127.0.0.1:7314/ingest/87d2da05-1d56-4da3-9cbe-64702b282ee9';

export function writeDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'post-fix',
): void {
  const payload = {
    sessionId: 'fb5d5f',
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };

  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'fb5d5f' },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

export function debugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'post-fix',
): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && typeof window !== 'undefined') {
    chrome.runtime.sendMessage({
      type: 'DEBUG_LOG',
      payload: {
        sessionId: 'fb5d5f',
        runId,
        hypothesisId,
        location,
        message,
        data,
        timestamp: Date.now(),
      },
    }).catch(() => {});
    return;
  }

  writeDebugLog(location, message, data, hypothesisId, runId);
}
