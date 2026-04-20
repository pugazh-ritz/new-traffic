# Backend Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

## Installation

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. (Optional) Configure MongoDB:
   - If using MongoDB, update `MONGODB_URI` in `.env`
   - Otherwise, system will work without database (in-memory only)

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Status & Monitoring
- `GET /health` - Health check
- `GET /api/status` - Full system status
- `GET /api/signals` - All signal states
- `GET /api/signals/:signalId` - Specific signal
- `GET /api/signals/:signalId/history` - Historical data

### Mode Control
- `POST /api/mode/manual` - Switch to manual mode
- `POST /api/mode/automatic` - Switch to automatic mode

### Manual Override
- `POST /api/manual/override` - Send manual timing to signal
  ```json
  {
    "signalId": "A",
    "greenTime": 60,
    "redTime": 40,
    "yellowTime": 5
  }
  ```

### Strategy Testing
- `POST /api/strategy/force` - Force specific strategy
  ```json
  {
    "strategy": "ADAPTIVE" | "GREEN_WAVE"
  }
  ```

### Configuration
- `GET /api/config/green-wave` - Green wave parameters
- `GET /api/config/adaptive` - Adaptive mode parameters
- `GET /api/decision/explanation` - Decision reasoning
- `GET /api/statistics` - System statistics

## WebSocket Events

### From Signal Nodes (Inbound)
- `signal:connect` - Signal node connects
- `signal:update` - Vehicle data update
- `signal:disconnect` - Signal node disconnects

### To Signal Nodes (Outbound)
- `mode:update` - Strategy change notification
- `manual:override` - Manual timing command

### Dashboard Events
- `state:update` - Broadcast system state to dashboard

## Architecture

```
backend/
├── src/
│   ├── config/
│   │   └── constants.js      # System constants
│   ├── decision/
│   │   └── strategyEngine.js # Decision logic
│   ├── routes/
│   │   └── api.js            # REST endpoints
│   ├── sockets/
│   │   └── signalHandler.js  # WebSocket logic
│   ├── state/
│   │   └── signalState.js    # State management
│   └── index.js              # Server entry point
└── package.json
```

## Testing the Server

### Using curl

Check health:
```bash
curl http://localhost:5000/health
```

Get system status:
```bash
curl http://localhost:5000/api/status
```

Switch to manual mode:
```bash
curl -X POST http://localhost:5000/api/mode/manual
```

### Using Postman
Import the API endpoints and test each route.

## Signal Node Connection

Signal nodes should connect using Socket.IO:

```javascript
const socket = io('http://localhost:5000');

// Connect as signal
socket.emit('signal:connect', {
  signalId: 'A'
});

// Send updates
socket.emit('signal:update', {
  signalId: 'A',
  vehicleCount: 25,
  density: 'MEDIUM',
  avgSpeed: 35
});

// Receive commands
socket.on('mode:update', (data) => {
  console.log('Strategy change:', data);
});
```

## Troubleshooting

### Port Already in Use
Change `PORT` in `.env` file:
```
PORT=5001
```

### CORS Errors
Update CORS settings in `src/index.js` to match your frontend URL.

### Signal Not Connecting
- Check firewall settings
- Ensure all devices on same network
- Verify Socket.IO URL in signal node code

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Configure proper CORS origins
3. Use process manager (PM2):
```bash
npm install -g pm2
pm2 start src/index.js --name traffic-admin
```

## Next Steps

After backend is running:
1. Start frontend dashboard
2. Connect signal node laptops
3. Monitor traffic in real-time
