import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

class LLDBDebugger {
  constructor() {
    this.pythonScript = path.join(process.cwd(), 'src', 'python', 'lldb-tracer.py');
  }

  /**
   * Generate execution trace using LLDB Python API
   */
  async generateTrace(executable, semanticInfo = null) {
    console.log('🐍 Starting LLDB Python trace generation...');
    
    return new Promise(async (resolve, reject) => {
      const args = [this.pythonScript, executable];
      
      // Pass semantic info if available
      let semanticFile = null;
      if (semanticInfo) {
        semanticFile = path.join(process.cwd(), 'temp', `semantic_${Date.now()}.json`);
        await writeFile(semanticFile, JSON.stringify(semanticInfo), 'utf-8');
        args.push(semanticFile);
      }
      
     const pythonExecutable =
  process.platform === 'win32' ? 'python' : 'python3';


      
      const proc = spawn(pythonExecutable, args);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        // Forward stderr to console for debugging
        console.log('[LLDB]', data.toString().trim());
      });
      
      proc.on('close', async (code) => {
        // Cleanup semantic file
        if (semanticFile) {
          try {
            await unlink(semanticFile);
          } catch (e) {}
        }
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            console.log(`✅ LLDB generated ${result.totalSteps} steps`);
            resolve(result);
          } catch (error) {
            console.error('Failed to parse LLDB output:', error);
            console.error('Raw output:', stdout.substring(0, 500));
            reject(new Error(`Failed to parse LLDB output: ${error.message}`));
          }
        } else {
          console.error('LLDB Python script failed:', stderr);
          reject(new Error(`LLDB failed with code ${code}: ${stderr}`));
        }
      });
      
      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn LLDB Python: ${err.message}`));
      });
    });
  }
}

export default new LLDBDebugger();