import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Helper function to retry database operations
const retryQuery = async <T>(operation: () => Promise<T>): Promise<T> => {
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const err = error as { code?: string; message?: string };

      if (err.code === 'P1001' || err.code === 'P1017' || err.message?.includes('Connection closed')) {
        if (attempt < maxRetries) {
          logger.warn(`Connection lost, retrying query (${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        } else {
          logger.error(`Query failed after ${maxRetries} retries`);
        }
      } else {
        throw error;
      }
    }
  }

  throw lastError;
};

// Create Prisma Client with extensions
const createPrismaClient = () => {
  const basePrisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          return retryQuery(() => query(args));
        },
      },
    },
  });
};

// Singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Database connection with retry
export const connectDatabase = async (retries = 5): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      logger.warn(`Database connection attempt ${i + 1}/${retries} failed. Retrying...`);
      if (i === retries - 1) {
        logger.error('Database connection failed after all retries');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
};

// Database disconnection
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database');
  }
};

// Keep-alive mechanism (ping every 30s)
let keepAliveInterval: NodeJS.Timeout | null = null;

export const startConnectionKeepAlive = (): void => {
  if (keepAliveInterval) return;

  keepAliveInterval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (_error) {
      logger.error('Keep-alive ping failed');
      try {
        await prisma.$disconnect();
        await prisma.$connect();
        logger.info('Connection restored via keep-alive');
      } catch (_reconnectError) {
        logger.error('Keep-alive reconnection failed');
      }
    }
  }, 30000);

  logger.info('Database keep-alive started (30s interval)');
};

export const stopConnectionKeepAlive = (): void => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    logger.info('Database keep-alive stopped');
  }
};
