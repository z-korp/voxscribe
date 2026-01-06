import { TranscriptionSettings } from '../types';

type TranscriptionPanelProps = {
  settings: TranscriptionSettings;
  onToggle: (enabled: boolean) => void;
  onLanguageChange: (language: string) => void;
  onEnableWordsChange: (enableWords: boolean) => void;
};

export function TranscriptionPanel({
  settings,
  onToggle,
  onLanguageChange,
  onEnableWordsChange,
}: TranscriptionPanelProps): JSX.Element {
  return (
    <section className="card">
      <header className="card__header">
        <h2>Transcription Whisper</h2>
        <p>Reconnaissance vocale locale avec Whisper d&apos;OpenAI.</p>
      </header>
      <div className="card__body card__body--grid">
        <label className="option">
          <span className="option__label">Activer la transcription Whisper</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span className="option__description">
            Whisper telechargera automatiquement les modeles necessaires au premier usage (~1.5 GB
            par modele).
          </span>
        </label>
        <label className="option">
          <span className="option__label">Langue</span>
          <select
            className="option__input"
            value={settings.language}
            disabled={!settings.enabled}
            onChange={(event) => onLanguageChange(event.target.value)}
          >
            <option value="fr">Francais (medium)</option>
            <option value="en">English (medium.en)</option>
            <option value="auto">Auto-detection</option>
          </select>
          <span className="option__description">
            Modele EN optimise pour l&apos;anglais (~900 MB), FR pour francais/multilingue (~1.5
            GB).
          </span>
        </label>
        <label className="option">
          <span className="option__label">Inclure le detail par mot</span>
          <input
            type="checkbox"
            checked={settings.enableWords}
            disabled={!settings.enabled}
            onChange={(event) => onEnableWordsChange(event.target.checked)}
          />
          <span className="option__description">
            Ajoute les minutages par mot dans les resultats.
          </span>
        </label>
      </div>
    </section>
  );
}
