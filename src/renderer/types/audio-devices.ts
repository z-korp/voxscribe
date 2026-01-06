/**
 * Audio device types for renderer process
 * Duplicated from main process types to avoid tsconfig issues
 */

export type AudioDeviceType = 'microphone' | 'loopback' | 'system' | 'virtual' | 'multi-output';

export type AudioDevice = {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
  type: AudioDeviceType;
  isDefault: boolean;
  groupId?: string;
};

export type CaptureStrategy =
  | {
      type: 'loopback';
      deviceId: string;
      deviceLabel: string;
      confidence: 'high' | 'medium';
    }
  | {
      type: 'multi-source';
      deviceIds: string[];
      deviceLabels: string[];
      reason: string;
    }
  | {
      type: 'desktop-fallback';
      sourceId: string;
      warning: string;
      suggestStereoMix: boolean;
    };

export type AudioDeviceTestResult = {
  success: boolean;
  audioLevel: number;
  error?: string;
  duration?: number;
};
