import express from 'express';
import { analyzeService } from '../services/analyze.service.js';

const router = express.Router();

// POST /api/analyze - Execute code and return trace
router.post('/analyze', async (req, res) => {
  try {
    const { code, language, inputs } = req.body;
    const result = await analyzeService.analyze({ code, language, inputs });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/validate - Check syntax only
router.post('/validate', async (req, res) => {
  try {
    const { code, language } = req.body;
    const result = await analyzeService.validateSyntax({ code, language });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/requirements - Check if code needs input
router.post('/requirements', async (req, res) => {
  try {
    const { code, language } = req.body;
    const result = await analyzeService.getInputRequirements({ code, language });
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;