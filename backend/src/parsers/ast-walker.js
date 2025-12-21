/**
 * AST Walker
 * Traverses Tree-sitter AST in execution order
 */

import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import Cpp from 'tree-sitter-cpp';

export default class ASTWalker {
  constructor(language = 'c') {
    this.parser = new Parser();
    if (language === 'cpp' || language === 'c++') {
      this.parser.setLanguage(Cpp);
    } else {
      this.parser.setLanguage(C);
    }
    this.language = language;
  }

  /**
   * Parse source code into AST
   */
  parse(sourceCode) {
    try {
      const tree = this.parser.parse(sourceCode);
      if (!tree || !tree.rootNode) {
        throw new Error('Failed to parse source code');
      }
      return tree;
    } catch (error) {
      throw new Error(`Parse error: ${error.message}`);
    }
  }

  /**
   * Extract function definitions
   */
  extractFunctions(tree) {
    const functions = new Map();
    const rootNode = tree.rootNode;

    this._visitNode(rootNode, (node) => {
      if (node.type === 'function_definition') {
        const funcInfo = this._parseFunctionDefinition(node);
        functions.set(funcInfo.name, funcInfo);
      }
    });

    return functions;
  }

  /**
   * Extract global declarations
   */
  extractGlobals(tree) {
    const globals = [];
    const rootNode = tree.rootNode;

    for (let i = 0; i < rootNode.childCount; i++) {
      const child = rootNode.child(i);
      if (child.type === 'declaration') {
        globals.push(this._parseDeclaration(child));
      }
    }

    return globals;
  }

  /**
   * Find main function
   */
  findMain(tree) {
    const functions = this.extractFunctions(tree);
    const mainFunc = functions.get('main');
    if (!mainFunc) {
      throw new Error('No main function found');
    }
    return mainFunc;
  }

  /**
   * Get statements from compound statement (block)
   */
  getStatements(node) {
    if (node.type === 'compound_statement') {
      return Array.from({ length: node.childCount }, (_, i) => node.child(i))
        .filter(child => child.type !== '{' && child.type !== '}');
    }
    return [node];
  }

  /**
   * Parse function definition
   */
  _parseFunctionDefinition(node) {
    let declarator = node.childForFieldName('declarator');
    let functionName = null;
    let parameters = [];

    if (declarator) {
      if (declarator.type === 'function_declarator') {
        const nameNode = declarator.childForFieldName('declarator');
        functionName = nameNode ? nameNode.text : null;
        
        const paramsNode = declarator.childForFieldName('parameters');
        if (paramsNode) {
          parameters = this._parseParameters(paramsNode);
        }
      } else if (declarator.type === 'pointer_declarator') {
        const innerDeclarator = declarator.childForFieldName('declarator');
        if (innerDeclarator && innerDeclarator.type === 'function_declarator') {
          const nameNode = innerDeclarator.childForFieldName('declarator');
          functionName = nameNode ? nameNode.text : null;
          
          const paramsNode = innerDeclarator.childForFieldName('parameters');
          if (paramsNode) {
            parameters = this._parseParameters(paramsNode);
          }
        }
      }
    }

    const returnType = node.childForFieldName('type');
    const body = node.childForFieldName('body');

    return {
      name: functionName,
      returnType: returnType ? returnType.text : 'void',
      parameters,
      body,
      node,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1
    };
  }

  /**
   * Parse function parameters
   */
  _parseParameters(paramsNode) {
    const params = [];
    
    for (let i = 0; i < paramsNode.childCount; i++) {
      const child = paramsNode.child(i);
      if (child.type === 'parameter_declaration') {
        const type = child.childForFieldName('type');
        const declarator = child.childForFieldName('declarator');
        
        let paramName = null;
        if (declarator) {
          paramName = this._extractIdentifier(declarator);
        }
        
        params.push({
          name: paramName,
          type: type ? type.text : 'int',
          node: child
        });
      }
    }
    
    return params;
  }

  /**
   * Parse declaration
   */
  _parseDeclaration(node) {
    const type = node.childForFieldName('type');
    const declarators = [];

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === 'init_declarator') {
        const declarator = child.childForFieldName('declarator');
        const value = child.childForFieldName('value');
        
        const name = this._extractIdentifier(declarator);
        const fullType = this._extractType(type, declarator);
        
        declarators.push({
          name,
          type: fullType,
          initializer: value,
          node: child,
          line: child.startPosition.row + 1
        });
      }
    }

    return {
      baseType: type ? type.text : 'int',
      declarators,
      node,
      line: node.startPosition.row + 1
    };
  }

  /**
   * Extract identifier from declarator
   */
  _extractIdentifier(node) {
    if (!node) return null;
    
    if (node.type === 'identifier') {
      return node.text;
    }
    
    if (node.type === 'pointer_declarator') {
      return this._extractIdentifier(node.childForFieldName('declarator'));
    }
    
    if (node.type === 'array_declarator') {
      return this._extractIdentifier(node.childForFieldName('declarator'));
    }
    
    if (node.type === 'function_declarator') {
      return this._extractIdentifier(node.childForFieldName('declarator'));
    }
    
    return node.text;
  }

  /**
   * Extract full type including pointers and arrays
   */
  _extractType(typeNode, declaratorNode) {
    let baseType = typeNode ? typeNode.text : 'int';
    
    if (!declaratorNode) return baseType;
    
    let current = declaratorNode;
    let suffix = '';
    
    while (current) {
      if (current.type === 'pointer_declarator') {
        baseType += '*';
        current = current.childForFieldName('declarator');
      } else if (current.type === 'array_declarator') {
        const size = current.childForFieldName('size');
        suffix = `[${size ? size.text : ''}]` + suffix;
        current = current.childForFieldName('declarator');
      } else {
        break;
      }
    }
    
    return baseType + suffix;
  }

  /**
   * Visit all nodes recursively
   */
  _visitNode(node, callback) {
    callback(node);
    for (let i = 0; i < node.childCount; i++) {
      this._visitNode(node.child(i), callback);
    }
  }

  /**
   * Get line number for node
   */
  getLine(node) {
    return node.startPosition.row + 1;
  }

  /**
   * Get source text for node
   */
  getText(node) {
    return node.text;
  }
}