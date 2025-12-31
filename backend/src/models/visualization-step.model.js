class VisualizationStep {
  constructor(type, element, payload) {
    this.type = type; // e.g., 'variable', 'function', 'loop'
    this.element = element; // e.g., 'variable_single_initial', 'function_call_from_main'
    this.payload = payload; // The data needed for the visualization
  }
}

export default VisualizationStep;
