import express from 'express';
import { gccService } from '../services/gcc.service.js';
import { io } from '../server.js';

const router = express.Router();

/**
 * GET /api/compiler/status
 * Check GCC availability
 */
router.get('/status', (req, res) => {
  try {
    const status = gccService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/compiler/download
 * Start GCC download
 */
router.post('/download', async (req, res) => {
  try {
    if (gccService.isAvailable()) {
      return res.json({
        success: true,
        message: 'GCC already available'
      });
    }

    if (gccService.downloading) {
      return res.status(409).json({
        success: false,
        message: 'Download already in progress'
      });
    }

    // Start download in background
    gccService.downloadGCC((progress, stage) => {
      // Emit progress via Socket.io
      io.emit('gcc:download:progress', {
        progress,
        stage
      });
    }).catch(error => {
      io.emit('gcc:download:error', {
        message: error.message
      });
    });

    res.json({
      success: true,
      message: 'GCC download started'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * GET /api/compiler/progress
 * Get download progress
 */
router.get('/progress', (req, res) => {
  try {
    const status = gccService.getStatus();
    res.json({
      success: true,
      data: {
        progress: status.progress,
        stage: status.stage
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;