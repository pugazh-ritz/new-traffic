# Smart Traffic Management System

A real-time traffic signal management and simulation system with a centralized admin control center.

## Architecture

- **Frontend**: React app running on port 5000 (Create React App / react-scripts)
- **Backend**: Node.js Express + Socket.IO server running on port 3001

## Project Structure

```
/
├── backend/               # Express + Socket.IO server
│   ├── src/
│   │   ├── index.js       # Main entry point (port 3001)
│   │   ├── routes/api.js  # REST API endpoints
│   │   ├── sockets/signalHandler.js  # Real-time signal logic
│   │   ├── decision/strategyEngine.js # ADAPTIVE / GREEN_WAVE decisions
│   │   └── config/constants.js
│   └── .env               # PORT=3001, NODE_ENV=development
├── frontend/              # React dashboard (port 5000)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/    # SystemStatus, SignalCard, ControlPanel, TrafficChart, ParserMonitor
│   │   ├── services/      # apiService.js, socketService.js
│   │   ├── config.js      # Constants and config
│   │   └── setupProxy.js  # CRA proxy to backend at localhost:3001
│   └── .env               # HOST=0.0.0.0, PORT=5000, DANGEROUSLY_DISABLE_HOST_CHECK=true
├── signal-simulator-A.js  # Simulates Junction A node
├── signal-simulator-B.js  # Simulates Junction B node
└── signal-simulator-C.js  # Simulates Junction C node
```

## Workflows

- **Start application**: `cd frontend && npm start` → port 5000 (webview)
- **Backend**: `cd backend && node src/index.js` → port 3001 (console)

## Communication

- Frontend proxies all `/api`, `/socket.io`, `/health`, `/media` requests to backend via CRA's `setupProxy.js`
- Socket.IO provides real-time bidirectional communication for traffic signals
- In-memory state management (no database required for core functionality)

## Signal Simulators (JS — for testing)

Run signal simulators to feed data to the dashboard:
```bash
node signal-simulator-A.js
node signal-simulator-B.js
node signal-simulator-C.js
```

## Video Detection (Python — real traffic from video)

Use `video-detector.py` to feed real vehicle counts from a traffic video or webcam:
```bash
# From a video file
VIDEO_SOURCE=traffic.mp4 SIGNAL_ID=A python3 video-detector.py

# From a webcam (index 0)
VIDEO_SOURCE=0 SIGNAL_ID=B python3 video-detector.py
```

Env vars: `ADMIN_URL` (default: `http://localhost:3001`), `SIGNAL_ID`, `VIDEO_SOURCE`,
`LOW_TO_MEDIUM_THRESHOLD`, `MEDIUM_TO_HIGH_THRESHOLD`, `PARSED_FRAME_OUTPUT_DIR`,
`RED_HOLD_SEC`, `GREEN_HOLD_SEC`, `YELLOW_HOLD_SEC`.

Annotated frames are saved to `./parsed_frames/<SIGNAL_ID>.jpg` and visible in Parser View.

## Cumulative RED Queue Count

During RED/YELLOW, the vehicle count displayed in the SignalCard only ever **grows** (never decreases). It resets to 0 when the signal turns GREEN. This represents the queue of vehicles accumulating at the junction while waiting for green. Backend field: `cumulativeRedCount`.

## Environment Variables

### Backend (backend/.env)
- `PORT=3001`
- `NODE_ENV=development`
- `SIGNAL_TIMEOUT_MS=300000`
- `DISTANCE_BETWEEN_SIGNALS_KM=2`
- `DEFAULT_AVG_SPEED_KMPH=40`

### Frontend (frontend/.env)
- `HOST=0.0.0.0`
- `PORT=5000`
- `DANGEROUSLY_DISABLE_HOST_CHECK=true` (required for Replit proxy)
- `WDS_SOCKET_PORT=0`
