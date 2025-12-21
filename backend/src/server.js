import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { gccService } from './services/gcc.service.js';
import { setupSocketHandlers } from './sockets/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({
  origin: config.allowedOrigins
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

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
    
    // Check GCC availability on startup
    logger.info('🔍 Checking GCC availability...');
    await gccService.initialize();
    
    if (gccService.isAvailable()) {
      logger.success('✅ GCC is available');
    } else {
      logger.warn('⚠️  GCC not found - fallback mode will be used');
    }

    // Start server
    httpServer.listen(config.port, () => {
      logger.success(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Socket.io ready for connections`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`🔗 Allowed origins: ${config.allowedOrigins.join(', ')}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('\nSIGINT received, closing server...');
  httpServer.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

startServer();

export { io };