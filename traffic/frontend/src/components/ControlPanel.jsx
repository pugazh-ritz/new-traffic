import React, { useState } from 'react';
import apiService from '../services/apiService';
import './ControlPanel.css';

const ControlPanel = ({ systemMode, currentStrategy, signals }) => {
  const [selectedSignal, setSelectedSignal] = useState('');
  const [greenTime, setGreenTime] = useState(60);
  const [redTime, setRedTime] = useState(40);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleModeSwitch = async (mode) => {
    setLoading(true);
    setMessage('');

    try {
      if (mode === 'AUTOMATIC') {
        await apiService.switchToAutomatic();
        setMessage('✅ Switched to AUTOMATIC mode');
      } else {
        await apiService.switchToManual();
        setMessage('✅ Switched to MANUAL mode');
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualOverride = async () => {
    if (!selectedSignal) {
      setMessage('⚠️ Please select a signal');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      await apiService.sendManualOverride(selectedSignal, greenTime, redTime);
      setMessage(`✅ Manual override sent to Signal ${selectedSignal}`);
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceStrategy = async (strategy) => {
    setLoading(true);
    setMessage('');

    try {
      await apiService.forceStrategy(strategy);
      setMessage(`✅ Forced strategy to ${strategy}`);
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="control-panel">
      <h2>Control Panel</h2>

      {/* System Mode */}
      <div className="control-section">
        <h3>System Mode</h3>
        <div className="mode-buttons">
          <button
            className={`mode-btn ${systemMode === 'AUTOMATIC' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('AUTOMATIC')}
            disabled={loading || systemMode === 'AUTOMATIC'}
          >
            🤖 AUTOMATIC
          </button>
          <button
            className={`mode-btn ${systemMode === 'MANUAL' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('MANUAL')}
            disabled={loading || systemMode === 'MANUAL'}
          >
            👤 MANUAL
          </button>
        </div>
        
        {systemMode === 'AUTOMATIC' && currentStrategy && (
          <div className="strategy-info">
            Current Strategy: <strong>{currentStrategy}</strong>
          </div>
        )}
      </div>

      {/* Manual Override */}
      <div className="control-section">
        <h3>Manual Override</h3>
        <p className="section-description">
          Override individual signal timing (requires MANUAL mode)
        </p>

        <div className="form-group">
          <label>Select Signal:</label>
          <select
            value={selectedSignal}
            onChange={(e) => setSelectedSignal(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Choose Signal --</option>
            {signals.map(signal => (
              <option key={signal.signalId} value={signal.signalId}>
                Signal {signal.signalId}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Green Time (seconds):</label>
          <input
            type="range"
            min="10"
            max="120"
            value={greenTime}
            onChange={(e) => setGreenTime(parseInt(e.target.value))}
            disabled={loading}
          />
          <span className="range-value">{greenTime}s</span>
        </div>

        <div className="form-group">
          <label>Red Time (seconds):</label>
          <input
            type="range"
            min="10"
            max="120"
            value={redTime}
            onChange={(e) => setRedTime(parseInt(e.target.value))}
            disabled={loading}
          />
          <span className="range-value">{redTime}s</span>
        </div>

        <button
          className="apply-btn"
          onClick={handleManualOverride}
          disabled={loading || !selectedSignal}
        >
          Apply Override
        </button>
      </div>

      {/* Force Strategy (Testing) */}
      <div className="control-section">
        <h3>Force Strategy (Testing)</h3>
        <div className="force-buttons">
          <button
            className="force-btn adaptive"
            onClick={() => handleForceStrategy('ADAPTIVE')}
            disabled={loading}
          >
            Force ADAPTIVE
          </button>
          <button
            className="force-btn greenwave"
            onClick={() => handleForceStrategy('GREEN_WAVE')}
            disabled={loading}
          >
            Force GREEN WAVE
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`message ${message.includes('❌') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
