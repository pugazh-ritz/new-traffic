/**
 * Signal State Management
 * Maintains live state of all connected traffic signals
 */

const { CONNECTION_STATUS } = require('../config/constants');

class SignalStateManager {
  constructor() {
    // Live state of all signals
    this.signals = new Map();
    
    // System-wide state
    this.systemMode = 'AUTOMATIC';
    this.currentStrategy = 'ADAPTIVE';
    this.greenWaveTimer = null;
    this.forcedStrategy = null;
    
    // History (limited to last N records per signal)
    this.historyLimit = 100;
    this.history = new Map();
  }

  /**
   * Register a new signal or update existing one
   */
  updateSignal(signalId, data) {
    const now = Date.now();
    const existing = this.signals.get(signalId);
    const prevState = existing?.currentState || null;
    const newState = data.currentState || prevState || 'RED';
    const newVehicleCount = data.vehicleCount || 0;

    // Cumulative RED queue logic:
    // - Reset to 0 when transitioning INTO green
    // - During RED/YELLOW, only allow the count to grow (vehicles accumulate in queue)
    let cumulativeRedCount = existing?.cumulativeRedCount || 0;

    if (newState === 'GREEN') {
      // Light just turned green — queue clears
      cumulativeRedCount = 0;
    } else if (newState === 'RED' || newState === 'YELLOW') {
      // Accumulate: queue only grows while signal is red/yellow
      cumulativeRedCount = Math.max(cumulativeRedCount, newVehicleCount);
    }

    const signalData = {
      signalId,
      vehicleCount: newVehicleCount,
      density: data.density || 'LOW',
      avgSpeed: data.avgSpeed || null,
      lastUpdate: now,
      status: CONNECTION_STATUS.ONLINE,
      ...data,
      cumulativeRedCount,
    };

    this.signals.set(signalId, signalData);
    this._addToHistory(signalId, signalData);

    return signalData;
  }

  /**
   * Get current state of a specific signal
   */
  getSignal(signalId) {
    return this.signals.get(signalId);
  }

  /**
   * Get all signals
   */
  getAllSignals() {
    return Array.from(this.signals.values());
  }

  /**
   * Get online signals only
   */
  getOnlineSignals() {
    return this.getAllSignals().filter(
      signal => signal.status === CONNECTION_STATUS.ONLINE
    );
  }

  /**
   * Mark signal as offline
   */
  markOffline(signalId) {
    const signal = this.signals.get(signalId);
    if (signal) {
      signal.status = CONNECTION_STATUS.OFFLINE;
      this.signals.set(signalId, signal);
    }
  }

  /**
   * Remove signal completely
   */
  removeSignal(signalId) {
    this.signals.delete(signalId);
  }

  /**
   * Check for stale signals (no updates for timeout period)
   */
  checkStaleSignals(timeoutMs = 5000) {
    const now = Date.now();
    const staleSignals = [];

    this.signals.forEach((signal, signalId) => {
      if (now - signal.lastUpdate > timeoutMs) {
        this.markOffline(signalId);
        staleSignals.push(signalId);
      }
    });

    return staleSignals;
  }

  /**
   * Get system mode
   */
  getSystemMode() {
    return this.systemMode;
  }

  /**
   * Set system mode
   */
  setSystemMode(mode) {
    this.systemMode = mode;
  }

  /**
   * Get current strategy
   */
  getCurrentStrategy() {
    return this.currentStrategy;
  }

  /**
   * Set current strategy
   */
  setCurrentStrategy(strategy) {
    this.currentStrategy = strategy;
  }

  setForcedStrategy(strategy) {
    this.forcedStrategy = strategy || null;
  }

  getForcedStrategy() {
    return this.forcedStrategy;
  }

  /**
   * Start/update multi-junction arrival timers from Junction A release.
   */
  startGreenWaveTimer({ releaseAtMs, sourceSignal = 'A', targets = [] }) {
    const normalizedTargets = (targets || [])
      .filter(t => t && t.signalId && Number.isFinite(t.etaSeconds))
      .map(t => ({
        signalId: t.signalId,
        etaSeconds: t.etaSeconds,
        etaArrivalMs: releaseAtMs + (t.etaSeconds * 1000)
      }));

    this.greenWaveTimer = {
      sourceSignal,
      releaseAtMs,
      targets: normalizedTargets
    };
  }

  /**
   * Get current green-wave timer with computed remaining seconds.
   */
  getGreenWaveTimer() {
    if (!this.greenWaveTimer) return null;

    const targets = this.greenWaveTimer.targets.map((t) => {
      const remainingMs = Math.max(0, t.etaArrivalMs - Date.now());
      return {
        signalId: t.signalId,
        etaSeconds: t.etaSeconds,
        etaArrivalMs: t.etaArrivalMs,
        remainingSeconds: Math.ceil(remainingMs / 1000)
      };
    });

    // Auto-expire timer when all downstream arrivals have completed.
    const hasActiveTarget = targets.some((t) => t.remainingSeconds > 0);
    if (!hasActiveTarget) {
      this.greenWaveTimer = null;
      // Auto-clear forced GREEN_WAVE after one full wave cycle.
      if (this.forcedStrategy === 'GREEN_WAVE') {
        this.forcedStrategy = null;
      }
      if (this.currentStrategy === 'GREEN_WAVE') {
        this.currentStrategy = 'ADAPTIVE';
      }
      return null;
    }

    return {
      ...this.greenWaveTimer,
      targets
    };
  }

  /**
   * Get system summary
   */
  getSystemSummary() {
    const signals = this.getAllSignals();
    const onlineCount = this.getOnlineSignals().length;

    return {
      systemMode: this.systemMode,
      currentStrategy: this.currentStrategy,
      forcedStrategy: this.forcedStrategy,
      totalSignals: signals.length,
      onlineSignals: onlineCount,
      offlineSignals: signals.length - onlineCount,
      signals: signals
        .sort((a, b) => (a.signalId || '').localeCompare(b.signalId || ''))
        .map(s => ({
          signalId: s.signalId,
          density: s.density,
          vehicleCount: s.vehicleCount,
          cumulativeRedCount: s.cumulativeRedCount || 0,
          avgSpeed: s.avgSpeed || null,
          status: s.status,
          currentState: s.currentState || 'RED',
          adaptiveGreenTime: s.adaptiveGreenTime || null,
          greenReason: s.greenReason || null,
          lastUpdate: s.lastUpdate
        })),
      greenWaveTimer: this.getGreenWaveTimer()
    };
  }

  /**
   * Get historical data for a signal
   */
  getHistory(signalId, limit = 50) {
    const signalHistory = this.history.get(signalId) || [];
    return signalHistory.slice(-limit);
  }

  /**
   * Add data to history (private)
   */
  _addToHistory(signalId, data) {
    if (!this.history.has(signalId)) {
      this.history.set(signalId, []);
    }

    const signalHistory = this.history.get(signalId);
    signalHistory.push({
      timestamp: data.lastUpdate,
      vehicleCount: data.vehicleCount,
      density: data.density,
      avgSpeed: data.avgSpeed
    });

    // Keep only last N records
    if (signalHistory.length > this.historyLimit) {
      signalHistory.shift();
    }
  }

  /**
   * Clear all state (for testing)
   */
  reset() {
    this.signals.clear();
    this.history.clear();
    this.systemMode = 'AUTOMATIC';
    this.currentStrategy = 'ADAPTIVE';
    this.greenWaveTimer = null;
  }
}

// Singleton instance
const signalStateManager = new SignalStateManager();

module.exports = signalStateManager;
