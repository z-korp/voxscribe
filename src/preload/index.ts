import { contextBridge, ipcRenderer } from 'electron';
import type { FileFilter } from 'electron';

const api = {
  ping: (): Promise<string> => ipcRenderer.invoke('system:ping'),
  getDefaultAnalysisOptions: (): Promise<{
    silenceThresholdDb: number;
    minSilenceDurationMs: number;
    paddingBeforeMs: number;
    paddingAfterMs: number;
    minChunkDurationMs: number;
    maxChunkDurationMs: number;
  }> => ipcRenderer.invoke('media:get-default-options'),
  getDefaultTranscriptionOptions: (): Promise<{
    enabled: boolean;
    engine: 'vosk';
    modelPath: string | null;
    sampleRate: number;
    maxAlternatives: number;
    enableWords: boolean;
  }> => ipcRenderer.invoke('media:get-default-transcription'),
  selectMediaSources: (options?: {
    allowMultiple?: boolean;
    filters?: FileFilter[];
    defaultPath?: string;
  }): Promise<{
    canceled: boolean;
    filePaths: string[];
  }> => ipcRenderer.invoke('media:select-sources', options),
  analyzeMedia: (request: {
    inputPath: string;
    outputDir?: string;
    options?: {
      silenceThresholdDb?: number;
      minSilenceDurationMs?: number;
      paddingBeforeMs?: number;
      paddingAfterMs?: number;
      minChunkDurationMs?: number;
      maxChunkDurationMs?: number;
    };
    transcription?: {
      enabled?: boolean;
      language?: string;
      enableWords?: boolean;
    };
  }): Promise<{
    sourcePath: string;
    sourceUrl: string;
    durationMs: number | null;
    chunks: Array<{
      id: string;
      startMs: number;
      endMs: number;
      durationMs: number;
    }>;
    options: {
      silenceThresholdDb: number;
      minSilenceDurationMs: number;
      paddingBeforeMs: number;
      paddingAfterMs: number;
      minChunkDurationMs: number;
      maxChunkDurationMs: number;
    };
    previews: {
      original: {
        label: 'original';
        format: string;
        path: string;
        fileUrl: string;
        base64: string;
      } | null;
      trimmed: {
        label: 'trimmed';
        format: string;
        path: string;
        fileUrl: string;
        base64: string;
      } | null;
    };
    chunkExports: Array<{
      id: string;
      startMs: number;
      endMs: number;
      durationMs: number;
      wavPath: string;
      wavUrl: string;
    }>;
    chunkExportsDirPath: string | null;
    chunkExportsDirUrl: string | null;
    transcriptions: Array<{
      chunkId: string;
      text: string;
      confidence: number | null;
      words: Array<{
        word: string;
        startSec: number;
        endSec: number;
        confidence: number | null;
      }>;
      rawResult: Record<string, unknown> | null;
      error?: string;
    }>;
    transcription: {
      enabled: boolean;
      engine: 'vosk';
      modelPath: string | null;
      sampleRate: number;
      maxAlternatives: number;
      enableWords: boolean;
    };
    outputDir: string;
    warnings: string[];
  }> => ipcRenderer.invoke('media:analyze', request),
  openPath: (targetPath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('media:open-path', targetPath),
  zipChunks: (
    directoryPath: string,
  ): Promise<{
    canceled: boolean;
    filePath?: string;
  }> => ipcRenderer.invoke('media:zip-chunks', directoryPath),

  // Recording APIs
  getRecordingSources: (): Promise<
    Array<{
      id: string;
      name: string;
      thumbnail: string;
    }>
  > => ipcRenderer.invoke('recording:get-sources'),

  saveRecording: (options: {
    buffer: ArrayBuffer;
    filename?: string;
  }): Promise<{
    filePath: string;
    fileUrl: string;
  }> => ipcRenderer.invoke('recording:save', options),

  // electron-audio-loopback APIs (handlers auto-registered by initMain)
  enableLoopbackAudio: (): Promise<void> => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: (): Promise<void> => ipcRenderer.invoke('disable-loopback-audio'),

  // Native multi-device audio capture APIs
  nativeAudioCheckAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('native-audio:check-available'),
  nativeAudioListDevices: (): Promise<string[]> => ipcRenderer.invoke('native-audio:list-devices'),
  nativeAudioStartCapture: (deviceNames?: string[]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('native-audio:start-capture', deviceNames),
  nativeAudioStopCapture: (): Promise<{
    filePath: string;
    fileUrl: string;
    buffer: ArrayBuffer;
  }> => ipcRenderer.invoke('native-audio:stop-capture'),
  nativeAudioIsCapturing: (): Promise<boolean> => ipcRenderer.invoke('native-audio:is-capturing'),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api);
  } catch (error) {
    console.error('contextBridge expose failed', error);
  }
} else {
  // Fallback for context isolation disabled.
  const fallbackWindow = window as typeof window & {
    electronAPI?: typeof api;
  };
  fallbackWindow.electronAPI = api;
}
