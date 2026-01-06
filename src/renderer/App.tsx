import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnalysisOptions,
  AnalysisState,
  MediaAnalysis,
  TranscriptionSettings,
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
  const [pingResult, setPingResult] = useState<string>('...');
  const [options, setOptions] = useState<AnalysisOptions | null>(null);
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
    let canceled = false;
    const api = window.electronAPI;
    if (!api?.ping) {
      setPingResult('electronAPI non disponible');
      return;
    }

    void api
      .ping()
      .then((result) => {
        if (!canceled) setPingResult(result);
      })
      .catch((error) => {
        console.error('IPC ping failed', error);
        if (!canceled) setPingResult('ping error');
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const api = window.electronAPI;
    if (!api?.getDefaultAnalysisOptions) return;

    void api
      .getDefaultAnalysisOptions()
      .then((defaults) => {
        if (!canceled) setOptions(defaults);
      })
      .catch((error) => {
        console.error('Failed to load default analysis options', error);
        if (!canceled) setOptions(null);
      });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const api = window.electronAPI;
    if (!api?.getDefaultTranscriptionOptions) return;

    void api
      .getDefaultTranscriptionOptions()
      .then((defaults) => {
        if (!canceled) {
          setTranscriptionSettings({
            enabled: defaults.enabled,
            modelPath: defaults.modelPath ?? '',
            language: 'fr',
            sampleRate: defaults.sampleRate,
            maxAlternatives: defaults.maxAlternatives,
            enableWords: defaults.enableWords,
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load default transcription options', error);
      });

    return () => {
      canceled = true;
    };
  }, []);

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
      setInfoMessage("Impossible d'ouvrir le chemin depuis cette interface.");
      return;
    }
    try {
      await api.openPath(targetPath);
    } catch (error) {
      console.error('openPath failed', error);
      setInfoMessage("Impossible d'ouvrir le chemin demande.");
    }
  }, []);

  const handleCopyPath = useCallback(async (targetPath: string) => {
    if (!navigator?.clipboard?.writeText) {
      setInfoMessage('La copie dans le presse-papiers est indisponible.');
      return;
    }
    try {
      await navigator.clipboard.writeText(targetPath);
      setInfoMessage('Chemin copie dans le presse-papiers.');
    } catch (error) {
      console.error('clipboard error', error);
      setInfoMessage('Copie du chemin impossible.');
    }
  }, []);

  const handleDownloadChunks = useCallback(async (directoryPath: string | null | undefined) => {
    if (!directoryPath) {
      setInfoMessage('Aucun dossier de chunks disponible.');
      return;
    }
    const api = window.electronAPI;
    if (!api?.zipChunks) {
      setInfoMessage('Telechargement indisponible dans cette interface.');
      return;
    }
    try {
      const result = await api.zipChunks(directoryPath);
      if (result.canceled) {
        setInfoMessage('Telechargement annule.');
      } else if (result.filePath) {
        setInfoMessage(`Archive sauvegardee : ${normalizePath(result.filePath)}`);
      }
    } catch (error) {
      console.error('zipChunks failed', error);
      setInfoMessage("Impossible de generer l'archive ZIP.");
    }
  }, []);

  const handleSelectFiles = async (): Promise<void> => {
    const api = window.electronAPI;
    if (!api?.selectMediaSources) {
      setAnalysisState({
        status: 'error',
        error: "L'API de selection de fichiers n'est pas disponible.",
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
          ? `${result.filePaths.length} fichiers charges.`
          : `Fichier selectionne : ${normalizePath(result.filePaths[0])}`,
      );
    } catch (error) {
      console.error('File selection failed', error);
      setAnalysisState({
        status: 'error',
        error: 'Impossible de selectionner des fichiers.',
        analyses: {},
      });
    }
  };

  const handleOptionChange = (key: keyof AnalysisOptions, value: number): void => {
    setOptions((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  };

  const handleTranscriptionToggle = (enabled: boolean): void => {
    setTranscriptionSettings((current) => ({ ...current, enabled }));
  };

  const handleTranscriptionEnableWordsChange = (enableWords: boolean): void => {
    setTranscriptionSettings((current) => ({ ...current, enableWords }));
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
        error: "L'analyse des medias n'est pas disponible.",
        analyses: {},
      });
      return;
    }
    if (!options) {
      cleanupPreviewUrls();
      setPreviewSources({});
      setAnalysisState({
        status: 'error',
        error: 'Options non disponibles.',
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
            modelPath:
              transcriptionSettings.modelPath.trim().length > 0
                ? transcriptionSettings.modelPath.trim()
                : undefined,
            language: transcriptionSettings.language,
            sampleRate: transcriptionSettings.sampleRate,
            maxAlternatives: transcriptionSettings.maxAlternatives,
            enableWords: transcriptionSettings.enableWords,
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
      setInfoMessage('Analyse terminee.');
    } catch (error) {
      console.error('Analyse failed', error);
      cleanupPreviewUrls();
      setPreviewSources({});
      setAnalysisState({
        status: 'error',
        error: error instanceof Error ? error.message : "Erreur inconnue lors de l'analyse.",
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
    setInfoMessage(`Fichier ajoute : ${savedFilePath}`);
  }, [recordingState, cleanupPreviewUrls]);

  return (
    <div className="page">
      <header className="page__header">
        <h1>VoxScribe</h1>
        <p className="page__subtitle">
          Ping Electron : <strong>{pingResult}</strong>
        </p>
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

        <ParametersPanel options={options} onOptionChange={handleOptionChange} />

        <TranscriptionPanel
          settings={transcriptionSettings}
          onToggle={handleTranscriptionToggle}
          onLanguageChange={handleTranscriptionLanguageChange}
          onEnableWordsChange={handleTranscriptionEnableWordsChange}
        />

        <section className="card">
          <header className="card__header">
            <h2>Analyse</h2>
            <p>Decoupez automatiquement les zones parlees.</p>
          </header>
          <div className="card__body">
            <button
              className="btn btn-secondary"
              onClick={handleAnalyze}
              type="button"
              disabled={!hasFiles || isAnalyzing}
            >
              {isAnalyzing ? 'Analyse en cours...' : 'Analyser'}
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
