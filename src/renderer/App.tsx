import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnalysisOptions,
  AnalysisState,
  MediaAnalysis,
  TranscriptionSettings,
  PresetType,
  PRESETS,
  DEFAULT_ANALYSIS_STATE,
  DEFAULT_TRANSCRIPTION_SETTINGS,
} from './types';
import { normalizePath } from './utils/format';
import { useRecording } from './hooks/useRecording';
import {
  FileSelector,
  RecordingPanel,
  ParametersPanel,
  TranscriptionPanel,
  ResultsPanel,
} from './components';

function App(): JSX.Element {
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('meeting');
  const [options, setOptions] = useState<AnalysisOptions>(PRESETS.meeting.options);
  const [transcriptionSettings, setTranscriptionSettings] = useState<TranscriptionSettings>(
    DEFAULT_TRANSCRIPTION_SETTINGS,
  );
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [analysisState, setAnalysisState] = useState<AnalysisState>(DEFAULT_ANALYSIS_STATE);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [previewSources, setPreviewSources] = useState<
    Record<string, { original?: string; trimmed?: string }>
  >({});
  const previewUrlCacheRef = useRef<string[]>([]);

  const {
    recordingState,
    loadRecordingSources,
    startRecording,
    stopRecording,
    stopRecordingStreams,
    handleToggleMicrophone,
    handleSelectSource,
    handleResetRecording,
  } = useRecording(setInfoMessage);

  const cleanupPreviewUrls = useCallback((): void => {
    previewUrlCacheRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    previewUrlCacheRef.current = [];
  }, []);

  const base64ToBlobUrl = useCallback((base64: string): string => {
    const binary = window.atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    previewUrlCacheRef.current.push(url);
    return url;
  }, []);

  useEffect(() => {
    return () => {
      cleanupPreviewUrls();
    };
  }, [cleanupPreviewUrls]);

  useEffect(() => {
    return () => {
      stopRecordingStreams();
    };
  }, [stopRecordingStreams]);

  const hasFiles = selectedFiles.length > 0;
  const isAnalyzing = analysisState.status === 'running';

  const handleOpenPath = useCallback(async (targetPath: string) => {
    const api = window.electronAPI;
    if (!api?.openPath) {
      setInfoMessage('Cannot open path from this interface.');
      return;
    }
    try {
      await api.openPath(targetPath);
    } catch (error) {
      console.error('openPath failed', error);
      setInfoMessage('Cannot open the requested path.');
    }
  }, []);

  const handleCopyPath = useCallback(async (targetPath: string) => {
    if (!navigator?.clipboard?.writeText) {
      setInfoMessage('Clipboard is not available.');
      return;
    }
    try {
      await navigator.clipboard.writeText(targetPath);
      setInfoMessage('Path copied to clipboard.');
    } catch (error) {
      console.error('clipboard error', error);
      setInfoMessage('Failed to copy path.');
    }
  }, []);

  const handleDownloadChunks = useCallback(async (directoryPath: string | null | undefined) => {
    if (!directoryPath) {
      setInfoMessage('No chunks folder available.');
      return;
    }
    const api = window.electronAPI;
    if (!api?.zipChunks) {
      setInfoMessage('Download not available in this interface.');
      return;
    }
    try {
      const result = await api.zipChunks(directoryPath);
      if (result.canceled) {
        setInfoMessage('Download cancelled.');
      } else if (result.filePath) {
        setInfoMessage(`Archive saved: ${normalizePath(result.filePath)}`);
      }
    } catch (error) {
      console.error('zipChunks failed', error);
      setInfoMessage('Failed to generate ZIP archive.');
    }
  }, []);

  const handleSelectFiles = async (): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.selectMediaSources) {
      setAnalysisState({
        status: 'error',
        error: 'File selection API is not available.',
        analyses: {},
      });
      return;
    }
    try {
      const result = await api.selectMediaSources({ allowMultiple: true });
      if (result.canceled) return;
      setSelectedFiles(result.filePaths);
      setAnalysisState(DEFAULT_ANALYSIS_STATE);
      cleanupPreviewUrls();
      setPreviewSources({});
      setInfoMessage(
        result.filePaths.length > 1
          ? `${result.filePaths.length} files loaded.`
          : `File selected: ${normalizePath(result.filePaths[0])}`,
      );
    } catch (error) {
      console.error('File selection failed', error);
      setAnalysisState({
        status: 'error',
        error: 'Failed to select files.',
        analyses: {},
      });
    }
  };

  const handlePresetChange = (preset: PresetType): void => {
    setSelectedPreset(preset);
    setOptions(PRESETS[preset].options);
  };

  const handleOptionChange = (key: keyof AnalysisOptions, value: number): void => {
    setOptions((current) => ({ ...current, [key]: value }));
    if (selectedPreset !== 'custom') {
      setSelectedPreset('custom');
    }
  };

  const handleTranscriptionToggle = (enabled: boolean): void => {
    setTranscriptionSettings((current) => ({ ...current, enabled }));
  };

  const handleTranscriptionLanguageChange = (language: string): void => {
    setTranscriptionSettings((current) => ({ ...current, language }));
  };

  const handleAnalyze = async (): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.analyzeMedia) {
      cleanupPreviewUrls();
      setPreviewSources({});
      setAnalysisState({
        status: 'error',
        error: 'Media analysis is not available.',
        analyses: {},
      });
      return;
    }

    setAnalysisState({ status: 'running', analyses: {} });
    setInfoMessage(null);

    try {
      const analyses: Record<string, MediaAnalysis> = {};
      const newPreviewSources: Record<string, { original?: string; trimmed?: string }> = {};
      cleanupPreviewUrls();

      for (const filePath of selectedFiles) {
        const analysis = await api.analyzeMedia({
          inputPath: filePath,
          options,
          transcription: {
            enabled: transcriptionSettings.enabled,
            language: transcriptionSettings.language,
            enableWords: true,
          },
        });
        analyses[filePath] = analysis;

        const previewEntry: { original?: string; trimmed?: string } = {};
        if (analysis.previews.original?.base64) {
          previewEntry.original = base64ToBlobUrl(analysis.previews.original.base64);
        }
        if (analysis.previews.trimmed?.base64) {
          previewEntry.trimmed = base64ToBlobUrl(analysis.previews.trimmed.base64);
        }
        if (previewEntry.original || previewEntry.trimmed) {
          newPreviewSources[filePath] = previewEntry;
        }
      }

      setAnalysisState({ status: 'done', analyses });
      setPreviewSources(newPreviewSources);
      setInfoMessage('Analysis complete.');
    } catch (error) {
      console.error('Analysis failed', error);
      cleanupPreviewUrls();
      setPreviewSources({});
      setAnalysisState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during analysis.',
        analyses: {},
      });
    }
  };

  const handleUseRecording = useCallback((): void => {
    const { savedFilePath } = recordingState;
    if (!savedFilePath) return;
    setSelectedFiles((prev) => {
      if (prev.includes(savedFilePath)) return prev;
      return [...prev, savedFilePath];
    });
    setAnalysisState(DEFAULT_ANALYSIS_STATE);
    cleanupPreviewUrls();
    setPreviewSources({});
    setInfoMessage(`File added: ${savedFilePath}`);
  }, [recordingState, cleanupPreviewUrls]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>VoxScribe</h1>
        <p className="page__subtitle">Record meetings, remove silence, transcribe locally.</p>
      </header>

      <main className="page__content">
        <FileSelector selectedFiles={selectedFiles} onSelectFiles={handleSelectFiles} />

        <RecordingPanel
          recordingState={recordingState}
          onLoadSources={loadRecordingSources}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onSelectSource={handleSelectSource}
          onToggleMicrophone={handleToggleMicrophone}
          onResetRecording={handleResetRecording}
          onUseRecording={handleUseRecording}
        />

        <ParametersPanel
          selectedPreset={selectedPreset}
          options={options}
          onPresetChange={handlePresetChange}
          onOptionChange={handleOptionChange}
        />

        <TranscriptionPanel
          settings={transcriptionSettings}
          onToggle={handleTranscriptionToggle}
          onLanguageChange={handleTranscriptionLanguageChange}
        />

        <section className="card">
          <header className="card__header">
            <h2>Analysis</h2>
            <p>Automatically detect and extract speech segments.</p>
          </header>
          <div className="card__body">
            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              type="button"
              disabled={!hasFiles || isAnalyzing}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>

            {analysisState.status === 'error' && analysisState.error && (
              <p className="message message--error">{analysisState.error}</p>
            )}
            {infoMessage && <p className="message message--info">{infoMessage}</p>}

            <ResultsPanel
              analysisState={analysisState}
              previewSources={previewSources}
              onOpenPath={handleOpenPath}
              onCopyPath={handleCopyPath}
              onDownloadChunks={handleDownloadChunks}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
