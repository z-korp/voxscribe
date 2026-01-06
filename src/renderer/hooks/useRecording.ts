import { useCallback, useRef, useState } from 'react';
import { RecordingState, DEFAULT_RECORDING_STATE } from '../types';

export function useRecording(setInfoMessage: (msg: string | null) => void) {
  const [recordingState, setRecordingState] = useState<RecordingState>(DEFAULT_RECORDING_STATE);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const recordingTimerRef = useRef<number | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);

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

  const loadRecordingSources = useCallback(async (): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.getRecordingSources) {
      setRecordingState((prev) => ({
        ...prev,
        status: 'error',
        error: "L'API d'enregistrement n'est pas disponible.",
      }));
      return;
    }

    try {
      setRecordingState((prev) => ({ ...prev, status: 'selecting' }));
      const sources = await api.getRecordingSources();
      setRecordingState((prev) => ({
        ...prev,
        sources,
        selectedSourceId: sources.length > 0 ? sources[0].id : null,
      }));
    } catch (error) {
      console.error('Failed to load sources', error);
      setRecordingState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Impossible de charger les sources.',
      }));
    }
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    const { selectedSourceId, includeMicrophone } = recordingState;

    if (!selectedSourceId) {
      setRecordingState((prev) => ({
        ...prev,
        status: 'error',
        error: 'Veuillez selectionner une source.',
      }));
      return;
    }

    try {
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
          const api = window.electronAPI;
          if (!api?.saveRecording) {
            throw new Error("L'API de sauvegarde n'est pas disponible.");
          }

          const result = await api.saveRecording({ buffer: arrayBuffer });

          setRecordingState((prev) => ({
            ...prev,
            status: 'done',
            savedFilePath: result.filePath,
          }));

          setInfoMessage(`Enregistrement sauvegarde : ${result.filePath}`);
        } catch (error) {
          console.error('Save failed', error);
          setRecordingState((prev) => ({
            ...prev,
            status: 'error',
            error: "Impossible de sauvegarder l'enregistrement.",
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
        error: error instanceof Error ? error.message : "Impossible de demarrer l'enregistrement.",
      }));
    }
  }, [recordingState, stopRecordingStreams, setInfoMessage]);

  const stopRecording = useCallback((): void => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const handleToggleMicrophone = useCallback((enabled: boolean): void => {
    setRecordingState((prev) => ({ ...prev, includeMicrophone: enabled }));
  }, []);

  const handleSelectSource = useCallback((sourceId: string): void => {
    setRecordingState((prev) => ({ ...prev, selectedSourceId: sourceId }));
  }, []);

  const handleResetRecording = useCallback((): void => {
    stopRecordingStreams();
    setRecordingState(DEFAULT_RECORDING_STATE);
  }, [stopRecordingStreams]);

  return {
    recordingState,
    setRecordingState,
    loadRecordingSources,
    startRecording,
    stopRecording,
    stopRecordingStreams,
    handleToggleMicrophone,
    handleSelectSource,
    handleResetRecording,
  };
}
