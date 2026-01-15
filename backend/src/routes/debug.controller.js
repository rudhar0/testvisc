#DELETE
import debuggerService from '../services/debugger.service.js';

export const compileAndStart = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) throw new Error('No code provided');

        const exePath = await debuggerService.compile(code);
        const result = await debuggerService.start(exePath);
        
        res.json({ success: true, state: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const step = async (req, res) => {
    // Step over
    const result = await debuggerService.sendCommand('-exec-next');
    res.json({ success: true, state: result });
};

export const continueExec = async (req, res) => {
    const result = await debuggerService.sendCommand('-exec-continue');
    res.json({ success: true, state: result });
};

export const stop = (req, res) => {
    debuggerService.stop();
    res.json({ success: true });
};