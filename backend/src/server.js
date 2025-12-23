import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import clangAnalyzerService from './services/clang-analyzer.service.js';
import { setupSocketHandlers } from './sockets/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { logger } from './utils/logger.js';
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
app.use(morgan('dev'));

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
    
    // Check Clang availability asynchronously (don't block startup)
    logger.info('🔍 Checking Clang + LibTooling availability...');
    clangAnalyzerService.getSummary('int main(){return 0;}', 'c').then(summary => {
      if (summary.success) {
        logger.success('✅ Clang + LibTooling is available');
      } else {
        logger.warn('⚠️  Clang not found - code analysis will not work');
        logger.warn('   Install clang: https://clang.llvm.org/get_started.html');
      }
    }).catch(err => {
      logger.warn('⚠️  Clang check failed:', err.message);
    });

    // Start server immediately
    httpServer.listen(config.port, () => {
      logger.success(`🚀 Server running on port ${config.port}`);
      logger.info(`📡 Socket.io ready for connections`);
      logger.info(`🌍 Environment: ${config.env}`);
      logger.info(`🔗 Allowed origins: ${config.allowedOrigins.join(', ')}`);
      logger.info(`🔬 Using: Clang + LibTooling for semantic analysis`);
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