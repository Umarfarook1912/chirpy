import { describe, it, expect, beforeEach } from 'vitest';
import { RecordingStateMachine, isValidTransition } from './RecordingState';
import { RECORDING_STATUS } from '@chirpy/shared';

describe('isValidTransition', () => {
  it('allows idle → requesting', () => {
    expect(isValidTransition(RECORDING_STATUS.IDLE, RECORDING_STATUS.REQUESTING)).toBe(true);
  });

  it('allows requesting → recording', () => {
    expect(isValidTransition(RECORDING_STATUS.REQUESTING, RECORDING_STATUS.RECORDING)).toBe(true);
  });

  it('allows requesting → error', () => {
    expect(isValidTransition(RECORDING_STATUS.REQUESTING, RECORDING_STATUS.ERROR)).toBe(true);
  });

  it('allows recording → stopping', () => {
    expect(isValidTransition(RECORDING_STATUS.RECORDING, RECORDING_STATUS.STOPPING)).toBe(true);
  });

  it('allows stopping → completed', () => {
    expect(isValidTransition(RECORDING_STATUS.STOPPING, RECORDING_STATUS.COMPLETED)).toBe(true);
  });

  it('allows completed → idle', () => {
    expect(isValidTransition(RECORDING_STATUS.COMPLETED, RECORDING_STATUS.IDLE)).toBe(true);
  });

  it('allows error → idle', () => {
    expect(isValidTransition(RECORDING_STATUS.ERROR, RECORDING_STATUS.IDLE)).toBe(true);
  });

  it('rejects idle → recording (skipping requesting)', () => {
    expect(isValidTransition(RECORDING_STATUS.IDLE, RECORDING_STATUS.RECORDING)).toBe(false);
  });

  it('rejects idle → completed', () => {
    expect(isValidTransition(RECORDING_STATUS.IDLE, RECORDING_STATUS.COMPLETED)).toBe(false);
  });

  it('rejects recording → idle (skipping stopping)', () => {
    expect(isValidTransition(RECORDING_STATUS.RECORDING, RECORDING_STATUS.IDLE)).toBe(false);
  });
});

describe('RecordingStateMachine', () => {
  let machine: RecordingStateMachine;

  beforeEach(() => {
    machine = new RecordingStateMachine();
  });

  it('starts in idle state', () => {
    expect(machine.status).toBe(RECORDING_STATUS.IDLE);
  });

  it('successfully transitions through happy path', () => {
    expect(machine.transition(RECORDING_STATUS.REQUESTING)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.REQUESTING);

    expect(machine.transition(RECORDING_STATUS.RECORDING)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.RECORDING);

    expect(machine.transition(RECORDING_STATUS.STOPPING)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.STOPPING);

    expect(machine.transition(RECORDING_STATUS.COMPLETED)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.COMPLETED);

    expect(machine.transition(RECORDING_STATUS.IDLE)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.IDLE);
  });

  it('handles error path', () => {
    machine.transition(RECORDING_STATUS.REQUESTING);
    expect(machine.transition(RECORDING_STATUS.ERROR)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.ERROR);

    expect(machine.transition(RECORDING_STATUS.IDLE)).toBe(true);
    expect(machine.status).toBe(RECORDING_STATUS.IDLE);
  });

  it('rejects invalid transitions and stays in current state', () => {
    const result = machine.transition(RECORDING_STATUS.COMPLETED);
    expect(result).toBe(false);
    expect(machine.status).toBe(RECORDING_STATUS.IDLE);
  });

  it('reset always returns to idle', () => {
    machine.transition(RECORDING_STATUS.REQUESTING);
    machine.transition(RECORDING_STATUS.ERROR);
    machine.reset();
    expect(machine.status).toBe(RECORDING_STATUS.IDLE);
  });
});
