import { connectDatabase } from './config/db';
import { ENV } from './config/env';
import app from './app';

async function start(): Promise<void> {
  await connectDatabase();

  const server = app.listen(ENV.PORT, () => {
    console.warn(`CHIRPY backend running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.warn(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      const { disconnectDatabase } = await import('./config/db');
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
