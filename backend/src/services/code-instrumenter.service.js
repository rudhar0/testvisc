// backend/src/services/code-instrumenter.service.js
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import path from 'path';
import { v4 as uuid } from 'uuid';

let loopIdCounter = 0;
let blockDepthCounter = 0;

class CodeInstrumenter {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.scopeVariables = new Map();
    this.currentScope = 0;
    this.pointerAliases = new Map();
    this.blockDepth = 0;
    this.loopStack = [];
  }

  async instrumentCode(code, language = 'cpp') {
    console.log('🔧 Instrumenting code (beginner-correct mode)...');

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
    let isStringLiteral = false;

    if (hasInitializer) {
      const strMatch = varDecl.match(/=\s*"([^"]*)"/);
      if (strMatch) {
        initValues = strMatch[1];
        isStringLiteral = true;
      } else {
        const initMatch = varDecl.match(/=\s*\{([^}]*)\}/);
        if (initMatch) {
          initValues = initMatch[1];
        }
      }
    }

    return { name, type, dimensions, hasInitializer, initValues, isStringLiteral };
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

  isArrayDecay(value) {
    const trimmed = value.trim();
    if (/^\w+$/.test(trimmed)) return trimmed;
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

  isHeapAllocation(value) {
    return /\b(malloc|calloc|new)\s*[\(\[]/.test(value);
  }

  isBreakOrContinue(trimmed) {
    return /^\s*(break|continue)\s*;/.test(trimmed);
  }

  isVariableDeclaredInScope(varName, scope) {
    const key = `${scope}:${varName}`;
    return this.scopeVariables.has(key);
  }

  markVariableDeclared(varName, scope) {
    const key = `${scope}:${varName}`;
    this.scopeVariables.set(key, true);
  }

  async injectBeginnerModeTracing(code, language) {
    const lines = code.split('\n');
    const out = [];
    
    let inFunc = false;
    let braceDepth = 0;
    let inStruct = false;
    let inClass = false;
    let currentFunction = 'main';
    let scopeStack = [0];
    this.currentScope = 0;
    this.scopeVariables.clear();
    loopIdCounter = 0;
    blockDepthCounter = 0;
    this.blockDepth = 0;
    this.loopStack = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const indent = line.match(/^\s*/)[0];

      if (trimmed.match(/^\s*(struct|class)\s+\w+/)) {
        inStruct = true;
      }
      
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      const prevDepth = braceDepth;
      braceDepth += openBraces - closeBraces;
      
      if (openBraces > 0 && !inStruct && inFunc) {
        for (let b = 0; b < openBraces; b++) {
          this.currentScope++;
          scopeStack.push(this.currentScope);
          this.blockDepth++;
        }
      }
      
      if (closeBraces > 0 && !inStruct && inFunc) {
        for (let b = 0; b < closeBraces; b++) {
          scopeStack.pop();
          this.blockDepth--;
        }
      }
      
      if (braceDepth > 0 && !inStruct) {
        inFunc = true;
      }
      
      if (inStruct && braceDepth === 0 && closeBraces > 0) {
        inStruct = false;
      }

      const funcDef = trimmed.match(/^\s*(void|int|long|float|double|char|bool|auto)\s+(\w+)\s*\(/);
      if (funcDef && !inStruct) {
        currentFunction = funcDef[2];
      }

      if (inStruct || inClass) {
        out.push(line);
        continue;
      }

      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('#') ||
          !inFunc) {
        out.push(line);
        continue;
      }

      const returnStmt = trimmed.match(/^\s*return\s+([^;]+);/);
      if (returnStmt) {
        const returnValue = returnStmt[1];
        const destinationSymbol = '';
        out.push(`${indent}__trace_return(${returnValue}, "auto", "", ${i + 1});`);
        out.push(line);
        continue;
      }

      if (this.isBreakOrContinue(trimmed)) {
        const controlType = trimmed.match(/^\s*(break|continue)/)[1];
        out.push(line);
        out.push(`${indent}__trace_control_flow("${controlType}", ${i + 1});`);
        continue;
      }

      const ptrDeref = trimmed.match(/^\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDeref) {
        const [, ptrName, value] = ptrDeref;
        out.push(line);
        out.push(`${indent}__trace_pointer_deref_write(${ptrName}, ${value}, ${i + 1});`);
        continue;
      }

      const multiDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(.+);$/);
      if (multiDecl && multiDecl[2].includes(',')) {
        const [, type, rest] = multiDecl;
        const vars = this.parseMultiDeclaration(rest);
        
        for (let idx = 0; idx < vars.length; idx++) {
          const varDecl = vars[idx];
          
          if (this.isArrayDeclaration(varDecl)) {
            const arrayInfo = this.parseArrayDeclaration(type, varDecl);
            if (!arrayInfo) continue;

            const { name, dimensions, hasInitializer, initValues, isStringLiteral } = arrayInfo;
            
            const dimArgs = dimensions.slice(0, 3).join(',');
            const paddedDims = dimensions.length === 1 ? `${dimArgs},0,0` :
                              dimensions.length === 2 ? `${dimArgs},0` : dimArgs;
            
            out.push(`${indent}${type} ${varDecl};`);
            out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
            
            if (hasInitializer) {
              if (isStringLiteral) {
                out.push(`${indent}__trace_array_init_string(${name}, "${initValues}", ${i + 1});`);
              } else if (initValues) {
                const totalSize = dimensions.reduce((a, b) => a * (parseInt(b) || 1), 1);
                const initList = initValues.split(',').map(v => v.trim()).filter(Boolean);
                const paddedInit = [...initList, ...Array(totalSize - initList.length).fill('0')].join(',');
                
                out.push(`${indent}{`);
                out.push(`${indent}  int __temp_${name}[] = {${paddedInit}};`);
                out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
                out.push(`${indent}}`);
              }
            }
          } else {
            const varName = this.extractVariableName(varDecl);
            if (!varName || !/^\w+$/.test(varName)) continue;
            
            const hasInit = this.hasInitializer(varDecl);
            const currentScopeId = scopeStack[scopeStack.length - 1];
            const alreadyDeclared = this.isVariableDeclaredInScope(varName, currentScopeId);
            
            if (hasInit) {
              const initValue = this.extractInitializer(varDecl);
              if (!alreadyDeclared) {
                out.push(`${indent}${type} ${varName};`);
                out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
                this.markVariableDeclared(varName, currentScopeId);
              } else {
                out.push(`${indent}${type} ${varName};`);
              }
              out.push(`${indent}${varName} = ${initValue};`);
              out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
            } else {
              if (!alreadyDeclared) {
                out.push(`${indent}${type} ${varDecl};`);
                out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
                this.markVariableDeclared(varName, currentScopeId);
              } else {
                out.push(`${indent}${type} ${varDecl};`);
              }
            }
          }
        }
        continue;
      }

      const charArrStr = trimmed.match(/^\s*char\s+(\w+)\s*\[\s*([^\]]*)\s*\]\s*=\s*"([^"]*)"\s*;/);
      if (charArrStr) {
        const [, name, size, strValue] = charArrStr;
        const actualSize = size || (strValue.length + 1);
        
        out.push(line);
        out.push(`${indent}__trace_array_create(${name}, char, ${actualSize},0,0, ${i + 1});`);
        out.push(`${indent}__trace_array_init_string(${name}, "${strValue}", ${i + 1});`);
        continue;
      }

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

      const arrDeclInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*\[([^\]]+)\](\s*\[([^\]]+)\])?(\s*\[([^\]]+)\])?\s*=\s*\{([^}]*)\}\s*;/);
      if (arrDeclInit) {
        const [, type, name, dim1, , dim2, , dim3, initValues] = arrDeclInit;
        const dims = [dim1, dim2, dim3].filter(Boolean);
        const dimArgs = dims.slice(0, 3).join(',');
        const paddedDims = dims.length === 1 ? `${dimArgs},0,0` :
                          dims.length === 2 ? `${dimArgs},0` : dimArgs;
        
        const totalSize = dims.reduce((a, b) => a * (parseInt(b) || 1), 1);
        const initList = initValues.split(',').map(v => v.trim()).filter(Boolean);
        const paddedInit = [...initList, ...Array(totalSize - initList.length).fill('0')].join(',');
        
        out.push(line);
        out.push(`${indent}__trace_array_create(${name}, ${type}, ${paddedDims}, ${i + 1});`);
        out.push(`${indent}{`);
        out.push(`${indent}  int __temp_${name}[] = {${paddedInit}};`);
        out.push(`${indent}  __trace_array_init(${name}, __temp_${name}, ${totalSize}, ${i + 1});`);
        out.push(`${indent}}`);
        continue;
      }

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

      const declOnly = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*;/);
      if (declOnly) {
        const [, type, varName] = declOnly;
        const currentScopeId = scopeStack[scopeStack.length - 1];
        const alreadyDeclared = this.isVariableDeclaredInScope(varName, currentScopeId);
        
        out.push(line);
        if (!alreadyDeclared) {
          out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
          this.markVariableDeclared(varName, currentScopeId);
        }
        continue;
      }

      const declInit = trimmed.match(/^\s*(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (declInit) {
        const [, type, varName, value] = declInit;
        const currentScopeId = scopeStack[scopeStack.length - 1];
        const alreadyDeclared = this.isVariableDeclaredInScope(varName, currentScopeId);
        
        if (!alreadyDeclared) {
          out.push(`${indent}${type} ${varName};`);
          out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
          this.markVariableDeclared(varName, currentScopeId);
        } else {
          out.push(`${indent}${type} ${varName};`);
        }
        out.push(`${indent}${varName} = ${value};`);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      const constDecl = trimmed.match(/^\s*const\s+(int|long|float|double|char|bool)\s+(\w+)\s*=\s*([^;]+);/);
      if (constDecl) {
        const [, type, varName, value] = constDecl;
        const currentScopeId = scopeStack[scopeStack.length - 1];
        const alreadyDeclared = this.isVariableDeclaredInScope(varName, currentScopeId);
        
        if (!alreadyDeclared) {
          out.push(`${indent}const ${type} ${varName} = ${value};`);
          out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
          out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
          this.markVariableDeclared(varName, currentScopeId);
        } else {
          out.push(line);
        }
        continue;
      }

      const ptrDecl = trimmed.match(/^\s*(int|long|float|double|char|bool)\s*\*\s*(\w+)\s*=\s*([^;]+);/);
      if (ptrDecl) {
        const [, type, varName, value] = ptrDecl;
        
        const arrayName = this.isArrayDecay(value);
        const isHeap = this.isHeapAllocation(value);
        
        out.push(`${indent}${type} *${varName};`);
        out.push(`${indent}__trace_declare(${varName}, ${type}*, ${i + 1});`);
        out.push(`${indent}${varName} = ${value};`);
        out.push(`${indent}__trace_assign(${varName}, (long long)${varName}, ${i + 1});`);
        
        if (arrayName) {
          out.push(`${indent}__trace_pointer_alias(${varName}, ${arrayName}, true, ${i + 1});`);
        } else if (isHeap) {
          out.push(`${indent}__trace_pointer_heap_init(${varName}, ${varName}, ${i + 1});`);
        } else {
          const addrMatch = value.match(/&(\w+)/);
          if (addrMatch) {
            out.push(`${indent}__trace_pointer_alias(${varName}, ${addrMatch[1]}, false, ${i + 1});`);
          }
        }
        continue;
      }

      const memberAssign = trimmed.match(/^\s*(\w+)\.(\w+)\s*=\s*([^;]+);/);
      if (memberAssign) {
        const [, structName, memberName, value] = memberAssign;
        out.push(line);
        out.push(`${indent}__trace_assign(${structName}_${memberName}, ${value}, ${i + 1});`);
        continue;
      }

      const assign = trimmed.match(/^\s*(\w+)\s*=\s*([^;]+);/);
      if (assign && !trimmed.includes('(') && !trimmed.includes('[') && !trimmed.includes('.')) {
        const [, varName, value] = assign;
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${value}, ${i + 1});`);
        continue;
      }

      const compound = trimmed.match(/^\s*(\w+)\s*([+\-*/%]|<<|>>)=\s*([^;]+);/);
      if (compound) {
        const [, varName, op, value] = compound;
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      const inc = trimmed.match(/^\s*(\+\+|--)?(\w+)(\+\+|--)?;/);
      if (inc) {
        const varName = inc[2];
        out.push(line);
        out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        continue;
      }

      const forLoop = trimmed.match(/^\s*for\s*\(\s*(int|long)\s+(\w+)\s*=\s*([^;]+);([^;]+);([^)]+)\)/);
      if (forLoop) {
        const [, type, varName, initValue, condition, increment] = forLoop;
        const currentScopeId = scopeStack[scopeStack.length - 1];
        const alreadyDeclared = this.isVariableDeclaredInScope(varName, currentScopeId);
        const loopId = loopIdCounter++;
        this.loopStack.push(loopId);
        
        if (!alreadyDeclared) {
          out.push(`${indent}${type} ${varName};`);
          out.push(`${indent}__trace_declare(${varName}, ${type}, ${i + 1});`);
          this.markVariableDeclared(varName, currentScopeId);
          out.push(`${indent}${varName} = ${initValue};`);
          out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        } else {
          out.push(`${indent}${varName} = ${initValue};`);
          out.push(`${indent}__trace_assign(${varName}, ${varName}, ${i + 1});`);
        }
        out.push(`${indent}__trace_loop_start(${loopId}, "for", ${i + 1});`);
        out.push(`${indent}for (; ${condition}; ) {`);
        out.push(`${indent}  __trace_loop_condition(${loopId}, (${condition}) ? 1 : 0, ${i + 1});`);
        out.push(`${indent}  if (!(${condition})) { __trace_loop_end(${loopId}, ${i + 1}); break; }`);
        out.push(`${indent}  __trace_loop_body_start(${loopId}, ${i + 1});`);
        out.push(`${indent}  {`);
        
        let j = i + 1;
        let loopBraceDepth = 1;
        const loopBody = [];
        
        while (j < lines.length && loopBraceDepth > 0) {
          const bodyLine = lines[j];
          const bodyTrimmed = bodyLine.trim();
          
          if (bodyTrimmed.includes('{')) loopBraceDepth++;
          if (bodyTrimmed.includes('}')) loopBraceDepth--;
          
          if (loopBraceDepth > 0) {
            loopBody.push(bodyLine);
          }
          j++;
        }
        
        out.push(...loopBody);
        out.push(`${indent}  }`);
        out.push(`${indent}  ${increment};`);
        out.push(`${indent}  __trace_assign(${varName}, ${varName}, ${i + 1});`);
        out.push(`${indent}  __trace_loop_iteration_end(${loopId}, ${i + 1});`);
        out.push(`${indent}}`);
        
        this.loopStack.pop();
        i = j - 1;
        continue;
      }

      const whileLoop = trimmed.match(/^\s*while\s*\(([^)]+)\)/);
      if (whileLoop) {
        const [, condition] = whileLoop;
        const loopId = loopIdCounter++;
        this.loopStack.push(loopId);
        out.push(`${indent}__trace_loop_start(${loopId}, "while", ${i + 1});`);
        out.push(`${indent}while (1) {`);
        out.push(`${indent}  __trace_loop_condition(${loopId}, (${condition}) ? 1 : 0, ${i + 1});`);
        out.push(`${indent}  if (!(${condition})) { __trace_loop_end(${loopId}, ${i + 1}); break; }`);
        out.push(`${indent}  __trace_loop_body_start(${loopId}, ${i + 1});`);
        continue;
      }

      const doWhile = trimmed.match(/^\s*do\s*\{?$/);
      if (doWhile) {
        const loopId = loopIdCounter++;
        this.loopStack.push(loopId);
        out.push(`${indent}__trace_loop_start(${loopId}, "do-while", ${i + 1});`);
        out.push(`${indent}do {`);
        out.push(`${indent}  __trace_loop_body_start(${loopId}, ${i + 1});`);
        continue;
      }

      const whileEnd = trimmed.match(/^\s*}\s*while\s*\(([^)]+)\)\s*;/);
      if (whileEnd) {
        const [, condition] = whileEnd;
        const loopId = this.loopStack[this.loopStack.length - 1] || 0;
        out.push(`${indent}  __trace_loop_iteration_end(${loopId}, ${i + 1});`);
        out.push(`${indent}  __trace_loop_condition(${loopId}, (${condition}) ? 1 : 0, ${i + 1});`);
        out.push(`${indent}} while (${condition});`);
        out.push(`${indent}__trace_loop_end(${loopId}, ${i + 1});`);
        this.loopStack.pop();
        continue;
      }

      if (trimmed === '}' && this.loopStack.length > 0) {
        const loopId = this.loopStack[this.loopStack.length - 1];
        out.push(`${indent}  __trace_loop_iteration_end(${loopId}, ${i + 1});`);
        out.push(line);
        this.loopStack.pop();
        continue;
      }

      out.push(line);
    }
    
    return out.join('\n');
  }
}

export default new CodeInstrumenter();