export type AnalysisOptions = {
  silenceThresholdDb: number;
  minSilenceDurationMs: number;
  paddingBeforeMs: number;
  paddingAfterMs: number;
  minChunkDurationMs: number;
  maxChunkDurationMs: number;
};

export type MediaChunk = {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
};

export type MediaPreview = {
  label: 'original' | 'trimmed';
  format: string;
  path: string;
  fileUrl: string;
  base64: string;
};

export type ChunkExport = {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  wavPath: string;
  wavUrl: string;
};

export type TranscriptionWord = {
  word: string;
  startSec: number;
  endSec: number;
  confidence: number | null;
};

export type ChunkTranscription = {
  chunkId: string;
  text: string;
  confidence: number | null;
  words: TranscriptionWord[];
  rawResult: Record<string, unknown> | null;
  error?: string;
};

export type TranscriptionSummary = {
  enabled: boolean;
  engine: 'vosk';
  modelPath: string | null;
  sampleRate: number;
  maxAlternatives: number;
  enableWords: boolean;
};

export type TranscriptionSettings = {
  enabled: boolean;
  modelPath: string;
  language: string;
  sampleRate: number;
  maxAlternatives: number;
  enableWords: boolean;
};

export type MediaAnalysis = {
  sourcePath: string;
  sourceUrl: string;
  durationMs: number | null;
  chunks: MediaChunk[];
  options: AnalysisOptions;
  previews: {
    original: MediaPreview | null;
    trimmed: MediaPreview | null;
  };
  chunkExports: ChunkExport[];
  chunkExportsDirPath: string | null;
  chunkExportsDirUrl: string | null;
  transcriptions: ChunkTranscription[];
  transcription: TranscriptionSummary;
  outputDir: string;
  warnings: string[];
};

export type AnalysisState = {
  status: 'idle' | 'running' | 'done' | 'error';
  error?: string;
  analyses: Record<string, MediaAnalysis>;
};

export type DesktopSource = {
  id: string;
  name: string;
  thumbnail: string;
};

export type RecordingState = {
  status: 'idle' | 'selecting' | 'recording' | 'saving' | 'done' | 'error';
  sources: DesktopSource[];
  selectedSourceId: string | null;
  includeMicrophone: boolean;
  durationMs: number;
  error?: string;
  savedFilePath?: string;
};

export const DEFAULT_ANALYSIS_STATE: AnalysisState = {
  status: 'idle',
  analyses: {},
};

export const DEFAULT_RECORDING_STATE: RecordingState = {
  status: 'idle',
  sources: [],
  selectedSourceId: null,
  includeMicrophone: true,
  durationMs: 0,
  error: undefined,
  savedFilePath: undefined,
};

export const DEFAULT_TRANSCRIPTION_SETTINGS: TranscriptionSettings = {
  enabled: false,
  modelPath: '',
  language: 'fr',
  sampleRate: 16000,
  maxAlternatives: 0,
  enableWords: true,
};
