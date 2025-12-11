import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set test environment
process.env.NODE_ENV = 'test';

// Use the same database as dev for tests (simpler for MVP)
// In production, you'd use a separate test database
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

// Default test private key (Hardhat #0)
if (!process.env.SERVER_SIGNER_PRIVATE_KEY) {
  process.env.SERVER_SIGNER_PRIVATE_KEY = 
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
}

// Ensure database is ready
try {
  execSync('npx prisma db push --accept-data-loss', { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
} catch (error) {
  console.error('Failed to push database schema:', error);
}
