import React from 'react';
import { DENSITY_COLORS, CONNECTION_STATUS } from '../config';
import './SignalCard.css';

const LIGHT_COLORS = {
  RED:    { active: '#f44336', inactive: '#4a1a1a' },
  YELLOW: { active: '#ffc107', inactive: '#4a3a00' },
  GREEN:  { active: '#4caf50', inactive: '#0a2a0a' }
};

const TrafficLight = ({ currentState }) => {
  const state = currentState || 'RED';
  return (
    <div className="traffic-light">
      {['RED', 'YELLOW', 'GREEN'].map(color => (
        <div
          key={color}
          className="traffic-light-bulb"
          style={{
            backgroundColor: state === color ? LIGHT_COLORS[color].active : LIGHT_COLORS[color].inactive,
            boxShadow: state === color ? `0 0 14px 5px ${LIGHT_COLORS[color].active}` : 'none'
          }}
        />
      ))}
    </div>
  );
};

// Shows the logic panel — WHY is this signal in this state?
const SignalLogic = ({ signal, currentStrategy, greenWaveTimer }) => {
  const state = signal.currentState || 'RED';
  const density = signal.density || 'LOW';
  const adaptiveGreenTime = signal.adaptiveGreenTime;
  const greenReason = signal.greenReason;
  const waveTarget = greenWaveTimer?.targets?.find(t => t.signalId === signal.signalId);
  const waveOffset = waveTarget?.etaSeconds;

  // What the signal will do next
  let nextAction;
  if (currentStrategy === 'GREEN_WAVE') {
    if (state === 'RED') {
      nextAction = waveTarget?.remainingSeconds !== undefined
        ? `→ GREEN in ~${waveTarget.remainingSeconds}s`
        : '→ GREEN when wave triggered';
    } else if (state === 'GREEN') {
      const hold = waveOffset || adaptiveGreenTime || '?';
      nextAction = `→ YELLOW in ~${hold}s`;
    } else {
      nextAction = '→ RED in 5s';
    }
  } else {
    nextAction = state === 'GREEN'
      ? `→ YELLOW in ~${adaptiveGreenTime || '?'}s`
      : state === 'YELLOW'
      ? '→ RED in 5s'
      : `→ GREEN in ~${adaptiveGreenTime || '?'}s`;
  }

  return (
    <div className={`signal-logic-panel logic-${state.toLowerCase()}`}>
      <div className="logic-header">⚙️ Signal Logic</div>

      {state === 'GREEN' && greenReason && (
        <div className="logic-green-reason">
          <span className="logic-tick">✅</span> {greenReason}
        </div>
      )}

      {state === 'RED' && (
        <div className="logic-red-reason">
          <span className="logic-dot red-dot">🔴</span>
          {currentStrategy === 'GREEN_WAVE'
            ? `Holding RED — waiting for platoon from Junction A`
            : `Waiting turn — ${density} density → will get ${adaptiveGreenTime || '?'}s green when cycle reaches this junction`
          }
        </div>
      )}

      {state === 'YELLOW' && (
        <div className="logic-yellow-reason">
          <span className="logic-dot yellow-dot">🟡</span>
          Transitioning — clearing intersection before RED
        </div>
      )}

      <div className="logic-next">
        <span className="logic-next-label">Next:</span> {nextAction}
      </div>

      {currentStrategy === 'ADAPTIVE' && adaptiveGreenTime && (
        <div className="logic-formula">
          Formula: {density} density → <strong>{adaptiveGreenTime}s</strong> green time
        </div>
      )}

      {currentStrategy === 'GREEN_WAVE' && (
        <div className="logic-formula">
          Mode: coordinated corridor — junctions follow Junction A's release
        </div>
      )}
    </div>
  );
};

