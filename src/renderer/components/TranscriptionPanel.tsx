import { TranscriptionSettings } from '../types';

type TranscriptionPanelProps = {
  settings: TranscriptionSettings;
  onLanguageChange: (language: string) => void;
};

export function TranscriptionPanel({
  settings,
  onLanguageChange,
}: TranscriptionPanelProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Transcription</h2>
      </header>
      <div className="card__body">
        <label className="option option--inline">
          <span className="option__label">Language</span>
          <select
            className="option__input"
            value={settings.language}
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
        </label>
      </div>
    </section>
  );
}
