import { PrismaClient } from '@prisma/client';
import { PrismaPostgres } from '@prisma/adapter-postgres';
import { Pool } from 'pg';

// Singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/scrapesafe';
const pool = new Pool({ connectionString });
const adapter = new PrismaPostgres(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;

