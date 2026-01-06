import { RecordingState } from '../types';
import { formatMilliseconds } from '../utils/format';

type RecordingPanelProps = {
  recordingState: RecordingState;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => void;
  onToggleMicrophone: (enabled: boolean) => void;
  onResetRecording: () => void;
};

export function RecordingPanel({
  recordingState,
  onStartRecording,
  onStopRecording,
  onToggleMicrophone,
  onResetRecording,
}: RecordingPanelProps): JSX.Element {
  const isIdle = recordingState.status === 'idle';
  const isRecording = recordingState.status === 'recording';
  const isSaving = recordingState.status === 'saving';
  const isDone = recordingState.status === 'done';
  const isError = recordingState.status === 'error';

  return (
    <section className="card">
      <header className="card__header">
        <h2>Record</h2>
      </header>
      <div className="card__body">
        {isIdle && (
          <div className="recording-setup">
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={recordingState.includeMicrophone}
                onChange={(e) => onToggleMicrophone(e.target.checked)}
              />
              <span>Include microphone</span>
            </label>
            <button className="btn btn-primary" onClick={onStartRecording} type="button">
              Start recording
            </button>
          </div>
        )}

        {isRecording && (
          <div className="recording-controls">
            <div className="recording-indicator">
              <span className="recording-indicator__dot" />
              <span className="recording-indicator__time">
                {formatMilliseconds(recordingState.durationMs)}
              </span>
            </div>
            <button className="btn btn-secondary" onClick={onStopRecording} type="button">
              Stop
            </button>
          </div>
        )}

        {isSaving && <p className="message message--info">Saving...</p>}

        {isDone && recordingState.savedFilePath && (
          <div className="recording-done">
            <p className="message message--success">Recording added to files</p>
            <button className="btn btn-tertiary" onClick={onResetRecording} type="button">
              New recording
            </button>
          </div>
        )}

        {isError && recordingState.error && (
          <div>
            <p className="message message--error">{recordingState.error}</p>
            <button className="btn btn-tertiary" onClick={onResetRecording} type="button">
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
