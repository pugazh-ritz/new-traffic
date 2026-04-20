/**
 * REST API Routes
 * HTTP endpoints for dashboard and manual controls
 */

const express = require('express');
const router = express.Router();
const signalState = require('../state/signalState');
const strategyEngine = require('../decision/strategyEngine');

/**
 * GET /api/status
 * Get current system status and all signal states
 */
router.get('/status', (req, res) => {
  const summary = signalState.getSystemSummary();
  const decision = strategyEngine.getDecisionExplanation();
  const stats = strategyEngine.getStatistics();

  res.json({
    success: true,
    data: {
      ...summary,
      decision,
      statistics: stats,
      timestamp: Date.now()
    }
  });
});

/**
 * GET /api/signals
 * Get all signal states
 */
router.get('/signals', (req, res) => {
  const signals = signalState.getAllSignals();
  
  res.json({
    success: true,
    data: signals
  });
});

/**
 * GET /api/signals/:signalId
 * Get specific signal state
 */
router.get('/signals/:signalId', (req, res) => {
  const { signalId } = req.params;
  const signal = signalState.getSignal(signalId);

  if (!signal) {
    return res.status(404).json({
      success: false,
      error: `Signal ${signalId} not found`
    });
  }

  res.json({
    success: true,
    data: signal
  });
});

/**
 * GET /api/signals/:signalId/history
 * Get historical data for a signal
 */
router.get('/signals/:signalId/history', (req, res) => {
  const { signalId } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  const history = signalState.getHistory(signalId, limit);

  res.json({
    success: true,
    data: {
      signalId,
      history
    }
  });
});

/**
 * POST /api/mode/manual
 * Switch to manual mode
 */
router.post('/mode/manual', (req, res) => {
  signalState.setSystemMode('MANUAL');
  signalState.setForcedStrategy(null);

  console.log('[API] System switched to MANUAL mode');

  // Notify via socket
  req.app.get('socketHandler').broadcastSystemUpdate();

  res.json({
    success: true,
    message: 'System switched to MANUAL mode',
    mode: 'MANUAL'
  });
});

/**
 * POST /api/mode/automatic
 * Switch to automatic mode
 */
router.post('/mode/automatic', (req, res) => {
  signalState.setSystemMode('AUTOMATIC');
  signalState.setForcedStrategy(null);

  console.log('[API] System switched to AUTOMATIC mode');

  // Trigger strategy evaluation
  const socketHandler = req.app.get('socketHandler');
  socketHandler.evaluateAndUpdateStrategy();

  res.json({
    success: true,
    message: 'System switched to AUTOMATIC mode',
    mode: 'AUTOMATIC'
  });
});

/**
 * POST /api/manual/override
 * Send manual override to specific signal
 * 
 * Body:
 * {
 *   "signalId": "A",
 *   "greenTime": 60,
 *   "redTime": 30
 * }
 */
router.post('/manual/override', (req, res) => {
  const { signalId, greenTime, redTime, yellowTime } = req.body;

  if (!signalId || !greenTime || !redTime) {
    return res.status(400).json({
      success: false,
      error: 'signalId, greenTime, and redTime are required'
    });
  }

  // Validate timing values
  if (greenTime < 10 || greenTime > 120) {
    return res.status(400).json({
      success: false,
      error: 'greenTime must be between 10 and 120 seconds'
    });
  }

  const config = {
    mode: 'MANUAL',
    greenTime,
    redTime,
    yellowTime: yellowTime || 5
  };

  const socketHandler = req.app.get('socketHandler');
  const success = socketHandler.sendManualOverride(signalId, config);

  if (!success) {
    return res.status(404).json({
      success: false,
      error: `Signal ${signalId} not connected`
    });
  }

  res.json({
    success: true,
    message: `Manual override sent to signal ${signalId}`,
    config
  });
});

/**
 * POST /api/strategy/force
 * Force a specific strategy (for testing)
 * 
 * Body:
 * {
 *   "strategy": "ADAPTIVE" | "GREEN_WAVE"
 * }
 */
router.post('/strategy/force', (req, res) => {
  const { strategy } = req.body;

  if (!['ADAPTIVE', 'GREEN_WAVE'].includes(strategy)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid strategy. Use ADAPTIVE or GREEN_WAVE'
    });
  }

  // Temporarily override strategy
  const decision = {
    strategy,
    reason: 'Manually forced by admin',
    manual: true
  };

  // Persist forced strategy so dashboard + engine stay consistent
  signalState.setCurrentStrategy(strategy);
  signalState.setForcedStrategy(strategy);

  const socketHandler = req.app.get('socketHandler');
  socketHandler.sendStrategyUpdate(decision);

  res.json({
    success: true,
    message: `Strategy forced to ${strategy}`,
    strategy
  });
});

/**
 * GET /api/decision/explanation
 * Get detailed explanation of current decision
 */
router.get('/decision/explanation', (req, res) => {
  const explanation = strategyEngine.getDecisionExplanation();
  const feasibility = strategyEngine.evaluateGreenWaveFeasibility();

  res.json({
    success: true,
    data: {
      explanation,
      greenWaveFeasibility: feasibility
    }
  });
});

/**
 * GET /api/config/green-wave
 * Get current green wave configuration
 */
router.get('/config/green-wave', (req, res) => {
  const baseSignal = req.query.baseSignal || 'A';
  const speed = parseFloat(req.query.speed) || null;

  const config = strategyEngine.getGreenWaveConfig(baseSignal, speed);

  res.json({
    success: true,
    data: config
  });
});

/**
 * GET /api/config/adaptive
 * Get current adaptive mode configuration
 */
router.get('/config/adaptive', (req, res) => {
  const config = strategyEngine.getAdaptiveConfig();

  res.json({
    success: true,
    data: config
  });
});

/**
 * GET /api/statistics
 * Get system statistics
 */
router.get('/statistics', (req, res) => {
  const stats = strategyEngine.getStatistics();
  const summary = signalState.getSystemSummary();

  res.json({
    success: true,
    data: {
      decisions: stats,
      system: summary
    }
  });
});

/**
 * POST /api/green-wave/trigger-a-release
 * Force Junction A green release now and start Junction B ETA timer.
 */
router.post('/green-wave/trigger-a-release', (req, res) => {
  const socketHandler = req.app.get('socketHandler');
  const result = socketHandler.triggerGreenWaveReleaseFromA();

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error
    });
  }

  res.json({
    success: true,
    message: 'Triggered Junction A GREEN release',
    targets: result.targets
  });
});

module.exports = router;
