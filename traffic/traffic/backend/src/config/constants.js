/**
 * System-wide constants and configuration
 */

module.exports = {
  // System Modes
  SYSTEM_MODE: {
    AUTOMATIC: 'AUTOMATIC',
    MANUAL: 'MANUAL'
  },

  // Traffic Control Strategies
  STRATEGY: {
    ADAPTIVE: 'ADAPTIVE',
    GREEN_WAVE: 'GREEN_WAVE'
  },

  // Density Levels (from signal nodes)
  DENSITY: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
  },

  // Signal States
  SIGNAL_STATE: {
    RED: 'RED',
    YELLOW: 'YELLOW',
    GREEN: 'GREEN'
  },

  // Connection Status
  CONNECTION_STATUS: {
    ONLINE: 'ONLINE',
    OFFLINE: 'OFFLINE'
  },

  // Timing Configuration
  TIMING: {
    MIN_GREEN: parseInt(process.env.MIN_GREEN_TIME_SEC) || 30,
    MAX_GREEN: parseInt(process.env.MAX_GREEN_TIME_SEC) || 90,
    YELLOW: parseInt(process.env.YELLOW_TIME_SEC) || 5,
    SIGNAL_TIMEOUT: parseInt(process.env.SIGNAL_TIMEOUT_MS) || 5000
  },

  // Green Wave Configuration
  GREEN_WAVE: {
    DISTANCE_KM: parseFloat(process.env.DISTANCE_BETWEEN_SIGNALS_KM) || 2,
    DEFAULT_SPEED_KMPH: parseFloat(process.env.DEFAULT_AVG_SPEED_KMPH) || 40,
    MIN_SPEED: parseFloat(process.env.MIN_GREEN_WAVE_SPEED) || 32,
    MAX_SPEED: parseFloat(process.env.MAX_GREEN_WAVE_SPEED) || 48
  },

  // Socket Events
  EVENTS: {
    // Inbound (from signal nodes)
    SIGNAL_CONNECT: 'signal:connect',
    SIGNAL_UPDATE: 'signal:update',
    SIGNAL_DISCONNECT: 'signal:disconnect',
    
    // Outbound (to signal nodes)
    MODE_UPDATE: 'mode:update',
    MANUAL_OVERRIDE: 'manual:override',
    STRATEGY_CHANGE: 'strategy:change',
    
    // Dashboard (frontend)
    DASHBOARD_CONNECT: 'dashboard:connect',
    STATE_UPDATE: 'state:update',
    SYSTEM_STATUS: 'system:status'
  }
};
