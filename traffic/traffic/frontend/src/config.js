// ─── Backend URL ──────────────────────────────────────────────────────────
// All requests go through the CRA dev-server proxy (setupProxy.js) which
// forwards /api, /socket.io, /health, /media → http://localhost:3001
// Using window.location.origin keeps everything on port 5000 so the proxy works.
export const API_BASE_URL = '';                        // relative — proxy handles it
export const SOCKET_URL   = '';                        // relative — proxy handles /socket.io → localhost:3001

// Density levels
export const DENSITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH'
};

// Density colors for UI
export const DENSITY_COLORS = {
  LOW: '#4caf50',
  MEDIUM: '#ff9800',
  HIGH: '#f44336'
};

// System modes
export const SYSTEM_MODE = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL'
};

// Strategies
export const STRATEGY = {
  ADAPTIVE: 'ADAPTIVE',
  GREEN_WAVE: 'GREEN_WAVE'
};

// Signal states
export const SIGNAL_STATE = {
  RED: 'RED',
  YELLOW: 'YELLOW',
  GREEN: 'GREEN'
};

// Connection status
export const CONNECTION_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE'
};
