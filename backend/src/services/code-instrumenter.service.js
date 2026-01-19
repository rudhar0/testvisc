// src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * AST‑Based Code Instrumenter
 * Safely injects variable tracing calls using simple regex patterns.
 */
class CodeInstrumenter {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  /**
   * Inject variable tracing into code
   */
  async instrumentCode(code, language = 'cpp') {
    console.log('🔧 Instrumenting code for variable tracing...');

    try {
      // 1️⃣ Add trace.h include
      const withHeader = this.addTraceHeader(code);

      // 2️⃣ Inject TRACE_* calls after assignments
      const traced = await this.injectTraceCallsSafe(withHeader, language);

      console.log('✅ Code instrumentation complete');
      return traced;
    } catch (error) {
      console.error('⚠️  Instrumentation failed, using original code:', error.message);
      return code;   // fallback
    }
  }

  /** Add `#include "trace.h"` after the last existing include */
  addTraceHeader(code) {
    if (code.includes('trace.h')) return code;

    const lines = code.split('\n');
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (t.startsWith('#include')) insertIdx = i + 1;
      else if (t && !t.startsWith('#') && !t.startsWith('//')) break;
    }
    lines.splice(insertIdx, 0, '#include "trace.h"');
    return lines.join('\n');
  }

  /** Very conservative regex‑based injection of TRACE_* calls */
  async injectTraceCallsSafe(code, language) {
    const lines = code.split('\n');
    const out = [];
    let inFunc = false;
    let braceDepth = 0;
    let pendingFor = null;      // variable name to be traced once we see the loop body '{'

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // keep track of brace nesting to know when we are inside a function
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;
      if (braceDepth > 0) inFunc = true;

      // ------- FOR‑loop handling (deferred until we see the opening brace) -------
      const forHdr = trimmed.match(/^for\s*\(([^\)]*)\)/);
      if (forHdr && inFunc) {
        const header = forHdr[1];
        const init = header.match(/(?:int|long|float|double|char)?\s*(\w+)\s*=\s*[\d\-]+/);
        const varName = init ? init[1] : null;
        if (varName) {
          if (trimmed.includes('{')) {
            // brace on the same line → insert right after it
            const before = line.substring(0, line.indexOf('{') + 1);
            const after  = line.substring(line.indexOf('{') + 1);
            const indent = line.match(/^\s*/)[0];
            const traceIndent = indent + '    ';
            out.push(before);
            out.push(`${traceIndent}TRACE_INT(${varName});`);
            if (after.trim()) out.push(indent + after);
          } else {
            // remember we need to insert the trace line once we hit the '{'
            out.push(line);
            pendingFor = varName;
          }
          continue;
        }
      }

      out.push(line);

      // ignore comments, pre‑processor lines, return statements, etc.
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('return') ||
          trimmed.includes('include') ||
          !inFunc ||
          !trimmed.includes('=') ||
          trimmed.endsWith(',')) {
        continue;
      }

      // ---------- simple declaration with initializer -----------------
      const simple = trimmed.match(/^\s*(\w+)\s+(\w+)\s*=\s*([^;]+);/);
      if (simple) {
        const [, type, varName] = simple;
        const indent = line.match(/^\s*/)[0];
        const traceFn = this.getTraceFunctionForType(type);
        out.push(`${indent}${traceFn}(${varName});`);
        continue;
      }

      // ---------- assignment to an existing variable --------------------
      const assign = trimmed.match(/^\s*(\w+)\s*=\s*([^;]+);/);
      if (assign && !trimmed.includes('(') && !trimmed.includes('[')) {
        const [, varName] = assign;
        const indent = line.match(/^\s*/)[0];
        out.push(`${indent}TRACE_INT(${varName});`);
        continue;
      }

      // ---------- ++/-- on a loop counter --------------------------------
      const inc = trimmed.match(/^\s*(\+\+|--)?(\w+)(\+\+|--)?;/);
      if (inc) {
        const varName = inc[2];
        const indent = line.match(/^\s*/)[0];
        out.push(`${indent}TRACE_INT(${varName});`);
        continue;
      }

      // ---------- compound assignment (+=, -=, etc.) --------------------
      const compound = trimmed.match(/^\s*(\w+)\s*([+\-*/%]|<<|>>)?=\s*([^;]+);/);
      if (compound) {
        const [, varName] = compound;
        const indent = line.match(/^\s*/)[0];
        out.push(`${indent}TRACE_INT(${varName});`);
        continue;
      }

      // ---------- deferred TRACE for a for‑loop counter ---------------
      if (pendingFor && trimmed === '{') {
        const indent = line.match(/^\s*/)[0] + '    ';
        out.push(`${indent}TRACE_INT(${pendingFor});`);
        pendingFor = null;
      }
    }
    return out.join('\n');
  }

  /** Choose the right TRACE macro based on a variable's type */
  getTraceFunctionForType(type) {
    const t = type.toLowerCase().trim();
    if (t.includes('int') && !t.includes('long'))  return 'TRACE_INT';
    if (t.includes('long'))                       return 'TRACE_LONG';
    if (t.includes('float') || t.includes('double')) return 'TRACE_DOUBLE';
    if (t.includes('char') && t.includes('*'))    return 'TRACE_STR';
    if (t.includes('*') || t.includes('ptr'))    return 'TRACE_PTR';
    return 'TRACE_INT';   // fallback
  }
}

export default new CodeInstrumenter();
