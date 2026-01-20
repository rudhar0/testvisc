// src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * AST-Based Code Instrumenter with BEGINNER MODE
 * Safely injects variable tracing at STATEMENT LEVEL ONLY
 */
class CodeInstrumenter {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  /**
   * Inject variable tracing into code
   */
  async instrumentCode(code, language = 'cpp') {
    console.log('🔧 Instrumenting code for beginner-mode variable tracing...');

    try {
      // 1️⃣ Add trace.h include
      const withHeader = this.addTraceHeader(code);

      // 2️⃣ Inject beginner-mode trace calls
      const traced = await this.injectBeginnerModeTracing(withHeader, language);

      console.log('✅ Code instrumentation complete');
      return traced;
    } catch (error) {
      console.error('⚠️ Instrumentation failed, using original code:', error.message);
      return code;
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

  /**
   * ✅ NEW: Beginner-mode instrumentation
   * Creates EXPLICIT steps for declarations and assignments
   */
  async injectBeginnerModeTracing(code, language) {
    const lines = code.split('\n');
    const out = [];
    
    let inFunc = false;
    let braceDepth = 0;
    let inStruct = false;
    let inClass = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indent = line.match(/^\s*/)[0];

      // Track struct/class scope (NEVER instrument inside these)
      if (trimmed.match(/^\s*(struct|class)\s+\w+/)) {
        inStruct = true;
      }
      
      // Track brace depth
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      if (braceDepth > 0 && !inStruct) {
        inFunc = true;
      }
      
      // Exit struct/class when braces close
      if (inStruct && braceDepth === 0 && closeBraces > 0) {
        inStruct = false;
      }

      // ❌ SAFETY: Never instrument inside struct/class
      if (inStruct || inClass) {
        out.push(line);
        continue;
      }

      // ❌ SAFETY: Skip non-statement lines
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('return') ||
          trimmed.includes('include') ||
          !inFunc) {
        out.push(line);
        continue;
      }

      // ✅ PATTERN 1: Declaration without initializer
      // int a;
      const declOnly = trimmed.match(/^\s*(int|long|float|double|char)\s+(\w+)\s*;/);
      if (declOnly) {
        const [, type, varName] = declOnly;
        out.push(line);
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 2: Declaration with initializer
      // int a = 5;
      const declInit = trimmed.match(/^\s*(int|long|float|double|char)\s+(\w+)\s*=\s*([^;]+);/);
      if (declInit) {
        const [, type, varName, value] = declInit;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 3: Multi-declaration (int x=1, y=2, z;)
      const multiDecl = trimmed.match(/^\s*(int|long|float|double|char)\s+(.+);/);
      if (multiDecl && multiDecl[2].includes(',')) {
        const [, type, rest] = multiDecl;
        const vars = rest.split(',').map(v => v.trim());
        
        for (const v of vars) {
          const withInit = v.match(/^(\w+)\s*=\s*(.+)$/);
          if (withInit) {
            const [, varName, value] = withInit;
            out.push(`${indent}${type} ${varName} = ${value};`);
            out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
            out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
          } else {
            const varName = v;
            out.push(`${indent}${type} ${varName};`);
            out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
          }
        }
        continue;
      }

      // ✅ PATTERN 4: Simple assignment
      // a = 5;
      const assign = trimmed.match(/^\s*(\w+)\s*=\s*([^;]+);/);
      if (assign && !trimmed.includes('(') && !trimmed.includes('[')) {
        const [, varName, value] = assign;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 5: Compound assignment (+=, -=, etc.)
      // a += 1;
      const compound = trimmed.match(/^\s*(\w+)\s*([+\-*/%]|<<|>>)=\s*([^;]+);/);
      if (compound) {
        const [, varName, op, value] = compound;
        out.push(`${indent}__trace_assign(${varName}, ${varName} ${op} ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 6: Increment/decrement (++i, i++, --i, i--)
      // i++;
      const inc = trimmed.match(/^\s*(\+\+|--)?(\w+)(\+\+|--)?;/);
      if (inc) {
        const varName = inc[2];
        const isPre = inc[1];
        const isPost = inc[3];
        
        if (isPre) {
          out.push(`${indent}__trace_assign(${varName}, ${varName} ${isPre === '++' ? '+' : '-'} 1, ${i + 1});`);
        }
        out.push(line);
        if (isPost) {
          out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        }
        continue;
      }

      // Default: keep line as-is
      out.push(line);
    }
    
    return out.join('\n');
  }
}

export default new CodeInstrumenter();