/**
 * Main Entry Point
 * Exports all services for use in the application
 */

const AnalyzeService = require('./services/analyze.service');
const TraceService = require('./services/trace.service');
const ASTWalker = require('./parsers/ast-walker');
const CInterpreter = require('./interpreters/c.interpreter');
const MemoryManager = require('./interpreters/memory-manager');
const { ExecutionStep, StepType, AnimationType } = require('./models/execution-step');

module.exports = {
  // Services
  AnalyzeService,
  TraceService,
  
  // Core Components
  ASTWalker,
  CInterpreter,
  MemoryManager,
  
  // Models
  ExecutionStep,
  StepType,
  AnimationType
};