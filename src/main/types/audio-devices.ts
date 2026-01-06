/**
 * Types for audio device detection and capture strategies
 */

export type AudioDeviceType =
  | 'microphone' // Physical microphone
  | 'loopback' // Stereo Mix, VB-Cable, BlackHole
  | 'system' // Desktop capturer audio
  | 'virtual' // Virtual Audio Cable
  | 'multi-output'; // Multi-output devices like Arctis Chat/Game

export type AudioDevice = {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  type: AudioDeviceType;
  isDefault: boolean;
  groupId?: string; // For grouping related devices (e.g., Chat + Game)
};

export type CaptureStrategy =
  | {
      type: 'loopback';
      deviceId: string;
      deviceLabel: string;
      confidence: 'high' | 'medium'; // High = electron-audio-loopback, Medium = Stereo Mix
    }
  | {
      type: 'multi-source';
      deviceIds: string[];
      deviceLabels: string[];
      reason: string; // Explanation for user (e.g., "Detected Arctis 7 Chat + Game")
    }
  | {
      type: 'desktop-fallback';
      sourceId: string;
      warning: string;
      suggestStereoMix: boolean;
    };

export type AudioDeviceTestResult = {
  success: boolean;
  audioLevel: number; // in dB
  error?: string;
  duration?: number; // Test duration in ms
};
