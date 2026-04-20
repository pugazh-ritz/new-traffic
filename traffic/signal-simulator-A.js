/**
 * Signal A Simulator — Junction A
 * Simulates a real traffic signal node with proper light cycling.
 *
 * ADAPTIVE mode : cycles RED → GREEN (density-based time) → YELLOW → repeat
 * GREEN_WAVE mode: turns GREEN immediately, then resumes adaptive cycle
 */

const io = require('socket.io-client');

const ADMIN_URL = 'http://localhost:3001';
const SIGNAL_ID = 'A';

// Traffic state
let vehicleCount = 0;
let density = 'LOW';
let avgSpeed = 38;
let cumulativeRedCount = 0; // accumulates during RED, resets on GREEN

// Light state machine
let currentState = 'RED';
let currentMode = 'ADAPTIVE';
let adaptiveGreenTime = 30; // seconds — updated from server
let cycleTimer = null;

const YELLOW_TIME = 5;   // seconds
const RED_TIME    = 15;  // seconds between cycles

const DENSITY_THRESHOLDS = { LOW_TO_MEDIUM: 15, MEDIUM_TO_HIGH: 30 };

console.log('╔════════════════════════════════════════════════════╗');
console.log('║         Traffic Signal A — Node Simulator          ║');
console.log('╚════════════════════════════════════════════════════╝\n');

const socket = io(ADMIN_URL, { transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log(`✓ Connected to admin server: ${ADMIN_URL} (${socket.id})\n`);
  socket.emit('signal:connect', { signalId: SIGNAL_ID, timestamp: Date.now() });
});

socket.on('connected', () => {
  console.log(`✓ Registered as Signal ${SIGNAL_ID}\n`);
  startTrafficSimulation();
  startLightCycle();
});

// ─── Receive strategy from admin server ────────────────────────────────────
socket.on('mode:update', (data) => {
  console.log(`\n[Mode] Signal A received strategy: ${data.mode}`);
  currentMode = data.mode;

  if (data.mode === 'ADAPTIVE') {
    // Recalculate green time from density
    adaptiveGreenTime = computeGreenTime(density);
    console.log(`  Adaptive green time for current density (${density}): ${adaptiveGreenTime}s`);
    restartCycle();
  }

  if (data.mode === 'GREEN_WAVE') {
    // Junction A leads the wave — go GREEN immediately
    console.log(`  Green Wave: Junction A turns GREEN now to release platoon`);
    clearCycleTimer();
    transitionTo('GREEN');
    // After green wave green time, resume normal cycle
    setTimeout(() => {
      currentMode = 'ADAPTIVE';
      restartCycle();
    }, (adaptiveGreenTime + YELLOW_TIME) * 1000);
  }
});

socket.on('manual:override', (data) => {
  if (data.signalId === SIGNAL_ID || !data.signalId) {
    clearCycleTimer();

    if (data.state) {
      // Direct state flip (Green Wave trigger / demo)
      console.log(`\n[Override] A → ${data.state}`);
      transitionTo(data.state);
    } else if (data.greenTime !== undefined) {
      // Timing override from dashboard sliders
      const gt = data.greenTime;
      const yt = data.yellowTime || YELLOW_TIME;
      const rt = data.redTime;
      console.log(`\n[Override] A timing → GREEN:${gt}s  YELLOW:${yt}s  RED:${rt}s`);
      transitionTo('GREEN');
      cycleTimer = setTimeout(() => {
        transitionTo('YELLOW');
        cycleTimer = setTimeout(() => {
          transitionTo('RED');
          restartCycle();
        }, yt * 1000);
      }, gt * 1000);
    }
  }
});

socket.on('disconnect', () => console.log('\n✗ Disconnected from admin server'));

// ─── Light cycle engine ─────────────────────────────────────────────────────
function startLightCycle() {
  runNextPhase();
}

function runNextPhase() {
  if (currentState === 'RED') {
    // RED → wait RED_TIME → go GREEN
    cycleTimer = setTimeout(() => {
      adaptiveGreenTime = computeGreenTime(density);
      transitionTo('GREEN');
      console.log(`  [Cycle A] GREEN for ${adaptiveGreenTime}s (density: ${density})`);
      cycleTimer = setTimeout(() => {
        transitionTo('YELLOW');
        cycleTimer = setTimeout(() => {
          transitionTo('RED');
          runNextPhase();
        }, YELLOW_TIME * 1000);
      }, adaptiveGreenTime * 1000);
    }, RED_TIME * 1000);
  }
}

function transitionTo(state) {
  currentState = state;
}

function clearCycleTimer() {
  if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; }
}

function restartCycle() {
  clearCycleTimer();
  currentState = 'RED';
  runNextPhase();
}

// ─── Traffic simulation ─────────────────────────────────────────────────────
function startTrafficSimulation() {
  sendUpdate(); // immediate first update
  setInterval(() => {
    simulateTraffic();
    density = calculateDensity(vehicleCount);
    sendUpdate();
  }, 3000);
}

function sendUpdate() {
  // Update cumulative RED queue count
  if (currentState === 'GREEN') {
    cumulativeRedCount = 0;
  } else {
    cumulativeRedCount = Math.max(cumulativeRedCount, vehicleCount);
  }

  const greenReason = buildGreenReason();
  const update = {
    signalId: SIGNAL_ID,
    vehicleCount,
    density,
    avgSpeed,
    currentState,
    greenReason,
    timestamp: Date.now()
  };
  socket.emit('signal:update', update);

  const stateIcon  = currentState === 'GREEN' ? '🟢' : currentState === 'YELLOW' ? '🟡' : '🔴';
  const queueLabel = currentState === 'GREEN'
    ? `Queue:CLEAR`
    : `Queue:${String(cumulativeRedCount).padStart(3)} (red)`;
  console.log(
    `[${new Date().toLocaleTimeString()}] A | ${stateIcon} ${currentState.padEnd(6)} | ` +
    `Vehicles:${String(vehicleCount).padStart(3)} | ${queueLabel.padEnd(18)} | ` +
    `Density:${density.padEnd(6)} | Speed:${avgSpeed}km/h`
  );
}

function buildGreenReason() {
  if (currentState !== 'GREEN') return null;
  if (currentMode === 'GREEN_WAVE') return `Green Wave — Junction A releases platoon`;
  return `Adaptive — ${density} density → ${adaptiveGreenTime}s green time`;
}

function simulateTraffic() {
  const hour = new Date().getHours();
  let base = 10;
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) base = 35;
  else if (hour >= 22 || hour <= 5) base = 4;
  vehicleCount = Math.max(0, base + Math.floor(Math.random() * 15) - 5);
  avgSpeed = Math.round(30 + Math.random() * 20);
}

function calculateDensity(count) {
  if (count < DENSITY_THRESHOLDS.LOW_TO_MEDIUM) return 'LOW';
  if (count < DENSITY_THRESHOLDS.MEDIUM_TO_HIGH) return 'MEDIUM';
  return 'HIGH';
}

function computeGreenTime(d) {
  const map = { LOW: 30, MEDIUM: 60, HIGH: 90 };
  return map[d] || 30;
}

process.on('SIGINT', () => {
  console.log('\nShutting down Signal A...');
  clearCycleTimer();
  socket.disconnect();
  process.exit(0);
});
