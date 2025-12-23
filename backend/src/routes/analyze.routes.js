import express from 'express';
import clangAnalyzerService from '../services/clang-analyzer.service.js';
import { analyzeService } from '../services/analyze.service.js';

const router = express.Router();

/**
 * POST /api/analyze/syntax
 * Check syntax using Clang + LibTooling semantic analysis
 */
router.post('/syntax', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    // Auto-detect language if not provided
    const detectedLang = language || analyzeService.detectLanguage(code);

    // Use Clang semantic validation
    const result = await clangAnalyzerService.validateCode(code, detectedLang);
    res.json({
      success: true,
      data: {
        valid: result.valid,
        errors: result.errors,
        language: detectedLang,
        analyzer: 'clang+libtooling'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyze/ast
 * Get complete semantic AST dump with type information
 */
router.post('/ast', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const detectedLang = language || analyzeService.detectLanguage(code);

    // Use Clang for complete semantic AST
    const result = await clangAnalyzerService.analyzeCode(code, detectedLang);
    res.json({
      success: result.success,
      data: result.analysis,
      errors: result.errors
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyze/trace
 * Generate execution trace
 */
router.post('/trace', async (req, res) => {
  try {
    const { code, language, inputs } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const detectedLang = language || analyzeService.detectLanguage(code);
    
    // Generate execution trace
    const trace = await analyzeService.generateTrace(code, detectedLang, inputs);

    res.json({
      success: true,
      data: trace
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyze/visual
 * Extract information optimized for visualization
 */
router.post('/visual', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const detectedLang = language || analyzeService.detectLanguage(code);
    
    const result = await clangAnalyzerService.extractVisualInfo(code, detectedLang);

    res.json({
      success: result.success,
      data: result.visualization,
      error: result.error
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyze/memory-issues
 * Detect potential memory-related issues
 */
router.post('/memory-issues', async (req, res) => {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }

    const detectedLang = language || analyzeService.detectLanguage(code);
    
    const result = await clangAnalyzerService.detectMemoryIssues(code, detectedLang);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;