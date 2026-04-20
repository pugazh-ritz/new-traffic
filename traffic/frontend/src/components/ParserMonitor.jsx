import React from 'react';
import { API_BASE_URL } from '../config';
import apiService from '../services/apiService';
import './ParserMonitor.css';

const NoFeedPlaceholder = ({ label }) => (
  <div className="no-feed-placeholder">
    <div className="no-feed-icon">📷</div>
    <div className="no-feed-label">{label}</div>
    <div className="no-feed-hint">
      Waiting for parsed frame from video parser
    </div>
  </div>
);

const ParsedFrameCard = ({ signalId, refreshTick }) => {
  const [hasError, setHasError] = React.useState(false);
  const src = `${API_BASE_URL}/media/parsed/${signalId}.jpg?t=${refreshTick}`;

  React.useEffect(() => {
    setHasError(false);
  }, [refreshTick]);

  return (
    <div className="parsed-preview-card">
      <div className="parsed-card-header">
        <span className="parsed-signal-badge">Junction {signalId}</span>
        <span className={`parsed-feed-status ${hasError ? 'no-feed' : 'live'}`}>
          {hasError ? '⚫ No Feed' : '🔴 Live'}
        </span>
      </div>
      {hasError ? (
        <NoFeedPlaceholder label={`Signal ${signalId} parsed frame`} />
      ) : (
        <img
          src={src}
          alt={`Signal ${signalId} parsed output`}
          onError={() => setHasError(true)}
          className="parsed-frame-img"
        />
      )}
      <div className="parsed-card-footer">
        Parsed by Python CV detector · saves to <code>parsed_frames/{signalId}.jpg</code>
      </div>
    </div>
  );
};

