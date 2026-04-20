# Frontend Setup Guide

## Prerequisites

- Node.js 18+ installed
- Backend server running

## Installation

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file (optional):
```bash
# Create .env file in frontend root
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

## Running the Dashboard

### Development Mode
```bash
npm start
```

The app will open at `http://localhost:3000`

### Production Build
```bash
npm run build
```

The build folder will contain optimized static files.

## Dashboard Features

### 1. System Status Panel
- Real-time system mode (AUTOMATIC / MANUAL)
- Active strategy (ADAPTIVE / GREEN WAVE)
- Signal connection status
- Decision reasoning

### 2. Signal Status Cards
- Live vehicle count
- Traffic density (LOW / MEDIUM / HIGH)
- Average speed
- Connection status
- Last update timestamp

### 3. Control Panel
- **Mode Switch**: Toggle between AUTOMATIC and MANUAL
- **Manual Override**: Set custom green/red times for specific signals
- **Force Strategy**: Test ADAPTIVE or GREEN WAVE modes

### 4. Traffic Charts
- Real-time vehicle count over time
- Density level trends
- Historical analysis

## Usage

### Switching Modes

**Automatic Mode:**
1. Click "AUTOMATIC" button
2. System decides strategy based on traffic density
3. Watch strategy indicator update

**Manual Mode:**
1. Click "MANUAL" button
2. Select signal from dropdown
3. Adjust green/red time sliders
4. Click "Apply Override"

### Monitoring Traffic

- Signal cards update every 1-2 seconds
- Charts display last 30 data points
- Color-coded density indicators:
  - 🟢 Green = LOW density
  - 🟠 Orange = MEDIUM density
  - 🔴 Red = HIGH density

### Testing Strategies

Use "Force Strategy" buttons to:
- Test ADAPTIVE mode with different traffic loads
- Test GREEN WAVE synchronization
- Compare efficiency of both strategies

## Components Overview

```
src/
├── components/
│   ├── SignalCard.jsx          # Individual signal display
│   ├── ControlPanel.jsx        # Mode and manual controls
│   ├── SystemStatus.jsx        # System overview
│   └── TrafficChart.jsx        # Historical charts
├── services/
│   ├── apiService.js           # HTTP API calls
│   └── socketService.js        # WebSocket connection
├── App.jsx                     # Main application
└── config.js                   # Configuration
```

## Customization

### Changing Colors

Edit color constants in [src/config.js](src/config.js):

```javascript
export const DENSITY_COLORS = {
  LOW: '#4caf50',     // Green
  MEDIUM: '#ff9800',  // Orange
  HIGH: '#f44336'     // Red
};
```

### Adjusting Chart Display

In [TrafficChart.jsx](src/components/TrafficChart.jsx), modify:
- Chart height
- Line colors
- Data point count
- Refresh interval

### Backend URL

If backend runs on different port:
```javascript
// src/config.js
export const API_BASE_URL = 'http://192.168.1.100:5000';
export const SOCKET_URL = 'http://192.168.1.100:5000';
```

## Troubleshooting

### Connection Failed
- Verify backend server is running
- Check `API_BASE_URL` in config
- Inspect browser console for errors

### Live Updates Not Working
- Check WebSocket connection in browser DevTools
- Verify firewall allows WebSocket connections
- Ensure CORS is properly configured in backend

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## Multi-Laptop Setup

### Admin Laptop (this dashboard)
1. Note your IP address: `ipconfig` (Windows) or `ifconfig` (Linux/Mac)
2. Update backend URL to use IP instead of localhost
3. Share the IP with signal laptop operators

### Network Configuration
All laptops must be on the same network (WiFi/LAN).

Example setup:
- Admin: `192.168.1.100:3000` (dashboard)
- Backend: `192.168.1.100:5000` (server)
- Signal A: Connects to backend
- Signal B: Connects to backend

## Production Deployment

### Build for Production
```bash
npm run build
```

### Serve with Static Server
```bash
npm install -g serve
serve -s build -p 3000
```

### Deploy to Web Host
Upload `build/` folder to:
- Netlify
- Vercel
- GitHub Pages
- Any static hosting service

## Performance Tips

- Use Chrome or Firefox for best WebSocket performance
- Keep browser tab active (some browsers throttle background tabs)
- Limit historical data to 50-100 points for smooth charts

## Demo Preparation

1. Start backend server first
2. Start dashboard
3. Open in fullscreen (F11)
4. Connect signal laptops
5. Switch between modes to demonstrate functionality
6. Use force strategy to show different behaviors
