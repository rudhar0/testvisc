import express from 'express';
import * as debugController from '../controllers/debug.controller.js';
import { validateCode } from '../middleware/error-detector.middleware.js';

const router = express.Router();

router.post('/start', validateCode, debugController.compileAndStart);
router.post('/step', debugController.step);
router.post('/continue', debugController.continueExec);
router.post('/stop', debugController.stop);

export default router;
