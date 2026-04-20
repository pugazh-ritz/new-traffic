# Smart Traffic Management System — Local Setup Guide

## Overview

A real-time traffic signal dashboard with a Node.js backend (Socket.IO) and React frontend. Traffic data comes from Python-based video detection (OpenCV) reading a real traffic video feed. Each junction (A, B, C) connects as a signal node and the dashboard responds in real time.

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | v20+ | https://nodejs.org |
| npm | v10+ | bundled with Node |
| Python | 3.9+ | https://python.org |
| pip | any | bundled with Python |

---

## Project Structure

```
smart-traffic/
├── backend/                  Node.js + Socket.IO admin server
│   ├── src/
│   │   ├── index.js          Entry point (port 3001)
│   │   ├── sockets/          Real-time signal handlers
│   │   ├── routes/           REST API routes
│   │   └── state/            In-memory signal state
│   ├── parsed_frames/        Annotated video frame outputs (auto-created)
│   └── .env                  Backend environment variables
│
├── frontend/                 React dashboard (port 5000)
│   ├── src/
│   │   ├── components/       SignalCard, ControlPanel, SystemStatus, etc.
│   │   └── services/         Socket.IO and API clients
│   └── .env
│
├── video-detector.py         Python OpenCV vehicle detector (one per junction)
├── signal-simulator-A.js     JS test simulator — Junction A
├── signal-simulator-B.js     JS test simulator — Junction B
├── signal-simulator-C.js     JS test simulator — Junction C
└── LOCAL_SETUP.md            This file
```

---

## Installation

### 1. Backend dependencies
```bash
cd backend
npm install
cd ..
```

### 2. Frontend dependencies
```bash
cd frontend
npm install
cd ..
```

### 3. Root-level dependencies (JS simulators)
```bash
npm install
```

### 4. Python dependencies (video detector)
```bash
pip install opencv-python python-socketio websocket-client requests numpy
```

> On some systems use `pip3` instead of `pip`.

---

## Running the System

You need **three terminal windows** minimum.

### Terminal 1 — Backend server
```bash
cd backend
node src/index.js
```
Expected output:
```
[Server] Admin server listening on port 3001
[Server] Signal management system initialized
```

### Terminal 2 — Frontend dashboard
```bash
cd frontend
npm start
```
Open your browser at: **http://localhost:5000**

### Terminal 3 — Video detector (Junction A)
```bash
VIDEO_SOURCE=/path/to/your/traffic.mp4 SIGNAL_ID=A python3 video-detector.py
```

To run **all three junctions** from real video, open additional terminals:
```bash
# Terminal 4 — Junction B
VIDEO_SOURCE=/path/to/your/traffic.mp4 SIGNAL_ID=B python3 video-detector.py

# Terminal 5 — Junction C
VIDEO_SOURCE=/path/to/your/traffic.mp4 SIGNAL_ID=C python3 video-detector.py
```

---

## Video Detector — Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VIDEO_SOURCE` | *(required)* | Path to video file, or `0` for webcam |
| `SIGNAL_ID` | `A` | Junction ID: `A`, `B`, or `C` |
| `ADMIN_URL` | `http://localhost:3001` | Backend server URL |
| `LOW_TO_MEDIUM_THRESHOLD` | `15` | Vehicle count to trigger MEDIUM density |
| `MEDIUM_TO_HIGH_THRESHOLD` | `30` | Vehicle count to trigger HIGH density |
| `RED_HOLD_SEC` | `20` | Seconds to hold RED before going GREEN |
| `GREEN_HOLD_SEC` | `15` | Seconds to hold GREEN before going YELLOW |
| `YELLOW_HOLD_SEC` | `5` | Seconds to hold YELLOW before going RED |

---

## Terminal Output Format (Video Detector & Simulators)

Every 3 seconds each junction prints:

```
[15:23:42] A | 🔴 RED    | Vehicles: 16 | Queue: 16 (red)    | Density:MEDIUM | Speed:36km/h
[15:23:45] A | 🔴 RED    | Vehicles:  9 | Queue: 16 (red)    | Density:LOW    | Speed:41km/h
[15:23:48] A | 🟢 GREEN  | Vehicles: 12 | Queue:CLEAR        | Density:LOW    | Speed:44km/h
```

| Column | Meaning |
|---|---|
| 🔴/🟡/🟢 State | Current signal phase |
| `Vehicles:` | Vehicle count from the current video frame scan |
| `Queue: N (red)` | Cumulative peak count during this RED phase — only ever grows |
| `Queue:CLEAR` | Queue reset — signal just turned GREEN |
| `Density:` | LOW / MEDIUM / HIGH based on vehicle count |
| `Speed:` | Estimated average vehicle speed |

