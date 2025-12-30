
class GdbMiParser {
  parse(output) {
    const records = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.startsWith('^')) {
        records.push(this.parseResult(line));
      } else if (line.startsWith('*')) {
        records.push(this.parseAsync(line, 'exec'));
      } else if (line.startsWith('+')) {
        records.push(this.parseAsync(line, 'status'));
      } else if (line.startsWith('=')) {
        records.push(this.parseAsync(line, 'notify'));
      } else if (line.startsWith('~')) {
        records.push({ type: 'console', payload: this.unescape(line.substring(2, line.length - 1)) });
      } else if (line.startsWith('@')) {
        records.push({ type: 'target', payload: this.unescape(line.substring(2, line.length - 1)) });
      } else if (line.startsWith('&')) {
        records.push({ type: 'log', payload: this.unescape(line.substring(2, line.length - 1)) });
      }
    }

    return records;
  }

  parseResult(line) {
    const token = line.substring(0, line.indexOf('^'));
    line = line.substring(line.indexOf('^') + 1);
    const parts = line.split(',');
    const type = parts[0];
    const payload = this.parsePayload(parts.slice(1));
    return { token, type, payload };
  }

  parseAsync(line, asyncClass) {
    const token = line.substring(0, line.indexOf('*'));
    line = line.substring(line.indexOf('*') + 1);
    const parts = line.split(',');
    const type = parts[0];
    const payload = this.parsePayload(parts.slice(1));
    return { token, type, asyncClass, payload };
  }

  parsePayload(parts) {
    const payload = {};
    for (const part of parts) {
      const eqIndex = part.indexOf('=');
      if (eqIndex !== -1) {
        const key = part.substring(0, eqIndex);
        let value = part.substring(eqIndex + 1);
        if (value.startsWith('"')) {
          value = this.unescape(value.substring(1, value.length - 1));
        } else if (value.startsWith('{') || value.startsWith('[')) {
          value = this.parseValue(value);
        }
        payload[key] = value;
      }
    }
    return payload;
  }

  parseValue(value) {
    // This is a simplified parser for nested structures.
    // A proper implementation would handle nested quotes and brackets.
    try {
      // Handle simple array/list structures from GDB
      if (value.startsWith('[') && value.endsWith(']')) {
         // GDB lists often look like [{name="a",value="1"},...]
      }
      let jsonString = value.replace(/=/g, ':');
      jsonString = jsonString.replace(/([{,])(\w+):/g, '$1"$2":');
      return JSON.parse(jsonString);
    } catch (e) {
      return value;
    }
  }

  unescape(str) {
    return str.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }
}

export default GdbMiParser;
