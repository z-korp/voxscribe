import { useState, useCallback } from 'react';
import { AnalysisState, ChunkExport } from '../types';
import { formatMilliseconds, normalizePath, fileNameFromPath } from '../utils/format';

function getTranscriptionText(transcriptions: { error?: string; text?: string }[]): string {
  return (
    transcriptions
      .filter((t) => !t.error && t.text?.trim())
      .map((t) => t.text!.trim())
      .join(' ') || ''
  );
}

type ResultsPanelProps = {
  analysisState: AnalysisState;
  previewSources: Record<string, { original?: string; trimmed?: string }>;
  onOpenPath: (path: string) => Promise<void>;
  onCopyPath: (path: string) => Promise<void>;
  onDownloadChunks: (dirPath: string | null | undefined) => Promise<void>;
};

type TabType = 'transcription' | 'debug';

export function ResultsPanel({
  analysisState,
  onOpenPath,
  onCopyPath,
  onDownloadChunks,
}: ResultsPanelProps): JSX.Element | null {
  const [activeTab, setActiveTab] = useState<TabType>('transcription');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopyTranscription = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  if (analysisState.status !== 'done') {
    return null;
  }

  const analyses = Object.entries(analysisState.analyses);

  return (
    <div className="results">
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'transcription' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('transcription')}
          type="button"
        >
          Transcription
        </button>
        <button
          className={`tab ${activeTab === 'debug' ? 'tab--active' : ''}`}
          onClick={() => setActiveTab('debug')}
          type="button"
        >
          Debug
        </button>
      </div>

      {activeTab === 'transcription' && (
        <div className="tab-content">
          {analyses.map(([key, analysis]) => (
            <article key={key} className="result">
              <header className="result__header">
                <h3>{fileNameFromPath(analysis.sourcePath)}</h3>
                <span className="result__duration">
                  {analysis.durationMs ? formatMilliseconds(analysis.durationMs) : ''}
                </span>
              </header>

              {analysis.warnings.length > 0 && (
                <ul className="warnings">
                  {analysis.warnings.map((warning, index) => (
                    <li key={index} className="warnings__item">
                      {warning}
                    </li>
                  ))}
                </ul>
              )}

              {analysis.transcription.enabled ? (
                <div className="transcription-result">
                  {analysis.transcriptions.length > 0 ? (
                    (() => {
                      const text = getTranscriptionText(analysis.transcriptions);
                      return text ? (
                        <>
                          <div className="transcription-text">{text}</div>
                          <button
                            className="btn btn-tertiary btn-sm copy-btn"
                            type="button"
                            onClick={() => handleCopyTranscription(key, text)}
                          >
                            {copiedKey === key ? 'Copied!' : 'Copy'}
                          </button>
                        </>
                      ) : (
                        <p className="placeholder">(no speech detected)</p>
                      );
                    })()
                  ) : (
                    <p className="placeholder">No transcription results.</p>
                  )}
                </div>
              ) : (
                <p className="placeholder">Transcription was disabled.</p>
              )}
            </article>
          ))}
        </div>
      )}

      {activeTab === 'debug' && (
        <div className="tab-content">
          {analyses.map(([key, analysis]) => (
            <article key={key} className="result">
              <header className="result__header">
                <h3>{fileNameFromPath(analysis.sourcePath)}</h3>
              </header>

              <div className="debug-section">
                <h4>Segments ({analysis.chunks.length})</h4>
                {analysis.chunks.length > 0 ? (
                  <table className="chunks">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.chunks.map((chunk, index) => (
                        <tr key={chunk.id}>
                          <td>{index + 1}</td>
                          <td>{formatMilliseconds(chunk.startMs)}</td>
                          <td>{formatMilliseconds(chunk.endMs)}</td>
                          <td>{formatMilliseconds(chunk.durationMs)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="placeholder">No segments detected.</p>
                )}
              </div>

              <div className="debug-section">
                <div className="debug-section__header">
                  <h4>WAV Chunks</h4>
                  <div className="debug-section__actions">
                    <button
                      className="btn btn-tertiary btn-sm"
                      type="button"
                      onClick={() => onOpenPath(analysis.outputDir)}
                    >
                      Open folder
                    </button>
                    <button
                      className="btn btn-tertiary btn-sm"
                      type="button"
                      disabled={analysis.chunkExports.length === 0}
                      onClick={() => onDownloadChunks(analysis.chunkExportsDirPath)}
                    >
                      Download ZIP
                    </button>
                  </div>
                </div>
                {analysis.chunkExports.length > 0 ? (
                  <ul className="exports exports--compact">
                    {analysis.chunkExports.map((chunkExport: ChunkExport, index: number) => (
                      <li key={chunkExport.id} className="exports__item">
                        <span className="exports__name">Chunk {index + 1}</span>
                        <span className="exports__time">
                          {formatMilliseconds(chunkExport.startMs)} &rarr;{' '}
                          {formatMilliseconds(chunkExport.endMs)}
                        </span>
                        <button
                          className="btn btn-tertiary btn-sm"
                          type="button"
                          onClick={() => onCopyPath(chunkExport.wavPath)}
                        >
                          Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="placeholder">No chunks exported.</p>
                )}
              </div>

              <div className="debug-section">
                <h4>Transcription per segment</h4>
                {analysis.transcriptions.length > 0 ? (
                  <div className="transcriptions-debug">
                    {analysis.transcriptions.map((entry, index) => (
                      <div key={entry.chunkId} className="transcription-debug-entry">
                        <span className="transcription-debug-entry__num">{index + 1}</span>
                        {entry.error ? (
                          <span className="message message--error">{entry.error}</span>
                        ) : (
                          <span className="transcription-debug-entry__text">
                            {entry.text?.trim() || '(silence)'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="placeholder">No transcription data.</p>
                )}
              </div>

              <div className="debug-section">
                <h4>Paths</h4>
                <code className="debug-path">{normalizePath(analysis.sourcePath)}</code>
                <code className="debug-path">{normalizePath(analysis.outputDir)}</code>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
