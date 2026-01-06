import { AnalysisState, ChunkExport } from '../types';
import { formatMilliseconds, normalizePath, fileNameFromPath } from '../utils/format';

type ResultsPanelProps = {
  analysisState: AnalysisState;
  previewSources: Record<string, { original?: string; trimmed?: string }>;
  onOpenPath: (path: string) => Promise<void>;
  onCopyPath: (path: string) => Promise<void>;
  onDownloadChunks: (dirPath: string | null | undefined) => Promise<void>;
};

export function ResultsPanel({
  analysisState,
  previewSources,
  onOpenPath,
  onCopyPath,
  onDownloadChunks,
}: ResultsPanelProps): JSX.Element | null {
  if (analysisState.status !== 'done') {
    return null;
  }

  return (
    <div className="results">
      {Object.entries(analysisState.analyses).map(([key, analysis]) => {
        const sources = previewSources[key] ?? {};

        return (
          <article key={key} className="result">
            <header className="result__header">
              <h3>{normalizePath(analysis.sourcePath)}</h3>
              <p>
                Duration: {analysis.durationMs ? formatMilliseconds(analysis.durationMs) : 'n/a'}
              </p>
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

            <div className="previews">
              <div className="preview">
                <span className="preview__title">Before cleanup</span>
                {analysis.previews.original && sources.original ? (
                  <>
                    <audio controls className="preview__audio" src={sources.original} />
                    <span className="preview__meta">
                      {fileNameFromPath(analysis.previews.original.path)}
                    </span>
                  </>
                ) : (
                  <p className="placeholder">Original preview not available.</p>
                )}
              </div>
              <div className="preview">
                <span className="preview__title">After silence removal</span>
                {analysis.previews.trimmed && sources.trimmed ? (
                  <>
                    <audio controls className="preview__audio" src={sources.trimmed} />
                    <span className="preview__meta">
                      {fileNameFromPath(analysis.previews.trimmed.path)}
                    </span>
                  </>
                ) : (
                  <p className="placeholder">Cleaned preview not available.</p>
                )}
              </div>
            </div>

            <div className="result__exports">
              <div className="result__exports-header">
                <h4>WAV Chunks (STT-ready)</h4>
                <div className="result__exports-actions">
                  <button
                    className="btn btn-tertiary"
                    type="button"
                    onClick={() => onOpenPath(analysis.outputDir)}
                  >
                    Open export folder
                  </button>
                  <button
                    className="btn btn-tertiary"
                    type="button"
                    disabled={analysis.chunkExports.length === 0}
                    onClick={() => onDownloadChunks(analysis.chunkExportsDirPath)}
                  >
                    Download all chunks
                  </button>
                </div>
              </div>
              <p className="exports__hint">
                WAV files are mono 16kHz, ready for Whisper and other STT engines.
              </p>
              {analysis.chunkExports.length > 0 ? (
                <ul className="exports">
                  {analysis.chunkExports.map((chunkExport: ChunkExport, index: number) => (
                    <li key={chunkExport.id} className="exports__item">
                      <div className="exports__meta">
                        <strong>Chunk {index + 1}</strong>
                        <span>
                          {formatMilliseconds(chunkExport.startMs)} &rarr;{' '}
                          {formatMilliseconds(chunkExport.endMs)} |{' '}
                          {formatMilliseconds(chunkExport.durationMs)}
                        </span>
                      </div>
                      <code className="exports__path">{chunkExport.wavPath}</code>
                      <div className="exports__actions">
                        <button
                          className="btn btn-tertiary"
                          type="button"
                          onClick={() => onCopyPath(chunkExport.wavPath)}
                        >
                          Copy path
                        </button>
                        <button
                          className="btn btn-tertiary"
                          type="button"
                          onClick={() => onOpenPath(chunkExport.wavPath)}
                        >
                          Open
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="placeholder">No chunks exported (adjust settings and retry).</p>
              )}
            </div>

            <div className="result__exports">
              <div className="result__exports-header">
                <h4>Transcription</h4>
              </div>
              {analysis.transcription.enabled ? (
                <>
                  {analysis.transcriptions.length > 0 ? (
                    <div className="transcriptions">
                      {analysis.transcriptions.map((entry, index) => (
                        <div key={entry.chunkId} className="transcription-entry">
                          <div className="transcription-entry__header">
                            <strong>Segment {index + 1}</strong>
                            {analysis.chunkExports[index] && (
                              <span className="transcription-entry__time">
                                {formatMilliseconds(analysis.chunkExports[index].startMs)} &rarr;{' '}
                                {formatMilliseconds(analysis.chunkExports[index].endMs)}
                              </span>
                            )}
                          </div>
                          {entry.error ? (
                            <p className="message message--error">{entry.error}</p>
                          ) : (
                            <p className="transcription-entry__text">
                              {entry.text && entry.text.trim().length > 0
                                ? entry.text.trim()
                                : '(silence or inaudible)'}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="transcription-full">
                        <strong>Full transcription:</strong>
                        <p className="transcription-full__text">
                          {analysis.transcriptions
                            .filter((t) => !t.error && t.text?.trim())
                            .map((t) => t.text.trim())
                            .join(' ') || '(no text transcribed)'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="placeholder">No transcription results for these segments.</p>
                  )}
                </>
              ) : (
                <p className="placeholder">Transcription was disabled for this analysis.</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
