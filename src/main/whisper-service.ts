import { downloadWhisperModel, installWhisperCpp, transcribe } from '@remotion/install-whisper-cpp';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// Whisper model names supported by @remotion/install-whisper-cpp
export type WhisperModelName =
  | 'tiny'
  | 'tiny.en'
  | 'base'
  | 'base.en'
  | 'small'
  | 'small.en'
  | 'medium'
  | 'medium.en'
  | 'large-v1'
  | 'large-v2'
  | 'large-v3';

// Language codes supported by Whisper
export type WhisperLanguage =
  | 'auto'
  | 'en'
  | 'fr'
  | 'es'
  | 'de'
  | 'it'
  | 'pt'
  | 'nl'
  | 'ja'
  | 'zh'
  | 'ko'
  | 'ru'
  | 'ar'
  | 'pl'
  | 'sv'
  | 'da'
  | 'fi'
  | 'no'
  | 'tr'
  | 'uk'
  | 'vi'
  | 'th'
  | 'id'
  | 'ms'
  | 'hi'
  | 'cs'
  | 'el'
  | 'he'
  | 'hu'
  | 'ro';

export type WhisperTranscriptSegment = {
  start: string;
  end: string;
  speech: string;
};

export type WhisperOptions = {
  modelName?: string; // 'tiny', 'base', 'small', 'medium', 'large'
  modelPath?: string; // custom model path
  language?: WhisperLanguage; // 'auto', 'en', 'fr', etc.
  wordTimestamps?: boolean;
};

// Whisper metadata patterns to filter out (system messages, not actual speech)
const WHISPER_METADATA_PATTERNS = [
  /\[BLANK_AUDIO\]/gi,
  /\[SOUND\]/gi,
  /\[MUSIC\]/gi,
  /\[NOISE\]/gi,
  /\[SILENCE\]/gi,
  /\[INAUDIBLE\]/gi,
  /\[_[A-Z]+\]/gi, // [_TT_xxx] internal tokens
  /\[\s*(?:French|English|Spanish|German|Italian|Portuguese|Dutch|Japanese|Chinese|Korean|Russian|Arabic)\s+(?:translation|speech|audio)\s*\]/gi,
];

export class WhisperService {
  private whisperPath: string;
  private whisperVersion = '1.5.5'; // Match @remotion/install-whisper-cpp supported version
  private isInitialized = false;

  constructor() {
    // Store whisper.cpp in appData/callcenter-audio-capture/whisper.cpp/
    const appDataPath = app.getPath('userData');
    this.whisperPath = path.join(appDataPath, 'whisper.cpp');
  }

  /**
   * Initialize whisper.cpp by downloading binaries if needed
   */
  private async ensureWhisperInstalled(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Check if whisper.cpp binaries already exist
    const mainExecutable = process.platform === 'win32' ? 'main.exe' : 'main';
    const executablePath = path.join(this.whisperPath, mainExecutable);

    if (!fs.existsSync(executablePath)) {
      console.log('Installing whisper.cpp binaries...');
      await installWhisperCpp({
        to: this.whisperPath,
        version: this.whisperVersion,
      });
      console.log('whisper.cpp installed successfully');
    }

    this.isInitialized = true;
  }

  /**
   * Ensure a model is downloaded
   */
  private async ensureModelDownloaded(modelName: string): Promise<void> {
    const modelPath = path.join(this.whisperPath, `ggml-${modelName}.bin`);

    if (!fs.existsSync(modelPath)) {
      console.log(`Downloading Whisper model: ${modelName}...`);
      await downloadWhisperModel({
        model: modelName as WhisperModelName,
        folder: this.whisperPath,
      });
      console.log(`Model ${modelName} downloaded successfully`);
    }
  }

