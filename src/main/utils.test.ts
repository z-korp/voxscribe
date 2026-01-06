import { describe, it, expect } from 'vitest';

// Test utility functions that can be extracted and tested independently

/**
 * Parse timestamp from "HH:MM:SS.mmm" format to seconds
 * (Extracted from media-chunker.ts for testing)
 */
function parseTimestampToSeconds(timestamp: string): number {
  const numericValue = parseFloat(timestamp);
  if (!isNaN(numericValue) && !timestamp.includes(':')) {
    return numericValue;
  }

  const match = timestamp.match(/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseFloat(match[3]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return parseFloat(timestamp) || 0;
}

/**
 * Format seconds to HH:MM:SS.mmm format
 * (Similar to whisper-service.ts formatTimestamp)
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
}

/**
 * Clean transcription text
 * (Similar to whisper-service.ts text cleaning)
 */
function cleanTranscriptionText(rawText: string): string {
  return rawText
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])\s*/g, '$1 ')
    .trim();
}

describe('parseTimestampToSeconds', () => {
  it('parses HH:MM:SS format', () => {
    expect(parseTimestampToSeconds('00:00:05')).toBe(5);
    expect(parseTimestampToSeconds('00:01:00')).toBe(60);
    expect(parseTimestampToSeconds('01:00:00')).toBe(3600);
  });

  it('parses HH:MM:SS.mmm format', () => {
    expect(parseTimestampToSeconds('00:00:05.500')).toBe(5.5);
    expect(parseTimestampToSeconds('00:01:30.250')).toBe(90.25);
  });

  it('parses complex timestamps', () => {
    expect(parseTimestampToSeconds('01:23:45.678')).toBeCloseTo(5025.678, 2);
  });

  it('handles numeric strings', () => {
    expect(parseTimestampToSeconds('5')).toBe(5);
    expect(parseTimestampToSeconds('5.5')).toBe(5.5);
  });

  it('returns 0 for invalid input', () => {
    expect(parseTimestampToSeconds('')).toBe(0);
    expect(parseTimestampToSeconds('invalid')).toBe(0);
  });
});

describe('formatTimestamp', () => {
  it('formats 0 seconds', () => {
    expect(formatTimestamp(0)).toBe('00:00:00.000');
  });

  it('formats seconds only', () => {
    expect(formatTimestamp(5)).toBe('00:00:05.000');
    expect(formatTimestamp(5.5)).toBe('00:00:05.500');
  });

  it('formats minutes and seconds', () => {
    expect(formatTimestamp(65)).toBe('00:01:05.000');
    expect(formatTimestamp(90.25)).toBe('00:01:30.250');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatTimestamp(3661)).toBe('01:01:01.000');
    expect(formatTimestamp(3723.456)).toBe('01:02:03.456');
  });
});

describe('cleanTranscriptionText', () => {
  it('removes multiple spaces', () => {
    expect(cleanTranscriptionText('hello   world')).toBe('hello world');
  });

  it('removes space before punctuation', () => {
    expect(cleanTranscriptionText('hello , world')).toBe('hello, world');
    expect(cleanTranscriptionText('hello . world')).toBe('hello. world');
  });

  it('ensures space after punctuation', () => {
    expect(cleanTranscriptionText('hello.world')).toBe('hello. world');
    expect(cleanTranscriptionText('hello,world')).toBe('hello, world');
  });

  it('trims whitespace', () => {
    expect(cleanTranscriptionText('  hello world  ')).toBe('hello world');
  });

  it('handles complex cases', () => {
    expect(cleanTranscriptionText('hello ,  world .  test')).toBe('hello, world. test');
  });

  it('handles empty string', () => {
    expect(cleanTranscriptionText('')).toBe('');
  });
});

describe('Timestamp Round-trip', () => {
  it('format then parse returns original value', () => {
    const values = [0, 5, 60, 3600, 3661.5, 7200.123];

    for (const original of values) {
      const formatted = formatTimestamp(original);
      const parsed = parseTimestampToSeconds(formatted);
      expect(parsed).toBeCloseTo(original, 2);
    }
  });
});
