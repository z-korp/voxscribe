import { AnalysisOptions } from '../types';

type ParametersPanelProps = {
  options: AnalysisOptions | null;
  onOptionChange: (key: keyof AnalysisOptions, value: number) => void;
};

type OptionConfig = {
  key: keyof AnalysisOptions;
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
};

export function ParametersPanel({ options, onOptionChange }: ParametersPanelProps): JSX.Element {
  const optionViewModel: OptionConfig[] = options
    ? [
        {
          key: 'silenceThresholdDb',
          label: 'Seuil de silence (dB)',
          description: 'Volume maximal considere comme silence.',
          value: options.silenceThresholdDb,
          min: -80,
          max: 0,
          step: 1,
        },
        {
          key: 'minSilenceDurationMs',
          label: 'Duree minimale du silence (ms)',
          description: 'Silence continu requis pour declencher une coupe.',
          value: options.minSilenceDurationMs,
          min: 100,
          max: 10000,
          step: 50,
        },
        {
          key: 'paddingBeforeMs',
          label: 'Marge avant (ms)',
          description: 'Temps conserve avant chaque segment parle.',
          value: options.paddingBeforeMs,
          min: 0,
          max: 2000,
          step: 10,
        },
        {
          key: 'paddingAfterMs',
          label: 'Marge apres (ms)',
          description: 'Temps conserve apres chaque segment parle.',
          value: options.paddingAfterMs,
          min: 0,
          max: 2000,
          step: 10,
        },
        {
          key: 'minChunkDurationMs',
          label: 'Duree minimale des segments (ms)',
          description: 'Segments plus courts seront etendus autour de la parole detectee.',
          value: options.minChunkDurationMs,
          min: 100,
          max: 60000,
          step: 50,
        },
        {
          key: 'maxChunkDurationMs',
          label: 'Duree maximale des segments (ms)',
          description: 'Segments plus longs seront decoupes.',
          value: options.maxChunkDurationMs,
          min: 1000,
          max: 30 * 60 * 1000,
          step: 1000,
        },
      ]
    : [];

  return (
    <section className="card">
      <header className="card__header">
        <h2>Parametres</h2>
        <p>Affinez la detection des silences.</p>
      </header>
      <div className="card__body card__body--grid">
        {options ? (
          optionViewModel.map((option) => (
            <label key={option.key} className="option">
              <span className="option__label">{option.label}</span>
              <input
                className="option__input"
                type="number"
                min={option.min}
                max={option.max}
                step={option.step}
                value={option.value}
                onChange={(event) => onOptionChange(option.key, Number(event.target.value))}
              />
              <span className="option__description">{option.description}</span>
            </label>
          ))
        ) : (
          <p className="placeholder">Chargement des reglages...</p>
        )}
      </div>
    </section>
  );
}
