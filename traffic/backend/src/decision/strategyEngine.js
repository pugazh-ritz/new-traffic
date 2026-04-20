/**
 * Traffic Control Strategy Decision Engine
 * Core logic for selecting ADAPTIVE vs GREEN WAVE mode
 */

const { STRATEGY, DENSITY, SYSTEM_MODE } = require('../config/constants');
const signalState = require('../state/signalState');

class StrategyEngine {
  constructor() {
    this.lastDecision = null;
    this.decisionHistory = [];
  }

  /**
   * Main decision function
   * Analyzes all signals and decides the optimal strategy
   *
   * @returns {Object} Decision with strategy, reason, and metadata
   */
  decideStrategy() {
    // Rule 0: Forced strategy from admin panel overrides all logic
    const forced = signalState.getForcedStrategy?.();
    if (forced) {
      return {
        strategy: forced,
        reason: 'Forced strategy override from admin',
        manual: true
      };
    }

    // Rule 1: Manual mode overrides everything
    if (signalState.getSystemMode() === SYSTEM_MODE.MANUAL) {
      return {
        strategy: null,
        reason: 'System in MANUAL mode',
        manual: true
      };
    }

    const onlineSignals = signalState.getOnlineSignals();

    // Rule 2: No signals online - fail-safe
    if (onlineSignals.length === 0) {
      return {
        strategy: STRATEGY.ADAPTIVE,
        reason: 'No signals online - fail-safe mode',
        failSafe: true
      };
    }

    // Rule 3: All online signals HIGH -> GREEN WAVE
    const allHighDensity = onlineSignals.every(
      signal => signal.density === DENSITY.HIGH
    );

    if (allHighDensity) {
      const feasibility = this.evaluateGreenWaveFeasibility();

      if (!feasibility.feasible) {
        const fallbackDecision = {
          strategy: STRATEGY.ADAPTIVE,
          reason: `HIGH density detected but green wave not feasible - ${feasibility.reason}`,
          fallback: true
        };

        this._recordDecision(fallbackDecision);
        return fallbackDecision;
      }

      const decision = {
        strategy: STRATEGY.GREEN_WAVE,
        reason: 'HIGH density across all signals - coordinating corridor flow',
        densityTrigger: true,
        affectedSignals: onlineSignals.map(s => s.signalId)
      };

      this._recordDecision(decision);
      return decision;
    }

    // Rule 4: All signals LOW density -> ADAPTIVE
    const allLowDensity = onlineSignals.every(
      signal => signal.density === DENSITY.LOW
    );

    if (allLowDensity) {
      const decision = {
        strategy: STRATEGY.ADAPTIVE,
        reason: 'LOW density on all signals - adaptive local control is sufficient',
        lowDensityTrigger: true,
        signalCount: onlineSignals.length
      };

      this._recordDecision(decision);
      return decision;
    }

    // Rule 5: Mixed density (some MEDIUM) -> ADAPTIVE (safer default)
    const decision = {
      strategy: STRATEGY.ADAPTIVE,
      reason: 'Mixed density levels - using adaptive signaling',
      defaultChoice: true
    };

    this._recordDecision(decision);
    return decision;
  }

  /**
   * Compute the exact adaptive green time for a given density level.
   * LOW  → density_factor 0.0 → minGreen
   * MEDIUM → density_factor 0.5 → midpoint
   * HIGH → density_factor 1.0 → maxGreen
   *
   * @param {string} density - 'LOW' | 'MEDIUM' | 'HIGH'
   * @returns {number} Green time in seconds
   */
  computeAdaptiveGreenTime(density) {
    const { MIN_GREEN, MAX_GREEN } = require('../config/constants').TIMING;
    const factors = { LOW: 0.0, MEDIUM: 0.5, HIGH: 1.0 };
    const factor = factors[density] !== undefined ? factors[density] : 0.5;
    return Math.round(MIN_GREEN + factor * (MAX_GREEN - MIN_GREEN));
  }

  /**
   * Calculate adaptive mode parameters
   * Admin sends constraints, signals compute exact timing locally
   *
   * @returns {Object} Adaptive mode configuration
   */
  getAdaptiveConfig() {
    const { MIN_GREEN, MAX_GREEN, YELLOW } = require('../config/constants').TIMING;

    return {
      mode: STRATEGY.ADAPTIVE,
      minGreen: MIN_GREEN,
      maxGreen: MAX_GREEN,
      yellowTime: YELLOW,
      instruction: 'Calculate green time based on local density',
      formula: 'greenTime = minGreen + (density_factor * (maxGreen - minGreen))'
    };
  }