function ParserMonitor({ systemState }) {
  const [refreshTick, setRefreshTick] = React.useState(Date.now());
  const [triggerLoading, setTriggerLoading] = React.useState(false);
  const [triggerMessage, setTriggerMessage] = React.useState('');
  const greenWaveTimer = systemState.greenWaveTimer;

  React.useEffect(() => {
    const interval = setInterval(() => setRefreshTick(Date.now()), 1500);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerARelease = async () => {
    setTriggerLoading(true);
    setTriggerMessage('');
    try {
      const response = await apiService.triggerARelease();
      if (response.success) {
        const etaSummary = (response.targets || [])
          .map((t) => `Junction ${t.signalId} in ${t.etaSeconds}s`)
          .join(' → ');
        setTriggerMessage(`✅ Junction A released. Green wave: ${etaSummary}`);
      } else {
        setTriggerMessage(response.error || 'Unable to trigger release');
      }
    } catch (error) {
      setTriggerMessage(error?.response?.data?.error || error.message || 'Unable to trigger release');
    } finally {
      setTriggerLoading(false);
    }
  };

  const bTimer = greenWaveTimer?.targets?.find((t) => t.signalId === 'B');
  const cTimer = greenWaveTimer?.targets?.find((t) => t.signalId === 'C');

  const currentStrategy = systemState.currentStrategy;
  const isGreenWave = currentStrategy === 'GREEN_WAVE';

  return (
    <section className="parser-monitor">

      {/* ── Video Frame Feed ── */}
      <div className="parser-video-panel">
        <div className="parser-panel-header">
          <h2>Parsed Traffic Frames</h2>
          <span className="parser-refresh-note">
            Refreshing every 1.5s from Python CV output
          </span>
        </div>

        <div className="parser-live-video">
          <div className="parser-live-header">
            <span className="parser-live-title">Junction A Live Feed</span>
            <span className="parser-live-subtitle">Source video stream</span>
          </div>
          <video
            className="parser-live-video-el"
            src={`${API_BASE_URL}/media/traffic-video`}
            muted
            autoPlay
            loop
            playsInline
          />
        </div>

        <div className="parsed-preview-grid">
          <ParsedFrameCard signalId="A" refreshTick={refreshTick} />
          <ParsedFrameCard signalId="B" refreshTick={refreshTick} />
          <ParsedFrameCard signalId="C" refreshTick={refreshTick} />
        </div>

      </div>

      {/* ── Live Data Panel ── */}
      <div className="parser-data-panel">
        <h2>Live Signal Data</h2>

        {/* Strategy explanation */}
        <div className={`strategy-banner strategy-banner-${(currentStrategy || 'none').toLowerCase().replace('_', '-')}`}>
          {isGreenWave ? (
            <>
              <div className="strategy-banner-title">🌊 GREEN WAVE ACTIVE</div>
              <div className="strategy-banner-desc">
                All junctions HIGH density → Junction A goes GREEN first → downstream junctions follow
                in sequence based on vehicle travel time (distance ÷ speed).
              </div>
            </>
          ) : (
            <>
              <div className="strategy-banner-title">🧠 ADAPTIVE MODE</div>
              <div className="strategy-banner-desc">
                Each junction independently sets its own green time based on local density:
                LOW → 30s · MEDIUM → 60s · HIGH → 90s
              </div>
            </>
          )}
        </div>

        {/* Signal rows */}
        <div className="parser-signals-list">
          {systemState.signals.length === 0 && (
            <div className="signal-row empty">Waiting for signal data from simulators / video parsers...</div>
          )}
          {systemState.signals.map((signal) => (
            <div className="signal-row" key={signal.signalId}>
              <div className="signal-id">Junction {signal.signalId}</div>
              <div className={`state-chip state-chip-${(signal.currentState || 'RED').toLowerCase()}`}>
                {signal.currentState || 'RED'}
              </div>
              <div className={`density-chip density-${(signal.density || 'LOW').toLowerCase()}`}>
                {signal.density || 'LOW'}
              </div>
              <div className="vehicle-count">{signal.vehicleCount} vehicles</div>
              {signal.adaptiveGreenTime && (
                <div className="adaptive-time-chip">⏱ {signal.adaptiveGreenTime}s</div>
              )}
              {signal.greenReason && (
                <div className="green-reason-chip">✅ {signal.greenReason}</div>
              )}
            </div>
          ))}
        </div>

        {/* Green wave countdown */}
        {isGreenWave && (
          <div className="gw-parser-panel">
            <div className="gw-parser-title">🕒 Green Wave Cascade Timers</div>
            <div className="gw-parser-row">
              <span>Junction B turns GREEN in:</span>
              <strong>
                {bTimer
                  ? `${bTimer.remainingSeconds}s`
                  : 'Waiting for Junction A release'}
              </strong>
            </div>
            <div className="gw-parser-row">
              <span>Junction C turns GREEN in:</span>
              <strong>
                {cTimer
                  ? `${cTimer.remainingSeconds}s`
                  : 'Waiting for Junction A release'}
              </strong>
            </div>
            <button
              className="trigger-a-btn"
              onClick={handleTriggerARelease}
              disabled={triggerLoading}
            >
              {triggerLoading ? 'Triggering...' : '▶ Manually trigger Junction A GREEN'}
            </button>
            {triggerMessage && (
              <div className={`trigger-msg ${triggerMessage.startsWith('✅') ? 'success' : 'error'}`}>
                {triggerMessage}
              </div>
            )}
            <div className="trigger-note">
              In production this fires automatically when Junction A's camera detects traffic departing.
              Use the button above for demo/testing.
            </div>
          </div>
        )}

        {/* Decision reason */}
        <div className="decision-box">
          <h3>Why this strategy was chosen</h3>
          <p>{systemState.decision?.reason || 'No decision yet — waiting for signal data'}</p>
          {systemState.decision?.confidence && (
            <span className="confidence-badge">Confidence: {systemState.decision.confidence.toUpperCase()}</span>
          )}
        </div>
      </div>
    </section>
  );
}

export default ParserMonitor;
