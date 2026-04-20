import React, { useState, useEffect } from 'react';
import './SystemStatus.css';

const GreenWaveCountdown = ({ greenWaveTimer }) => {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!greenWaveTimer || !greenWaveTimer.targets || greenWaveTimer.targets.length === 0) return null;

  const activeTargets = greenWaveTimer.targets.filter(t =>
    Math.ceil(Math.max(0, t.etaArrivalMs - Date.now()) / 1000) > 0
  );
  if (activeTargets.length === 0) return null;

  return (
    <div className="green-wave-panel">
      <div className="green-wave-header">
        <span className="green-wave-icon">🌊</span>
        <strong>Green Wave Active — Junction A released traffic</strong>
      </div>
      <div className="green-wave-targets">
        {greenWaveTimer.targets.map(t => {
          const remainingSec = Math.ceil(Math.max(0, t.etaArrivalMs - Date.now()) / 1000);
          const arrived = remainingSec <= 0;
          return (
            <div key={t.signalId} className={`green-wave-target ${arrived ? 'arrived' : 'pending'}`}>
              <div className="gw-junction">Junction {t.signalId}</div>
              <div className="gw-details">
                {arrived
                  ? <span className="gw-arrived">✅ GREEN NOW</span>
                  : <><span className="gw-countdown">{remainingSec}s</span><span className="gw-label"> until GREEN</span></>
                }
              </div>
              <div className="gw-eta">ETA offset: {t.etaSeconds}s from A</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Shows exactly what each mode means and how the signal gets green
const StrategyExplainer = ({ currentStrategy, signals }) => {
  if (!currentStrategy) return null;

  if (currentStrategy === 'ADAPTIVE') {
    if (!signals || signals.length === 0) return null;
    return (
      <div className="strategy-explainer adaptive">
        <div className="explainer-current">
          {signals.map(s => (
            <div key={s.signalId} className={`explainer-signal-row state-row-${(s.currentState||'red').toLowerCase()}`}>
              <span className="esc-id">Junction {s.signalId}</span>
              <span className={`esc-density density-${(s.density||'LOW').toLowerCase()}`}>{s.density || 'LOW'}</span>
              <span className="esc-arrow">→</span>
              <span className="esc-greentime">{s.adaptiveGreenTime || '—'}s green</span>
              <span className={`esc-state state-pill-${(s.currentState||'red').toLowerCase()}`}>{s.currentState || 'RED'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (currentStrategy === 'GREEN_WAVE') {
    return (
      <div className="strategy-explainer greenwave">
        <div className="explainer-header">
          <span className="explainer-icon">🌊</span>
          <span className="explainer-title">How Green Wave works</span>
        </div>
        <div className="explainer-steps">
          <div className="explainer-step">
            <span className="step-num">1</span>
            <span>Triggered when <strong>all junctions</strong> report HIGH density simultaneously</span>
          </div>
          <div className="explainer-step">
            <span className="step-num">2</span>
            <span>Junction A turns GREEN first — releasing the waiting platoon of vehicles</span>
          </div>
          <div className="explainer-step">
            <span className="step-num">3</span>
            <span>System calculates: <strong>travel time = distance (2 km) ÷ avg speed (km/h)</strong></span>
          </div>
          <div className="explainer-step">
            <span className="step-num">4</span>
            <span>Junction B (and C, D…) turns GREEN exactly when the platoon is predicted to arrive</span>
          </div>
        </div>
        <div className="explainer-cascade">
          <div className="cascade-node source">
            <div className="cascade-light green">🟢</div>
            <div>Junction A</div>
            <div className="cascade-label">GREEN now</div>
          </div>
          <div className="cascade-arrow">→ 2 km →</div>
          <div className="cascade-node downstream">
            <div className="cascade-light red">🔴</div>
            <div>Junction B</div>
            <div className="cascade-label">GREEN after 1× offset</div>
          </div>
          <div className="cascade-arrow">→ 2 km →</div>
          <div className="cascade-node downstream">
            <div className="cascade-light red">🔴</div>
            <div>Junction C</div>
            <div className="cascade-label">GREEN after 2× offset</div>
          </div>
        </div>
        <div className="explainer-note">
          Unlike Adaptive, junctions are <strong>coordinated</strong> — they don't act independently.
          B and C stay RED until the platoon from A is predicted to arrive.
        </div>
      </div>
    );
  }

  return null;
};

const SystemStatus = ({ systemMode, currentStrategy, totalSignals, onlineSignals, decision, greenWaveTimer, signals }) => {
  return (
    <div className="system-status">
      <div className="status-header">
        <h2>🎛️ System Status</h2>
        <div className="connection-indicator">
          <span className="pulse-dot"></span>
          <span>Live</span>
        </div>
      </div>

      <div className="status-grid">
        <div className="status-item">
          <div className="status-label">System Mode</div>
          <div className={`status-value mode-${systemMode?.toLowerCase()}`}>{systemMode || 'N/A'}</div>
        </div>
        <div className="status-item">
          <div className="status-label">Active Strategy</div>
          <div className={`status-value strategy-${currentStrategy?.toLowerCase()}`}>
            {currentStrategy === 'GREEN_WAVE' ? '🌊 GREEN WAVE' : currentStrategy === 'ADAPTIVE' ? '🧠 ADAPTIVE' : currentStrategy || 'N/A'}
          </div>
        </div>
        <div className="status-item">
          <div className="status-label">Signal Status</div>
          <div className="status-value">
            <span className="status-fraction">{onlineSignals}/{totalSignals}</span>
            <span className="status-subtext"> online</span>
          </div>
        </div>
      </div>

      {/* Clear strategy explanation */}
      <StrategyExplainer currentStrategy={currentStrategy} signals={signals} />

      {/* Green Wave countdown */}
      <GreenWaveCountdown greenWaveTimer={greenWaveTimer} />

      {/* Decision reason */}
      {decision && decision.reason && (
        <div className="decision-box">
          <div className="decision-header">
            <span className="decision-icon">💡</span>
            <strong>Why this strategy was chosen</strong>
          </div>
          <p className="decision-reason">{decision.reason}</p>
          {decision.confidence && (
            <div className="confidence-badge">Confidence: <strong>{decision.confidence.toUpperCase()}</strong></div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemStatus;