  /**
   * Calculate green wave synchronization parameters
   *
   * @param {string} baseSignalId - Signal to use as reference (e.g., "A")
   * @param {number} avgSpeedKmph - Average road speed
   * @returns {Object} Green wave configuration
   */
  getGreenWaveConfig(baseSignalId = 'A', avgSpeedKmph = null) {
    const config = require('../config/constants').GREEN_WAVE;

    // Use provided speed or default
    const speed = avgSpeedKmph || config.DEFAULT_SPEED_KMPH;

    // Calculate travel time between signals
    // time (seconds) = distance (km) / speed (km/h) * 3600
    const travelTimeSec = (config.DISTANCE_KM / speed) * 3600;
    const offsetSeconds = Math.round(travelTimeSec);

    // Calculate recommended speed band
    const speedBand = {
      min: config.MIN_SPEED,
      max: config.MAX_SPEED,
      optimal: speed
    };

    return {
      mode: STRATEGY.GREEN_WAVE,
      baseSignal: baseSignalId,
      offsetSeconds,
      distance: config.DISTANCE_KM,
      speedBand,
      coordination: {
        description: `Signal B should turn GREEN about ${offsetSeconds}s after Signal ${baseSignalId} releases traffic`,
        etaToJunctionBSeconds: offsetSeconds,
        trigger: `When vehicles depart Signal ${baseSignalId} on GREEN`
      },
      instruction: `Signal ${baseSignalId} starts green wave, others follow with calculated offset`,
      driverMessage: `Maintain ${speedBand.min}-${speedBand.max} km/h for uninterrupted flow`
    };
  }

  /**
   * Evaluate if green wave is currently feasible
   * Additional checks beyond just density
   *
   * @returns {Object} Feasibility result
   */
  evaluateGreenWaveFeasibility() {
    const onlineSignals = signalState.getOnlineSignals();

    // Need at least 2 signals for coordination
    if (onlineSignals.length < 2) {
      return {
        feasible: false,
        reason: 'Need at least 2 signals for green wave coordination'
      };
    }

    // GREEN_WAVE requires all participating signals to be in HIGH density
    const allHighDensity = onlineSignals.every(
      signal => signal.density === DENSITY.HIGH
    );

    if (!allHighDensity) {
      return {
        feasible: false,
        reason: 'Not all signals are HIGH density'
      };
    }

    // Check average speeds are available and reasonable
    const signalsWithSpeed = onlineSignals.filter(s => s.avgSpeed && s.avgSpeed > 0);

    if (signalsWithSpeed.length > 0) {
      const avgSpeed = signalsWithSpeed.reduce((sum, s) => sum + s.avgSpeed, 0)
        / signalsWithSpeed.length;

      return {
        feasible: true,
        reason: 'Conditions support high-density green wave coordination',
        recommendedSpeed: Math.round(avgSpeed)
      };
    }

    // No speed data, use default
    return {
      feasible: true,
      reason: 'Using default speed for high-density green wave coordination',
      recommendedSpeed: require('../config/constants').GREEN_WAVE.DEFAULT_SPEED_KMPH
    };
  }

  /**
   * Get decision explanation for dashboard
   *
   * @returns {Object} Human-readable decision summary
   */
  getDecisionExplanation() {
    const decision = this.lastDecision;

    if (!decision) {
      return {
        status: 'No decision made yet',
        action: 'Waiting for signal data'
      };
    }

    return {
      currentStrategy: decision.strategy,
      reason: decision.reason,
      timestamp: decision.timestamp,
      confidence: this._calculateConfidence(decision),
      nextReview: 'Continuous (updates every 2 seconds)'
    };
  }

  /**
   * Record decision for history and analysis
   * @private
   */
  _recordDecision(decision) {
    decision.timestamp = Date.now();
    this.lastDecision = decision;

    this.decisionHistory.push(decision);

    // Keep only last 100 decisions
    if (this.decisionHistory.length > 100) {
      this.decisionHistory.shift();
    }

    // Update global state
    signalState.setCurrentStrategy(decision.strategy);
  }

  /**
   * Calculate confidence score for decision
   * @private
   */
  _calculateConfidence(decision) {
    // Simple heuristic - can be made more sophisticated
    if (decision.failSafe) return 'low';
    if (decision.densityTrigger) return 'high';
    if (decision.greenWaveFeasible) return 'high';
    return 'medium';
  }

  /**
   * Get decision statistics
   */
  getStatistics() {
    const total = this.decisionHistory.length;
    if (total === 0) return null;

    const adaptive = this.decisionHistory.filter(d => d.strategy === STRATEGY.ADAPTIVE).length;
    const greenWave = this.decisionHistory.filter(d => d.strategy === STRATEGY.GREEN_WAVE).length;

    return {
      totalDecisions: total,
      adaptiveCount: adaptive,
      greenWaveCount: greenWave,
      adaptivePercentage: ((adaptive / total) * 100).toFixed(1),
      greenWavePercentage: ((greenWave / total) * 100).toFixed(1)
    };
  }
}

// Singleton instance
const strategyEngine = new StrategyEngine();

module.exports = strategyEngine;
