import { TranscriptionSettings } from '../types';

type TranscriptionPanelProps = {
  settings: TranscriptionSettings;
  onToggle: (enabled: boolean) => void;
  onLanguageChange: (language: string) => void;
};

export function TranscriptionPanel({
  settings,
  onToggle,
  onLanguageChange,
}: TranscriptionPanelProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Transcription</h2>
        <p>Local speech-to-text with OpenAI Whisper.</p>
      </header>
      <div className="card__body card__body--grid">
        <label className="option">
          <span className="option__label">Enable transcription</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="option__description">
            Whisper will auto-download the model on first use (~1.5 GB).
          </span>
        </label>
        <label className="option">
          <span className="option__label">Language</span>
          <select
            className="option__input"
            value={settings.language}
            disabled={!settings.enabled}
            onChange={(event) => onLanguageChange(event.target.value)}
          >
            <option value="auto">Auto-detect</option>
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="it">Italian</option>
            <option value="pt">Portuguese</option>
            <option value="nl">Dutch</option>
            <option value="ja">Japanese</option>
            <option value="zh">Chinese</option>
          </select>
          <span className="option__description">
            Select the spoken language for better accuracy.
          </span>
        </label>
      </div>
    </section>
  );
}
