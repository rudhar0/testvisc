import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { setupSocketHandlers } from './sockets/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import logger from './utils/logger.js';
import workerPoolManager from './services/worker-pool.service.js';
import { socketConfig } from './config/socket.config.js';
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, socketConfig);

// Middleware
app.use(cors({
  origin: config.allowedOrigins
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Quick root route to verify Express HTTP is responding
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Express root responding', time: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// Setup Socket.io handlers
setupSocketHandlers(io);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize server
async function startServer() {
  try {
    logger.info('🚀 Starting C/C++ Visualizer Backend...');
    
    // Initialize Worker Pool
    await workerPoolManager.initialize();

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Socket.io ready for connections`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`🔗 Allowed origins: ${config.allowedOrigins.join(', ')}`);
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server:');
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, closing server...`);
  
  // Close HTTP server
  httpServer.close(async () => {
    logger.info('HTTP server closed.');
    
    // Shutdown worker pool
    await workerPoolManager.shutdown();
    
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

export { io };