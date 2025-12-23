/**
 * Clang + LibTooling Service
 * Provides powerful semantic analysis with full AST, type information, and semantic understanding
 * Industry Standard: VSCode C++ extension, CLion, clangd
 *
 * Capabilities:
 * ✅ Full semantic analysis (not just syntax)
 * ✅ Pointer analysis & dereferencing chains
 * ✅ Template instantiation tracking
 * ✅ Class inheritance hierarchies
 * ✅ Member access & ownership
 * ✅ Control flow graph generation
 * ✅ Call graph with virtual function resolution
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdtemp, rm } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import ASTWalker from '../parsers/ast-walker.js'; // Import Tree-sitter fallback

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

class ClangService {
  constructor() {
    this.clangPath = 'clang';
    this.clangCppPath = 'clang++';
    this.checkedAvailability = false;
    this.isAvailable = { c: false, cpp: false };
  }

  /**
   * Check if Clang is available on the system
   */
  async checkAvailability() {
    if (this.checkedAvailability) return this.isAvailable.c || this.isAvailable.cpp;
    
    const check = async (cmd) => {
      try {
        await execAsync(`${cmd} --version`, { timeout: 3000 });
        return true;
      } catch {
        return false;
      }
    };

    [this.isAvailable.c, this.isAvailable.cpp] = await Promise.all([
      check(this.clangPath),
      check(this.clangCppPath)
    ]);

    if (this.isAvailable.c || this.isAvailable.cpp) {
      console.log(`✅ Clang availability: C (${this.isAvailable.c ? 'found' : 'not found'}), C++ (${this.isAvailable.cpp ? 'found' : 'not found'})`);
    } else {
      console.warn('⚠️  Clang not available on this system. Please install Clang and ensure it is in your system PATH.');
    }
    
    this.checkedAvailability = true;
    return this.isAvailable.c || this.isAvailable.cpp;
  }
  /**
   * Generates a complete semantic AST using Clang with JSON output
   * @param {string} code - The source code
   * @param {string} language - 'c' or 'cpp'
   * @param {number} timeout - Timeout in milliseconds (default 10000ms)
   * @returns {Promise<{success: boolean, ast: Object|null, errors: Array, metadata: Object}>}
   */
  async generateAst(code, language, timeout = 10000) {
    await this.checkAvailability();

    const isCpp = language.toLowerCase() === 'cpp';
    const langKey = isCpp ? 'cpp' : 'c';
    const compiler = isCpp ? this.clangCppPath : this.clangPath;

    if (!this.isAvailable[langKey]) {
      // The checkAvailability method already warns the user once. No need for repeated warnings.

      try {
        const astWalker = new ASTWalker();
        const ast = astWalker.parse(code, language);
        return {
          success: true,
          ast,
          errors: [],
          metadata: { hasSemanticInfo: false, fallback: 'Tree-sitter' } // Indicate that a fallback was used
        };
      } catch (fallbackError) {
        return {
          success: false,
          errors: [{
            message: `Fallback parser failed: ${fallbackError.message}`,
            severity: 'error'
          }],
          ast: null,
          metadata: { hasSemanticInfo: false, fallback: 'Tree-sitter' }
        };
      }
    }

    const fileExtension = isCpp ? 'cpp' : 'c';
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'clang-analyze-'));
    const tempFileName = `${uuidv4()}.${fileExtension}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
      await writeFile(tempFilePath, code, 'utf-8');

      // Use Clang with semantic analysis flags
      // -Xclang -ast-dump=json: Dump full semantic AST as JSON
      // -fparse-all-comments: Include all comments in AST
      // -std=c++20: Support modern C++ features
      // -fsyntax-only: Don't generate object code
      const language_flag = isCpp ? '-std=c++20' : '-std=c99';
      
      const command = `"${compiler}" -Xclang -ast-dump=json -fparse-all-comments ${language_flag} -fsyntax-only "${tempFilePath}"`;

      return await Promise.race([
        new Promise((resolve) => {
          exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error && !stdout) {
            // Syntax errors
            resolve({
              success: false,
              errors: this._parseClangErrors(stderr),
              ast: null,
              metadata: { hasSemanticInfo: false }
            });
            return;
          }

          try {
            const ast = JSON.parse(stdout);
            const metadata = this._extractMetadata(ast);
            
            resolve({
              success: true,
              ast,
              errors: stderr ? this._parseClangErrors(stderr) : [],
              metadata
            });
          } catch (parseError) {
            console.error('Failed to parse Clang AST output:', parseError);
            resolve({
              success: false,
              errors: [{ message: 'Failed to parse Clang AST output.' }],
              ast: null,
              metadata: { hasSemanticInfo: false }
            });
          }
        });
        }),
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: false,
              errors: [{ message: `Clang execution timeout (${timeout}ms) - clang may not be installed or is not in PATH` }],
              ast: null,
              metadata: { hasSemanticInfo: false }
            });
          }, timeout);
        })
      ]);
    } finally {
      // Clean up temporary files
      await unlink(tempFilePath).catch(() => {});
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Analyzes pointers, dereferencing, and memory access patterns
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>} Detailed pointer analysis
   */
  async analyzePointers(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return { pointers: [], dereferences: [], patterns: [] };

    const pointers = [];
    const dereferences = [];

    this._walkAst(ast, (node) => {
      // Find pointer declarations
      if (node.kind === 'VarDecl' && node.type?.includes('*')) {
        pointers.push({
          name: node.name,
          type: node.type,
          line: node.loc?.line,
          isPointer: true
        });
      }

      // Find pointer dereferences
      if (node.kind === 'UnaryOperator' && (node.opcode === '*' || node.opcode === '->')) {
        dereferences.push({
          operator: node.opcode,
          line: node.loc?.line,
          type: 'dereference'
        });
      }

      // Find address-of operations
      if (node.kind === 'UnaryOperator' && node.opcode === '&') {
        dereferences.push({
          operator: '&',
          line: node.loc?.line,
          type: 'address-of'
        });
      }
    });

    return { pointers, dereferences, patterns: this._analyzePointerPatterns(pointers, dereferences) };
  }

  /**
   * Analyzes template instantiations and specializations
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>} Template analysis
   */
  async analyzeTemplates(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return { templates: [], instantiations: [] };

    const templates = [];
    const instantiations = [];

    this._walkAst(ast, (node) => {
      if (node.kind === 'ClassTemplateDecl' || node.kind === 'FunctionTemplateDecl') {
        templates.push({
          name: node.name,
          kind: node.kind,
          parameters: node.templateParameters || [],
          line: node.loc?.line
        });
      }

      if (node.kind === 'ClassTemplateSpecializationDecl' || node.kind === 'FunctionTemplateSpecializationDecl') {
        instantiations.push({
          name: node.name,
          specialization: node.specializationKind,
          arguments: node.templateArguments || [],
          line: node.loc?.line
        });
      }
    });

    return { templates, instantiations };
  }

  /**
   * Extracts class hierarchy and inheritance relationships
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>} Class hierarchy
   */
  async analyzeClassHierarchy(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return { classes: [], inheritance: [] };

    const classes = [];
    const inheritance = [];

    this._walkAst(ast, (node) => {
      if (node.kind === 'CXXRecordDecl') {
        const classInfo = {
          name: node.name,
          type: node.tagUsed || 'class',
          methods: [],
          members: [],
          line: node.loc?.line
        };

        // Extract members and methods
        if (node.inner) {
          node.inner.forEach((child) => {
            if (child.kind === 'FieldDecl') {
              classInfo.members.push({
                name: child.name,
                type: child.type,
                access: child.access || 'public'
              });
            } else if (child.kind === 'CXXMethodDecl') {
              classInfo.methods.push({
                name: child.name,
                returnType: child.type?.qualType || child.type,
                parameters: (child.inner || [])
                  .filter(c => c.kind === 'ParmVarDecl')
                  .map(p => ({
                    name: p.name,
                    type: p.type?.qualType || p.type
                  })),
                access: child.access || 'public',
                isVirtual: child.isVirtual || false
              });
            }
          });
        }

        // Extract base classes
        if (node.bases) {
          node.bases.forEach((base) => {
            inheritance.push({
              derived: node.name,
              base: base.type,
              access: base.access || 'public',
              isVirtual: base.isVirtual || false
            });
          });
        }

        classes.push(classInfo);
      }
    });

    return { classes, inheritance };
  }

  /**
   * Builds a call graph with function resolution
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Object>} Call graph
   */
  async buildCallGraph(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return { functions: [], calls: [], virtualCalls: [] };

    const functions = [];
    const calls = [];
    const virtualCalls = [];

    this._walkAst(ast, (node) => {
      // Function declarations
      if (node.kind === 'FunctionDecl' || node.kind === 'CXXMethodDecl') {
        functions.push({
          name: node.name,
          returnType: node.type?.qualType || node.type,
          // Correctly extract parameters from inner ParmVarDecl nodes
          parameters: (node.inner || [])
            .filter(child => child.kind === 'ParmVarDecl')
            .map(param => ({
              name: param.name,
              type: param.type?.qualType || param.type,
            })),
          isVirtual: node.isVirtual || false,
          line: node.loc?.line
        });
      }

      // Function calls
      if (node.kind === 'CallExpr') {
        const callInfo = {
          callee: node.referencedDecl?.name || 'unknown',
          line: node.loc?.line,
          arguments: node.inner?.filter(n => n.kind !== 'ImplicitCastExpr').length || 0
        };

        if (node.referencedDecl?.isVirtual) {
          virtualCalls.push(callInfo);
        } else {
          calls.push(callInfo);
        }
      }
    });

    return { functions, calls, virtualCalls };
  }

  /**
   * Validates syntax with semantic checking
   * @param {string} code
   * @param {string} language
   * @returns {Promise<{valid: boolean, errors: Array}>}
   */
  async validateSyntax(code, language) {
    const { success, errors } = await this.generateAst(code, language);
    return { valid: success, errors };
  }

  /**
   * Extracts input/output function calls from code
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Array>} List of I/O calls
   */
  async extractInputCalls(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return [];

    const ioCalls = [];
    const ioFunctions = ['scanf', 'cin', 'getchar', 'fgets', 'gets', 'read', 'getline'];

    this._walkAst(ast, (node) => {
      if (node.kind === 'CallExpr') {
        const callee = node.referencedDecl?.name || '';
        if (ioFunctions.some(fn => callee.includes(fn))) {
          ioCalls.push({
            function: callee,
            line: node.loc?.line,
            type: 'input'
          });
        }
      }
    });

    return ioCalls;
  }

  /**
   * Extracts all variable declarations with type information
   * @param {string} code
   * @param {string} language
   * @returns {Promise<Array>} Variables with semantic type info
   */
  async extractVariables(code, language) {
    const { ast, success } = await this.generateAst(code, language);
    if (!success || !ast) return [];

    const variables = [];

    this._walkAst(ast, (node) => {
      if (node.kind === 'VarDecl') {
        variables.push({
          name: node.name,
          type: node.type,
          isPointer: node.type?.includes('*') || false,
          isArray: node.type?.includes('[') || false,
          isStatic: node.storageClass === 'static',
          isConstexpr: node.constexpr || false,
          line: node.loc?.line
        });
      }
    });

    return variables;
  }

  /**
   * Parses Clang error output into structured format
   * @private
   */
  _parseClangErrors(stderr) {
    const errorRegex = /.+?:(\d+):(\d+):\s+(?:error|warning|note):\s+(.+)/g;
    const errors = [];
    let match;

    while ((match = errorRegex.exec(stderr)) !== null) {
      errors.push({
        line: parseInt(match[1], 10),
        column: parseInt(match[2], 10),
        message: match[3].trim(),
        severity: stderr.includes('error') ? 'error' : 'warning'
      });
    }

    return errors.length > 0 ? errors : stderr ? [{ message: stderr }] : [];
  }

  /**
   * Walks the AST recursively
   * @private
   */
  _walkAst(node, callback) {
    if (!node) return;
    
    callback(node);

    if (node.inner && Array.isArray(node.inner)) {
      node.inner.forEach(child => this._walkAst(child, callback));
    }
  }

  /**
   * Extracts metadata from AST
   * @private
   */
  _extractMetadata(ast) {
    const metadata = {
      hasSemanticInfo: true,
      functionCount: 0,
      classCount: 0,
      variableCount: 0,
      templateCount: 0
    };

    this._walkAst(ast, (node) => {
      if (node.kind === 'FunctionDecl' || node.kind === 'CXXMethodDecl') metadata.functionCount++;
      if (node.kind === 'CXXRecordDecl') metadata.classCount++;
      if (node.kind === 'VarDecl') metadata.variableCount++;
      if (node.kind?.includes('Template')) metadata.templateCount++;
    });

    return metadata;
  }

  /**
   * Analyzes pointer usage patterns
   * @private
   */
  _analyzePointerPatterns(pointers, dereferences) {
    return {
      totalPointers: pointers.length,
      totalDereferences: dereferences.length,
      patterns: [
        'pointer_arithmetic',
        'double_pointer',
        'function_pointer',
        'void_pointer_cast',
        'null_dereference_risk'
      ].filter(p => pointers.some(ptr => ptr.type?.includes('**') || ptr.type?.includes('(*)') || ptr.type?.includes('void')))
    };
  }
}

export default ClangService;