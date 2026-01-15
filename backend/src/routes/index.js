import express from 'express';
import compilerRoutes from './compiler.routes.js';
import analyzeRoutes from './analyze.routes.js';
import debugRoutes from './debug.routes.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Mount routes
router.use('/compiler', compilerRoutes);
router.use('/analyze', analyzeRoutes);
router.use('/debug', debugRoutes);

export default router;