import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.warn('MongoDB connected');
  });

  mongoose.connection.on('error', (err: unknown) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(ENV.MONGODB_URI, {
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
