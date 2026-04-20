/**
 * Signal C Simulator — Junction C
 * Simulates a real traffic signal node with proper light cycling.
 *
 * ADAPTIVE mode : cycles RED → GREEN (density-based time) → YELLOW → repeat
 * GREEN_WAVE mode: waits for 2× offset from A, then turns GREEN to receive platoon
 */

const io = require('socket.io-client');

const ADMIN_URL = 'http://localhost:3001';
const SIGNAL_ID = 'C';

// Traffic state
let vehicleCount = 0;
let density = 'LOW';
let avgSpeed = 40;
let cumulativeRedCount = 0; // accumulates during RED, resets on GREEN

// Light state machine
let currentState = 'RED';
let currentMode = 'ADAPTIVE';
let adaptiveGreenTime = 30;
let cycleTimer = null;
let greenWaveTimer = null;

const YELLOW_TIME = 5;
const RED_TIME    = 15;

const DENSITY_THRESHOLDS = { LOW_TO_MEDIUM: 15, MEDIUM_TO_HIGH: 30 };

console.log('╔════════════════════════════════════════════════════╗');
console.log('║         Traffic Signal C — Node Simulator          ║');
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

socket.on('mode:update', (data) => {
  console.log(`\n[Mode] Signal C received strategy: ${data.mode}`);
  currentMode = data.mode;

  if (data.mode === 'ADAPTIVE') {
    if (greenWaveTimer) { clearTimeout(greenWaveTimer); greenWaveTimer = null; }
    adaptiveGreenTime = computeGreenTime(density);
    console.log(`  Adaptive green time for current density (${density}): ${adaptiveGreenTime}s`);
    restartCycle();
  }

  if (data.mode === 'GREEN_WAVE') {
    // Junction C is 2nd downstream (road: A → B → C) — waits 2× the base offset
    const baseEta = data?.coordination?.etaToJunctionBSeconds ?? data.offsetSeconds ?? 180;
    const etaSeconds = baseEta * 2;
    console.log(`  Green Wave: Signal C will turn GREEN in ${etaSeconds}s (2× offset from A, after B)`);

    clearCycleTimer();
    if (greenWaveTimer) clearTimeout(greenWaveTimer);

    currentState = 'RED';

    greenWaveTimer = setTimeout(() => {
      console.log(`\n  [Green Wave] Signal C turning GREEN — platoon arriving from B`);
      transitionTo('GREEN');
      setTimeout(() => {
        transitionTo('YELLOW');
        setTimeout(() => {
          currentMode = 'ADAPTIVE';
          transitionTo('RED');
          restartCycle();
        }, YELLOW_TIME * 1000);
      }, adaptiveGreenTime * 1000);
    }, etaSeconds * 1000);
  }
});

socket.on('manual:override', (data) => {
  if (data.signalId === SIGNAL_ID || !data.signalId) {
    clearCycleTimer();
    if (greenWaveTimer) { clearTimeout(greenWaveTimer); greenWaveTimer = null; }

    if (data.state) {
      console.log(`\n[Override] C → ${data.state}`);
      transitionTo(data.state);
    } else if (data.greenTime !== undefined) {
      const gt = data.greenTime;
      const yt = data.yellowTime || YELLOW_TIME;
      const rt = data.redTime;
      console.log(`\n[Override] C timing → GREEN:${gt}s  YELLOW:${yt}s  RED:${rt}s`);
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

function startLightCycle() {
  runNextPhase();
}

function runNextPhase() {
  if (currentState === 'RED') {
    cycleTimer = setTimeout(() => {
      adaptiveGreenTime = computeGreenTime(density);
      transitionTo('GREEN');
      console.log(`  [Cycle C] GREEN for ${adaptiveGreenTime}s (density: ${density})`);
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

function startTrafficSimulation() {
  sendUpdate();
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
    `[${new Date().toLocaleTimeString()}] C | ${stateIcon} ${currentState.padEnd(6)} | ` +
    `Vehicles:${String(vehicleCount).padStart(3)} | ${queueLabel.padEnd(18)} | ` +
    `Density:${density.padEnd(6)} | Speed:${avgSpeed}km/h`
  );
}

function buildGreenReason() {
  if (currentState !== 'GREEN') return null;
  if (currentMode === 'GREEN_WAVE') return `Green Wave — platoon arrived from Junction B`;
  return `Adaptive — ${density} density → ${adaptiveGreenTime}s green time`;
}

function simulateTraffic() {
  const hour = new Date().getHours();
  let base = 9;
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) base = 32;
  else if (hour >= 22 || hour <= 5) base = 3;
  vehicleCount = Math.max(0, base + Math.floor(Math.random() * 15) - 5);
  avgSpeed = Math.round(33 + Math.random() * 18);
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
  console.log('\nShutting down Signal C...');
  clearCycleTimer();
  if (greenWaveTimer) clearTimeout(greenWaveTimer);
  socket.disconnect();
  process.exit(0);
});
