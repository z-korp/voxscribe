import { useCallback, useRef, useState } from 'react';
import { RecordingState, DEFAULT_RECORDING_STATE } from '../types';

type RecordingRefs = {
  mediaRecorder: MediaRecorder | null;
  recordedChunks: Blob[];
  recordingStartTime: number;
  recordingTimer: number | null;
  activeStreams: MediaStream[];
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
  });

  const stopRecordingStreams = useCallback((): void => {
    refs.current.activeStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    refs.current.activeStreams = [];

    if (refs.current.recordingTimer !== null) {
      window.clearInterval(refs.current.recordingTimer);
      refs.current.recordingTimer = null;
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

      // Read includeMicrophone from current state via callback
      // This avoids stale closure issues
      let includeMicrophone = false;
      setRecordingState((prev) => {
        includeMicrophone = prev.includeMicrophone;
        return prev;
      });

      stopRecordingStreams();
      refs.current.recordedChunks = [];

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
  }, [stopRecordingStreams, setInfoMessage]);

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
