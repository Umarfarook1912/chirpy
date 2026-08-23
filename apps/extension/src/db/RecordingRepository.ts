import { db, type StoredRecording } from './db';

export class RecordingRepository {
  async save(recording: Omit<StoredRecording, 'id'>): Promise<string> {
    const id = await db.recordings.add(recording);
    return recording.recordingKey;
  }

  async getByKey(recordingKey: string): Promise<StoredRecording | undefined> {
    return db.recordings.where('recordingKey').equals(recordingKey).first();
  }

  async getLatest(): Promise<StoredRecording | undefined> {
    return db.recordings.orderBy('createdAt').reverse().first();
  }

  async deleteByKey(recordingKey: string): Promise<void> {
    await db.recordings.where('recordingKey').equals(recordingKey).delete();
  }
}
