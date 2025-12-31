import VisualizationStep from '../models/visualization-step.model.js';
import { logger } from '../utils/logger.js';

class TraceVisualizerService {
  constructor() {
    this.previousState = null;
  }

  _createInitialVisualization(variable, frameId) {
    if (variable.isArray) {
      return new VisualizationStep('array', 'array_initial', {
        name: variable.name,
        type: variable.type,
        size: variable.size,
        elements: variable.elements,
        frameId: frameId,
      });
    }
    if (variable.isPointer) {
        return new VisualizationStep('pointer', 'pointer_initial', {
            name: variable.name,
            type: variable.type,
            value: variable.value,
            frameId: frameId,
        });
    }
    return new VisualizationStep('variable', 'variable_single_initial', {
      name: variable.name,
      type: variable.type,
      value: variable.value,
      frameId: frameId,
    });
  }

  generateVisualizationSteps(currentState) {
    const visualizationSteps = [];

    if (!this.previousState) {
      // First step: visualize all initial frames and variables
      if (currentState.stack) {
        for (const frame of currentState.stack) {
          visualizationSteps.push(new VisualizationStep('function', 'function_call', {
            functionName: frame.function,
            frameId: frame.frameId,
          }));
          for (const varName in frame.locals) {
            const variable = frame.locals[varName];
            visualizationSteps.push(this._createInitialVisualization(variable, frame.frameId));
          }
        }
      }
    } else {
      // Compare with previous state
      if (currentState.stack) {
        // Detect function calls and returns
        for (const currentFrame of currentState.stack) {
          const previousFrame = this.previousState.stack.find(f => f.frameId === currentFrame.frameId);
          if (!previousFrame) {
            visualizationSteps.push(new VisualizationStep('function', 'function_call', {
              functionName: currentFrame.function,
              frameId: currentFrame.frameId,
            }));
          }
        }
        for (const previousFrame of this.previousState.stack) {
          const currentFrame = currentState.stack.find(f => f.frameId === previousFrame.frameId);
          if (!currentFrame) {
            visualizationSteps.push(new VisualizationStep('function', 'function_return', {
              functionName: previousFrame.function,
              frameId: previousFrame.frameId,
            }));
          }
        }
        
        for (const currentFrame of currentState.stack) {
          const previousFrame = this.previousState.stack.find(f => f.frameId === currentFrame.frameId);

          if (previousFrame) {
            // Existing stack frame, compare variables
            for (const varName in currentFrame.locals) {
              const currentVar = currentFrame.locals[varName];
              const previousVar = previousFrame.locals[varName];

              if (!previousVar) {
                // New variable in existing frame
                visualizationSteps.push(this._createInitialVisualization(currentVar, currentFrame.frameId));
              } else if (currentVar.value !== previousVar.value) {
                // Variable value changed
                if (currentVar.isArray) {
                    visualizationSteps.push(new VisualizationStep(
                        'array',
                        'array_element_update',
                        {
                            name: currentVar.name,
                            type: currentVar.type,
                            oldValue: previousVar.value,
                            newValue: currentVar.value,
                            frameId: currentFrame.frameId,
                        }
                    ));
                } else if (currentVar.isPointer) {
                    visualizationSteps.push(new VisualizationStep(
                        'pointer',
                        'pointer_value_assign',
                        {
                            name: currentVar.name,
                            type: currentVar.type,
                            oldValue: previousVar.value,
                            newValue: currentVar.value,
                            frameId: currentFrame.frameId,
                        }
                    ));

                    // Check if the pointer now points to a known variable
                    const targetAddress = currentVar.value;
                    for (const frame of currentState.stack) {
                        for (const name in frame.locals) {
                            const targetVar = frame.locals[name];
                            if (targetVar.address === targetAddress) {
                                visualizationSteps.push(new VisualizationStep(
                                    'pointer',
                                    'pointer_arrow',
                                    {
                                        sourceId: `${currentVar.frameId}-${currentVar.name}`,
                                        targetId: `${targetVar.frameId}-${targetVar.name}`,
                                    }
                                ));
                            }
                        }
                    }

                } else {
                    visualizationSteps.push(new VisualizationStep(
                      'variable',
                      'variable_value_change',
                      {
                        name: currentVar.name,
                        type: currentVar.type,
                        oldValue: previousVar.value,
                        newValue: currentVar.value,
                        frameId: currentFrame.frameId,
                      }
                    ));
                }
              }
            }
          }
        }
      }
    }

    // Deep copy the current state to be the previous state for the next step
    this.previousState = JSON.parse(JSON.stringify(currentState));

    logger.info(`Generated ${visualizationSteps.length} visualization steps.`);
    return visualizationSteps;
  }
}

const traceVisualizerService = new TraceVisualizerService();
export default traceVisualizerService;
