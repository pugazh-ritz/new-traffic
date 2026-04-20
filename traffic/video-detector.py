"""
Video-Based Traffic Signal Node
Reads from a video file (or webcam) to count vehicles using OpenCV.
Sends real-time vehicle counts to the SmartTraffic backend via Socket.IO.

Usage:
  VIDEO_SOURCE=traffic.mp4 SIGNAL_ID=A python3 video-detector.py
  VIDEO_SOURCE=0 SIGNAL_ID=B python3 video-detector.py     # webcam index 0
"""

import socketio
import time
import cv2
import numpy as np
import os
from pathlib import Path
import threading

# ─── Configuration ─────────────────────────────────────────────────────────
ADMIN_URL              = os.getenv('ADMIN_URL', 'http://localhost:3001')
SIGNAL_ID              = os.getenv('SIGNAL_ID', 'A')
VIDEO_SOURCE_RAW       = os.getenv('VIDEO_SOURCE', '0')
VIDEO_SOURCE           = int(VIDEO_SOURCE_RAW) if VIDEO_SOURCE_RAW.isdigit() else VIDEO_SOURCE_RAW
PARSED_FRAME_OUTPUT_DIR = os.getenv('PARSED_FRAME_OUTPUT_DIR', './parsed_frames')
LOW_TO_MEDIUM          = int(os.getenv('LOW_TO_MEDIUM_THRESHOLD', '5'))
MEDIUM_TO_HIGH         = int(os.getenv('MEDIUM_TO_HIGH_THRESHOLD', '12'))
FRAMES_PER_CYCLE       = int(os.getenv('FRAMES_PER_CYCLE', '6'))
UPDATE_INTERVAL        = float(os.getenv('UPDATE_INTERVAL_SEC', '3'))
# Light cycle timings (seconds)
RED_HOLD_SEC           = int(os.getenv('RED_HOLD_SEC', '20'))
GREEN_HOLD_SEC         = int(os.getenv('GREEN_HOLD_SEC', '15'))
YELLOW_HOLD_SEC        = int(os.getenv('YELLOW_HOLD_SEC', '5'))

# ─── State ─────────────────────────────────────────────────────────────────
current_state        = 'RED'
current_mode         = 'ADAPTIVE'
phase_start_ms       = int(time.time() * 1000)
cumulative_red_count = 0   # accumulates during RED/YELLOW, resets on GREEN

# Override timing from dashboard (None = use env-var defaults)
override_green_sec   = None
override_red_sec     = None
override_yellow_sec  = None

# Adaptive timing (from backend)
adaptive_min_green = 30
adaptive_max_green = 90
adaptive_yellow = YELLOW_HOLD_SEC
last_density = 'LOW'

# Green-wave timers (for B/C coordination)
green_wave_timer = None
green_wave_phase_timer = None

# Latest green-wave release parameters (from backend)
green_wave_release_at_ms = None
green_wave_offset_sec = None

sio = socketio.Client(reconnection=True, reconnection_attempts=0, reconnection_delay=2)


