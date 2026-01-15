import child_process from 'child_process';
const { spawn } = child_process;
import { EventEmitter } from 'events';
import path from 'path';

/**
 * Minimal DAP client wrapper.
 * Requires an external DAP adapter executable (set via DAP_ADAPTER_PATH env var).
 */
export default class DapDebugger extends EventEmitter {
  constructor(adapterPath) {
    super();
    this.adapterPath = adapterPath;
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
  }

  spawnAdapter() {
    if (!this.adapterPath) throw new Error('DAP adapter path not provided (DAP_ADAPTER_PATH)');
    this.proc = spawn(this.adapterPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

    this.proc.stdout.on('data', (chunk) => this.onData(chunk));
    this.proc.stderr.on('data', (chunk) => console.error('DAP adapter stderr:', chunk.toString()));
    this.proc.on('close', (code) => console.log('DAP adapter exited', code));
    this.proc.on('error', (err) => {
      console.error('DAP adapter process error:', err);
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const str = this.buffer.toString();
      const idx = str.indexOf('\r\n\r\n');
      if (idx === -1) break;
      const header = str.substring(0, idx);
      const m = header.match(/Content-Length: (\d+)/i);
      if (!m) {
        // malformed, drop
        this.buffer = Buffer.alloc(0);
        break;
      }
      const len = parseInt(m[1], 10);
      const total = idx + 4 + len;
      if (this.buffer.length < total) break; // wait for full body
      const body = this.buffer.slice(idx + 4, total).toString();
      this.buffer = this.buffer.slice(total);
      try {
        const msg = JSON.parse(body);
        this.handleMessage(msg);
      } catch (e) {
        console.error('DAP parse error', e);
      }
    }
  }

  handleMessage(msg) {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
      return;
    }

    if (msg.method) {
      this.emit(msg.method, msg.params || msg);
      return;
    }
  }

  sendRequest(command, args = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const payload = JSON.stringify({ jsonrpc: '2.0', id, method: command, params: args });
      const header = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n`;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(header);
      this.proc.stdin.write(payload);
    });
  }

  async initialize() {
    if (!this.proc) this.spawnAdapter();
    await this.sendRequest('initialize', { adapterID: 'cpp-visualizer', clientID: 'backend' });
  }

  async launch(programPath, args = []) {
    const launchArgs = {
      name: 'Launch',
      program: programPath,
      args,
      cwd: path.dirname(programPath),
      stopOnEntry: false,
    };
    await this.sendRequest('launch', launchArgs);
    await this.sendRequest('configurationDone', {});
  }

  async setBreakpoints(sourcePath, breakpoints) {
    const body = breakpoints.map((line) => ({ line }));
    return this.sendRequest('setBreakpoints', { source: { path: sourcePath }, breakpoints: body });
  }

  async threads() {
    return this.sendRequest('threads');
  }

  async stackTrace(threadId) {
    return this.sendRequest('stackTrace', { threadId, startFrame: 0, levels: 20 });
  }

  async scopes(frameId) {
    return this.sendRequest('scopes', { frameId });
  }

  async variables(variablesReference) {
    return this.sendRequest('variables', { variablesReference, filter: 'indexed' });
  }

  async next() {
    return this.sendRequest('next', { threadId: 1 });
  }

  async stepIn() {
    return this.sendRequest('stepIn', { threadId: 1 });
  }

  async continue(threadId = 1) {
    return this.sendRequest('continue', { threadId });
  }

  async disconnect() {
    try {
      await this.sendRequest('disconnect', { restart: false });
    } catch (e) {
      // ignore
    }
    if (this.proc) this.proc.kill();
    this.proc = null;
  }

  async fetchVariableRecursive(varRef, depth = 3) {
    const result = [];
    if (!varRef || varRef === 0 || depth <= 0) return result;
    try {
      const vars = await this.variables(varRef);
      for (const v of vars) {
        const entry = { name: v.name, value: v.value, type: v.type, variablesReference: v.variablesReference };
        if (v.variablesReference && v.variablesReference !== 0) {
          entry.children = await this.fetchVariableRecursive(v.variablesReference, depth - 1);
        }
        result.push(entry);
      }
    } catch (e) {
      // best-effort
    }
    return result;
  }

  async generateTrace(programPath, limit = 200) {
    const trace = [];
    await this.initialize();
    await this.launch(programPath, []);

    let stepCount = 0;
    let running = true;

    while (running && stepCount < limit) {
      const th = await this.threads();
      const threadId = (th?.threads && th.threads[0] && th.threads[0].id) || 1;
      try {
        await this.next();
      } catch (e) {
        try {
          await this.continue(threadId);
        } catch (e2) {
          running = false;
          break;
        }
      }

      const st = await this.stackTrace(threadId);
      const frames = st?.stackFrames || [];
      if (frames.length === 0) {
        running = false;
        break;
      }

      const frame = frames[0];
      const scopesRes = await this.scopes(frame.id);
      const scopes = scopesRes?.scopes || [];
      const localsScope = scopes.find((s) => s.name.toLowerCase().includes('local')) || scopes[0];
      let locals = [];
      if (localsScope) locals = await this.fetchVariableRecursive(localsScope.variablesReference, 4);

      trace.push({ id: stepCount, type: 'line_execution', line: frame.line, function: frame.name, locals });
      stepCount++;
    }

    await this.disconnect();
    return trace;
  }
}
