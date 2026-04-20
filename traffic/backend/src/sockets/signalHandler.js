/**
 * Socket.IO Event Handlers for Signal Nodes
 * Manages real-time communication with traffic signal edge devices
 */

const { EVENTS, CONNECTION_STATUS } = require('../config/constants');
const signalState = require('../state/signalState');
const strategyEngine = require('../decision/strategyEngine');

class SignalSocketHandler {
  constructor(io) {
    this.io = io;
    this.signalSockets = new Map(); // signalId -> socket
    this.lastGreenWaveOffsetSec = null;
  }

  _startGreenWaveTimerFromA(avgSpeed = null) {
    const greenWaveConfig = strategyEngine.getGreenWaveConfig('A', avgSpeed || null);
    const baseOffsetSec = greenWaveConfig.offsetSeconds;

    // Road layout order: A → B → C
    const ROAD_ORDER = ['A', 'B', 'C'];

    // Prefer online signals; fall back to all connected socket IDs so the
    // timer is never empty just because B/C haven't sent their first update yet.
    const onlineIds = signalState.getOnlineSignals().map(s => s.signalId);
    const connectedIds = Array.from(this.signalSockets.keys());
    const allKnownIds = [...new Set([...onlineIds, ...connectedIds])];

    const downstreamSignals = allKnownIds
      .filter(id => id !== 'A')
      .sort((x, y) => {
        const xi = ROAD_ORDER.indexOf(x);
        const yi = ROAD_ORDER.indexOf(y);
        return (xi === -1 ? 999 : xi) - (yi === -1 ? 999 : yi);
      });

    const targets = downstreamSignals.map((signalId, index) => ({
      signalId,
      etaSeconds: baseOffsetSec * (index + 1)
    }));

    const releaseAtMs = Date.now();
    signalState.startGreenWaveTimer({
      releaseAtMs,
      sourceSignal: 'A',
      targets
    });

    // Log the full sequence to terminal
    console.log('\n[Green Wave] ═══════════════════════════════════════');
    console.log(`[Green Wave] Junction A → GREEN NOW`);
    console.log(`[Green Wave] Speed used: ${Math.round(avgSpeed || greenWaveConfig.speedBand.optimal)} km/h | Signal spacing: ${greenWaveConfig.distance} km`);
    targets.forEach(t => {
      const etaTime = new Date(releaseAtMs + t.etaSeconds * 1000).toLocaleTimeString();
      console.log(`[Green Wave] Junction ${t.signalId} → GREEN in ${t.etaSeconds}s (ETA: ${etaTime})`);
    });
    console.log('[Green Wave] ═══════════════════════════════════════\n');

    // Notify all nodes of the actual release moment (A went GREEN)
    this.io.emit(EVENTS.GREEN_WAVE_RELEASE, {
      releaseAtMs,
      offsetSeconds: baseOffsetSec,
      speedKmph: Math.round(avgSpeed || greenWaveConfig.speedBand.optimal),
      distanceKm: greenWaveConfig.distance
    });

    // Schedule terminal alerts when each downstream junction should go green
    targets.forEach(t => {
      setTimeout(() => {
        console.log('\n[Green Wave] ⏰ ══════════════════════════════════════════');
        console.log(`[Green Wave] ⏰ NOW: Junction ${t.signalId} should turn GREEN`);
        console.log('[Green Wave] ⏰    Traffic arriving from Junction A');
        console.log('[Green Wave] ⏰ ══════════════════════════════════════════\n');
        this.broadcastSystemUpdate();
      }, t.etaSeconds * 1000);
    });

    return targets;
  }

