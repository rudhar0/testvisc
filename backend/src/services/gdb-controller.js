/**
 * GDB Controller
 * Manages interaction with GDB via Machine Interface (MI)
 */

class GdbController {
  constructor(stream) {
    this.stream = stream;
    this.buffer = '';
    this.pendingCommands = [];
    
    // Handle stream data
    this.stream.on('data', (chunk) => {
      this.buffer += chunk.toString();
      this._processBuffer();
    });
  }

  /**
   * Send a command to GDB and wait for response
   */
  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      this.pendingCommands.push({ resolve, reject, command });
      this.stream.write(`${command}\n`);
    });
  }

  /**
   * Process buffered output from GDB
   */
  _processBuffer() {
    const lines = this.buffer.split('\n');
    // Keep the last partial line in the buffer
    this.buffer = lines.pop();

    for (const line of lines) {
      this._handleLine(line.trim());
    }
  }

  /**
   * Handle a single line of GDB output
   */
  _handleLine(line) {
    // Check for command completion
    if (line.startsWith('^done') || line.startsWith('^error') || line.startsWith('^running') || line.startsWith('^connected')) {
      const cmd = this.pendingCommands.shift();
      if (cmd) {
        if (line.startsWith('^error')) {
          cmd.reject(new Error(line));
        } else {
          cmd.resolve(this._parseMI(line));
        }
      }
    }
    // Handle async output (stopped, etc.) if needed, 
    // but for this synchronous-style controller, we mostly rely on command responses.
  }

  /**
   * Parse GDB MI output string into an object
   */
  _parseMI(output) {
    const result = {};
    
    // Simple regex to extract key=value pairs
    // Note: This is a simplified parser. A full MI parser is complex.
    // We focus on extracting locals and stack args.
    
    if (output.includes('locals=[')) {
      result.locals = this._extractList(output, 'locals');
    }
    
    if (output.includes('stack=[')) {
      result.stack = this._parseStack(output);
    }

    // Extract line number for stopped events
    // *stopped,reason="end-stepping-range",frame={addr="...",func="main",args=[],file="source.c",fullname="...",line="5"}
    const lineMatch = output.match(/line="(\d+)"/);
    if (lineMatch) {
      result.line = parseInt(lineMatch[1], 10);
    }

    return result;
  }

  /**
   * Helper to parse stack frames
   */
  _parseStack(output) {
    try {
      const match = output.match(/stack=\[(.*?)\]/);
      if (!match) return [];
      
      const content = match[1];
      const frames = [];
      // Match frame={...} blocks
      // Note: This is a simplified regex that assumes no nested braces inside frame attributes
      const frameRegex = /frame={([^}]+)}/g;
      let m;
      
      while ((m = frameRegex.exec(content)) !== null) {
        const frameStr = m[1];
        const frame = {};
        
        // Extract key="value" pairs
        const attrRegex = /([a-z]+)="([^"]+)"/g;
        let attr;
        while ((attr = attrRegex.exec(frameStr)) !== null) {
          frame[attr[1]] = attr[2];
        }
        frames.push(frame);
      }
      return frames;
    } catch (e) {
      console.error('Error parsing stack:', e);
      return [];
    }
  }

  /**
   * Helper to extract lists like locals=[{name="a",value="1"}]
   */
  _extractList(output, key) {
    try {
      const startMarker = `${key}=[`;
      const startIndex = output.indexOf(startMarker);
      if (startIndex === -1) return [];

      let bracketCount = 0;
      let endIndex = -1;
      
      for (let i = startIndex + startMarker.length - 1; i < output.length; i++) {
        if (output[i] === '[') bracketCount++;
        if (output[i] === ']') bracketCount--;
        
        if (bracketCount === 0) {
          endIndex = i;
          break;
        }
      }

      if (endIndex === -1) return [];

      const listContent = output.substring(startIndex + startMarker.length, endIndex);
      
      // Parse the content manually to handle nested structures better than regex
      const items = [];
      const itemRegex = /{name="([^"]+)",(?:type="[^"]+",)?value="([^"]+)"}/g;
      let match;
      
      // This regex handles simple primitives. 
      // For complex types, GDB might return value="{...}".
      // We will do a best-effort extraction.
      
      while ((match = itemRegex.exec(listContent)) !== null) {
        items.push({
          name: match[1],
          value: match[2]
        });
      }

      // Fallback for complex types (arrays/structs) which might not match the simple regex
      if (items.length === 0 && listContent.length > 0) {
         // If regex failed but there is content, it might be complex.
         // For now, we return raw content if we can't parse it, or try a broader regex.
         const complexRegex = /{name="([^"]+)",[^v]*value=(.+?)(?=,|})/g;
         // This is tricky without a full parser. 
         // For MVP, we stick to simple types and maybe strings.
      }

      return items;
    } catch (e) {
      console.error('Error parsing GDB list:', e);
      return [];
    }
  }

  /**
   * Get current local variables
   */
  async getLocals() {
    const response = await this.sendCommand('-stack-list-locals --all-values');
    return response.locals || [];
  }

  /**
   * Get current arguments
   */
  async getArgs() {
    const response = await this.sendCommand('-stack-list-arguments --all-values');
    // The structure of stack-list-arguments is slightly different
    // stack-args=[frame={level="0",args=[{name="n",value="5"}]}]
    // We simplify for now
    return [];
  }

  /**
   * Get current stack frames
   */
  async getStack() {
    const response = await this.sendCommand('-stack-list-frames');
    return response.stack || [];
  }
}

export default GdbController;