  /**
   * Transcribe an audio file using Whisper
   */
  async transcribe(
    audioFilePath: string,
    options: WhisperOptions = {},
  ): Promise<WhisperTranscriptSegment[]> {
    const { modelName = 'medium', language = 'auto' } = options;

    // Check if audio file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    try {
      // Ensure whisper.cpp is installed
      await this.ensureWhisperInstalled();

      // Determine model name based on language
      // Use .en suffix only for English, otherwise use multilingual model
      const modelSuffix = language === 'en' ? '.en' : '';
      const fullModelName = `${modelName}${modelSuffix}`;

      // Ensure model is downloaded
      await this.ensureModelDownloaded(fullModelName);

      console.log('Starting Whisper transcription:', {
        file: audioFilePath,
        model: fullModelName,
        language,
      });

      // Transcribe using @remotion/install-whisper-cpp
      // IMPORTANT: translateToEnglish must be false to get transcription in original language
      const result = await transcribe({
        inputPath: audioFilePath,
        whisperPath: this.whisperPath,
        whisperCppVersion: this.whisperVersion,
        model: fullModelName as WhisperModelName,
        tokenLevelTimestamps: true,
        translateToEnglish: false, // DO NOT translate - transcribe in original language
        language: language === 'auto' ? undefined : (language as WhisperLanguage),
        printOutput: false, // Disable verbose output in production
      });

      console.log('Whisper transcription complete');

      // Convert result to our segment format
      // @remotion/install-whisper-cpp returns:
      // {
      //   transcription: Array<{timestamps: {from, to}, offsets: {from, to}, text: string, tokens?: Array}>
      //   ...other metadata
      // }
      const segments: WhisperTranscriptSegment[] = [];

      // Debug: log structure
      console.log(
        'Whisper result keys:',
        Object.keys(result),
        'transcription is array:',
        Array.isArray(result.transcription),
      );

      if (result.transcription && Array.isArray(result.transcription)) {
        for (const item of result.transcription) {
          // item format: {timestamps: {from: "00:00:00", to: "00:00:05"}, text: string, ...}
          let text = typeof item.text === 'string' ? item.text.trim() : '';
          const startTime = item.timestamps?.from || '00:00:00.000';
          const endTime = item.timestamps?.to || '00:00:00.000';

          // Filter out Whisper metadata messages (system tokens, not actual speech)
          // Uses specific patterns to avoid removing legitimate content like [applause]
          text = this.filterWhisperMetadata(text);

          // Skip empty segments after filtering
          if (!text) {
            continue;
          }

          segments.push({
            start: startTime,
            end: endTime,
            speech: text,
          });
        }
      }

      // If we have segments, combine them into a single result for simplicity
      // (since Whisper returns many small token-level segments)
      if (segments.length > 0) {
        // Join with space, then clean up multiple spaces and spacing around punctuation
        const rawText = segments.map((s) => s.speech).join(' ');
        const fullText = rawText
          .replace(/\s+/g, ' ') // Multiple spaces to single
          .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
          .replace(/([.,!?;:])\s*/g, '$1 ') // Ensure space after punctuation
          .trim();
        const firstStart = segments[0].start;
        const lastEnd = segments[segments.length - 1].end;

        console.log('Transcription result:', fullText.slice(0, 200));

        // Return a single combined segment
        return [
          {
            start: firstStart,
            end: lastEnd,
            speech: fullText.trim(),
          },
        ];
      }

      return segments;
    } catch (error) {
      console.error('Whisper transcription failed:', error);
      throw new Error(
        `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Filter out Whisper metadata messages that are not actual speech
   * Uses specific patterns to preserve legitimate content like [applause], [laughing]
   */
  private filterWhisperMetadata(text: string): string {
    let filtered = text;
    for (const pattern of WHISPER_METADATA_PATTERNS) {
      filtered = filtered.replace(pattern, '');
    }
    // Clean up extra whitespace
    return filtered.replace(/\s+/g, ' ').trim();
  }

  /**
   * Convert seconds to HH:MM:SS.mmm format
   */
  private formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  /**
   * Get the path where whisper.cpp and models are stored
   */
  getWhisperPath(): string {
    return this.whisperPath;
  }

  /**
   * List available models in the whisper directory
   */
  listAvailableModels(): string[] {
    try {
      if (!fs.existsSync(this.whisperPath)) {
        return [];
      }
      const files = fs.readdirSync(this.whisperPath);
      return files.filter((file) => file.endsWith('.bin'));
    } catch {
      return [];
    }
  }

  /**
   * Check if a specific model exists
   */
  hasModel(modelName: string): boolean {
    const modelFile = `ggml-${modelName}.bin`;
    const modelPath = path.join(this.whisperPath, modelFile);
    return fs.existsSync(modelPath);
  }
}
