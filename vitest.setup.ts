import '@testing-library/jest-dom';
import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  // Provide a complete stub for electronAPI so renderer tests can run
  const mockElectronAPI = {
    ping: vi.fn().mockResolvedValue('pong'),
    getDefaultAnalysisOptions: vi.fn().mockResolvedValue({
      silenceThresholdDb: -40,
      minSilenceDurationMs: 500,
      paddingBeforeMs: 100,
      paddingAfterMs: 100,
      minChunkDurationMs: 1000,
      maxChunkDurationMs: 300000
    }),
    getDefaultTranscriptionOptions: vi.fn().mockResolvedValue({
      enabled: false,
      engine: 'vosk',
      modelPath: null,
      sampleRate: 16000,
      maxAlternatives: 0,
      enableWords: true
    }),
    selectMediaSources: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    analyzeMedia: vi.fn().mockResolvedValue({
      sourcePath: '/test/file.mp3',
      sourceUrl: 'file:///test/file.mp3',
      durationMs: 10000,
      chunks: [],
      options: {},
      previews: { original: null, trimmed: null },
      chunkExports: [],
      chunkExportsDirPath: null,
      chunkExportsDirUrl: null,
      transcriptions: [],
      transcription: { enabled: false, engine: 'vosk', modelPath: null, sampleRate: 16000, maxAlternatives: 0, enableWords: true },
      outputDir: '/test/output',
      warnings: []
    }),
    openPath: vi.fn().mockResolvedValue({ success: true }),
    zipChunks: vi.fn().mockResolvedValue({ canceled: true }),
    getRecordingSources: vi.fn().mockResolvedValue([]),
    saveRecording: vi.fn().mockResolvedValue({ filePath: '/test/recording.webm', fileUrl: 'file:///test/recording.webm' })
  };

  Object.defineProperty(window, 'electronAPI', {
    value: mockElectronAPI,
    writable: true,
    configurable: true
  });

  Object.defineProperty(window, 'electron', {
    value: {},
    writable: false
  });
});