---

## Using JS Simulators (no video needed)

For testing without a video file, run the JS simulators instead:

```bash
node signal-simulator-A.js
node signal-simulator-B.js
node signal-simulator-C.js
```

They produce identical terminal output and dashboard behavior — the only difference is the vehicle counts are simulated based on realistic time-of-day patterns instead of real video.

---

## Dashboard Features

### System Modes
| Mode | Behaviour |
|---|---|
| **Automatic** | System AI picks the best strategy based on traffic density |
| **Manual** | You control each signal directly from the dashboard |

### Strategies
| Strategy | Description |
|---|---|
| **Adaptive** | Each junction cycles independently; green time scales with density (LOW→30s, MEDIUM→60s, HIGH→90s) |
| **Green Wave** | A → B → C coordination: A releases a platoon, B and C open at calculated travel-time offsets |

### Signal Cards (Dashboard)
Each junction card shows:
- Current state (RED / YELLOW / GREEN) with countdown
- **RED phase:** "Queue (Accumulated)" — the peak vehicle count since this RED started
- **GREEN phase:** "Vehicles Passing" with Queue:CLEAR confirmation
- Density badge and average speed

---

## Manual Override

The dashboard Control Panel lets you override any junction's timing.

### How it works
1. Switch to **Manual** mode using the mode button
2. Select a junction (A, B, or C)
3. Set the **Green Time** and **Red Time** sliders (10–120 seconds)
4. Click **Apply Override**

The signal immediately jumps to GREEN for the specified duration, then YELLOW, then RED — after which it resumes its normal adaptive cycle.

### What you see in the terminal
```
[Override] A timing → GREEN:60s  YELLOW:5s  RED:30s
[15:31:02] A | 🟢 GREEN  | Vehicles: 11 | Queue:CLEAR | Density:LOW | Speed:44km/h
```

### Works with both video detector and JS simulators
The override event is sent over Socket.IO to whichever node is connected for that junction.

---

## Cumulative RED Queue Count

This is the key traffic management metric:

- During **RED / YELLOW**: the queue count only ever **grows** — it takes the maximum of all vehicle scans during that phase. Even if a scan detects fewer vehicles, the queue stays at its peak (vehicles are still waiting, they just weren't all visible in one frame).
- On **GREEN**: the queue instantly resets to 0 (vehicles are being released).
- Visible both in the dashboard card and in the terminal output.

---

## Annotated Video Frames (Parser View)

The Python detector saves an annotated snapshot of the latest processed frame to:
```
backend/parsed_frames/<SIGNAL_ID>.jpg
```

These are viewable in the **Parser View** tab of the dashboard. Bounding boxes show detected vehicles with count and density overlaid.

---

## Backend REST API (port 3001)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/api/status` | All signal states |
| POST | `/api/mode/auto` | Switch to automatic mode |
| POST | `/api/mode/manual` | Switch to manual mode |
| POST | `/api/mode/adaptive` | Force adaptive strategy |
| POST | `/api/mode/green-wave` | Force green wave strategy |
| POST | `/api/manual/override` | Send timing override to a signal |

### Manual override payload
```json
POST /api/manual/override
{
  "signalId": "A",
  "greenTime": 60,
  "redTime": 30,
  "yellowTime": 5
}
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard shows "Connecting..." | Make sure the backend is running on port 3001 before the frontend |
| Video detector can't connect | Check `ADMIN_URL` and that the backend is running |
| `cv2` not found | Run `pip install opencv-python` |
| `socketio` not found | Run `pip install python-socketio websocket-client` |
| Signal shows as offline | The signal node disconnected — restart `video-detector.py` |
| Override has no effect | Confirm the junction is connected (shown as online in the dashboard) |
| JS simulator error `Cannot find module 'socket.io-client'` | Run `npm install` from the project root |
| Frontend port already in use | Set `PORT=5001` before `npm start` in the frontend |
| Video file not found | Use an absolute path for `VIDEO_SOURCE` |

---

## Quick-Start (all in one)

```bash
# Terminal 1 — Backend
cd backend && node src/index.js

# Terminal 2 — Frontend
cd frontend && npm start

# Terminal 3 — Junction A (video)
VIDEO_SOURCE=/absolute/path/to/traffic.mp4 SIGNAL_ID=A python3 video-detector.py

# Terminal 4 — Junction B (video)
VIDEO_SOURCE=/absolute/path/to/traffic.mp4 SIGNAL_ID=B python3 video-detector.py

# Terminal 5 — Junction C (video)
VIDEO_SOURCE=/absolute/path/to/traffic.mp4 SIGNAL_ID=C python3 video-detector.py
```

Open **http://localhost:5000** in your browser.
