import DebuggerService from '../routes/debugger.service.js';
import VariableService from '../services/variable.service.js';

let debuggerInstance = null;

export const compileAndStart = async (req, res) => {
  try {
    const { code, language } = req.body;
    
    if (debuggerInstance) {
      debuggerInstance.stop();
    }

    const io = req.app.get('socketio');
    debuggerInstance = new DebuggerService(io);

    await debuggerInstance.start(code, language);
    
    res.json({ success: true, message: 'Debugger started' });
  } catch (error) {
    console.error('Compile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const step = (req, res) => {
  if (debuggerInstance) {
    debuggerInstance.step();
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Debugger not running' });
  }
};

export const next = (req, res) => {
    if (debuggerInstance) {
        debuggerInstance.next();
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'Debugger not running' });
    }
};

export const continueExec = (req, res) => {
  if (debuggerInstance) {
    debuggerInstance.continue();
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Debugger not running' });
  }
};

export const getStack = async (req, res) => {
    if (debuggerInstance) {
        const stack = await debuggerInstance.getStack();
        res.json({ success: true, stack });
    } else {
        res.status(400).json({ success: false, message: 'Debugger not running' });
    }
}

export const getVariables = async (req, res) => {
    if (debuggerInstance) {
        const variables = await VariableService.getScopedVariables();
        res.json({ success: true, variables });
    } else {
        res.status(400).json({ success: false, message: 'Debugger not running' });
    }
}

export const stop = (req, res) => {
  if (debuggerInstance) {
    debuggerInstance.stop();
    debuggerInstance = null;
  }
  res.json({ success: true });
};

export default {
  compileAndStart,
  step,
  next,
  continueExec,
  getStack,
  getVariables,
  stop
};
