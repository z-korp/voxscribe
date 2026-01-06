declare module 'vosk' {
  export function setLogLevel(level: number): void;

  export class Model {
    constructor(modelPath: string);
    free(): void;
  }

  export type RecognizerOptions = {
    model: Model;
    sampleRate: number;
    maxAlternatives?: number;
    words?: boolean;
  };

  export class Recognizer {
    constructor(options: RecognizerOptions);
    acceptWaveform(data: Buffer): boolean;
    finalResult(): string;
    partialResult(): string;
    result(): string;
    free(): void;
  }
}
