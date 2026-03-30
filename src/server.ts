import { env } from './common/config/env.js';
import { logger } from './common/utils/logger.js';
import { connectDatabase, disconnectDatabase, startConnectionKeepAlive, stopConnectionKeepAlive } from './common/config/database.js';
import app from './app.js';

const startServer = async () => {
  // Connect to database
  await connectDatabase();
  startConnectionKeepAlive();

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    stopConnectionKeepAlive();

    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
};

startServer().catch((error) => {
  logger.error({ err: error }, 'Failed to start server');
  process.exit(1);
});
