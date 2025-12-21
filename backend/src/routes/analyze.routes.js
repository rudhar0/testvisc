import express from 'express';
import { gccService } from '../services/gcc.service.js';
import { analyzeService } from '../services/analyze.service.js';

const router = express.Router();

/**
 * POST /api/analyze/syntax
 * Check syntax using GCC
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

    if (gccService.isAvailable()) {
      // Use GCC for syntax check
      const result = await gccService.compileCode(code, detectedLang);
      res.json({
        success: true,
        data: {
          valid: result.success,
          errors: result.errors,
          warnings: result.warnings,
          language: detectedLang,
          method: 'gcc'
        }
      });
    } else {
      // Fallback to parser-based validation
      const result = await analyzeService.validateSyntax(code, detectedLang);
      res.json({
        success: true,
        data: {
          valid: result.valid,
          errors: result.errors,
          warnings: result.warnings,
          language: detectedLang,
          method: 'parser'
        }
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * POST /api/analyze/ast
 * Get AST dump
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

    if (gccService.isAvailable()) {
      const result = await gccService.getASTDump(code, detectedLang);
      res.json({
        success: true,
        data: result
      });
    } else {
      const result = await analyzeService.parseAST(code, detectedLang);
      res.json({
        success: true,
        data: result
      });
    }

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
    
    // Generate execution trace (this will be implemented in analyze.service.js)
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

export default router;