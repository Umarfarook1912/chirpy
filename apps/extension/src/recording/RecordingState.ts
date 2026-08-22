import type { RecordingStatus } from '@chirpy/shared';
import { RECORDING_STATUS } from '@chirpy/shared';

export type RecordingStateTransition = {
  from: RecordingStatus;
  to: RecordingStatus;
  valid: boolean;
};

const VALID_TRANSITIONS: Array<[RecordingStatus, RecordingStatus]> = [
  [RECORDING_STATUS.IDLE, RECORDING_STATUS.REQUESTING],
  [RECORDING_STATUS.REQUESTING, RECORDING_STATUS.RECORDING],
  [RECORDING_STATUS.REQUESTING, RECORDING_STATUS.ERROR],
  [RECORDING_STATUS.RECORDING, RECORDING_STATUS.STOPPING],
  [RECORDING_STATUS.RECORDING, RECORDING_STATUS.ERROR],
  [RECORDING_STATUS.STOPPING, RECORDING_STATUS.COMPLETED],
  [RECORDING_STATUS.STOPPING, RECORDING_STATUS.ERROR],
  [RECORDING_STATUS.COMPLETED, RECORDING_STATUS.IDLE],
  [RECORDING_STATUS.ERROR, RECORDING_STATUS.IDLE],
];

export function isValidTransition(from: RecordingStatus, to: RecordingStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

export class RecordingStateMachine {
  private _status: RecordingStatus = RECORDING_STATUS.IDLE;

  get status(): RecordingStatus {
    return this._status;
  }

  transition(to: RecordingStatus): boolean {
    if (!isValidTransition(this._status, to)) {
      console.warn(`[CHIRPY Recording] Invalid transition: ${this._status} → ${to}`);
      return false;
    }
    this._status = to;
    return true;
  }

  reset(): void {
    this._status = RECORDING_STATUS.IDLE;
  }
}