const SignalCard = ({ signal, currentStrategy, greenWaveTimer }) => {
  if (!signal) {
    return (
      <div className="signal-card signal-card-empty">
        <div className="signal-card-header">
          <h3>No Signal Data</h3>
          <p className="empty-hint">Start a signal simulator or connect a real node to see data here.</p>
        </div>
      </div>
    );
  }

  const isOnline = signal.status === CONNECTION_STATUS.ONLINE;
  const densityColor = DENSITY_COLORS[signal.density] || '#999';
  const currentState = signal.currentState || 'RED';
  const waveTarget = greenWaveTimer?.targets?.find(t => t.signalId === signal.signalId);
  const waveOffset = waveTarget?.etaSeconds;

  return (
    <div className={`signal-card ${!isOnline ? 'signal-card-offline' : ''} signal-state-${currentState.toLowerCase()}`}>

      {/* Header */}
      <div className="signal-card-header">
        <div className="signal-card-title">
          <h3>Junction {signal.signalId}</h3>
          <span className={`signal-state-label state-${currentState.toLowerCase()}`}>{currentState}</span>
        </div>
        <TrafficLight currentState={currentState} />
      </div>

      <div className="signal-card-body">
        {/* Vehicle Count — cumulative queue during RED, live count during GREEN */}
        {currentState === 'RED' || currentState === 'YELLOW' ? (
          <div className="signal-metric signal-metric-queue">
            <div className="metric-icon">🚗</div>
            <div className="metric-info">
              <div className="metric-label">Queue (Accumulated)</div>
              <div className="metric-value metric-value-queue">
                {signal.cumulativeRedCount || 0}
                <span className="queue-badge">🔴 waiting</span>
              </div>
              <div className="metric-sublabel">
                Last scan: {signal.vehicleCount || 0} vehicles detected
              </div>
            </div>
          </div>
        ) : (
          <div className="signal-metric">
            <div className="metric-icon">🚗</div>
            <div className="metric-info">
              <div className="metric-label">Vehicles Passing</div>
              <div className="metric-value metric-value-green">{signal.vehicleCount || 0}</div>
              <div className="metric-sublabel">Queue cleared ✅</div>
            </div>
          </div>
        )}

        {/* Density */}
        <div className="signal-metric">
          <div className="density-indicator" style={{ backgroundColor: densityColor }} />
          <div className="metric-info">
            <div className="metric-label">Traffic Density</div>
            <div className="metric-value" style={{ color: densityColor }}>{signal.density || 'N/A'}</div>
          </div>
        </div>

        {/* Average Speed */}
        {signal.avgSpeed && (
          <div className="signal-metric">
            <div className="metric-icon">⚡</div>
            <div className="metric-info">
              <div className="metric-label">Avg Speed</div>
              <div className="metric-value">{Math.round(signal.avgSpeed)} km/h</div>
            </div>
          </div>
        )}

        {/* Adaptive Green Time */}
        {(currentStrategy !== 'GREEN_WAVE' ? signal.adaptiveGreenTime : waveOffset) && (
          <div className="signal-metric adaptive-timing">
            <div className="metric-icon">⏱️</div>
            <div className="metric-info">
              <div className="metric-label">
                {currentStrategy === 'GREEN_WAVE' ? 'Green Wave Offset' : 'Adaptive Green Time'}
              </div>
              <div className="metric-value adaptive-green">
                {currentStrategy === 'GREEN_WAVE' ? `${waveOffset}s` : `${signal.adaptiveGreenTime}s`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Signal Logic — explains WHY it's in this state */}
      <SignalLogic signal={signal} currentStrategy={currentStrategy} greenWaveTimer={greenWaveTimer} />

      {/* Footer */}
      <div className="signal-footer">
        <span className={`status-badge ${isOnline ? 'status-online' : 'status-offline'}`}>
          {signal.status}
        </span>
        <small>Updated: {signal.lastUpdate ? new Date(signal.lastUpdate).toLocaleTimeString() : '—'}</small>
      </div>
    </div>
  );
};

export default SignalCard;
