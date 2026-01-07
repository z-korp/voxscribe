import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class NativeAudioCaptureService {
  private process: ChildProcess | null = null;
  private isCapturing = false;
  private captureStartTime: number = 0;
  private outputFilePath: string = '';
  private stopFilePath: string = '';

  /**
   * Get the path to the AudioCapturer.exe
   */
  private getCapturerPath(): string {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'AudioCapturer.exe');
    } else {
      return path.join(__dirname, '../../resources/AudioCapturer.exe');
    }
  }

  /**
   * Check if native audio capture is available
   */
  public isAvailable(): boolean {
    const capturerPath = this.getCapturerPath();
    return fs.existsSync(capturerPath);
  }

  /**
   * List available audio devices
   */
  public async listDevices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const capturerPath = this.getCapturerPath();

      if (!fs.existsSync(capturerPath)) {
        reject(new Error('AudioCapturer.exe not found'));
        return;
      }

      const proc = spawn(capturerPath, ['--list']);
      let output = '';
      let errorOutput = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          const devices: string[] = [];
          const lines = output.split('\n');

          for (const line of lines) {
            if (line.startsWith('Name: ')) {
              const deviceName = line.substring(6).trim();
              devices.push(deviceName);
            }
          }

          resolve(devices);
        } else {
          reject(new Error(`Failed to list devices: ${errorOutput}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Start capturing audio from multiple devices
   */
  public async startCapture(deviceNames?: string[]): Promise<void> {
    if (this.isCapturing) {
      throw new Error('Already capturing');
    }

    const capturerPath = this.getCapturerPath();

    if (!fs.existsSync(capturerPath)) {
      throw new Error('AudioCapturer.exe not found');
    }

    // Generate output file path and stop file path
    const recordingsDir = path.join(app.getPath('userData'), 'recordings');
    await fs.promises.mkdir(recordingsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.outputFilePath = path.join(recordingsDir, `native-capture-${timestamp}.wav`);
    this.stopFilePath = path.join(recordingsDir, `stop-${timestamp}.signal`);

    // Make sure stop file doesn't exist
    if (fs.existsSync(this.stopFilePath)) {
      await fs.promises.unlink(this.stopFilePath);
    }

    // Build arguments
    const args: string[] = ['--output', this.outputFilePath, '--stopfile', this.stopFilePath];
    if (deviceNames && deviceNames.length > 0) {
      args.push('--devices', deviceNames.join(','));
    }

    console.log(`[NativeAudio] Starting capture, output: ${this.outputFilePath}`);
    console.log(`[NativeAudio] Command: ${capturerPath} ${args.join(' ')}`);

    // Spawn the process
    this.process = spawn(capturerPath, args);
    this.isCapturing = true;
    this.captureStartTime = Date.now();

    // Log stdout (will contain output file path when done)
    this.process.stdout?.on('data', (data: Buffer) => {
      console.log('[AudioCapturer:stdout]', data.toString().trim());
    });

    // Log errors from stderr
    this.process.stderr?.on('data', (data: Buffer) => {
      console.log('[AudioCapturer]', data.toString().trim());
    });

    // Handle process exit
    this.process.on('close', (code) => {
      console.log(`[NativeAudio] AudioCapturer exited with code ${code}`);
    });

    this.process.on('error', (err) => {
      console.error('[NativeAudio] AudioCapturer error:', err);
      this.isCapturing = false;
    });

    // Wait a bit to ensure process started
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (!this.isCapturing) {
      throw new Error('Failed to start audio capture process');
    }
  }

  /**
   * Stop capturing and return the WAV file path
   */
  public async stopCapture(): Promise<Buffer> {
    if (!this.isCapturing || !this.process) {
      throw new Error('Not currently capturing');
    }

    console.log('[NativeAudio] Stopping capture...');

    const processToKill = this.process;
    this.isCapturing = false;

    // Create stop file to signal the C# process to stop
    console.log(`[NativeAudio] Creating stop file: ${this.stopFilePath}`);
    await fs.promises.writeFile(this.stopFilePath, 'STOP');

    // Wait for process to exit (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[NativeAudio] Process did not exit gracefully, forcing...');
        processToKill.kill('SIGKILL');
        resolve();
      }, 60000); // 60 second timeout for mixing

      processToKill.on('close', () => {
        clearTimeout(timeout);
        console.log('[NativeAudio] Process exited');
        resolve();
      });
    });

    // Clean up stop file if it still exists
    if (fs.existsSync(this.stopFilePath)) {
      try {
        await fs.promises.unlink(this.stopFilePath);
      } catch {
        // Ignore - file may already be deleted
      }
    }

    // Wait a bit more for file to be fully written
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Read the output file
    if (!fs.existsSync(this.outputFilePath)) {
      throw new Error(`Output file not found: ${this.outputFilePath}`);
    }

    console.log(`[NativeAudio] Reading output file: ${this.outputFilePath}`);
    const wavBuffer = await fs.promises.readFile(this.outputFilePath);

    const fileSizeKB = Math.round(wavBuffer.length / 1024);
    console.log(`[NativeAudio] File size: ${fileSizeKB} KB`);

    // Clean up
    this.process = null;

    return wavBuffer;
  }

  /**
   * Get the output file path (useful for direct file access)
   */
  public getOutputFilePath(): string {
    return this.outputFilePath;
  }

  /**
   * Check if currently capturing
   */
  public isCaptureActive(): boolean {
    return this.isCapturing;
  }

  /**
   * Get capture duration in milliseconds
   */
  public getCaptureDuration(): number {
    if (!this.isCapturing) {
      return 0;
    }
    return Date.now() - this.captureStartTime;
  }
}
