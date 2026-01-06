type StereoMixGuideModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onTest: () => Promise<void>;
};

export function StereoMixGuideModal({
  isOpen,
  onClose,
  onTest,
}: StereoMixGuideModalProps): JSX.Element | null {
  if (!isOpen) return null;

  const platform = process.platform || 'win32';
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';

  return (
    <div className="modal modal--open">
      <div className="modal__overlay" onClick={onClose} />
      <div className="modal__content">
        <header className="modal__header">
          <h2>Enable System Audio Loopback</h2>
          <button onClick={onClose} className="btn-close" type="button">
            ×
          </button>
        </header>

        <div className="modal__body">
          {isWindows && <WindowsStereoMixGuide />}
          {isMac && <MacBlackHoleGuide />}
          {!isWindows && !isMac && <LinuxGuide />}
        </div>

        <footer className="modal__footer">
          <button onClick={onTest} className="btn btn-primary" type="button">
            🔍 Test Detection
          </button>
          <button onClick={onClose} className="btn btn-secondary" type="button">
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

function WindowsStereoMixGuide() {
  return (
    <div className="guide guide--windows">
      <h3>📝 Windows: Enable Stereo Mix</h3>
      <p className="text-muted">
        Stereo Mix allows capturing all system audio (Discord, YouTube, games, etc.)
      </p>

      <ol className="guide-steps">
        <li>
          <strong>Right-click</strong> the speaker icon <span className="icon">🔊</span> in the
          taskbar
        </li>
        <li>
          Select <strong>"Sound settings"</strong>
        </li>
        <li>
          Scroll down and click <strong>"Sound Control Panel"</strong>
        </li>
        <li>
          Go to the <strong>"Recording"</strong> tab
        </li>
        <li>
          Right-click in the empty space → Check <strong>"Show Disabled Devices"</strong>
        </li>
        <li>
          Find <strong>"Stereo Mix"</strong> or <strong>"Mixage stéréo"</strong> (if using French
          Windows)
        </li>
        <li>
          Right-click on it → Select <strong>"Enable"</strong>
        </li>
        <li>
          Click <strong>"Test Detection"</strong> below to verify
        </li>
      </ol>

      <div className="guide-note guide-note--warning">
        <strong>⚠️ Stereo Mix not available?</strong>
        <p>
          Some audio drivers don't include Stereo Mix. If you can't find it, you can install{' '}
          <a href="https://vb-audio.com/Cable/" target="_blank" rel="noopener noreferrer">
            VB-Audio Virtual Cable
          </a>{' '}
          (free) as an alternative.
        </p>
      </div>
    </div>
  );
}

function MacBlackHoleGuide() {
  return (
    <div className="guide guide--mac">
      <h3>🍎 macOS: Install BlackHole</h3>
      <p className="text-muted">macOS requires a virtual audio device to capture system audio.</p>

      <h4>Option 1: Homebrew (Recommended)</h4>
      <div className="code-block">
        <code>brew install blackhole-2ch</code>
      </div>

      <h4>Option 2: Manual Installation</h4>
      <ol className="guide-steps">
        <li>
          Download from{' '}
          <a href="https://existential.audio/blackhole/" target="_blank" rel="noopener noreferrer">
            existential.audio/blackhole
          </a>
        </li>
        <li>
          Install the <code>.pkg</code> file
        </li>
        <li>
          Open <strong>"Audio MIDI Setup"</strong> app (in Applications → Utilities)
        </li>
        <li>
          Click the <strong>"+"</strong> button → <strong>"Create Multi-Output Device"</strong>
        </li>
        <li>
          Check both: <strong>Your speakers</strong> + <strong>BlackHole 2ch</strong>
        </li>
        <li>
          Set this Multi-Output Device as default output in <strong>System Preferences</strong> →{' '}
          <strong>Sound</strong>
        </li>
        <li>
          In VoxScribe, select <strong>BlackHole 2ch</strong> as the audio input
        </li>
      </ol>

      <div className="guide-note guide-note--info">
        <strong>💡 Tip:</strong>
        <p>
          After setup, you'll hear audio normally (through the Multi-Output), and VoxScribe will
          capture everything via BlackHole.
        </p>
      </div>
    </div>
  );
}

function LinuxGuide() {
  return (
    <div className="guide guide--linux">
      <h3>🐧 Linux: PulseAudio Monitor</h3>
      <p className="text-muted">Linux uses PulseAudio monitors to capture system audio.</p>

      <h4>Using PulseAudio</h4>
      <div className="code-block">
        <code>pactl list short sources</code>
      </div>
      <p>
        Look for sources ending with <code>.monitor</code>
      </p>

      <h4>Using PipeWire (Modern Linux)</h4>
      <div className="code-block">
        <code>pw-link -o</code>
      </div>

      <div className="guide-note guide-note--info">
        <strong>Note:</strong>
        <p>
          System audio capture on Linux depends on your audio server (PulseAudio/PipeWire).
          VoxScribe should auto-detect monitor sources.
        </p>
      </div>
    </div>
  );
}
