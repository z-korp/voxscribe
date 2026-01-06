import { useState, useEffect, useCallback } from 'react';
import type { AudioDevice, CaptureStrategy, AudioDeviceType } from '../../main/types/audio-devices';

/**
 * Hook to detect and manage audio devices
 * Enumerates devices, classifies them, and recommends capture strategy
 */
export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [strategy, setStrategy] = useState<CaptureStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Classify a device by its label
   */
  const classifyDevice = useCallback((label: string, kind: MediaDeviceKind): AudioDeviceType => {
    const lowerLabel = label.toLowerCase();

    // Loopback patterns
    const loopbackPatterns = [
      /stereo\s*mix/i,
      /mixage\s*st[ée]r[ée]o/i,
      /vb-cable/i,
      /blackhole/i,
      /soundflower/i,
      /loopback/i,
      /wave\s*out/i,
      /what\s*u\s*hear/i,
    ];

    for (const pattern of loopbackPatterns) {
      if (pattern.test(lowerLabel)) {
        return 'loopback';
      }
    }

    // Virtual devices
    if (lowerLabel.includes('virtual') || lowerLabel.includes('cable')) {
      return 'virtual';
    }

    // Multi-output devices (Arctis, etc.)
    if (lowerLabel.includes('chat') || lowerLabel.includes('game')) {
      return 'multi-output';
    }

    if (lowerLabel.includes('voice') || lowerLabel.includes('music')) {
      return 'multi-output';
    }

    // Default
    return kind === 'audioinput' ? 'microphone' : 'system';
  }, []);

  /**
   * Convert MediaDeviceInfo to AudioDevice
   */
  const convertToAudioDevice = useCallback(
    (device: MediaDeviceInfo, defaultDeviceId: string | null): AudioDevice => {
      const type = classifyDevice(device.label, device.kind as MediaDeviceKind);

      return {
        id: device.deviceId,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 8)}`,
        kind: device.kind as 'audioinput' | 'audiooutput',
        type,
        isDefault: device.deviceId === defaultDeviceId,
        groupId: device.groupId,
      };
    },
    [classifyDevice],
  );

  /**
   * Enumerate all audio devices
   */
  const enumerateDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
      });

      // Get all devices
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();

      // Get default audio input device
      const defaultDevice = mediaDevices.find(
        (d) => d.kind === 'audioinput' && d.deviceId === 'default',
      );
      const defaultDeviceId = defaultDevice?.deviceId || null;

      // Convert to AudioDevice objects
      const audioDevices = mediaDevices
        .filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput')
        .map((d) => convertToAudioDevice(d, defaultDeviceId));

      setDevices(audioDevices);

      // Get recommended strategy
      const api = window.electronAPI;
      if (api?.recommendCaptureStrategy) {
        const recommendedStrategy = await api.recommendCaptureStrategy(audioDevices);
        setStrategy(recommendedStrategy);
      }
    } catch (err) {
      console.error('Failed to enumerate audio devices:', err);
      setError(err instanceof Error ? err.message : 'Failed to enumerate audio devices');
    } finally {
      setLoading(false);
    }
  }, [convertToAudioDevice]);

  /**
   * Refresh devices (for after user enables Stereo Mix, etc.)
   */
  const refreshDevices = useCallback(async () => {
    await enumerateDevices();
  }, [enumerateDevices]);

  /**
   * Test a device by capturing audio for a short duration
   */
  const testDevice = useCallback(async (deviceId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      // Create audio context to measure level
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Measure for 2 seconds
      const startTime = Date.now();
      let maxLevel = 0;

      await new Promise<void>((resolve) => {
        const measure = () => {
          analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          maxLevel = Math.max(maxLevel, average);

          if (Date.now() - startTime < 2000) {
            requestAnimationFrame(measure);
          } else {
            resolve();
          }
        };
        measure();
      });

      // Cleanup
      stream.getTracks().forEach((track) => track.stop());
      audioContext.close();

      // Convert to dB (rough approximation)
      const dB = maxLevel > 0 ? 20 * Math.log10(maxLevel / 255) : -100;

      return {
        success: true,
        audioLevel: Math.round(dB),
        duration: 2000,
      };
    } catch (err) {
      return {
        success: false,
        audioLevel: 0,
        error: err instanceof Error ? err.message : 'Test failed',
      };
    }
  }, []);

  /**
   * Get devices by type
   */
  const getDevicesByType = useCallback(
    (type: AudioDeviceType) => {
      return devices.filter((d) => d.type === type);
    },
    [devices],
  );

  // Load devices on mount
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    devices,
    strategy,
    loading,
    error,
    refreshDevices,
    testDevice,
    getDevicesByType,
  };
}