  /**
   * Initialize signal-related socket handlers
   */
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket] New connection: ${socket.id}`);

      // Handle signal node connection
      socket.on(EVENTS.SIGNAL_CONNECT, (data) => {
        this.handleSignalConnect(socket, data);
      });

      // Handle signal updates (vehicle data)
      socket.on(EVENTS.SIGNAL_UPDATE, (data) => {
        this.handleSignalUpdate(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleSignalDisconnect(socket);
      });
    });

    // Start periodic health check
    this.startHealthCheck();
  }

  /**
   * Handle signal node connecting to admin
   */
  handleSignalConnect(socket, data) {
    const { signalId } = data;

    if (!signalId) {
      console.error('[Signal Connect] Missing signalId');
      socket.emit('error', { message: 'signalId required' });
      return;
    }

    console.log(`[Signal Connect] Signal ${signalId} connected`);

    // Store socket reference
    socket.signalId = signalId;
    this.signalSockets.set(signalId, socket);

    // Initialize signal in state
    signalState.updateSignal(signalId, {
      status: CONNECTION_STATUS.ONLINE,
      connectedAt: Date.now()
    });

    // Send acknowledgment
    socket.emit('connected', {
      signalId,
      message: 'Connected to admin control center',
      timestamp: Date.now()
    });

    // Broadcast system update to dashboard
    this.broadcastSystemUpdate();
  }

  /**
   * Handle incoming signal data (vehicle count, density, etc.)
   */
  handleSignalUpdate(socket, data) {
    const { signalId } = data;

    if (!signalId) {
      console.error('[Signal Update] Missing signalId');
      return;
    }

    const previousSignal = signalState.getSignal(signalId);
    const previousState = previousSignal?.currentState || null;

    // Compute adaptive green time for this signal and store it
    const adaptiveGreenTime = strategyEngine.computeAdaptiveGreenTime(data.density);

    // Update signal state (include computed adaptive green time)
    signalState.updateSignal(signalId, { ...data, adaptiveGreenTime });

    console.log(`[Signal Update] Junction ${signalId} — Vehicles: ${data.vehicleCount || 0}, Density: ${data.density || 'N/A'}${data.avgSpeed ? `, Speed: ${Math.round(data.avgSpeed)} km/h` : ''}`);

    // Log adaptive green time so terminal always shows what timing applies
    if (data.density) {
      console.log(`[Adaptive]     Junction ${signalId} — Density: ${data.density}, Vehicles: ${data.vehicleCount || 0} → Green Time: ${adaptiveGreenTime}s`);
    }

    // Event-driven GREEN_WAVE timing:
    // when Signal A actually turns GREEN, calculate ETA for downstream junctions.
    if (
      signalState.getCurrentStrategy() === 'GREEN_WAVE' &&
      signalId === 'A' &&
      data.currentState === 'GREEN' &&
      previousState !== 'GREEN'
    ) {
      this._startGreenWaveTimerFromA(data.avgSpeed || null);
    }

    // Run decision engine (only in AUTOMATIC mode)
    if (signalState.getSystemMode() === 'AUTOMATIC') {
      this.evaluateAndUpdateStrategy();
    }

    // Fallback path: if strategy just became GREEN_WAVE and A is already GREEN,
    // initialize timer once from the current update.
    if (
      signalId === 'A' &&
      data.currentState === 'GREEN' &&
      signalState.getCurrentStrategy() === 'GREEN_WAVE' &&
      !signalState.getGreenWaveTimer()
    ) {
      this._startGreenWaveTimerFromA(data.avgSpeed || null);
    }

    // Broadcast to dashboard
    this.broadcastSystemUpdate();
  }

  /**
   * Handle signal disconnection
   */
  handleSignalDisconnect(socket) {
    const signalId = socket.signalId;

    if (signalId) {
      console.log(`[Signal Disconnect] Signal ${signalId} disconnected`);
      
      signalState.markOffline(signalId);
      this.signalSockets.delete(signalId);

      // Check if we need to switch to fail-safe mode
      const onlineSignals = signalState.getOnlineSignals();
      if (onlineSignals.length === 0) {
        console.warn('[Fail-Safe] No signals online - system in fail-safe mode');
      }

      this.broadcastSystemUpdate();
    }
  }

  /**
   * Evaluate current conditions and update strategy if needed
   */
  evaluateAndUpdateStrategy() {
    const decision = strategyEngine.decideStrategy();
    const currentStrategy = signalState.getCurrentStrategy();

    // Only send update if strategy changed
    if (decision.strategy && decision.strategy !== currentStrategy) {
      console.log(`[Strategy Change] ${currentStrategy} → ${decision.strategy}`);
      console.log(`[Reason] ${decision.reason}`);

      signalState.setCurrentStrategy(decision.strategy);
      this.sendStrategyUpdate(decision);
      return;
    }

    // Safeguard: while GREEN_WAVE is active but no A-release event captured yet,
    // keep pushing mode updates so edge nodes align states (A -> GREEN, B -> wait ETA).
    if (
      decision.strategy === 'GREEN_WAVE' &&
      currentStrategy === 'GREEN_WAVE' &&
      !signalState.getGreenWaveTimer()
    ) {
      this.sendStrategyUpdate(decision);
    }
  }

  /**
   * Send strategy update to all signal nodes
   */
  sendStrategyUpdate(decision) {
    const { strategy } = decision;

    let payload;

    if (strategy === 'ADAPTIVE') {
      payload = strategyEngine.getAdaptiveConfig();
    } else if (strategy === 'GREEN_WAVE') {
      // Determine base signal (first online signal or 'A')
      const onlineSignals = signalState.getOnlineSignals();
      const baseSignal = onlineSignals.find(s => s.signalId === 'A')?.signalId || (onlineSignals.length > 0 ? onlineSignals[0].signalId : 'A');
      
      payload = strategyEngine.getGreenWaveConfig(baseSignal);
      this.lastGreenWaveOffsetSec = payload.offsetSeconds;
    } else {
      return; // No strategy (manual mode)
    }

    // Add decision metadata
    payload.decision = {
      reason: decision.reason,
      timestamp: Date.now()
    };

    console.log('[Strategy Update] Broadcasting to all signals:', payload.mode);

    // Send to all connected signals
    this.signalSockets.forEach((socket, signalId) => {
      socket.emit(EVENTS.MODE_UPDATE, payload);
    });

    // Also broadcast to dashboard
    this.broadcastSystemUpdate();
  }

  /**
   * Send manual override command to specific signal
   */
  sendManualOverride(signalId, config) {
    const socket = this.signalSockets.get(signalId);

    if (!socket) {
      console.error(`[Manual Override] Signal ${signalId} not connected`);
      return false;
    }

    const now = new Date();
    const greenEndTime = new Date(now.getTime() + config.greenTime * 1000).toLocaleTimeString();
    const redEndTime = new Date(now.getTime() + (config.greenTime + (config.yellowTime || 5) + config.redTime) * 1000).toLocaleTimeString();
    console.log('\n[Manual Override] ════════════════════════════════════');
    console.log(`[Manual Override] Junction ${signalId} timing applied:`);
    console.log(`[Manual Override]   GREEN  : ${config.greenTime}s (until ~${greenEndTime})`);
    console.log(`[Manual Override]   YELLOW : ${config.yellowTime || 5}s`);
    console.log(`[Manual Override]   RED    : ${config.redTime}s (cycle ends ~${redEndTime})`);
    console.log('[Manual Override] ════════════════════════════════════\n');

    socket.emit(EVENTS.MANUAL_OVERRIDE, {
      ...config,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Force a direct signal state override (used for demo triggers)
   */
  sendSignalStateOverride(signalId, state) {
    const socket = this.signalSockets.get(signalId);
    if (!socket) return false;
    socket.emit(EVENTS.MANUAL_OVERRIDE, {
      signalId,
      state,
      timestamp: Date.now()
    });
    return true;
  }

  /**
   * Demo trigger: release traffic at Junction A now and start Junction B ETA timer.
   */
  triggerGreenWaveReleaseFromA() {
    if (signalState.getCurrentStrategy() !== 'GREEN_WAVE') {
      // Demo convenience: allow trigger button to enter GREEN_WAVE first.
      const decision = {
        strategy: 'GREEN_WAVE',
        reason: 'Manually triggered GREEN_WAVE release from dashboard',
        manual: true
      };
      signalState.setCurrentStrategy('GREEN_WAVE');
      this.sendStrategyUpdate(decision);
    }

    const signalA = signalState.getSignal('A');
    const targets = this._startGreenWaveTimerFromA(signalA?.avgSpeed || null);

    this.sendSignalStateOverride('A', 'GREEN');
    const downstreamSignals = signalState.getOnlineSignals()
      .map(s => s.signalId)
      .filter(id => id !== 'A');
    downstreamSignals.forEach((signalId) => this.sendSignalStateOverride(signalId, 'RED'));

    // Reflect immediate state in backend cache for UI consistency
    signalState.updateSignal('A', { ...(signalA || {}), signalId: 'A', currentState: 'GREEN' });
    downstreamSignals.forEach((signalId) => {
      const signal = signalState.getSignal(signalId);
      signalState.updateSignal(signalId, { ...(signal || {}), signalId, currentState: 'RED' });
    });

    this.broadcastSystemUpdate();

    return {
      success: true,
      targets
    };
  }

  /**
   * Broadcast current system state to all dashboard clients
   */
  broadcastSystemUpdate() {
    const summary = signalState.getSystemSummary();
    const decision = strategyEngine.getDecisionExplanation();

    const payload = {
      ...summary,
      decision,
      timestamp: Date.now()
    };

    // Emit to dashboard namespace
    this.io.emit(EVENTS.STATE_UPDATE, payload);
  }

  /**
   * Start periodic health check for stale signals
   */
  startHealthCheck() {
    const { SIGNAL_TIMEOUT } = require('../config/constants').TIMING;

    setInterval(() => {
      const staleSignals = signalState.checkStaleSignals(SIGNAL_TIMEOUT);

      if (staleSignals.length > 0) {
        console.warn(`[Health Check] Stale signals detected:`, staleSignals);
        
        // If in automatic mode, re-evaluate strategy
        if (signalState.getSystemMode() === 'AUTOMATIC') {
          this.evaluateAndUpdateStrategy();
        }

        this.broadcastSystemUpdate();
      }
    }, 2000); // Check every 2 seconds
  }

  /**
   * Get connected signal count
   */
  getConnectedSignalCount() {
    return this.signalSockets.size;
  }
}

module.exports = SignalSocketHandler;
