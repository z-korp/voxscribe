import type { ElectronAPI as ToolkitElectronAPI } from '@electron-toolkit/preload';
import type { FileFilter } from 'electron';

export interface ElectronAPI {
  ping: () => Promise<string>;
  getDefaultAnalysisOptions: () => Promise<{
    silenceThresholdDb: number;
    minSilenceDurationMs: number;
    paddingBeforeMs: number;
    paddingAfterMs: number;
    minChunkDurationMs: number;
    maxChunkDurationMs: number;
  }>;
  getDefaultTranscriptionOptions: () => Promise<{
    enabled: boolean;
    engine: 'vosk';
    modelPath: string | null;
    sampleRate: number;
    maxAlternatives: number;
    enableWords: boolean;
  }>;
  selectMediaSources: (options?: {
    allowMultiple?: boolean;
    filters?: FileFilter[];
    defaultPath?: string;
  }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;
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
      modelPath?: string;
      sampleRate?: number;
      maxAlternatives?: number;
      enableWords?: boolean;
    };
  }) => Promise<{
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
  }>;
  openPath: (targetPath: string) => Promise<{ success: boolean }>;
  zipChunks: (directoryPath: string) => Promise<{ canceled: boolean; filePath?: string }>;

  // Recording APIs
  getRecordingSources: () => Promise<
    Array<{
      id: string;
      name: string;
      thumbnail: string;
    }>
  >;
  saveRecording: (options: {
    buffer: ArrayBuffer;
    filename?: string;
  }) => Promise<{
    filePath: string;
    fileUrl: string;
  }>;
}

declare global {
  interface Window {
    electron: ToolkitElectronAPI;
    electronAPI?: ElectronAPI;
  }
}
