// src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

/**
 * ✅ ENHANCED: Complete array support alongside existing scalar behavior
 * Arrays emit native array events, scalars remain unchanged
 */
class CodeInstrumenter {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  async instrumentCode(code, language = 'cpp') {
    console.log('🔧 Instrumenting code (scalars + arrays)...');

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

  // ✅ NEW: Detect if declaration is an array
  isArrayDeclaration(varDecl) {
    return /\[/.test(varDecl);
  }

  // ✅ NEW: Parse array declaration
  parseArrayDeclaration(type, varDecl) {
    // Examples: arr[3], mat[2][3], cube[2][3][4]
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

  async injectBeginnerModeTracing(code, language) {
    const lines = code.split('\n');
    const out = [];
    
    let inFunc = false;
    let braceDepth = 0;
    let inStruct = false;
    let inClass = false;
    let currentFunction = null;
    let functionParams = new Map(); // Track function parameters
    
    // ✅ NEW: Track pointer→array mappings for index resolution
    const pointerToArray = new Map();
    
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
      
      // ✅ NEW: Track function entries and detect array parameters
      const funcDecl = trimmed.match(/^\s*(?:void|int|float|double|char|bool|long)\s+(\w+)\s*\(([^)]*)\)\s*({)?/);
      if (funcDecl && braceDepth === 0) {
        currentFunction = funcDecl[1];
        const params = funcDecl[2];
        const hasOpenBrace = funcDecl[3] === '{';
        
        // Parse parameters to find array parameters
        const arrayParams = [];
        if (params.trim()) {
          const paramList = params.split(',').map(p => p.trim());
          paramList.forEach(param => {
            // Detect array parameter: int arr[], int arr[N], int *arr
            const arrMatch = param.match(/(?:int|long|float|double|char|bool)\s*(?:\*|(\w+)\s*\[)/);
            if (arrMatch) {
              const nameMatch = param.match(/(\w+)(?:\s*\[|\s*$)/);
              if (nameMatch) {
                arrayParams.push(nameMatch[1]);
              }
            }
          });
        }
        
        functionParams.set(currentFunction, arrayParams);
        
        // If function has array params and opening brace on same line, inject traces
        if (hasOpenBrace && arrayParams.length > 0 && currentFunction !== 'main') {
          out.push(line);
          // We'll inject array_reference at call sites, not here
          continue;
        }
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

      // ✅ PATTERN: Multi-declaration
      const multiDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(.+);$/);
      if (multiDecl && multiDecl[2].includes(',')) {
        const [, type, rest] = multiDecl;
        const vars = this.parseMultiDeclaration(rest);
        
        for (let idx = 0; idx < vars.length; idx++) {
          const varDecl = vars[idx];
          
          // ✅ NEW: Check if it's an array
          if (this.isArrayDeclaration(varDecl)) {
            const arrayInfo = this.parseArrayDeclaration(type, varDecl);
            if (!arrayInfo) continue;

            const { name, dimensions, hasInitializer, initValues } = arrayInfo;
            
            // Emit array_create
            const dimArgs = dimensions.slice(0, 3).join(',');
            const paddedDims = dimensions.length === 1 ? `${dimArgs},0,0` :
                              dimensions.length === 2 ? `${dimArgs},0` : dimArgs;
            
            out.push(`${indent}${type} ${varDecl};`);
            out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
            
            // Emit array_init if has initializer
            if (hasInitializer && initValues) {
              const totalSize = dimensions.reduce((a, b) => a * (parseInt(b) || 1), 1);
              out.push(`${indent}{`);
              out.push(`${indent}  int __temp_${name}[] = {${initValues}};`);
              out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
              out.push(`${indent}}`);
            }
          } else {
            // ✅ EXISTING: Regular scalar variable
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

      // ✅ PATTERN: Single array declaration (int arr[3];)
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

      // ✅ PATTERN: Array with initializer (int arr[3] = {1,2,3};)
      const arrDeclInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*\[([^\]]+)\](\s*\[([^\]]+)\])?(\s*\[([^\]]+)\])?\s*=\s*\{([^}]*)\}\s*;/);
      if (arrDeclInit) {
        const [, type, name, dim1, , dim2, , dim3, initValues] = arrDeclInit;
        const dims = [dim1, dim2, dim3].filter(Boolean);
        const dimArgs = dims.slice(0, 3).join(',');
        const paddedDims = dims.length === 1 ? `${dimArgs},0,0` :
                          dims.length === 2 ? `${dimArgs},0` : dimArgs;
        const totalSize = dims.reduce((a, b) => a * (parseInt(b) || 1), 1);
        
        out.push(line);
        out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
        out.push(`${indent}{`);
        out.push(`${indent}  int __temp_${name}[] = {${initValues}};`);
        out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
        out.push(`${indent}}`);
        continue;
      }

      // ✅ PATTERN: Array element assignment (arr[0] = 10;)
      const arrAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arrAssign) {
        const [, varName, index, value] = arrAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_1d(${varName}, ${index}, ${value}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN: 2D array element assignment (mat[0][1] = 20;)
      const arr2DAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arr2DAssign) {
        const [, varName, idx1, idx2, value] = arr2DAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_2d(${varName}, ${idx1}, ${idx2}, ${value}, ${i + 1});`);
        continue;
      }

      // ✅ PATTERN: 3D array element assignment (cube[0][1][2] = 30;)
      const arr3DAssign = trimmed.match(/^\s*(\w+)\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*\[\s*([^\]]+)\s*\]\s*=\s*([^;]+);/);
      if (arr3DAssign) {
        const [, varName, idx1, idx2, idx3, value] = arr3DAssign;
        out.push(line);
        out.push(`${indent}__trace_array_index_assign_3d(${varName}, ${idx1}, ${idx2}, ${idx3}, ${value}, ${i + 1});`);
        continue;
      }

      // ✅ EXISTING PATTERNS: All scalar patterns remain unchanged
      const declOnly = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*;/);
      if (declOnly) {
        const [, type, varName] = declOnly;
        out.push(line);
        out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
        continue;
      }

      // ✅ NEW: Detect function calls with array arguments
      const funcCall = trimmed.match(/^\s*(\w+)\s*\(([^)]+)\)\s*;/);
      if (funcCall && currentFunction) {
        const [, calledFunc, args] = funcCall;
        
        // Check if called function has array parameters
        const targetParams = functionParams.get(calledFunc);
        
        if (targetParams && targetParams.length > 0) {
          // Parse arguments
          const argList = args.split(',').map(a => a.trim());
          
          // Emit array_reference for each array argument
          argList.forEach((arg, idx) => {
            if (idx < targetParams.length && /^\w+$/.test(arg)) {
              const paramName = targetParams[idx];
              // Emit: array_reference(fromVar=paramName, toArray=arg, from=current, to=calledFunc)
              out.push(`${indent}__trace_array_reference(${paramName}, ${arg}, "${currentFunction}", "${calledFunc}", ${i + 1});`);
            }
          });
        }
        
        out.push(line);
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

      const ptrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDecl) {
        const [, type, varName, value] = ptrDecl;
        out.push(`${indent}__trace_declare(${varName}, ${type}*, ${i + 1});`);
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, (long long)${varName}, ${i + 1});`);
        
        // ✅ NEW: If assigning an array, emit mapping
        const arrayName = value.trim().replace(/&/g, '');
        if (/^\w+$/.test(arrayName)) {
          out.push(`${indent}__trace_pointer_maps_array(${varName}, ${arrayName}, ${i + 1});`);
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