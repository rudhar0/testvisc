import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

class ClangAnalyzer {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
  }

  /**
   * Analyzes C++ code using Clang AST dump
   * Extracts classes, constructors, destructors, and variables
   */
  async analyzeCode(code, language = 'cpp') {
    console.log('🔍 Starting Clang semantic analysis...');
    
    if (!existsSync(this.tempDir)) {
      await mkdir(this.tempDir, { recursive: true });
    }

    const tempFile = path.join(this.tempDir, `analyze_${Date.now()}.${language}`);
    
    try {
      await writeFile(tempFile, code, 'utf-8');
      
      // Get AST with full type information
      const ast = await this.getAST(tempFile, language);
      
      // Extract semantic information
      const analysis = {
        classes: this.extractClasses(ast),
        constructors: this.extractConstructors(ast),
        destructors: this.extractDestructors(ast),
        variables: this.extractVariables(ast),
        functions: this.extractFunctions(ast),
        sourceLines: code.split('\n')
      };
      
      console.log('✅ Clang analysis complete:', {
        classes: analysis.classes.length,
        constructors: analysis.constructors.length,
        destructors: analysis.destructors.length,
        variables: analysis.variables.length
      });
      
      await unlink(tempFile);
      return analysis;
      
    } catch (error) {
      console.error('❌ Clang analysis failed:', error);
      try {
        await unlink(tempFile);
      } catch (e) {}
      throw error;
    }
  }

  async getAST(filePath, language) {
    return new Promise((resolve, reject) => {
      const compiler = language === 'cpp' || language === 'c++' ? 'clang++' : 'clang';
      const args = [
        '-Xclang', '-ast-dump',
        '-fsyntax-only',
        '-fno-color-diagnostics',
        '-std=c++17',
        filePath
      ];

      const proc = spawn(compiler, args);

      let output = '';
      let errorOutput = '';
      
      proc.stdout.on('data', (data) => output += data.toString());
      proc.stderr.on('data', (data) => errorOutput += data.toString());
      
      proc.on('close', (code) => {
        // Clang writes AST to stderr, not stdout
        const astOutput = errorOutput || output;
        
        if (astOutput.length > 0) {
          resolve(astOutput);
        } else {
          reject(new Error(`Clang analysis failed with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn clang: ${err.message}`));
      });
    });
  }

  extractClasses(ast) {
    const classes = [];
    // Match: CXXRecordDecl ... line:5:7 class ClassName definition
    const classRegex = /CXXRecordDecl[^\n]*?line:(\d+):\d+\s+(?:referenced\s+)?(?:class|struct)\s+(\w+)\s+definition/gm;
    let match;

    while ((match = classRegex.exec(ast)) !== null) {
      const [_, line, className] = match;
      
      // Extract members for this class
      const members = this.extractClassMembers(ast, className);
      
      classes.push({
        name: className,
        line: parseInt(line),
        members,
        hasConstructor: members.some(m => m.isConstructor),
        hasDestructor: members.some(m => m.isDestructor)
      });
    }

    return classes;
  }

  extractClassMembers(ast, className) {
    const members = [];
    
    // Find the class definition block
    const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const classBlockRegex = new RegExp(
      `(?:class|struct) ${escapedClassName} definition[\\s\\S]*?(?=CXXRecordDecl.*?definition|FunctionDecl.*?line:\\d+|$)`,
      'i'
    );
    const classBlockMatch = ast.match(classBlockRegex);
    
    if (!classBlockMatch) return members;
    const classBlock = classBlockMatch[0];
    
    // Extract member variables
    const fieldRegex = /FieldDecl[^\n]*?line:(\d+):\d+\s+(\w+)\s+'([^']+)'/g;
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(classBlock)) !== null) {
      members.push({
        name: fieldMatch[2],
        type: fieldMatch[3],
        line: parseInt(fieldMatch[1]),
        isField: true
      });
    }
    
    // Extract constructors
    const ctorRegex = new RegExp(`CXXConstructorDecl[^\\n]*?line:(\\d+):\\d+\\s+${escapedClassName}`, 'g');
    let ctorMatch;
    
    while ((ctorMatch = ctorRegex.exec(classBlock)) !== null) {
      members.push({
        name: className,
        line: parseInt(ctorMatch[1]),
        isConstructor: true,
        type: 'constructor'
      });
    }
    
    // Extract destructor
    const dtorRegex = new RegExp(`CXXDestructorDecl[^\\n]*?line:(\\d+):\\d+\\s+~${escapedClassName}`, 'g');
    const dtorMatch = dtorRegex.exec(classBlock);
    
    if (dtorMatch) {
      members.push({
        name: `~${className}`,
        line: parseInt(dtorMatch[1]),
        isDestructor: true,
        type: 'destructor'
      });
    }
    
    // Extract methods
    const methodRegex = /CXXMethodDecl[^\n]*?line:(\d+):\d+\s+(\w+)\s+'([^']+)'/g;
    let methodMatch;
    
    while ((methodMatch = methodRegex.exec(classBlock)) !== null) {
      const methodName = methodMatch[2];
      
      // Skip if it's a constructor or destructor (already added)
      if (methodName === className || methodName === `~${className}`) continue;
      
      members.push({
        name: methodName,
        type: methodMatch[3],
        line: parseInt(methodMatch[1]),
        isMethod: true
      });
    }
    
    return members;
  }

  extractConstructors(ast) {
    const constructors = [];
    const ctorRegex = /CXXConstructorDecl[^\n]*?line:(\d+):\d+\s+(\w+)/g;
    let match;

    while ((match = ctorRegex.exec(ast)) !== null) {
      constructors.push({
        className: match[2],
        line: parseInt(match[1])
      });
    }

    return constructors;
  }

  extractDestructors(ast) {
    const destructors = [];
    const dtorRegex = /CXXDestructorDecl[^\n]*?line:(\d+):\d+\s+~(\w+)/g;
    let match;

    while ((match = dtorRegex.exec(ast)) !== null) {
      destructors.push({
        className: match[2],
        line: parseInt(match[1])
      });
    }

    return destructors;
  }

  extractVariables(ast) {
    const variables = [];
    // Match: VarDecl ... line:11:5 varName 'type'
    const varRegex = /VarDecl[^\n]*?line:(\d+):\d+\s+(?:used\s+)?(?:referenced\s+)?(\w+)\s+'([^']+)'/g;
    let match;

    while ((match = varRegex.exec(ast)) !== null) {
      const [_, line, name, type] = match;
      
      variables.push({
        name,
        type,
        line: parseInt(line),
        isClass: this.isClassType(type),
        className: this.extractClassNameFromType(type)
      });
    }

    return variables;
  }

  extractFunctions(ast) {
    const functions = [];
    const funcRegex = /FunctionDecl[^\n]*?line:(\d+):\d+\s+(?:parent\s+\w+\s+)?(\w+)\s+'([^']+)'/g;
    let match;

    while ((match = funcRegex.exec(ast)) !== null) {
      const funcName = match[2];
      
      // Skip main, we handle it separately
      if (funcName === 'main') continue;
      
      functions.push({
        name: funcName,
        signature: match[3],
        line: parseInt(match[1])
      });
    }

    return functions;
  }

  isClassType(type) {
    if (!type) return false;
    
    // Remove qualifiers
    const cleanType = type.replace(/^(const|struct|class)\s+/, '')
                          .replace(/[*&\s]/g, '')
                          .replace(/\[.*\]/g, '')
                          .trim();
    
    // List of primitive types
    const primitives = [
      'int', 'char', 'float', 'double', 'long', 'short', 'bool', 'void',
      'unsigned', 'signed', 'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
      'int8_t', 'int16_t', 'int32_t', 'int64_t'
    ];
    
    return !primitives.includes(cleanType.toLowerCase()) && 
           !type.includes('*') && 
           !type.includes('[');
  }

  extractClassNameFromType(type) {
    if (!type) return null;
    
    // Remove qualifiers like 'const', 'struct', 'class'
    const cleaned = type.replace(/^(const|struct|class)\s+/, '')
                        .replace(/[*&\[\]]/g, '')
                        .trim();
    
    return cleaned;
  }
}

export default new ClangAnalyzer();