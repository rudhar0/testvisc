import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

class LLDBDebugger {
  constructor() {
    this.pythonScript = path.join(process.cwd(), 'src', 'python', 'lldb-tracer.py');
    this.timeout = 35000; // 35 seconds (Python has 30s timeout)
  }

  /**
   * Generate execution trace using LLDB Python API
   * With timeout protection and better error handling
   */
  async generateTrace(executable, semanticInfo = null) {
    console.log('🐍 Starting LLDB Python trace generation (source-line-based)...');
    
    return new Promise(async (resolve, reject) => {
      const args = [this.pythonScript, executable];
      
      // Pass semantic info if available
      let semanticFile = null;
      if (semanticInfo) {
        semanticFile = path.join(process.cwd(), 'temp', `semantic_${Date.now()}.json`);
        await writeFile(semanticFile, JSON.stringify(semanticInfo), 'utf-8');
        args.push(semanticFile);
      }
      
      const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
      
      const proc = spawn(pythonExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      let killed = false;
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!killed) {
          console.error('⏰ LLDB process timeout - killing process');
          killed = true;
          proc.kill('SIGTERM');
          
          // Force kill if still alive after 2s
          setTimeout(() => {
            if (proc.exitCode === null) {
              console.error('🔪 Force killing LLDB process');
              proc.kill('SIGKILL');
            }
          }, 2000);
        }
      }, this.timeout);
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        // Forward stderr to console for debugging
        const message = data.toString().trim();
        if (message) {
          console.log('[LLDB]', message);
        }
      });
      
      proc.on('close', async (code, signal) => {
        clearTimeout(timeoutId);
        
        // Cleanup semantic file
        if (semanticFile) {
          try {
            await unlink(semanticFile);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        
        if (killed) {
          reject(new Error('LLDB process timed out after ' + (this.timeout / 1000) + ' seconds'));
          return;
        }
        
        if (signal) {
          reject(new Error(`LLDB process killed by signal: ${signal}`));
          return;
        }
        
        if (code === 0) {
          try {
            // Parse JSON output
            const result = JSON.parse(stdout);
            console.log(`✅ LLDB generated ${result.totalSteps} steps (source-line-based)`);
            
            // Validate that we got reasonable step count
            if (result.totalSteps < 2) {
              console.warn('⚠️  Very few steps generated - code might be too simple or tracer failed');
            }
            
            // Validate trace structure
            if (!result.steps || !Array.isArray(result.steps)) {
              throw new Error('Invalid trace structure: missing or invalid steps array');
            }
            
            resolve(result);
          } catch (error) {
            console.error('❌ Failed to parse LLDB output:', error.message);
            console.error('Raw stdout (first 1000 chars):', stdout.substring(0, 1000));
            console.error('Raw stderr (first 1000 chars):', stderr.substring(0, 1000));
            reject(new Error(`Failed to parse LLDB output: ${error.message}`));
          }
        } else {
          const errorMsg = stderr || 'Unknown error';
          console.error('❌ LLDB Python script failed with code', code);
          console.error('Error output:', errorMsg.substring(0, 500));
          reject(new Error(`LLDB failed with code ${code}: ${errorMsg.substring(0, 200)}`));
        }
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('❌ Failed to spawn LLDB Python process:', err.message);
        reject(new Error(`Failed to spawn LLDB Python: ${err.message}`));
      });
    });
  }

  /**
   * Check if LLDB Python environment is available
   */
  async checkEnvironment() {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    
    return new Promise((resolve) => {
      const proc = spawn(pythonExecutable, ['-c', 'import lldb; print(lldb.SBDebugger.GetVersionString())']);
      
      let output = '';
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          console.log('✅ LLDB Python bindings available:', output.trim());
          resolve(true);
        } else {
          console.warn('⚠️  LLDB Python bindings not available');
          resolve(false);
        }
      });
      
      proc.on('error', () => {
        console.warn('⚠️  Python not available');
        resolve(false);
      });
    });
  }
}

export default new LLDBDebugger();