import { desktopCapturer } from 'electron';
import type {
  AudioDevice,
  AudioDeviceType,
  CaptureStrategy,
  AudioDeviceTestResult,
} from './types/audio-devices';

/**
 * Service for detecting and managing audio devices
 * Handles loopback detection, multi-source devices, and capture strategy recommendation
 */
export class AudioDeviceService {
  // Patterns to detect loopback devices
  private readonly LOOPBACK_PATTERNS = [
    /stereo\s*mix/i,
    /mixage\s*st[ée]r[ée]o/i, // French
    /vb-cable/i,
    /vb\s*audio\s*cable/i,
    /blackhole/i,
    /soundflower/i,
    /loopback/i,
    /wave\s*out/i,
    /what\s*u\s*hear/i, // Creative/Realtek
  ];

  // Patterns to detect multi-output devices (like Arctis 7)
  private readonly MULTI_OUTPUT_PATTERNS = [
    { chat: /chat/i, game: /game/i },
    { voice: /voice/i, music: /music/i },
    { communication: /communication/i, media: /media/i },
  ];

  /**
   * Check if electron-audio-loopback is available
   */
  private async isElectronLoopbackAvailable(): Promise<boolean> {
    try {
      // Try to import electron-audio-loopback
      await import('electron-audio-loopback');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Classify a device by its label
   */
  private classifyDevice(label: string, kind: MediaDeviceKind): AudioDeviceType {
    const lowerLabel = label.toLowerCase();

    // Check for loopback devices
    for (const pattern of this.LOOPBACK_PATTERNS) {
      if (pattern.test(lowerLabel)) {
        return 'loopback';
      }
    }

    // Check for virtual devices
    if (lowerLabel.includes('virtual') || lowerLabel.includes('cable')) {
      return 'virtual';
    }

    // Check for multi-output indicators
    for (const patterns of this.MULTI_OUTPUT_PATTERNS) {
      if (patterns.chat?.test(lowerLabel) || patterns.game?.test(lowerLabel)) {
        return 'multi-output';
      }
    }

    // Default classification
    if (kind === 'audioinput') {
      return 'microphone';
    }

    return 'system';
  }

  /**
   * Enumerate all audio devices available in the system
   * Note: This method should be called from renderer process with getUserMedia permissions
   */
  async enumerateAudioDevices(): Promise<AudioDevice[]> {
    // This will be called from renderer via IPC
    // Return empty array for now, will be populated from renderer
    return [];
  }

  /**
   * Detect loopback device from a list of devices
   */
  detectLoopbackDevice(devices: AudioDevice[]): AudioDevice | null {
    // Prioritize devices by type
    const loopbackDevices = devices.filter((d) => d.type === 'loopback' || d.type === 'virtual');

    if (loopbackDevices.length === 0) {
      return null;
    }

    // Return default loopback if available, otherwise first one
    const defaultLoopback = loopbackDevices.find((d) => d.isDefault);
    return defaultLoopback || loopbackDevices[0];
  }

  /**
   * Detect multi-output devices (e.g., Arctis 7 Chat + Game)
   */
  detectMultiOutputDevices(devices: AudioDevice[]): AudioDevice[] {
    const multiOutputs = devices.filter((d) => d.type === 'multi-output');

    if (multiOutputs.length < 2) {
      return [];
    }

    // Group by groupId if available
    const grouped = new Map<string, AudioDevice[]>();
    for (const device of multiOutputs) {
      if (device.groupId) {
        const group = grouped.get(device.groupId) || [];
        group.push(device);
        grouped.set(device.groupId, group);
      }
    }

    // Find the largest group (most likely Chat + Game pair)
    let largestGroup: AudioDevice[] = [];
    for (const group of grouped.values()) {
      if (group.length > largestGroup.length) {
        largestGroup = group;
      }
    }

    // If we have at least 2 devices in a group, return them
    if (largestGroup.length >= 2) {
      return largestGroup;
    }

    // Fallback: try to match by patterns
    for (const patterns of this.MULTI_OUTPUT_PATTERNS) {
      const chatDevice = multiOutputs.find((d) => patterns.chat?.test(d.label));
      const gameDevice = multiOutputs.find((d) => patterns.game?.test(d.label));

      if (chatDevice && gameDevice) {
        return [chatDevice, gameDevice];
      }
    }

    return [];
  }

  /**
   * Recommend the best capture strategy based on available devices
   */
  async recommendCaptureStrategy(devices: AudioDevice[]): Promise<CaptureStrategy> {
    // Strategy 1: Check for loopback (best option)
    const loopback = this.detectLoopbackDevice(devices);
    if (loopback) {
      const hasElectronLoopback = await this.isElectronLoopbackAvailable();
      return {
        type: 'loopback',
        deviceId: loopback.id,
        deviceLabel: loopback.label,
        confidence: hasElectronLoopback ? 'high' : 'medium',
      };
    }

    // Strategy 2: Check for multi-output devices (Arctis Chat + Game)
    const multiDevices = this.detectMultiOutputDevices(devices);
    if (multiDevices.length >= 2) {
      return {
        type: 'multi-source',
        deviceIds: multiDevices.map((d) => d.id),
        deviceLabels: multiDevices.map((d) => d.label),
        reason: `Detected ${multiDevices.length} related audio outputs that will be mixed together`,
      };
    }

    // Strategy 3: Fallback to desktop capture
    const desktopSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 },
    });

    const sourceId = desktopSources[0]?.id || '';

    return {
      type: 'desktop-fallback',
      sourceId,
      warning:
        'No system audio loopback detected. Audio from background apps (like Discord) may not be captured.',
      suggestStereoMix: process.platform === 'win32',
    };
  }

  /**
   * Test an audio device by capturing a short sample
   * Returns audio level and success status
   */
  async testDevice(deviceId: string): Promise<AudioDeviceTestResult> {
    // This will be implemented from renderer side
    // Return mock result for now
    return {
      success: false,
      audioLevel: 0,
      error: 'Test must be called from renderer process',
    };
  }

  /**
   * Helper: Convert MediaDeviceInfo to AudioDevice
   */
  mediaDeviceToAudioDevice(device: MediaDeviceInfo, isDefault: boolean): AudioDevice {
    const type = this.classifyDevice(device.label, device.kind as MediaDeviceKind);

    return {
      id: device.deviceId,
      label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
      kind: device.kind as 'audioinput' | 'audiooutput',
      type,
      isDefault,
      groupId: device.groupId,
    };
  }
}
