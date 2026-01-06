import { useCallback, useRef, useState } from 'react';
import { RecordingState, DEFAULT_RECORDING_STATE } from '../types';
import type { CaptureStrategy, AudioDevice } from '../types/audio-devices';

type RecordingRefs = {
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  recordingStartTime: number;
  recordingTimer: number | null;
  activeStreams: MediaStream[];
  audioContext: AudioContext | null;
};

export function useRecording(setInfoMessage: (msg: string | null) => void) {
  const [recordingState, setRecordingState] = useState<RecordingState>(DEFAULT_RECORDING_STATE);

  // Use a single ref object to avoid stale closure issues
  const refs = useRef<RecordingRefs>({
    mediaRecorder: null,
    recordedChunks: [],
    recordingStartTime: 0,
    recordingTimer: null,
    activeStreams: [],
    audioContext: null,
  });

  const stopRecordingStreams = useCallback((): void => {
    refs.current.activeStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    refs.current.activeStreams = [];

    if (refs.current.audioContext) {
      refs.current.audioContext.close();
      refs.current.audioContext = null;
    }

    if (refs.current.recordingTimer !== null) {
      window.clearInterval(refs.current.recordingTimer);
      refs.current.recordingTimer = null;
    }
  }, []);

  /**
   * Strategy A: Loopback capture (Stereo Mix, VB-Cable, etc.)
   * Captures all system audio automatically
   */
  const startLoopbackCapture = useCallback(
    async (deviceId: string, deviceLabel: string): Promise<MediaStream> => {
      try {
        // Try direct device capture (Stereo Mix, VB-Cable)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        refs.current.activeStreams.push(stream);
        setInfoMessage(`✅ Capturing all system audio via ${deviceLabel}`);
        return stream;
      } catch (error) {
        console.error('Loopback capture failed:', error);
        throw new Error(`Failed to capture loopback device: ${deviceLabel}`);
      }
    },
    [setInfoMessage],
  );

  /**
   * Strategy B: Multi-source capture (Arctis Chat + Game, etc.)
   * Captures multiple audio devices and mixes them together
   */
  const startMultiSourceCapture = useCallback(
    async (
      deviceIds: string[],
      deviceLabels: string[],
      includeMicrophone: boolean,
    ): Promise<MediaStream> => {
      const audioContext = new AudioContext();
      refs.current.audioContext = audioContext;

      const destination = audioContext.createMediaStreamDestination();

      // Capture each source
      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const label = deviceLabels[i];

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } },
          });

          const source = audioContext.createMediaStreamSource(stream);
          source.connect(destination);

          refs.current.activeStreams.push(stream);
          console.log(`Captured source: ${label}`);
        } catch (error) {
          console.warn(`Failed to capture ${label}:`, error);
        }
      }

      // Add microphone if requested
      if (includeMicrophone) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });

          const micSource = audioContext.createMediaStreamSource(micStream);
          micSource.connect(destination);

          refs.current.activeStreams.push(micStream);
          console.log('Microphone added to mix');
        } catch (error) {
          console.warn('Failed to add microphone:', error);
        }
      }

      setInfoMessage(`✅ Mixing ${deviceIds.length} audio sources`);
      return destination.stream;
    },
    [setInfoMessage],
  );

  /**
   * Strategy C: System Audio Loopback (Windows 10 1903+)
   * Uses getDisplayMedia with system audio - GENERIC solution for all Windows users
   */
  const startSystemAudioCapture = useCallback(
    async (includeMicrophone: boolean): Promise<MediaStream> => {
      try {
        // Request screen share with system audio
        // On Windows 10 1903+, this captures ALL system audio via WASAPI loopback
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true, // This will capture system audio on Windows 10 1903+
          video: true, // Required but we'll stop the video track
        });

        refs.current.activeStreams.push(displayStream);

        // Stop video track immediately (we only want audio)
        displayStream.getVideoTracks().forEach((track) => track.stop());

        let finalStream: MediaStream;

        if (includeMicrophone) {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
          refs.current.activeStreams.push(micStream);

          const audioContext = new AudioContext();
          refs.current.audioContext = audioContext;

          const destination = audioContext.createMediaStreamDestination();
          const systemSource = audioContext.createMediaStreamSource(displayStream);
          const micSource = audioContext.createMediaStreamSource(micStream);

          systemSource.connect(destination);
          micSource.connect(destination);

          finalStream = destination.stream;
        } else {
          finalStream = new MediaStream(displayStream.getAudioTracks());
        }

        setInfoMessage('✅ Capturing all system audio (generic method)');
        return finalStream;
      } catch (error) {
        console.warn('System audio capture failed, trying fallback:', error);
        throw error;
      }
    },
    [setInfoMessage],
  );

  /**
   * Strategy D: Desktop fallback (legacy method)
   * Captures desktop audio via Electron desktopCapturer
   */
  const startDesktopCapture = useCallback(
    async (includeMicrophone: boolean): Promise<MediaStream> => {
      const api = window.electronAPI;
      if (!api?.getRecordingSources) {
        throw new Error('Recording API is not available.');
      }

      const sources = await api.getRecordingSources();
      if (sources.length === 0) {
        throw new Error('No audio sources available.');
      }

      const selectedSourceId = sources[0].id;

      const systemStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-expect-error - Electron-specific constraint
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSourceId,
          },
        },
        video: {
          // @ts-expect-error - Electron-specific constraint
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSourceId,
          },
        },
      });

      refs.current.activeStreams.push(systemStream);
      systemStream.getVideoTracks().forEach((track) => track.stop());

      let finalStream: MediaStream;

      if (includeMicrophone) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        refs.current.activeStreams.push(micStream);

        const audioContext = new AudioContext();
        refs.current.audioContext = audioContext;

        const destination = audioContext.createMediaStreamDestination();
        const systemSource = audioContext.createMediaStreamSource(systemStream);
        const micSource = audioContext.createMediaStreamSource(micStream);

        systemSource.connect(destination);
        micSource.connect(destination);

        finalStream = destination.stream;
      } else {
        finalStream = new MediaStream(systemStream.getAudioTracks());
      }

      return finalStream;
    },
    [],
  );

  /**
   * Get capture strategy based on available audio devices
   */
  const getCaptureStrategy = useCallback(async (): Promise<{
    strategy: CaptureStrategy;
    devices: AudioDevice[];
  }> => {
    // Request permission first
    await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    // Enumerate devices
    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = mediaDevices.filter((d) => d.kind === 'audioinput');

    // Convert to AudioDevice format
    const devices: AudioDevice[] = audioInputs.map((d) => {
      const label = d.label.toLowerCase();

      // Classify device type
      let type: AudioDevice['type'] = 'microphone';
      if (
        label.includes('stereo mix') ||
        label.includes('mixage') ||
        label.includes('vb-cable') ||
        label.includes('blackhole') ||
        label.includes('loopback')
      ) {
        type = 'loopback';
      } else if (label.includes('chat') || label.includes('game')) {
        type = 'multi-output';
      }

      return {
        id: d.deviceId,
        label: d.label || `Device ${d.deviceId.slice(0, 8)}`,
        kind: 'audioinput',
        type,
        isDefault: d.deviceId === 'default',
        groupId: d.groupId,
      };
    });

    // Get recommended strategy
    const api = window.electronAPI;
    if (api?.recommendCaptureStrategy) {
      const strategy = await api.recommendCaptureStrategy(devices);
      return { strategy, devices };
    }

    // Fallback strategy
    return {
      strategy: {
        type: 'desktop-fallback',
        sourceId: '',
        warning: 'Using desktop capture fallback',
        suggestStereoMix: process.platform === 'win32',
      },
      devices,
    };
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      // Get current microphone setting
      let includeMicrophone = false;
      setRecordingState((prev) => {
        includeMicrophone = prev.includeMicrophone;
        return prev;
      });

      stopRecordingStreams();
      refs.current.recordedChunks = [];

      let finalStream: MediaStream;

      // GENERIC APPROACH: Try system audio loopback first (Windows 10 1903+)
      // This works for ALL users without any configuration
      try {
        finalStream = await startSystemAudioCapture(includeMicrophone);
        console.log('✅ Using system audio loopback (generic method)');
      } catch (error) {
        console.warn('System audio loopback failed, trying alternative methods:', error);

        // Fallback: Get capture strategy
        const { strategy } = await getCaptureStrategy();

        // Execute fallback strategy
        switch (strategy.type) {
          case 'loopback':
            finalStream = await startLoopbackCapture(strategy.deviceId, strategy.deviceLabel);
            break;

          case 'multi-source':
            finalStream = await startMultiSourceCapture(
              strategy.deviceIds,
              strategy.deviceLabels,
              includeMicrophone,
            );
            break;

          case 'desktop-fallback':
            finalStream = await startDesktopCapture(includeMicrophone);
            if (strategy.suggestStereoMix) {
              setInfoMessage(`⚠️ ${strategy.warning}`);
            }
            break;

          default:
            throw new Error('Unknown capture strategy');
        }
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event): void => {
        if (event.data.size > 0) {
          refs.current.recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async (): Promise<void> => {
        stopRecordingStreams();

        const blob = new Blob(refs.current.recordedChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();

        setRecordingState((prev) => ({ ...prev, status: 'saving' }));

        try {
          const saveApi = window.electronAPI;
          if (!saveApi?.saveRecording) {
            throw new Error('Save API is not available.');
          }

          const result = await saveApi.saveRecording({ buffer: arrayBuffer });

          setRecordingState((prev) => ({
            ...prev,
            status: 'done',
            savedFilePath: result.filePath,
          }));

          setInfoMessage(`Recording saved: ${result.filePath}`);
        } catch (error) {
          console.error('Save failed', error);
          setRecordingState((prev) => ({
            ...prev,
            status: 'error',
            error: 'Failed to save recording.',
          }));
        }
      };

      refs.current.mediaRecorder = mediaRecorder;
      mediaRecorder.start(1000);

      refs.current.recordingStartTime = Date.now();
      setRecordingState((prev) => ({
        ...prev,
        status: 'recording',
        durationMs: 0,
        error: undefined,
      }));

      refs.current.recordingTimer = window.setInterval(() => {
        const elapsed = Date.now() - refs.current.recordingStartTime;
        setRecordingState((prev) => ({ ...prev, durationMs: elapsed }));
      }, 100);
    } catch (error) {
      console.error('Recording failed to start', error);
      stopRecordingStreams();
      setRecordingState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start recording.',
      }));
    }
  }, [
    stopRecordingStreams,
    startSystemAudioCapture,
    getCaptureStrategy,
    startLoopbackCapture,
    startMultiSourceCapture,
    startDesktopCapture,
    setInfoMessage,
  ]);

  const stopRecording = useCallback((): void => {
    const recorder = refs.current.mediaRecorder;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    refs.current.mediaRecorder = null;
  }, []);

  const handleToggleMicrophone = useCallback((enabled: boolean): void => {
    setRecordingState((prev) => ({ ...prev, includeMicrophone: enabled }));
  }, []);

  const handleResetRecording = useCallback((): void => {
    stopRecordingStreams();
    setRecordingState(DEFAULT_RECORDING_STATE);
  }, [stopRecordingStreams]);

  return {
    recordingState,
    setRecordingState,
    startRecording,
    stopRecording,
    stopRecordingStreams,
    handleToggleMicrophone,
    handleResetRecording,
  };
}
