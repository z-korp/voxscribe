import { AnalysisOptions, PresetType, PRESETS } from '../types';

type ParametersPanelProps = {
  selectedPreset: PresetType;
  options: AnalysisOptions | null;
  onPresetChange: (preset: PresetType) => void;
  onOptionChange: (key: keyof AnalysisOptions, value: number) => void;
};

export function ParametersPanel({
  selectedPreset,
  options,
  onPresetChange,
  onOptionChange,
}: ParametersPanelProps): JSX.Element {
  const presetList = Object.values(PRESETS);

  return (
    <section className="card">
      <header className="card__header">
        <h2>Settings</h2>
        <p>Configure silence detection.</p>
      </header>
      <div className="card__body">
        <label className="option">
          <span className="option__label">Preset</span>
          <select
            className="option__input"
            value={selectedPreset}
            onChange={(e) => onPresetChange(e.target.value as PresetType)}
          >
            {presetList.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <span className="option__description">{PRESETS[selectedPreset].description}</span>
        </label>

        {selectedPreset === 'custom' && options && (
          <div className="card__body--grid" style={{ marginTop: '1rem' }}>
            <label className="option">
              <span className="option__label">Silence threshold (dB)</span>
              <input
                className="option__input"
                type="number"
                min={-80}
                max={0}
                step={1}
                value={options.silenceThresholdDb}
                onChange={(e) => onOptionChange('silenceThresholdDb', Number(e.target.value))}
              />
              <span className="option__description">
                Maximum volume level considered as silence.
              </span>
            </label>

            <label className="option">
              <span className="option__label">Minimum silence duration (ms)</span>
              <input
                className="option__input"
                type="number"
                min={100}
                max={10000}
                step={100}
                value={options.minSilenceDurationMs}
                onChange={(e) => onOptionChange('minSilenceDurationMs', Number(e.target.value))}
              />
              <span className="option__description">
                How long a silence must last to trigger a cut.
              </span>
            </label>

            <label className="option">
              <span className="option__label">Padding (ms)</span>
              <input
                className="option__input"
                type="number"
                min={0}
                max={2000}
                step={50}
                value={options.paddingBeforeMs}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  onOptionChange('paddingBeforeMs', value);
                  onOptionChange('paddingAfterMs', value);
                }}
              />
              <span className="option__description">
                Time kept before and after each speech segment.
              </span>
            </label>
          </div>
        )}
      </div>
    </section>
  );
}
