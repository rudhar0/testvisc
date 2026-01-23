// src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * Complete code instrumenter with:
 * - Proper array initialization (zero-padding)
 * - Array-to-pointer decay detection
 * - Minimal step generation (one line → one step max)
 * - No spurious heap events
 */
class CodeInstrumenter {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  async instrumentCode(code, language = 'cpp') {
    console.log('🔧 Instrumenting code...');

    try {
      const withHeader = this.addTraceHeader(code);
      const traced = await this.injectBeginnerModeTracing(withHeader, language);
      console.log('✅ Code instrumentation complete');
      return traced;
    } catch (error) {
      console.error('⚠️ Instrumentation failed, using original code:', error.message);
      return code;
    }
  }

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

  isArrayDeclaration(varDecl) {
    return /\[/.test(varDecl);
  }

  parseArrayDeclaration(type, varDecl) {
    const nameMatch = varDecl.match(/^(\w+)/);
    if (!nameMatch) return null;

    const name = nameMatch[1];
    const dimensionsMatch = varDecl.match(/\[([^\]]*)\]/g);
    if (!dimensionsMatch) return null;

    const dimensions = dimensionsMatch.map(d => {
      const sizeMatch = d.match(/\[([^\]]*)\]/);
      return sizeMatch && sizeMatch[1] ? sizeMatch[1] : '0';
    });

    const hasInitializer = varDecl.includes('=');
    let initValues = null;

