import { useCallback, useRef, useState } from 'react';
import { RecordingState, DEFAULT_RECORDING_STATE } from '../types';

export function useRecording(setInfoMessage: (msg: string | null) => void) {
  const [recordingState, setRecordingState] = useState<RecordingState>(DEFAULT_RECORDING_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<number | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const usingNativeAudioRef = useRef<boolean>(false);

  const stopRecordingStreams = useCallback((): void => {
    activeStreamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    activeStreamsRef.current = [];

    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.getRecordingSources) {
      setRecordingState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Recording API is not available.',
      }));
      return;
    }

    try {
      // PRIORITY 1: Try native C# multi-device audio capture
      if (api.nativeAudioCheckAvailable && api.nativeAudioStartCapture) {
        try {
          const isAvailable = await api.nativeAudioCheckAvailable();
          if (isAvailable) {
            console.log('Starting native C# multi-device audio capture...');
            await api.nativeAudioStartCapture(); // Auto-detects Arctis devices
            usingNativeAudioRef.current = true;

            // Start timer
            recordingStartTimeRef.current = Date.now();
            setRecordingState((prev) => ({
              ...prev,
              status: 'recording',
              durationMs: 0,
              error: undefined,
            }));

            recordingTimerRef.current = window.setInterval(() => {
              const elapsed = Date.now() - recordingStartTimeRef.current;
              setRecordingState((prev) => ({ ...prev, durationMs: elapsed }));
            }, 100);

            setInfoMessage(
              'Recording started using: Native multi-device capture (Arctis Chat + Game)',
            );
            console.log('✓ Native C# capture started successfully');
            return; // Exit early - we're using native capture
          }
        } catch (nativeError) {
          console.warn('Native C# capture failed, falling back:', nativeError);
          usingNativeAudioRef.current = false;
        }
      }

      // PRIORITY 2 & 3: Fallback to existing methods
      // Get sources and auto-select the first one (usually "Entire Screen")
      const sources = await api.getRecordingSources();
      if (sources.length === 0) {
        setRecordingState((prev) => ({
          ...prev,
          status: 'error',
          error: 'No audio sources available.',
        }));
        return;
      }

      const selectedSourceId = sources[0].id;
      const { includeMicrophone } = recordingState;

      stopRecordingStreams();
      recordedChunksRef.current = [];

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

      activeStreamsRef.current.push(systemStream);
      systemStream.getVideoTracks().forEach((track) => track.stop());

      let finalStream: MediaStream;

      if (includeMicrophone) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        activeStreamsRef.current.push(micStream);

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();

        const systemSource = audioContext.createMediaStreamSource(systemStream);
        const micSource = audioContext.createMediaStreamSource(micStream);

        systemSource.connect(destination);
        micSource.connect(destination);

        finalStream = destination.stream;
      } else {
        finalStream = new MediaStream(systemStream.getAudioTracks());
      }

      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      mediaRecorder.ondataavailable = (event): void => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async (): Promise<void> => {
        stopRecordingStreams();

        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
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

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      recordingStartTimeRef.current = Date.now();
      setRecordingState((prev) => ({
        ...prev,
        status: 'recording',
        durationMs: 0,
        error: undefined,
      }));

      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordingStartTimeRef.current;
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
  }, [recordingState.includeMicrophone, stopRecordingStreams, setInfoMessage]);

  const stopRecording = useCallback(async (): Promise<void> => {
    // Handle native C# audio capture
    if (usingNativeAudioRef.current) {
      const api = window.electronAPI;
      if (!api?.nativeAudioStopCapture) {
        console.error('Native audio stop API not available');
        return;
      }

      try {
        // Stop timer
        if (recordingTimerRef.current !== null) {
          window.clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        setRecordingState((prev) => ({ ...prev, status: 'saving' }));

        // Stop native capture and get WAV file
        const result = await api.nativeAudioStopCapture();

        setRecordingState((prev) => ({
          ...prev,
          status: 'done',
          savedFilePath: result.filePath,
        }));

        setInfoMessage(`Recording saved: ${result.filePath}`);
        usingNativeAudioRef.current = false;
      } catch (error) {
        console.error('Failed to stop native audio capture:', error);
        setRecordingState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Failed to save recording.',
        }));
        usingNativeAudioRef.current = false;
      }
      return;
    }

    // Handle regular MediaRecorder-based recording
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, [setInfoMessage]);

  const handleToggleMicrophone = useCallback((enabled: boolean): void => {
    setRecordingState((prev) => ({ ...prev, includeMicrophone: enabled }));
  }, []);

  const handleResetRecording = useCallback(async (): Promise<void> => {
    // If native audio is running, stop it first
    if (usingNativeAudioRef.current) {
      await stopRecording();
    }

    stopRecordingStreams();
    usingNativeAudioRef.current = false;
    setRecordingState(DEFAULT_RECORDING_STATE);
  }, [stopRecordingStreams, stopRecording]);

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
