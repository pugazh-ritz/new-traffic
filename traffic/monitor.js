/**
 * Traffic Monitor — live single-terminal view of all junctions.
 *
 * Connects to the backend and reprints a live table every time any
 * signal sends an update.  One terminal shows all junctions at once.
 *
 * Usage:
 *   node monitor.js
 *   ADMIN_URL=http://localhost:3001 node monitor.js
 */

const io = require('socket.io-client');

const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:3001';
const CLEAR     = '\x1b[2J\x1b[H';

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
};

let updateCount = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function strip(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

function rpad(s, len) {
  const v = strip(s);
  return s + ' '.repeat(Math.max(0, len - v.length));
}

function lpad(s, len) {
  const v = strip(s);
  return ' '.repeat(Math.max(0, len - v.length)) + s;
}

function stateIcon(state) {
  if (state === 'GREEN')  return '🟢';
  if (state === 'YELLOW') return '🟡';
  return '🔴';
}

function stateColor(state) {
  if (state === 'GREEN')  return C.green;
  if (state === 'YELLOW') return C.yellow;
  return C.red;
}

function densityColor(d) {
  if (d === 'HIGH')   return C.red;
  if (d === 'MEDIUM') return C.yellow;
  return C.green;
}

// Build one table row string (with box border)
function row(content, W) {
  const visible = strip(content);
  const pad = Math.max(0, W - 2 - visible.length);
  return '║ ' + content + ' '.repeat(pad) + '║';
}

function divider(W, l = '╟', r = '╢', fill = '─') {
  return l + fill.repeat(W - 2) + r;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

function render(payload) {
  const W   = 80;
  const now = new Date().toLocaleTimeString();

  const signals  = (payload.signals || []).sort((a, b) => a.signalId.localeCompare(b.signalId));
  const strategy = payload.currentStrategy || 'ADAPTIVE';
  const mode     = payload.systemMode      || 'AUTOMATIC';
  const online   = payload.onlineSignals   || 0;
  const total    = payload.totalSignals    || 0;

  const lines = [];

  // ── Header ──
  lines.push('╔' + '═'.repeat(W - 2) + '╗');
  lines.push(row(
    `${C.bold}  Smart Traffic Monitor${C.reset}` +
    `${C.dim}   ${now}   Updates: ${updateCount}${C.reset}`,
    W
  ));
  lines.push(row(
    `  Mode: ${C.bold}${mode}${C.reset}  ` +
    `Strategy: ${C.bold}${strategy}${C.reset}  ` +
    `Signals online: ${online === total && total > 0 ? C.green : C.yellow}${online}/${total}${C.reset}`,
    W
  ));

  if (signals.length === 0) {
    lines.push(divider(W));
    lines.push(row(`${C.dim}   Waiting for signal nodes to connect...${C.reset}`, W));
    lines.push('╚' + '═'.repeat(W - 2) + '╝');
    return lines.join('\n');
  }

  // ── Column headers ──
  lines.push(divider(W, '╠', '╣', '═'));
  lines.push(row(
    `${C.bold}${C.dim}  JN  STATE     VEHICLES  QUEUE              DENSITY   SPEED ${C.reset}`,
    W
  ));
  lines.push(divider(W));

  // ── One row per signal ──
  for (const sig of signals) {
    const isOnline = (sig.status || '').toUpperCase() === 'ONLINE';
    const statusDot = isOnline ? `${C.green}●${C.reset}` : `${C.red}○${C.reset}`;
    const sc = stateColor(sig.currentState);
    const icon = stateIcon(sig.currentState);
    const state = rpad(`${icon} ${sc}${C.bold}${sig.currentState || 'RED'}${C.reset}`, 18);

    const vehicles = lpad(`${C.bold}${sig.vehicleCount || 0}${C.reset}`, 6);

    const q = sig.currentState === 'GREEN'
      ? `${C.green}CLEAR${C.reset}            `
      : `${C.red}${lpad(String(sig.cumulativeRedCount || 0), 3)} (red)${C.reset}         `;
    const queueStr = rpad(q, 22);

    const dc = densityColor(sig.density);
    const density = rpad(`${dc}${C.bold}${sig.density || 'N/A'}${C.reset}`, 16);

    const speed = sig.avgSpeed ? `${C.cyan}${sig.avgSpeed} km/h${C.reset}` : `${C.dim}N/A${C.reset}`;

    lines.push(row(
      `  ${statusDot} ${C.bold}${C.magenta}${sig.signalId}${C.reset}   ${state}  ${vehicles}    ${queueStr}  ${density}  ${speed}`,
      W
    ));
  }

  lines.push('╚' + '═'.repeat(W - 2) + '╝');

  // ── Decision reason ──
  if (payload.decision && payload.decision.reason) {
    lines.push(`\n  ${C.dim}⚡ ${payload.decision.reason}${C.reset}`);
  }

  lines.push(`\n  ${C.dim}Press Ctrl+C to quit${C.reset}`);

  return lines.join('\n');
}

// ─── Socket ───────────────────────────────────────────────────────────────────

process.stdout.write(CLEAR);
console.log(`Traffic Monitor — connecting to ${ADMIN_URL}...\n`);

const socket = io(ADMIN_URL, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  process.stdout.write(CLEAR);
  console.log(`${C.green}✓ Connected${C.reset} — waiting for signal data...\n`);
});

socket.on('state:update', (payload) => {
  updateCount++;
  process.stdout.write(CLEAR);
  console.log(render(payload));
});

socket.on('disconnect', () => {
  console.log(`\n${C.red}✗ Disconnected — will reconnect automatically${C.reset}`);
});

socket.on('connect_error', () => {
  process.stdout.write(CLEAR);
  console.log(`${C.red}✗ Cannot connect to ${ADMIN_URL}${C.reset}`);
  console.log(`  Ensure the backend is running:  cd backend && node src/index.js\n`);
});

process.on('SIGINT', () => {
  console.log(`\n${C.dim}Monitor stopped.${C.reset}`);
  socket.disconnect();
  process.exit(0);
});
