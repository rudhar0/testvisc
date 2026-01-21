// src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * AST-Based Code Instrumenter with COMPLETE BEGINNER MODE
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
   * ✅ COMPLETE: Beginner-mode instrumentation
   * Creates EXPLICIT steps for ALL declarations and assignments
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

      // ✅ PATTERN 1: Declaration without initializer (int a;)
      const declOnly = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*;/);
      if (declOnly) {
        const [, type, varName] = declOnly;
        out.push(line);
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 2: Declaration with initializer (int a = 5;)
      const declInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (declInit) {
        const [, type, varName, value] = declInit;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 3: Const declaration (const int c = 7;)
      const constDecl = trimmed.match(/^\s*const\s+(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (constDecl) {
        const [, type, varName, value] = constDecl;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 4: Multi-declaration (int x=1, y=2, z;)
      const multiDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(.+);$/);
      if (multiDecl && multiDecl[2].includes(',')) {
        const [, type, rest] = multiDecl;
        
        console.log(`[Instrumenter] Line ${i + 1}: Multi-declaration detected`);
        console.log(`[Instrumenter] Type: "${type}", Rest: "${rest}"`);
        
        // Split by comma, but be careful with nested expressions
        const vars = [];
        let current = '';
        let parenDepth = 0;
        
        for (let c of rest) {
          if (c === '(') parenDepth++;
          else if (c === ')') parenDepth--;
          
          if (c === ',' && parenDepth === 0) {
            vars.push(current.trim());
            current = '';
          } else {
            current += c;
          }
        }
        if (current.trim()) {
          vars.push(current.trim());
        }
        
        console.log(`[Instrumenter] Found ${vars.length} variables:`, JSON.stringify(vars));
        
        for (let idx = 0; idx < vars.length; idx++) {
          const v = vars[idx];
          const withInit = v.match(/^(\w+)\s*=\s*(.+)$/);
          
          if (withInit) {
            const [, varName, value] = withInit;
            console.log(`  [${idx}] "${varName}" = "${value}" (initialized)`);
            // Declare
            out.push(`${indent}${type} ${varName};`);
            out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
            // Initialize
            out.push(`${indent}${varName} = ${value};`);
            out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
          } else {
            const varName = v.trim();
            if (varName && /^\w+$/.test(varName)) {
              console.log(`  [${idx}] "${varName}" (uninitialized)`);
              // Declare only (no init)
              out.push(`${indent}${type} ${varName};`);
              out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
            } else {
              console.warn(`  [${idx}] SKIPPED invalid variable name: "${varName}"`);
            }
          }
        }
        continue;
      }

      // ✅ PATTERN 5: Pointer declaration (int *p = &a;)
      const ptrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDecl) {
        const [, type, varName, value] = ptrDecl;
        out.push(`${indent}__trace_declare(${varName}, ${type}*, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, (long long)${varName}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 6: Array declaration (int arr[3];)
      const arrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*\[(\d+)\]\s*;/);
      if (arrDecl) {
        const [, type, varName, size] = arrDecl;
        out.push(line);
        out.push(`${indent}__trace_declare(${varName}, ${type}[${size}], ${i + 1});`);
        continue;
      }

      // ✅ PATTERN 7: Array element assignment (arr[0] = 10;)
      const arrAssign = trimmed.match(/^\s*(\w+)\s*\[\s*(\d+)\s*\]\s*=\s*([^;]+);/);
      if (arrAssign) {
        const [, varName, index, value] = arrAssign;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 8: Pointer dereference (*p = 15;)
      const ptrDeref = trimmed.match(/^\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDeref) {
        const [, varName, value] = ptrDeref;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 9: Struct member assignment (pt.x = 3;)
      const memberAssign = trimmed.match(/^\s*(\w+)\.(\w+)\s*=\s*([^;]+);/);
      if (memberAssign) {
        const [, structName, memberName, value] = memberAssign;
        out.push(`${indent}__trace_assign(${structName}_${memberName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 10: Simple assignment (a = 5;)
      const assign = trimmed.match(/^\s*(\w+)\s*=\s*([^;]+);/);
      if (assign && !trimmed.includes('(') && !trimmed.includes('[') && !trimmed.includes('.')) {
        const [, varName, value] = assign;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      // ✅ PATTERN 11: Compound assignment (b = b + 2; or b += 2;)
      const compound = trimmed.match(/^\s*(\w+)\s*([+\-*/%]|<<|>>)?=\s*([^;]+);/);
      if (compound) {
        const [, varName, op, value] = compound;
        if (op) {
          out.push(`${indent}__trace_assign(${varName}, ${varName} ${op} ${value}, ${i + 1});`);
        } else {
          out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        }
        out.push(line);
        continue;
      }

      // ✅ PATTERN 12: Increment/decrement (i++, ++i, i--, --i)
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

      // ✅ PATTERN 13: For-loop with initialization (for (int i = 0; ...))
      const forLoop = trimmed.match(/^\s*for\s*\(\s*(int|long)\s+(\w+)\s*=\s*([^;]+);/);
      if (forLoop) {
        const [, type, varName, initValue] = forLoop;
        // Insert declaration trace before the for statement
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        // Find the opening brace and insert assignment trace
        if (trimmed.includes('{')) {
          const braceIdx = line.indexOf('{');
          const before = line.substring(0, braceIdx + 1);
          const after = line.substring(braceIdx + 1);
          out[out.length - 1] = before;
          out.push(`${indent}    __trace_assign(${varName}, ${varName}, ${i + 1});`);
          if (after.trim()) {
            out.push(`${indent}${after}`);
          }
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