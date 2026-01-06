import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { app } from 'electron';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import { WhisperService } from './whisper-service';

/**
 * Parse timestamp from "HH:MM:SS.mmm" format to seconds
 */
function parseTimestampToSeconds(timestamp: string): number {
  // Handle already numeric values
  const numericValue = parseFloat(timestamp);
  if (!isNaN(numericValue) && !timestamp.includes(':')) {
    return numericValue;
  }

  // Parse HH:MM:SS.mmm format
  const match = timestamp.match(/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseFloat(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  // Fallback: try parseFloat
  return parseFloat(timestamp) || 0;
}

function getPackagedBinaryPath(binaryName: 'ffmpeg' | 'ffprobe'): string | undefined {
  if (!app.isPackaged) {
    return undefined;
  }

  // In packaged app, binaries are in resources/ffmpeg or resources/ffprobe
  const platform = process.platform;
  const arch = process.arch;

  const binaryFileName = platform === 'win32' ? `${binaryName}.exe` : binaryName;

  // Try common paths for packaged binaries
  const possiblePaths = [
    // extraResources path
    path.join(process.resourcesPath, binaryName, `${platform}-${arch}`, binaryFileName),
    path.join(process.resourcesPath, binaryName, binaryFileName),
    // Fallback: look for binary in resources directly
    path.join(process.resourcesPath, binaryFileName),
  ];

  for (const binPath of possiblePaths) {
    try {
      fsSync.accessSync(binPath, fsSync.constants.X_OK);
      return binPath;
    } catch {
      // Continue to next path
    }
  }

  return undefined;
}

const nodeRequire = createRequire(import.meta.url);
type VoskModule = typeof import('vosk');

export type MediaAnalysisOptions = {
  silenceThresholdDb?: number;
  minSilenceDurationMs?: number;
  paddingBeforeMs?: number;
  paddingAfterMs?: number;
  minChunkDurationMs?: number;
  maxChunkDurationMs?: number;
};

export type MediaTranscriptionOptions = {
  enabled?: boolean;
  modelPath?: string;
  language?: string;
  sampleRate?: number;
  maxAlternatives?: number;
  enableWords?: boolean;
};

export type MediaAnalysisRequest = {
  inputPath: string;
  outputDir?: string;
  options?: MediaAnalysisOptions;
  transcription?: MediaTranscriptionOptions;
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

export type MediaChunkExport = {
  id: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  wavPath: string;
  wavUrl: string;
};

export type MediaChunkExportBundle = {
  exports: MediaChunkExport[];
  directoryPath: string;
  directoryUrl: string;
};

export type MediaChunkTranscriptionWord = {
  word: string;
  startSec: number;
  endSec: number;
  confidence: number | null;
};

export type MediaChunkTranscription = {
  chunkId: string;
  text: string;
  confidence: number | null;
  words: MediaChunkTranscriptionWord[];
  rawResult: Record<string, unknown> | null;
  error?: string;
};

export type NormalizedTranscriptionOptions = {
  enabled: boolean;
  engine: 'whisper' | 'vosk';
  modelPath: string | null;
  modelName?: string; // for whisper: 'tiny', 'base', 'small', 'medium', 'large'
  language?: string; // for whisper: 'auto', 'en', 'fr', etc.
  sampleRate: number;
  maxAlternatives: number;
  enableWords: boolean;
};

export type MediaAnalysisResponse = {
  sourcePath: string;
  sourceUrl: string;
  durationMs: number | null;
  chunks: MediaChunk[];
  options: Required<MediaAnalysisOptions>;
  previews: {
    original: MediaPreview | null;
    trimmed: MediaPreview | null;
  };
  chunkExports: MediaChunkExport[];
  chunkExportsDirPath: string | null;
  chunkExportsDirUrl: string | null;
  transcriptions: MediaChunkTranscription[];
  transcription: NormalizedTranscriptionOptions;
  outputDir: string;
  warnings: string[];
};

const DEFAULT_OPTIONS: Required<MediaAnalysisOptions> = {
  silenceThresholdDb: -40,
  minSilenceDurationMs: 1000,
  paddingBeforeMs: 200,
  paddingAfterMs: 300,
  minChunkDurationMs: 500,
  maxChunkDurationMs: 10 * 60 * 1000,
};

const DEFAULT_TRANSCRIPTION_OPTIONS: NormalizedTranscriptionOptions = {
  enabled: false,
  engine: 'whisper',
  modelPath: null,
  modelName: 'medium', // default Whisper model (best for French)
  language: 'auto', // auto-detect language
  sampleRate: 16000,
  maxAlternatives: 0,
  enableWords: true,
};

type SilenceInterval = {
  startMs: number;
  endMs: number;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

type ParsedWav = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  data: Buffer;
};

export class MediaChunkService {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly whisperService: WhisperService;

  constructor() {
    // Priority: env var > packaged binary > installer fallback
    this.ffmpegPath = this.resolveBinaryPath(
      process.env['FFMPEG_PATH'] || getPackagedBinaryPath('ffmpeg'),
      ffmpegInstaller.path,
      'ffmpeg',
    );
    this.ffprobePath = this.resolveBinaryPath(
      process.env['FFPROBE_PATH'] || getPackagedBinaryPath('ffprobe'),
      ffprobeInstaller.path,
      'ffprobe',
    );
    this.whisperService = new WhisperService();
  }

  getDefaultOptions(): Required<MediaAnalysisOptions> {
    return { ...DEFAULT_OPTIONS };
  }

  getDefaultTranscriptionOptions(): NormalizedTranscriptionOptions {
    return this.normalizeTranscriptionOptions(undefined);
  }

  async analyze(request: MediaAnalysisRequest): Promise<MediaAnalysisResponse> {
    const normalizedOptions = this.normalizeOptions(request.options);
    const normalizedTranscription = this.normalizeTranscriptionOptions(request.transcription);
    const sourcePath = path.resolve(request.inputPath);
    await this.ensureSourceExists(sourcePath);

    const durationMs = await this.probeDuration(sourcePath);
    const silenceIntervals = await this.detectSilences(sourcePath, normalizedOptions);
    const speechSegments = this.buildSpeechSegments(
      durationMs,
      silenceIntervals,
      normalizedOptions,
    );
    const constrainedSegments = this.enforceDurationConstraints(
      speechSegments,
      normalizedOptions,
      durationMs,
    );
    const chunks = constrainedSegments.map((segment, index) => ({
      id: `chunk-${index + 1}`,
      startMs: Math.round(segment.startMs),
      endMs: Math.round(segment.endMs),
      durationMs: Math.max(0, Math.round(segment.endMs - segment.startMs)),
    }));

    const warnings: string[] = [];
    if (chunks.length === 0) {
      warnings.push(
        "Aucun segment parlé détecté. Ajustez peut-être le seuil de silence ou vérifiez l'enregistrement.",
      );
    }

    const outputDir = await this.resolveOutputDir(request.outputDir);
    const stem = this.buildOutputStem(sourcePath);
    const suffix = randomUUID().slice(0, 8);
    const previews = await this.renderPreviews(
      sourcePath,
      outputDir,
      stem,
      suffix,
      constrainedSegments,
      warnings,
    );
    const chunkExportsBundle = await this.renderChunkExports(
      sourcePath,
      outputDir,
      stem,
      suffix,
      constrainedSegments,
    );

    const hasExports = chunkExportsBundle.exports.length > 0;
    let transcriptions: MediaChunkTranscription[] = [];
    if (normalizedTranscription.enabled) {
      if (!hasExports) {
        warnings.push(
          'Transcription demandée mais aucun chunk exporté. Ajustez les paramètres avant de relancer.',
        );
      } else {
        try {
          transcriptions = await this.transcribeChunkExports(
            chunkExportsBundle.exports,
            normalizedTranscription,
          );
        } catch (error) {
          warnings.push(
            `Échec de la transcription ${normalizedTranscription.engine} : ${(error as Error).message}`,
          );
        }
      }
    }

    return {
      sourcePath,
      sourceUrl: pathToFileURL(sourcePath).toString(),
      durationMs,
      chunks,
      options: normalizedOptions,
      previews,
      chunkExports: chunkExportsBundle.exports,
      chunkExportsDirPath: hasExports ? chunkExportsBundle.directoryPath : null,
      chunkExportsDirUrl: hasExports ? chunkExportsBundle.directoryUrl : null,
      transcriptions,
      transcription: normalizedTranscription,
      outputDir,
      warnings,
    };
  }

  private normalizeOptions(
    options: MediaAnalysisOptions | undefined,
  ): Required<MediaAnalysisOptions> {
    return {
      silenceThresholdDb: options?.silenceThresholdDb ?? DEFAULT_OPTIONS.silenceThresholdDb,
      minSilenceDurationMs: options?.minSilenceDurationMs ?? DEFAULT_OPTIONS.minSilenceDurationMs,
      paddingBeforeMs: options?.paddingBeforeMs ?? DEFAULT_OPTIONS.paddingBeforeMs,
      paddingAfterMs: options?.paddingAfterMs ?? DEFAULT_OPTIONS.paddingAfterMs,
      minChunkDurationMs: options?.minChunkDurationMs ?? DEFAULT_OPTIONS.minChunkDurationMs,
      maxChunkDurationMs: options?.maxChunkDurationMs ?? DEFAULT_OPTIONS.maxChunkDurationMs,
    };
  }

  private normalizeTranscriptionOptions(
    options: MediaTranscriptionOptions | undefined,
  ): NormalizedTranscriptionOptions {
    if (!options) {
      return { ...DEFAULT_TRANSCRIPTION_OPTIONS };
    }

    const requestModel = options.modelPath?.trim() ?? null;

    return {
      enabled: options.enabled ?? false,
      engine: 'whisper', // Default to Whisper
      modelPath: requestModel ? path.resolve(requestModel) : null,
      modelName: DEFAULT_TRANSCRIPTION_OPTIONS.modelName,
      language: options.language ?? DEFAULT_TRANSCRIPTION_OPTIONS.language,
      sampleRate:
        options.sampleRate && options.sampleRate > 0
          ? options.sampleRate
          : DEFAULT_TRANSCRIPTION_OPTIONS.sampleRate,
      maxAlternatives:
        options.maxAlternatives !== undefined && options.maxAlternatives >= 0
          ? options.maxAlternatives
          : DEFAULT_TRANSCRIPTION_OPTIONS.maxAlternatives,
      enableWords: options.enableWords ?? DEFAULT_TRANSCRIPTION_OPTIONS.enableWords,
    };
  }

  private async ensureSourceExists(inputPath: string): Promise<void> {
    try {
      const stats = await fs.stat(inputPath);
      if (!stats.isFile()) {
        throw new Error(`Le chemin ${inputPath} n'est pas un fichier.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Le fichier source est introuvable : ${inputPath}`);
      }
      throw error;
    }
  }

  private resolveBinaryPath(
    preferredPath: string | undefined,
    fallbackPath: string,
    label: 'ffmpeg' | 'ffprobe',
  ): string {
    const candidate = preferredPath?.trim() || fallbackPath;
    if (!candidate) {
      throw new Error(
        `Aucun binaire ${label} disponible. Installez ffmpeg ou ajoutez @${label}-installer comme dépendance.`,
      );
    }
    return candidate;
  }

  private async probeDuration(inputPath: string): Promise<number> {
    // Try to get duration from format metadata
    const formatArgs = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'json',
      inputPath,
    ];
    const formatResult = await this.runCommand(this.ffprobePath, formatArgs);

    try {
      const parsed = JSON.parse(formatResult.stdout) as {
        format?: {
          duration?: string;
        };
      };
      const durationSeconds = parsed?.format?.duration ? Number(parsed.format.duration) : NaN;
      if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
        return Math.round(durationSeconds * 1000);
      }
    } catch {
      // Format metadata not available, try stream metadata
    }

    // Fallback: try to get duration from stream metadata (works better for some webm files)
    try {
      const streamArgs = [
        '-v',
        'error',
        '-show_entries',
        'stream=duration',
        '-of',
        'json',
        inputPath,
      ];
      const streamResult = await this.runCommand(this.ffprobePath, streamArgs);
      const streamParsed = JSON.parse(streamResult.stdout) as {
        streams?: Array<{ duration?: string }>;
      };

      const streamDuration = streamParsed?.streams?.[0]?.duration
        ? Number(streamParsed.streams[0].duration)
        : NaN;
      if (Number.isFinite(streamDuration) && streamDuration > 0) {
        return Math.round(streamDuration * 1000);
      }
    } catch {
      // Stream metadata also not available
    }

    // Last resort: decode the file with ffmpeg to get actual duration
    console.warn('Could not get duration from metadata, decoding file with ffmpeg...');
    try {
      const decodeArgs = ['-i', inputPath, '-f', 'null', '-'];
      const decodeResult = await this.runCommand(this.ffmpegPath, decodeArgs);

      // Parse stderr for "time=HH:MM:SS.MS" pattern
      const timeMatch = decodeResult.stderr.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch) {
        const hours = Number(timeMatch[1]);
        const minutes = Number(timeMatch[2]);
        const seconds = Number(timeMatch[3]);
        const durationSeconds = hours * 3600 + minutes * 60 + seconds;
        const durationMs = Math.round(durationSeconds * 1000);
        console.log(`DEBUG: Extracted duration from ffmpeg decode: ${durationMs}ms`);
        return durationMs;
      }
    } catch (error) {
      console.error('Failed to decode file for duration:', error);
    }

    console.warn('Could not determine duration, returning 0');
    return 0;
  }

  private async detectSilences(
    inputPath: string,
    options: Required<MediaAnalysisOptions>,
  ): Promise<SilenceInterval[]> {
    const args = [
      '-hide_banner',
      '-nostats',
      '-i',
      inputPath,
      '-af',
      `silencedetect=noise=${options.silenceThresholdDb}dB:d=${options.minSilenceDurationMs / 1000}`,
      '-f',
      'null',
      '-',
    ];

    const result = await this.runCommand(this.ffmpegPath, args);

    // DEBUG: Log the full stderr output to see what ffmpeg returns
    console.log('=== FFMPEG SILENCE DETECTION DEBUG ===');
    console.log('Command:', this.ffmpegPath, args.join(' '));
    console.log('Stderr output:');
    console.log(result.stderr);
    console.log('=== END DEBUG ===');

    const silenceIntervals: SilenceInterval[] = [];
    const lines = result.stderr.split(/\r?\n/);

    let lastSilenceStart: number | null = null;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const startMatch = line.match(/silence_start:\s*([0-9.]+)/);
      if (startMatch) {
        lastSilenceStart = Number(startMatch[1]) * 1000;
        continue;
      }

      const endMatch = line.match(/silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/);
      if (endMatch) {
        const end = Number(endMatch[1]) * 1000;
        const duration = Number(endMatch[2]) * 1000;
        const start = lastSilenceStart ?? Math.max(0, end - duration); // fallback if start not logged
        silenceIntervals.push({
          startMs: Math.max(0, start),
          endMs: Math.max(start, end),
        });
        lastSilenceStart = null;
      }
    }

    // ffmpeg may log a trailing silence_start without end if the file ends silently.
    if (lastSilenceStart !== null) {
      silenceIntervals.push({
        startMs: Math.max(0, lastSilenceStart),
        endMs: lastSilenceStart,
      });
    }

    return silenceIntervals.sort((a, b) => a.startMs - b.startMs);
  }

  private buildSpeechSegments(
    durationMs: number,
    silences: SilenceInterval[],
    options: Required<MediaAnalysisOptions>,
  ): SilenceInterval[] {
    console.log(
      'DEBUG: buildSpeechSegments - durationMs:',
      durationMs,
      'silences count:',
      silences.length,
    );
    const segments: SilenceInterval[] = [];
    const clampedDuration = Math.max(0, durationMs);
    let cursor = 0;

    for (const silence of silences) {
      const start = Math.min(Math.max(0, silence.startMs), clampedDuration);
      const end = Math.min(Math.max(0, silence.endMs), clampedDuration);
      if (start > cursor) {
        segments.push({ startMs: cursor, endMs: start });
      }
      cursor = Math.max(cursor, end);
    }

    if (cursor < clampedDuration) {
      console.log(
        `DEBUG: No silences cover end of file, creating final segment from ${cursor}ms to ${clampedDuration}ms`,
      );
      segments.push({ startMs: cursor, endMs: clampedDuration });
    }

    console.log(`DEBUG: Built ${segments.length} speech segments before padding`);

    const withPadding = segments
      .map((segment) => {
        const paddedStart = Math.max(0, segment.startMs - options.paddingBeforeMs);
        const paddedEnd = Math.min(clampedDuration, segment.endMs + options.paddingAfterMs);
        return {
          startMs: Math.min(paddedStart, paddedEnd),
          endMs: Math.max(paddedStart, paddedEnd),
        };
      })
      .filter((segment) => segment.endMs > segment.startMs);

    if (withPadding.length === 0) {
      return withPadding;
    }

    // Merge overlaps resulting from padding
    const merged: SilenceInterval[] = [];
    let current = { ...withPadding[0] };

    for (let index = 1; index < withPadding.length; index++) {
      const candidate = withPadding[index];
      if (candidate.startMs <= current.endMs) {
        current.endMs = Math.max(current.endMs, candidate.endMs);
      } else {
        merged.push(current);
        current = { ...candidate };
      }
    }

    merged.push(current);
    return merged;
  }

  private enforceDurationConstraints(
    segments: SilenceInterval[],
    options: Required<MediaAnalysisOptions>,
    durationMs: number,
  ): SilenceInterval[] {
    if (segments.length === 0) {
      return segments;
    }

    const normalized: SilenceInterval[] = [];

    for (const segment of segments) {
      const span = segment.endMs - segment.startMs;
      if (span <= 0) {
        continue;
      }

      let adjustedStart = segment.startMs;
      let adjustedEnd = segment.endMs;

      if (span < options.minChunkDurationMs) {
        const deficit = options.minChunkDurationMs - span;
        const half = deficit / 2;
        adjustedStart = Math.max(0, adjustedStart - half);
        adjustedEnd = Math.min(durationMs, adjustedEnd + half);

        const adjustedSpan = adjustedEnd - adjustedStart;
        if (adjustedSpan < options.minChunkDurationMs) {
          if (adjustedStart === 0) {
            adjustedEnd = Math.min(durationMs, adjustedStart + options.minChunkDurationMs);
          } else if (adjustedEnd === durationMs) {
            adjustedStart = Math.max(0, adjustedEnd - options.minChunkDurationMs);
          }
        }

        if (adjustedEnd <= adjustedStart) {
          continue;
        }
      }

      if (normalized.length > 0) {
        const previous = normalized[normalized.length - 1];
        if (adjustedStart <= previous.endMs) {
          previous.endMs = Math.max(previous.endMs, adjustedEnd);
          continue;
        }
      }

      normalized.push({
        startMs: Math.max(0, Math.min(adjustedStart, durationMs)),
        endMs: Math.max(0, Math.min(adjustedEnd, durationMs)),
      });
    }

    const bounded: SilenceInterval[] = [];

    for (const segment of normalized) {
      let currentStart = segment.startMs;
      const segmentEnd = segment.endMs;

      while (segmentEnd - currentStart > options.maxChunkDurationMs) {
        const chunkEnd = currentStart + options.maxChunkDurationMs;
        bounded.push({ startMs: currentStart, endMs: chunkEnd });
        currentStart = chunkEnd;
      }

      const remaining = segmentEnd - currentStart;
      if (bounded.length > 0 && remaining < options.minChunkDurationMs) {
        // Extend the previous chunk instead of creating a sub-minimum leftover
        bounded[bounded.length - 1].endMs = Math.min(durationMs, segmentEnd);
      } else {
        bounded.push({ startMs: currentStart, endMs: segmentEnd });
      }
    }

    return bounded.map((segment) => ({
      startMs: Math.max(0, segment.startMs),
      endMs: Math.min(durationMs, segment.endMs),
    }));
  }

  private async resolveOutputDir(outputDir?: string): Promise<string> {
    const resolved =
      outputDir && outputDir.trim().length > 0
        ? path.resolve(outputDir)
        : path.join(process.cwd(), 'media-previews');
    await fs.mkdir(resolved, { recursive: true });
    return resolved;
  }

  private buildOutputStem(sourcePath: string): string {
    const base = path.basename(sourcePath, path.extname(sourcePath));
    const sanitized = base.replace(/[^a-zA-Z0-9_-]+/g, '_').toLowerCase();
    return sanitized.length > 0 ? sanitized : 'media';
  }

  private async renderPreviews(
    sourcePath: string,
    outputDir: string,
    stem: string,
    suffix: string,
    segments: SilenceInterval[],
    warnings: string[],
  ): Promise<{
    original: MediaPreview | null;
    trimmed: MediaPreview | null;
  }> {
    const originalPath = path.join(outputDir, `${stem}-${suffix}-original.mp3`);
    const trimmedPath = path.join(outputDir, `${stem}-${suffix}-trimmed.mp3`);

    const originalPreview = await this.renderOriginalPreview(sourcePath, originalPath);

    let trimmedPreview: MediaPreview | null = null;
    if (segments.length > 0) {
      try {
        trimmedPreview = await this.renderTrimmedPreview(sourcePath, trimmedPath, segments);
      } catch (error) {
        warnings.push(
          `Impossible de générer la version sans silences : ${(error as Error).message}`,
        );
      }
    }

    return {
      original: originalPreview,
      trimmed: trimmedPreview,
    };
  }

  private async renderOriginalPreview(
    sourcePath: string,
    targetPath: string,
  ): Promise<MediaPreview> {
    await this.runCommand(this.ffmpegPath, [
      '-y',
      '-i',
      sourcePath,
      '-vn',
      '-map',
      '0:a:0?',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '3',
      targetPath,
    ]);

    const base64 = await this.readBase64(targetPath);

    return {
      label: 'original',
      format: 'mp3',
      path: targetPath,
      fileUrl: pathToFileURL(targetPath).toString(),
      base64,
    };
  }

  private async renderTrimmedPreview(
    sourcePath: string,
    targetPath: string,
    segments: SilenceInterval[],
  ): Promise<MediaPreview> {
    const filterComplex = this.buildTrimFilterComplex(segments);

    await this.runCommand(this.ffmpegPath, [
      '-y',
      '-i',
      sourcePath,
      '-vn',
      '-filter_complex',
      filterComplex,
      '-map',
      '[aout]',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '3',
      targetPath,
    ]);

    const base64 = await this.readBase64(targetPath);

    return {
      label: 'trimmed',
      format: 'mp3',
      path: targetPath,
      fileUrl: pathToFileURL(targetPath).toString(),
      base64,
    };
  }

  private async transcribeChunkExports(
    chunkExports: MediaChunkExport[],
    options: NormalizedTranscriptionOptions,
  ): Promise<MediaChunkTranscription[]> {
    if (options.engine === 'whisper') {
      return this.transcribeWithWhisper(chunkExports, options);
    } else {
      return this.transcribeWithVosk(chunkExports, options);
    }
  }

  private async transcribeWithWhisper(
    chunkExports: MediaChunkExport[],
    options: NormalizedTranscriptionOptions,
  ): Promise<MediaChunkTranscription[]> {
    console.log('Starting Whisper transcription for', chunkExports.length, 'chunks');

    const results: MediaChunkTranscription[] = [];

    for (const chunk of chunkExports) {
      try {
        const segments = await this.whisperService.transcribe(chunk.wavPath, {
          modelName: options.modelName || 'medium',
          modelPath: options.modelPath || undefined,
          language: (options.language || 'auto') as
            | 'auto'
            | 'en'
            | 'fr'
            | 'es'
            | 'de'
            | 'it'
            | 'pt'
            | 'nl'
            | 'ja'
            | 'zh',
          wordTimestamps: options.enableWords,
        });

        // Convert Whisper segments to our format
        const fullText = segments.map((s) => String(s.speech || '')).join(' ');

        // Parse word timestamps if available
        const words: MediaChunkTranscriptionWord[] = [];
        if (options.enableWords) {
          for (const segment of segments) {
            const startSec = parseTimestampToSeconds(segment.start);
            const endSec = parseTimestampToSeconds(segment.end);
            const speechStr = String(segment.speech || '');
            const segmentWords = speechStr.split(/\s+/).filter((w) => w.length > 0);

            // Distribute time equally across words in the segment (approximation)
            const duration = endSec - startSec;
            const timePerWord = duration / Math.max(1, segmentWords.length);

            segmentWords.forEach((word, index) => {
              words.push({
                word,
                startSec: startSec + index * timePerWord,
                endSec: startSec + (index + 1) * timePerWord,
                confidence: null, // Whisper doesn't provide word-level confidence
              });
            });
          }
        }

        results.push({
          chunkId: chunk.id,
          text: fullText,
          confidence: null, // Whisper doesn't provide overall confidence
          words,
          rawResult: { segments }, // Store raw Whisper output
        });
      } catch (error) {
        console.error(`Whisper transcription failed for chunk ${chunk.id}:`, error);
        results.push({
          chunkId: chunk.id,
          text: '',
          confidence: null,
          words: [],
          rawResult: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  private async transcribeWithVosk(
    chunkExports: MediaChunkExport[],
    options: NormalizedTranscriptionOptions,
  ): Promise<MediaChunkTranscription[]> {
    if (!options.modelPath) {
      throw new Error('Chemin du modèle Vosk non défini.');
    }

    try {
      await fs.access(options.modelPath);
    } catch {
      throw new Error(`Le modèle Vosk est introuvable à l'emplacement ${options.modelPath}.`);
    }

    let vosk: VoskModule;
    try {
      vosk = nodeRequire('vosk') as VoskModule;
    } catch {
      throw new Error(
        'Le module "vosk" est introuvable. Installez-le via "pnpm add vosk" puis relancez la transcription.',
      );
    }

    vosk.setLogLevel(0);

    const model = new vosk.Model(options.modelPath);
    try {
      const results: MediaChunkTranscription[] = [];
      for (const chunk of chunkExports) {
        results.push(await this.transcribeSingleChunk(vosk, model, chunk, options));
      }
      return results;
    } finally {
      model.free();
    }
  }

  private async transcribeSingleChunk(
    vosk: VoskModule,
    model: InstanceType<VoskModule['Model']>,
    chunk: MediaChunkExport,
    options: NormalizedTranscriptionOptions,
  ): Promise<MediaChunkTranscription> {
    try {
      const buffer = await fs.readFile(chunk.wavPath);
      const parsed = this.parseWavBuffer(buffer);

      if (parsed.audioFormat !== 1) {
        throw new Error('Format WAV non PCM détecté.');
      }

      if (parsed.channels !== 1) {
        throw new Error('Le chunk doit être mono pour la transcription Vosk.');
      }

      if (parsed.bitsPerSample !== 16) {
        throw new Error('Le chunk doit être encodé en PCM 16 bits.');
      }

      const recognizer = new vosk.Recognizer({
        model,
        sampleRate: parsed.sampleRate,
        maxAlternatives: options.maxAlternatives,
        words: options.enableWords,
      });

      try {
        const frameSize = 4096;
        for (let offset = 0; offset < parsed.data.length; offset += frameSize) {
          const slice = parsed.data.subarray(
            offset,
            Math.min(offset + frameSize, parsed.data.length),
          );
          recognizer.acceptWaveform(slice);
        }

        const finalResult = recognizer.finalResult();
        const parsedResult = this.parseVoskResult(finalResult);

        return {
          chunkId: chunk.id,
          text: parsedResult.text,
          confidence: parsedResult.confidence,
          words: parsedResult.words,
          rawResult: parsedResult.raw ?? null,
        };
      } finally {
        recognizer.free();
      }
    } catch (error) {
      return {
        chunkId: chunk.id,
        text: '',
        confidence: null,
        words: [],
        rawResult: null,
        error: (error as Error).message,
      };
    }
  }

  private async renderChunkExports(
    sourcePath: string,
    outputDir: string,
    stem: string,
    suffix: string,
    segments: SilenceInterval[],
  ): Promise<MediaChunkExportBundle> {
    if (segments.length === 0) {
      return {
        exports: [],
        directoryPath: '',
        directoryUrl: '',
      };
    }

    const chunkDir = path.join(outputDir, `${stem}-${suffix}-chunks`);
    await fs.mkdir(chunkDir, { recursive: true });

    const exports: MediaChunkExport[] = [];

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      if (segment.endMs <= segment.startMs) {
        continue;
      }

      const chunkId = `chunk-${index + 1}`;
      const chunkFileName = `${stem}-${suffix}-${chunkId}.wav`;
      const chunkPath = path.join(chunkDir, chunkFileName);
      const filter = this.buildSingleTrimFilter(segment);

      await this.runCommand(this.ffmpegPath, [
        '-y',
        '-i',
        sourcePath,
        '-vn',
        '-filter_complex',
        filter,
        '-map',
        '[aout]',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '16000',
        '-ac',
        '1',
        chunkPath,
      ]);

      exports.push({
        id: chunkId,
        startMs: segment.startMs,
        endMs: segment.endMs,
        durationMs: Math.max(0, Math.round(segment.endMs - segment.startMs)),
        wavPath: chunkPath,
        wavUrl: pathToFileURL(chunkPath).toString(),
      });
    }

    return {
      exports,
      directoryPath: chunkDir,
      directoryUrl: pathToFileURL(chunkDir).toString(),
    };
  }

  private parseVoskResult(rawResult: string): {
    text: string;
    words: MediaChunkTranscriptionWord[];
    raw: Record<string, unknown> | null;
    confidence: number | null;
  } {
    if (!rawResult) {
      return {
        text: '',
        words: [],
        raw: null,
        confidence: null,
      };
    }

    try {
      const parsed = JSON.parse(rawResult) as Record<string, unknown>;
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      const rawEntries = (parsed as { result?: unknown }).result;
      const words: MediaChunkTranscriptionWord[] = [];

      if (Array.isArray(rawEntries)) {
        for (const entry of rawEntries as Array<Record<string, unknown>>) {
          const wordValue = entry['word'];
          if (typeof wordValue !== 'string' || wordValue.trim().length === 0) {
            continue;
          }

          const start = this.toNumber(entry['start']);
          const end = this.toNumber(entry['end']);
          const confidence = this.toNumber(entry['conf']);

          words.push({
            word: wordValue,
            startSec: start ?? 0,
            endSec: end ?? start ?? 0,
            confidence: confidence,
          });
        }
      }

      return {
        text,
        words,
        raw: parsed,
        confidence: this.computeAverageConfidence(words),
      };
    } catch {
      return {
        text: rawResult.trim(),
        words: [],
        raw: null,
        confidence: null,
      };
    }
  }

  private computeAverageConfidence(words: MediaChunkTranscriptionWord[]): number | null {
    const confidences = words
      .map((word) => word.confidence)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (confidences.length === 0) {
      return null;
    }

    const total = confidences.reduce((sum, value) => sum + value, 0);
    return total / confidences.length;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private parseWavBuffer(buffer: Buffer): ParsedWav {
    if (buffer.length < 44) {
      throw new Error('Fichier WAV incomplet.');
    }

    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('En-tête WAV invalide.');
    }

    let offset = 12;
    let audioFormat: number | null = null;
    let channels: number | null = null;
    let sampleRate: number | null = null;
    let bitsPerSample: number | null = null;
    let data: Buffer | null = null;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkSize;

      if (chunkEnd > buffer.length) {
        throw new Error('Chunk WAV tronqué détecté.');
      }

      if (chunkId === 'fmt ') {
        audioFormat = buffer.readUInt16LE(chunkStart);
        channels = buffer.readUInt16LE(chunkStart + 2);
        sampleRate = buffer.readUInt32LE(chunkStart + 4);
        bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
      } else if (chunkId === 'data') {
        data = buffer.subarray(chunkStart, chunkEnd);
        break;
      }

      offset = chunkEnd + (chunkSize % 2 === 1 ? 1 : 0);
    }

    if (
      audioFormat === null ||
      channels === null ||
      sampleRate === null ||
      bitsPerSample === null ||
      data === null
    ) {
      throw new Error('Impossible de lire les métadonnées WAV.');
    }

    return {
      audioFormat,
      channels,
      sampleRate,
      bitsPerSample,
      data,
    };
  }

  private buildTrimFilterComplex(segments: SilenceInterval[]): string {
    const validSegments = segments.filter((segment) => segment.endMs > segment.startMs);

    if (validSegments.length === 0) {
      throw new Error('Aucun segment audio valide pour la génération sans silences.');
    }

    if (validSegments.length === 1) {
      const segment = validSegments[0];
      const startSeconds = (segment.startMs / 1000).toFixed(3);
      const endSeconds = (segment.endMs / 1000).toFixed(3);
      return `[0:a]atrim=start=${startSeconds}:end=${endSeconds},asetpts=PTS-STARTPTS[aout]`;
    }

    const trimSegments = validSegments.map((segment, index) => {
      const startSeconds = (segment.startMs / 1000).toFixed(3);
      const endSeconds = (segment.endMs / 1000).toFixed(3);
      return `[0:a]atrim=start=${startSeconds}:end=${endSeconds},asetpts=PTS-STARTPTS[a${index}]`;
    });

    const concatInputs = validSegments.map((_, index) => `[a${index}]`).join('');
    return `${trimSegments.join(';')};${concatInputs}concat=n=${validSegments.length}:v=0:a=1[aout]`;
  }

  private buildSingleTrimFilter(segment: SilenceInterval): string {
    const startSeconds = (segment.startMs / 1000).toFixed(3);
    const endSeconds = (segment.endMs / 1000).toFixed(3);
    return `[0:a]atrim=start=${startSeconds}:end=${endSeconds},asetpts=PTS-STARTPTS[aout]`;
  }

  private async readBase64(filePath: string): Promise<string> {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  }

  private async runCommand(commandPath: string, args: string[]): Promise<CommandResult> {
    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(commandPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.once('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new Error(
              `Le binaire "${commandPath}" est introuvable. Installez ffmpeg/ffprobe ou définissez les variables d'environnement FFMPEG_PATH et FFPROBE_PATH.`,
            ),
          );
          return;
        }
        reject(error);
      });

      child.once('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(
            new Error(
              `La commande "${commandPath} ${args.join(' ')}" s'est terminée avec le code ${code}.` +
                (stderr ? `\n--- stderr ---\n${stderr}` : ''),
            ),
          );
        }
      });
    });
  }
}
