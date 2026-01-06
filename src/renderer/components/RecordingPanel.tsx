import { RecordingState } from '../types';
import { formatMilliseconds, normalizePath } from '../utils/format';

type RecordingPanelProps = {
  recordingState: RecordingState;
  onLoadSources: () => Promise<void>;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onSelectSource: (sourceId: string) => void;
  onToggleMicrophone: (enabled: boolean) => void;
  onResetRecording: () => void;
  onUseRecording: () => void;
};

export function RecordingPanel({
  recordingState,
  onLoadSources,
  onStartRecording,
  onStopRecording,
  onSelectSource,
  onToggleMicrophone,
  onResetRecording,
  onUseRecording,
}: RecordingPanelProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Enregistrement Meeting</h2>
        <p>Capturez l&apos;audio systeme et votre micro.</p>
      </header>
      <div className="card__body">
        {recordingState.status === 'idle' && (
          <button className="btn btn-primary" onClick={onLoadSources} type="button">
            Demarrer un enregistrement
          </button>
        )}

        {(recordingState.status === 'selecting' ||
          recordingState.status === 'recording' ||
          recordingState.status === 'saving' ||
          recordingState.status === 'done') && (
          <>
            {recordingState.status !== 'recording' && recordingState.status !== 'saving' && (
              <div className="recording-sources">
                <p className="option__label">Source audio (ecran ou fenetre) :</p>
                <div className="source-grid">
                  {recordingState.sources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      className={`source-card ${
                        recordingState.selectedSourceId === source.id ? 'source-card--selected' : ''
                      }`}
                      onClick={() => onSelectSource(source.id)}
                    >
                      <img
                        src={source.thumbnail}
                        alt={source.name}
                        className="source-card__thumbnail"
                      />
                      <span className="source-card__name">{source.name}</span>
                    </button>
                  ))}
                </div>

                <label className="option" style={{ marginTop: '1rem' }}>
                  <input
                    type="checkbox"
                    checked={recordingState.includeMicrophone}
                    onChange={(e) => onToggleMicrophone(e.target.checked)}
                  />
                  <span className="option__label">Inclure le microphone</span>
                  <span className="option__description">
                    Capture votre voix en plus de l&apos;audio systeme
                  </span>
                </label>
              </div>
            )}

            <div className="recording-controls" style={{ marginTop: '1rem' }}>
              {recordingState.status === 'selecting' && (
                <button
                  className="btn btn-primary"
                  onClick={onStartRecording}
                  type="button"
                  disabled={!recordingState.selectedSourceId}
                >
                  Lancer l&apos;enregistrement
                </button>
              )}

              {recordingState.status === 'recording' && (
                <>
                  <div className="recording-indicator">
                    <span className="recording-indicator__dot" />
                    <span className="recording-indicator__time">
                      {formatMilliseconds(recordingState.durationMs)}
                    </span>
                  </div>
                  <button className="btn btn-secondary" onClick={onStopRecording} type="button">
                    Arreter l&apos;enregistrement
                  </button>
                </>
              )}

              {recordingState.status === 'saving' && (
                <p className="message message--info">Sauvegarde en cours...</p>
              )}

              {recordingState.status === 'done' && recordingState.savedFilePath && (
                <div className="recording-done">
                  <p className="message message--info">
                    Enregistre : {normalizePath(recordingState.savedFilePath)}
                  </p>
                  <div className="recording-done__actions">
                    <button className="btn btn-primary" onClick={onUseRecording} type="button">
                      Utiliser pour l&apos;analyse
                    </button>
                    <button className="btn btn-tertiary" onClick={onResetRecording} type="button">
                      Nouvel enregistrement
                    </button>
                  </div>
                </div>
              )}

              {recordingState.status !== 'recording' &&
                recordingState.status !== 'saving' &&
                recordingState.status !== 'done' && (
                  <button
                    className="btn btn-tertiary"
                    onClick={onResetRecording}
                    type="button"
                    style={{ marginLeft: '0.5rem' }}
                  >
                    Annuler
                  </button>
                )}
            </div>
          </>
        )}

        {recordingState.status === 'error' && recordingState.error && (
          <div>
            <p className="message message--error">{recordingState.error}</p>
            <button
              className="btn btn-tertiary"
              onClick={onResetRecording}
              type="button"
              style={{ marginTop: '0.5rem' }}
            >
              Reessayer
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