# ─── Vehicle Detector ───────────────────────────────────────────────────────
class VehicleDetector:
    def __init__(self, source):
        self.source      = source
        self.is_file     = isinstance(source, str)
        self.fail_count  = 0
        self.frame_index = 0
        self.warmup      = 10
        self.latest_frame = None

        self.cap = self._open()
        self.bg  = cv2.createBackgroundSubtractorMOG2(
            history=300, varThreshold=32, detectShadows=True
        )
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

        # Output directory for parsed frames
        out_dir = Path(PARSED_FRAME_OUTPUT_DIR)
        out_dir.mkdir(parents=True, exist_ok=True)
        self.frame_path = out_dir / f'{SIGNAL_ID}.jpg'

        print(f'[Detector] Video source: {source}')
        print(f'[Detector] Frame output: {self.frame_path}')

    def _open(self):
        if self.is_file:
            cap = cv2.VideoCapture(self.source, cv2.CAP_FFMPEG)
            if not cap.isOpened():
                cap = cv2.VideoCapture(self.source)
            if not cap.isOpened():
                raise RuntimeError(f'Cannot open video file: {self.source}')
        else:
            cap = cv2.VideoCapture(self.source)
            if not cap.isOpened():
                raise RuntimeError(f'Cannot open camera index: {self.source}')
        return cap

    def _read_frame(self):
        ret, frame = self.cap.read()
        if not ret:
            if self.is_file:
                # Loop the video
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = self.cap.read()
            if not ret:
                self.fail_count += 1
                if self.fail_count >= 5:
                    print(f'[Detector] Reopening source after repeated failures...')
                    try: self.cap.release()
                    except: pass
                    self.cap = self._open()
                    self.fail_count = 0
                return None
        self.fail_count = 0
        return frame

    def detect(self):
        """Return (peak_vehicle_count) from a burst of FRAMES_PER_CYCLE frames."""
        peak = 0
        best_frame = None

        for _ in range(max(1, FRAMES_PER_CYCLE)):
            frame = self._read_frame()
            if frame is None:
                continue

            self.frame_index += 1
            frame = cv2.resize(frame, (640, 480))

            # Background subtraction
            fg = self.bg.apply(frame)
            _, fg = cv2.threshold(fg, 250, 255, cv2.THRESH_BINARY)
            fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, self.kernel)
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN,  self.kernel)

            contours, _ = cv2.findContours(fg, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            count = 0
            display_frame = frame.copy()
            for c in contours:
                area = cv2.contourArea(c)
                if 200 < area < 100000:
                    count += 1
                    x, y, w, h = cv2.boundingRect(c)
                    cv2.rectangle(display_frame, (x, y), (x+w, y+h), (0, 255, 0), 2)

            if count > peak:
                peak = count
                best_frame = display_frame

        if best_frame is not None:
            self.latest_frame = best_frame

        # Skip warmup frames (background model still learning)
        return peak if self.frame_index > self.warmup else 0

    def save_frame(self, count, density, state):
        if self.latest_frame is None:
            return
        frame = self.latest_frame.copy()
        # Overlay info
        overlay = [
            (f'Signal {SIGNAL_ID}',    (10, 30),  (255, 255, 255)),
            (f'Vehicles: {count}',     (10, 65),  (0, 255, 0)),
            (f'Density:  {density}',   (10, 100), (0, 200, 255)),
            (f'State:    {state}',     (10, 135), (255 if state=="RED" else 100, 255 if state=="GREEN" else 100, 0)),
            (time.strftime('%H:%M:%S'),(10, 170), (200, 200, 200)),
        ]
        for text, pos, color in overlay:
            cv2.putText(frame, text, pos, cv2.FONT_HERSHEY_SIMPLEX, 0.85, color, 2)
        cv2.imwrite(str(self.frame_path), frame)

    def density(self, count):
        if count < LOW_TO_MEDIUM:  return 'LOW'
        if count < MEDIUM_TO_HIGH: return 'MEDIUM'
        return 'HIGH'

    def release(self):
        try: self.cap.release()
        except: pass


# ─── Light Cycle (local autonomous cycle) ───────────────────────────────────
def tick_light_cycle():
    """Advance the local RED→GREEN→YELLOW→RED cycle. Returns new state."""
    global current_state, phase_start_ms, current_mode
    global override_green_sec, override_red_sec, override_yellow_sec

    if current_mode != 'ADAPTIVE':
        return current_state  # server controls in other modes

    now_ms   = int(time.time() * 1000)
    elapsed  = (now_ms - phase_start_ms) / 1000.0

    # Adaptive green time based on last known density
    density_factor = 0.0 if last_density == 'LOW' else (0.5 if last_density == 'MEDIUM' else 1.0)
    adaptive_green = round(adaptive_min_green + density_factor * (adaptive_max_green - adaptive_min_green))

    green_sec  = override_green_sec  if override_green_sec  is not None else adaptive_green
    yellow_sec = override_yellow_sec if override_yellow_sec is not None else adaptive_yellow
    red_sec    = override_red_sec    if override_red_sec    is not None else RED_HOLD_SEC

    if current_state == 'RED' and elapsed >= red_sec:
        _transition('GREEN')
    elif current_state == 'GREEN' and elapsed >= green_sec:
        _transition('YELLOW')
    elif current_state == 'YELLOW' and elapsed >= yellow_sec:
        # After YELLOW→RED, clear override so next cycle uses normal timing
        override_green_sec = override_red_sec = override_yellow_sec = None
        _transition('RED')

    return current_state

def _transition(new_state):
    global current_state, phase_start_ms
    print(f'[Signal {SIGNAL_ID}] {current_state} → {new_state}')
    current_state  = new_state
    phase_start_ms = int(time.time() * 1000)

def _cancel_green_wave_timers():
    global green_wave_timer, green_wave_phase_timer
    if green_wave_timer:
        try: green_wave_timer.cancel()
        except: pass
        green_wave_timer = None
    if green_wave_phase_timer:
        try: green_wave_phase_timer.cancel()
        except: pass
        green_wave_phase_timer = None


# ─── Socket.IO events ───────────────────────────────────────────────────────
@sio.event
def connect():
    print(f'\n✓ Connected to admin server: {ADMIN_URL}')
    sio.emit('signal:connect', {'signalId': SIGNAL_ID})

@sio.on('connected')
def on_registered(data):
    print(f'✓ Registered as Signal {SIGNAL_ID}\n')

@sio.on('mode:update')
def on_mode(data):
    global current_mode, current_state, phase_start_ms
    global green_wave_timer, green_wave_phase_timer
    global adaptive_min_green, adaptive_max_green, adaptive_yellow
    current_mode = data.get('mode', 'ADAPTIVE')
    print(f'[Mode] {SIGNAL_ID} → {current_mode}')
    if current_mode == 'GREEN_WAVE':
        # Prevent stacking: ignore repeated GREEN_WAVE updates while timers are active
        if green_wave_timer or green_wave_phase_timer:
            return
        _cancel_green_wave_timers()
        if SIGNAL_ID == 'A':
            _transition('GREEN')
            return
        # B/C wait for explicit green-wave release event from backend
        current_state = 'RED'
        phase_start_ms = int(time.time() * 1000)
        return

    if current_mode == 'ADAPTIVE':
        _cancel_green_wave_timers()
        # Pull adaptive timing config if present
        adaptive_min_green = data.get('minGreen', adaptive_min_green)
        adaptive_max_green = data.get('maxGreen', adaptive_max_green)
        adaptive_yellow = data.get('yellowTime', adaptive_yellow)
        if current_state != 'RED':
            _transition('RED')

@sio.on('green_wave:release')
def on_green_wave_release(data):
    global green_wave_timer, green_wave_phase_timer
    global green_wave_release_at_ms, green_wave_offset_sec
    if SIGNAL_ID == 'A':
        return
    if current_mode != 'GREEN_WAVE':
        return

    _cancel_green_wave_timers()

    green_wave_release_at_ms = data.get('releaseAtMs')
    green_wave_offset_sec = data.get('offsetSeconds') or 180

    eta_seconds = green_wave_offset_sec if SIGNAL_ID == 'B' else green_wave_offset_sec * 2
    print(f'[Green Wave] {SIGNAL_ID} release received — GREEN in {eta_seconds}s')

    # Hold GREEN long enough for platoon to clear the junction.
    green_hold_sec = data.get('greenWaveHoldSec') or max(GREEN_HOLD_SEC, eta_seconds)

    def start_green():
        global green_wave_timer
        green_wave_timer = None
        _transition('GREEN')

        def to_yellow():
            global green_wave_phase_timer
            _transition('YELLOW')

            def to_red_resume():
                global current_mode, green_wave_phase_timer
                _transition('RED')
                current_mode = 'ADAPTIVE'
                green_wave_phase_timer = None

            green_wave_phase_timer = threading.Timer(YELLOW_HOLD_SEC, to_red_resume)
            green_wave_phase_timer.start()

        global green_wave_phase_timer
        green_wave_phase_timer = threading.Timer(green_hold_sec, to_yellow)
        green_wave_phase_timer.start()

    green_wave_timer = threading.Timer(eta_seconds, start_green)
    green_wave_timer.start()

@sio.on('manual:override')
def on_override(data):
    global current_state, phase_start_ms
    global override_green_sec, override_red_sec, override_yellow_sec
    _cancel_green_wave_timers()
    if data.get('signalId') == SIGNAL_ID or data.get('signalId') is None:
        if 'state' in data:
            # Direct state flip (Green Wave trigger / demo)
            new_s = data['state']
            print(f'[Override] {SIGNAL_ID} → {new_s}')
            current_state  = new_s
            phase_start_ms = int(time.time() * 1000)
        elif 'greenTime' in data:
            # Timing override from dashboard sliders
            override_green_sec  = data.get('greenTime', GREEN_HOLD_SEC)
            override_red_sec    = data.get('redTime',   RED_HOLD_SEC)
            override_yellow_sec = data.get('yellowTime', YELLOW_HOLD_SEC)
            print(f'[Override] {SIGNAL_ID} timing → GREEN:{override_green_sec}s  YELLOW:{override_yellow_sec}s  RED:{override_red_sec}s')
            # Immediately apply: go GREEN now with override timing
            current_state  = 'GREEN'
            phase_start_ms = int(time.time() * 1000)

@sio.event
def disconnect():
    print(f'\n✗ Disconnected from admin server')


# ─── Main loop ───────────────────────────────────────────────────────────────
def main():
    global cumulative_red_count, override_green_sec, override_red_sec, override_yellow_sec
    global last_density
    print('╔════════════════════════════════════════════════════╗')
    print(f'║   Video Traffic Detector — Signal {SIGNAL_ID}            ║')
    print('╚════════════════════════════════════════════════════╝\n')
    print(f'  Video source : {VIDEO_SOURCE}')
    print(f'  Admin URL    : {ADMIN_URL}')
    print(f'  Signal ID    : {SIGNAL_ID}\n')

    try:
        detector = VehicleDetector(VIDEO_SOURCE)
    except RuntimeError as e:
        print(f'\n✗ {e}')
        print('  Set VIDEO_SOURCE=/path/to/video.mp4 or VIDEO_SOURCE=0 for webcam')
        return

    try:
        print(f'Connecting to {ADMIN_URL}...')
        sio.connect(ADMIN_URL, transports=['websocket', 'polling'])
    except Exception as e:
        print(f'✗ Could not connect: {e}')
        detector.release()
        return

    print('\nStarting detection loop...\n')
    try:
        while True:
            state   = tick_light_cycle()
            count   = detector.detect()
            den     = detector.density(count)
            last_density = den
            spd     = 46 if den == 'LOW' else (35 if den == 'MEDIUM' else 22)

            # Track cumulative RED queue count
            if state == 'GREEN':
                cumulative_red_count = 0
            else:
                cumulative_red_count = max(cumulative_red_count, count)

            detector.save_frame(count, den, state)

            payload = {
                'signalId':    SIGNAL_ID,
                'vehicleCount': count,
                'density':      den,
                'currentState': state,
                'avgSpeed':     spd,
                'timestamp':    int(time.time() * 1000),
            }
            sio.emit('signal:update', payload)

            ts         = time.strftime('%H:%M:%S')
            icon       = '🟢' if state == 'GREEN' else ('🟡' if state == 'YELLOW' else '🔴')
            queue_lbl  = 'Queue:CLEAR         ' if state == 'GREEN' else f'Queue:{cumulative_red_count:3d} (red)      '
            print(
                f'[{ts}] {SIGNAL_ID} | {icon} {state:<6} | '
                f'Vehicles:{count:3d} | {queue_lbl[:18]} | '
                f'Density:{den:<6} | Speed:{spd}km/h'
            )

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        print(f'\n[Signal {SIGNAL_ID}] Shutting down...')
    finally:
        detector.release()
        sio.disconnect()
        print(f'[Signal {SIGNAL_ID}] Stopped.')

if __name__ == '__main__':
    main()
