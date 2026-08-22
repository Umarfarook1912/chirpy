import { EXTENSION_CONSTANTS } from '../constants/extension.constants';

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = EXTENSION_CONSTANTS.SYNC_RETRY_LIMIT,
  delayMs = EXTENSION_CONSTANTS.SYNC_RETRY_DELAY_MS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(delayMs * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
