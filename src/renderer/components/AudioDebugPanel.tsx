import { useState } from 'react';
import type { AudioDevice, CaptureStrategy, AudioDeviceTestResult } from '../types/audio-devices';

type AudioDebugPanelProps = {
  devices: AudioDevice[];
  strategy: CaptureStrategy | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onTest: (deviceId: string) => Promise<AudioDeviceTestResult>;
};

export function AudioDebugPanel({
  devices,
  strategy,
  loading,
  onRefresh,
  onTest,
}: AudioDebugPanelProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [testingDevice, setTestingDevice] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, AudioDeviceTestResult>>({});
  const [refreshing, setRefreshing] = useState(false);

  const handleTest = async (deviceId: string) => {
    setTestingDevice(deviceId);
    try {
      const result = await onTest(deviceId);
      setTestResults((prev) => ({ ...prev, [deviceId]: result }));
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setTestingDevice(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const getTypeBadgeClass = (type: AudioDevice['type']) => {
    switch (type) {
      case 'loopback':
        return 'badge--success';
      case 'multi-output':
        return 'badge--info';
      case 'microphone':
        return 'badge--default';
      case 'virtual':
        return 'badge--warning';
      default:
        return 'badge--default';
    }
  };

  return (
    <section className="card audio-debug-panel">
      <header className="card__header">
        <button
          className="btn btn-small btn-tertiary"
          onClick={() => setExpanded(!expanded)}
          type="button"
        >
          {expanded ? '🔧 Hide' : '🔧 Show'} Audio Debug
        </button>
      </header>

      {expanded && (
        <div className="card__body">
          {loading ? (
            <p className="message message--info">Loading audio devices...</p>
          ) : (
            <>
              <div className="debug-header">
                <h3>Audio Devices Detected ({devices.length})</h3>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="btn btn-small"
                  type="button"
                >
                  {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>
              </div>

              {strategy && (
                <div className="debug-strategy">
                  <strong>Recommended Strategy:</strong>
                  {strategy.type === 'loopback' && (
                    <div className="strategy-box strategy-box--success">
                      <span className="strategy-icon">✅</span>
                      <div>
                        <strong>Loopback: {strategy.deviceLabel}</strong>
                        <p>All system audio will be captured automatically</p>
                        <span className="badge badge--small">
                          {strategy.confidence === 'high' ? 'High Quality' : 'Medium Quality'}
                        </span>
                      </div>
                    </div>
                  )}
                  {strategy.type === 'multi-source' && (
                    <div className="strategy-box strategy-box--info">
                      <span className="strategy-icon">🔧</span>
                      <div>
                        <strong>Multi-source: {strategy.deviceLabels.join(' + ')}</strong>
                        <p>{strategy.reason}</p>
                      </div>
                    </div>
                  )}
                  {strategy.type === 'desktop-fallback' && (
                    <div className="strategy-box strategy-box--warning">
                      <span className="strategy-icon">⚠️</span>
                      <div>
                        <strong>Fallback: Desktop Capture</strong>
                        <p>{strategy.warning}</p>
                        {strategy.suggestStereoMix && (
                          <p className="text-small">
                            💡 Consider enabling Stereo Mix for better audio capture
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="devices-table-container">
                <table className="devices-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Type</th>
                      <th>Kind</th>
                      <th>Default</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center">
                          No audio devices found
                        </td>
                      </tr>
                    ) : (
                      devices.map((device) => (
                        <tr
                          key={device.id}
                          className={device.isDefault ? 'device-row--default' : ''}
                        >
                          <td title={device.id}>{device.label || '(unnamed)'}</td>
                          <td>
                            <span className={`badge ${getTypeBadgeClass(device.type)}`}>
                              {device.type}
                            </span>
                          </td>
                          <td>{device.kind}</td>
                          <td>{device.isDefault ? '✓' : ''}</td>
                          <td>
                            <button
                              onClick={() => handleTest(device.id)}
                              disabled={testingDevice === device.id || device.kind !== 'audioinput'}
                              className="btn btn-small"
                              type="button"
                            >
                              {testingDevice === device.id ? 'Testing...' : 'Test'}
                            </button>
                            {testResults[device.id] && (
                              <span
                                className={`test-result ${testResults[device.id].success ? 'test-result--success' : 'test-result--error'}`}
                              >
                                {testResults[device.id].success ? '✅' : '❌'}
                                {testResults[device.id].success &&
                                  ` ${testResults[device.id].audioLevel}dB`}
                                {testResults[device.id].error && (
                                  <span title={testResults[device.id].error}> Error</span>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
