import { EventEmitter } from 'events';
import { spawn } from 'child_process';

class GdbMiParser extends EventEmitter {
  constructor(exePath) {
    super();
    this.prettyPrintersInitialized = false;
    this.useNodeLib = false;
    this.gdb = null; // node lib instance
    this.process = null; // fallback gdb subprocess
    this.buffer = '';

    // Try to dynamically load the optional npm library. If unavailable,
    // fall back to spawning `gdb --interpreter=mi2` directly and emit
    // minimal records so the rest of the app can continue to operate.
    (async () => {
      try {
        const mod = await import('node-gdb-mi2');
        const { GDB } = mod;
        this.gdb = new GDB([exePath]);
        this.useNodeLib = true;

        // Mirror events from the library
        this.gdb.on('error', (err) => this.emit('error', err));
        this.gdb.on('gdb-exit', (code) => this.emit('exit', code));
        ['result', 'notify', 'exec', 'status'].forEach(evt => {
          this.gdb.on(evt, (output) => this.emit('record', output));
        });
        ['console', 'log', 'target'].forEach(evt => {
          this.gdb.on(evt, (output) => this.emit(evt, output));
        });

        this._initializePrettyPrinters();
      } catch (e) {
        // Fallback: spawn gdb directly
        try {
          this.process = spawn('gdb', ['--interpreter=mi2', exePath]);
          this.process.stdout.on('data', (d) => this._onStdout(d.toString()));
          this.process.stderr.on('data', (d) => this.emit('console', d.toString()));
          this.process.on('exit', (code) => this.emit('exit', code));
          this.process.on('error', (err) => {
            if (err.code === 'ENOENT') {
              const enhancedError = new Error("Failed to spawn GDB. Ensure 'gdb' is installed and in your system's PATH. If you are running locally, consider using the docker-compose setup.");
              console.error('GDB process error:', enhancedError.message);
              if (this.listenerCount('error') > 0) {
                this.emit('error', enhancedError);
              }
            } else {
              console.error('GDB process error:', err);
              if (this.listenerCount('error') > 0) {
                this.emit('error', err);
              }
            }
          });
          this._initializePrettyPrinters();
        } catch (spawnErr) {
          this.emit('error', spawnErr);
        }
      }
    })();
  }

  _onStdout(data) {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop();

    for (const line of lines) {
      // Emit a raw record; higher-level code can inspect `record.raw`.
      const record = { raw: line.trim() };
      this.emit('record', record);

      // Best-effort: detect async stop notifications and re-emit a shaped object
      if (line.startsWith('*stopped') || line.includes(',stopped')) {
        this.emit('record', { asyncClass: 'exec', type: 'stopped', payload: line.trim() });
      }
    }
  }

  async _initializePrettyPrinters() {
    if (this.prettyPrintersInitialized) return;
    try {
      const gdbPythonPath = process.env.GDB_PYTHON_PATH || '/usr/share/gdb/python';

      await this.send('-interpreter-exec console "python import sys"');
      await this.send(`-interpreter-exec console "python sys.path.insert(0, '${gdbPythonPath}')"`);
      await this.send('-interpreter-exec console "python from libstdcxx.v6.printers import register_libstdcxx_printers"');
      await this.send('-interpreter-exec console "python register_libstdcxx_printers(None)"');
      await this.send('-interpreter-exec console "enable pretty-printing"');

      this.prettyPrintersInitialized = true;
      this.emit('console', 'GDB pretty-printers initialized.');
    } catch (e) {
      this.emit('error', new Error(`Failed to initialize GDB pretty-printers: ${e.message}`));
    }
  }

  send(command) {
    if (this.useNodeLib && this.gdb) return this.gdb.send(command);
    if (!this.process) return Promise.reject(new Error('GDB not started'));

    return new Promise((resolve) => {
      // Write command to gdb stdin. MI responses are asynchronous and complex
      // to parse correctly; for now resolve quickly and rely on 'record' events
      // emitted from `_onStdout` for async notifications.
      try {
        this.process.stdin.write(command + '\n');
      } catch (e) {
        // ignore write errors
      }
      // Minimal acknowledgement — callers expecting full MI objects may need
      // the `node-gdb-mi2` package for richer responses.
      setTimeout(() => resolve({ raw: true, command }), 30);
    });
  }

  stop() {
    if (this.useNodeLib && this.gdb) this.gdb.kill();
    if (this.process) this.process.kill();
  }
}

export default GdbMiParser;