    if (hasInitializer) {
      const initMatch = varDecl.match(/=\s*\{([^}]*)\}/);
      if (initMatch) {
        initValues = initMatch[1];
      }
    }

    return { name, type, dimensions, hasInitializer, initValues };
  }

  parseMultiDeclaration(rest) {
    const vars = [];
    let current = '';
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    
    for (let c of rest) {
      if (c === '(') parenDepth++;
      else if (c === ')') parenDepth--;
      else if (c === '{') braceDepth++;
      else if (c === '}') braceDepth--;
      else if (c === '[') bracketDepth++;
      else if (c === ']') bracketDepth--;
      
      if (c === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
        const trimmed = current.trim();
        if (trimmed) vars.push(trimmed);
        current = '';
      } else {
        current += c;
      }
    }
    
    const trimmed = current.trim();
    if (trimmed) vars.push(trimmed);
    return vars;
  }

  extractVariableName(varDecl) {
    let cleaned = varDecl.replace(/\s*=\s*\{[^}]*\}/g, '');
    cleaned = cleaned.replace(/\s*=.*$/, '');
    cleaned = cleaned.replace(/^\s*\*+\s*/, '');
    const match = cleaned.match(/^(\w+)/);
    return match ? match[1] : null;
  }

  hasInitializer(varDecl) {
    return varDecl.includes('=');
  }

  extractInitializer(varDecl) {
    const match = varDecl.match(/=\s*(.+)$/);
    return match ? match[1].trim() : null;
  }

  // Detect if pointer is assigned from array (decay)
  isArrayDecay(value) {
    const trimmed = value.trim();
    // Cases: arr, &arr[0], (arr), etc.
    if (/^\w+$/.test(trimmed)) return trimmed; // Plain identifier
    if (/^&\w+\[0\]$/.test(trimmed)) {
      const match = trimmed.match(/^&(\w+)\[0\]$/);
      return match ? match[1] : null;
    }
    if (/^\(\w+\)$/.test(trimmed)) {
      const match = trimmed.match(/^\((\w+)\)$/);
      return match ? match[1] : null;
    }
    return null;
  }

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

      if (trimmed.match(/^\s*(struct|class)\s+\w+/)) {
        inStruct = true;
      }
      
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      braceDepth += openBraces - closeBraces;
      
      if (braceDepth > 0 && !inStruct) {
        inFunc = true;
      }
      
      if (inStruct && braceDepth === 0 && closeBraces > 0) {
        inStruct = false;
      }

      if (inStruct || inClass) {
        out.push(line);
        continue;
      }

      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('return') ||
          trimmed.includes('include') ||
          !inFunc) {
        out.push(line);
        continue;
      }

      // Multi-declaration
      const multiDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(.+);$/);
      if (multiDecl && multiDecl[2].includes(',')) {
        const [, type, rest] = multiDecl;
        const vars = this.parseMultiDeclaration(rest);
        
        for (let idx = 0; idx < vars.length; idx++) {
          const varDecl = vars[idx];
          
          if (this.isArrayDeclaration(varDecl)) {
            const arrayInfo = this.parseArrayDeclaration(type, varDecl);
            if (!arrayInfo) continue;

            const { name, dimensions, hasInitializer, initValues } = arrayInfo;
            
            const dimArgs = dimensions.slice(0, 3).join(',');
            const paddedDims = dimensions.length === 1 ? `${dimArgs},0,0` :
                              dimensions.length === 2 ? `${dimArgs},0` : dimArgs;
            
            out.push(`${indent}${type} ${varDecl};`);
            out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
            
            if (hasInitializer && initValues) {
              const totalSize = dimensions.reduce((a, b) => a * (parseInt(b) || 1), 1);
              const initList = initValues.split(',').map(v => v.trim()).filter(Boolean);
              // Zero-pad partial initialization
              const paddedInit = [...initList, ...Array(totalSize - initList.length).fill('0')].join(',');
              
              out.push(`${indent}{`);
              out.push(`${indent}  int __temp_${name}[] = {${paddedInit}};`);
              out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
              out.push(`${indent}}`);
            }
          } else {
            const varName = this.extractVariableName(varDecl);
            if (!varName || !/^\w+$/.test(varName)) continue;
            
            const hasInit = this.hasInitializer(varDecl);
            
            if (hasInit) {
              const initValue = this.extractInitializer(varDecl);
              out.push(`${indent}${type} ${varName};`);
              out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
              out.push(`${indent}${varName} = ${initValue};`);
              out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
            } else {
              out.push(`${indent}${type} ${varDecl};`);
              out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
            }
          }
        }
        continue;
      }

      // Single array declaration
      const arrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*\[([^\]]+)\](\s*\[([^\]]+)\])?(\s*\[([^\]]+)\])?\s*;/);
      if (arrDecl) {
        const [, type, name, dim1, , dim2, , dim3] = arrDecl;
        const dims = [dim1, dim2, dim3].filter(Boolean);
        const dimArgs = dims.slice(0, 3).join(',');
        const paddedDims = dims.length === 1 ? `${dimArgs},0,0` :
                          dims.length === 2 ? `${dimArgs},0` : dimArgs;
        
        out.push(line);
        out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
        continue;
      }

      // Array with initializer - zero-pad partial init
      const arrDeclInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*\[([^\]]+)\](\s*\[([^\]]+)\])?(\s*\[([^\]]+)\])?\s*=\s*\{([^}]*)\}\s*;/);
      if (arrDeclInit) {
        const [, type, name, dim1, , dim2, , dim3, initValues] = arrDeclInit;
        const dims = [dim1, dim2, dim3].filter(Boolean);
        const dimArgs = dims.slice(0, 3).join(',');
        const paddedDims = dims.length === 1 ? `${dimArgs},0,0` :
                          dims.length === 2 ? `${dimArgs},0` : dimArgs;
        
        const totalSize = dims.reduce((a, b) => a * (parseInt(b) || 1), 1);
        const initList = initValues.split(',').map(v => v.trim()).filter(Boolean);
        // Zero-pad
        const paddedInit = [...initList, ...Array(totalSize - initList.length).fill('0')].join(',');
        
        out.push(line);
        out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
        out.push(`${indent}{`);
        out.push(`${indent}  int __temp_${name}[] = {${paddedInit}};`);
        out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
        out.push(`${indent}}`);
        continue;
      }

      // Array element assignment
      const arrAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arrAssign) {
        const [, varName, index, value] = arrAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_1d(${varName}, ${index}, ${value}, ${i + 1});`);
        continue;
      }

      const arr2DAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arr2DAssign) {
        const [, varName, idx1, idx2, value] = arr2DAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_2d(${varName}, ${idx1}, ${idx2}, ${value}, ${i + 1});`);
        continue;
      }

      const arr3DAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arr3DAssign) {
        const [, varName, idx1, idx2, idx3, value] = arr3DAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_3d(${varName}, ${idx1}, ${idx2}, ${idx3}, ${value}, ${i + 1});`);
        continue;
      }

      // Scalar declarations
      const declOnly = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*;/);
      if (declOnly) {
        const [, type, varName] = declOnly;
        out.push(line);
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        continue;
      }

      const declInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (declInit) {
        const [, type, varName, value] = declInit;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      const constDecl = trimmed.match(/^\s*const\s+(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (constDecl) {
        const [, type, varName, value] = constDecl;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      // Pointer declaration - detect array decay
      const ptrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDecl) {
        const [, type, varName, value] = ptrDecl;
        
        const arrayName = this.isArrayDecay(value);
        
        out.push(`${indent}__trace_declare(${varName}, ${type}*, ${i + 1});`);
        out.push(line);
        
        if (arrayName) {
          // Array decay detected
          out.push(`${indent}__trace_pointer_alias(${varName}, ${arrayName}, true, ${i + 1});`);
        } else {
          // Regular pointer
          out.push(`${indent}__trace_assign(${varName}, (long long)${varName}, ${i + 1});`);
        }
        continue;
      }

      const ptrDeref = trimmed.match(/^\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDeref) {
        const [, varName, value] = ptrDeref;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      const memberAssign = trimmed.match(/^\s*(\w+)\.(\w+)\s*=\s*([^;]+);/);
      if (memberAssign) {
        const [, structName, memberName, value] = memberAssign;
        out.push(`${indent}__trace_assign(${structName}_${memberName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      const assign = trimmed.match(/^\s*(\w+)\s*=\s*([^;]+);/);
      if (assign && !trimmed.includes('(') && !trimmed.includes('[') && !trimmed.includes('.')) {
        const [, varName, value] = assign;
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

      const compound = trimmed.match(/^\s*(\w+)\s*([+\-*/%]|<<|>>)=\s*([^;]+);/);
      if (compound) {
        const [, varName, op, value] = compound;
        out.push(`${indent}__trace_assign(${varName}, ${varName} ${op} ${value}, ${i + 1});`);
        out.push(line);
        continue;
      }

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

      const forLoop = trimmed.match(/^\s*for\s*\(\s*(int|long)\s+(\w+)\s*=\s*([^;]+);/);
      if (forLoop) {
        const [, type, varName, initValue] = forLoop;
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        out.push(line);
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

      out.push(line);
    }
    
    return out.join('\n');
  }
}

export default new CodeInstrumenter();