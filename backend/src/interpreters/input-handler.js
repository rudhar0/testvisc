/**
 * Input Handler
 * Detects and handles scanf/cin statements
 */

export class InputHandler {
  /**
   * Check if line is input statement
   */
  isInputStatement(line) {
    return line.includes('scanf') || line.includes('cin >>');
  }

  /**
   * Parse input statement
   */
  parseInputStatement(line) {
    // Handle scanf
    if (line.includes('scanf')) {
      return this.parseScanf(line);
    }

    // Handle cin
    if (line.includes('cin')) {
      return this.parseCin(line);
    }

    return null;
  }

  /**
   * Parse scanf statement
   */
  parseScanf(line) {
    // Extract format string and variables
    // Example: scanf("%d", &x)
    const formatMatch = line.match(/scanf\s*\(\s*"([^"]*)"\s*,\s*(.+)\)/);
    
    if (!formatMatch) {
      return {
        type: 'scanf',
        format: '%d',
        variables: [],
        types: ['int']
      };
    }

    const formatStr = formatMatch[1];
    const varsStr = formatMatch[2];

    // Extract variable names (remove & and whitespace)
    const variables = varsStr.split(',').map(v => 
      v.trim().replace(/&/g, '')
    );

    // Infer types from format string
    const types = this.parseFormatString(formatStr);

    return {
      type: 'scanf',
      format: formatStr,
      variables,
      types
    };
  }

  /**
   * Parse cin statement
   */
  parseCin(line) {
    // Example: cin >> x >> y
    const match = line.match(/cin\s*>>\s*(.+)/);
    
    if (!match) {
      return {
        type: 'cin',
        format: 'input',
        variables: [],
        types: ['int']
      };
    }

    // Extract variable names
    const variables = match[1].split('>>').map(v => v.trim().replace(';', ''));

    // Default to int type (can be enhanced)
    const types = variables.map(() => 'int');

    return {
      type: 'cin',
      format: 'input',
      variables,
      types
    };
  }

  /**
   * Parse format string to infer types
   */
  parseFormatString(formatStr) {
    const types = [];
    const formats = formatStr.match(/%[a-z]/g) || [];

    for (const fmt of formats) {
      switch (fmt) {
        case '%d':
        case '%i':
          types.push('int');
          break;
        case '%f':
          types.push('float');
          break;
        case '%lf':
          types.push('double');
          break;
        case '%c':
          types.push('char');
          break;
        case '%s':
          types.push('string');
          break;
        default:
          types.push('int');
      }
    }

    return types.length > 0 ? types : ['int'];
  }

  /**
   * Validate user input against expected type
   */
  validateInput(value, expectedType) {
    switch (expectedType) {
      case 'int':
        return !isNaN(parseInt(value));
      case 'float':
      case 'double':
        return !isNaN(parseFloat(value));
      case 'char':
        return typeof value === 'string' && value.length === 1;
      case 'string':
        return typeof value === 'string';
      default:
        return true;
    }
  }

  /**
   * Convert user input to appropriate type
   */
  convertInput(value, type) {
    switch (type) {
      case 'int':
        return parseInt(value);
      case 'float':
      case 'double':
        return parseFloat(value);
      case 'char':
        return value.charAt(0);
      case 'string':
        return value.toString();
      default:
        return value;
    }
  }
}

export default InputHandler;