import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './db/prisma';
import { initServerSigner, getServerAddress } from './services/signer';

// Import routes
import ownerRoutes from './routes/owner';
import marketRoutes from './routes/market';
import buyRoutes from './routes/buy';
import verifyRoutes from './routes/verify';
import adminRoutes from './routes/admin';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));
app.use(express.json());

// Request logging (development)
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    serverAddress: getServerAddress(),
  });
});

// API Routes
app.use('/api/owner', ownerRoutes);
app.use('/api/market', marketRoutes);
app.use('/api', marketRoutes); // Mount asset route at /api/asset/:ipId
app.use('/api/buy', buyRoutes);
app.use('/api', verifyRoutes); // Mount license/check-license/validate-proof at /api
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
  try {
    // Initialize server signer
    initServerSigner();
    console.log(`Server signer address: ${getServerAddress()}`);

    // Verify database connection
    await prisma.$connect();
    console.log('Database connected');

    // Start listening
    if (process.env.NODE_ENV !== 'test') {
      app.listen(PORT, () => {
        console.log(`ScrapeSafe API running on http://localhost:${PORT}`);
        console.log('Available endpoints:');
        console.log('  POST /api/owner/register');
        console.log('  POST /api/owner/verify');
        console.log('  POST /api/owner/set-terms');
        console.log('  GET  /api/owner/site/:siteId');
        console.log('  GET  /api/market');
        console.log('  GET  /api/asset/:ipId');
        console.log('  POST /api/buy');
        console.log('  GET  /api/license/:licenseId');
        console.log('  GET  /api/check-license');
        console.log('  POST /api/validate-proof');
        console.log('  POST /api/admin/revoke-license');
        console.log('  GET  /api/admin/stats');
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
start();

// Export for testing
export { app };
