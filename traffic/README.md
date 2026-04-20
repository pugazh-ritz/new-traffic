# 🚦 Smart Traffic Management System

A real-time distributed traffic signal coordination system with centralized control and intelligent decision-making.

![System Architecture](https://img.shields.io/badge/Architecture-Distributed-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js-green)
![Frontend](https://img.shields.io/badge/Frontend-React-61dafb)
![Detection](https://img.shields.io/badge/Detection-OpenCV-red)

## 📋 Overview

An intelligent traffic management system that coordinates multiple traffic signals to optimize traffic flow using real-time vehicle detection and adaptive control strategies.

### Key Features

- 🎯 **Real-Time Vehicle Detection** - OpenCV-based vehicle counting from video feeds
- 🤖 **Intelligent Strategy Engine** - Automatic switching between ADAPTIVE and GREEN WAVE modes
- 📊 **Live Dashboard** - Real-time monitoring with charts and metrics
- 🎮 **Manual Override** - Direct control for emergency situations
- 🔌 **WebSocket Communication** - Low-latency bi-directional updates
- 🛡️ **Fail-Safe Logic** - Automatic fallback when signals disconnect
- 📈 **Scalable Design** - Supports 2 to N signal nodes

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────┐
│         ADMIN CONTROL CENTER                │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │    React     │◄──►│  Node.js Server  │  │
│  │  Dashboard   │    │  + Socket.IO     │  │
│  └──────────────┘    └────────┬─────────┘  │
│                               │             │
│                      ┌────────▼──────────┐  │
│                      │ Decision Engine   │  │
│                      │ (ADAPTIVE/GREEN   │  │
│                      │  WAVE Selection)  │  │
│                      └───────────────────┘  │
└─────────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │      WebSocket (Socket.IO)   │
        │                              │
┌───────▼────────┐            ┌────────▼──────┐
│   SIGNAL A     │            │   SIGNAL B    │
│                │            │               │
│ ┌────────────┐ │            │ ┌───────────┐ │
│ │ Camera/    │ │            │ │ Camera/   │ │
│ │ Video Feed │ │            │ │Video Feed │ │
│ └─────┬──────┘ │            │ └─────┬─────┘ │
│       │        │            │       │       │
│ ┌─────▼──────┐ │            │ ┌─────▼─────┐ │
│ │  OpenCV    │ │            │ │  OpenCV   │ │
│ │  Detection │ │            │ │ Detection │ │
│ └────────────┘ │            │ └───────────┘ │
└────────────────┘            └───────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for admin server)
- **Python** 3.9+ (for signal nodes)
- **npm** or **yarn**
- 3 laptops on the same WiFi network

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-traffic-admin.git
   cd smart-traffic-admin
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Run on one laptop (demo mode)**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm start

   # Terminal 2 - Frontend
   cd frontend
   npm start

   # Terminal 3 - Signal Simulators
   cd ..
   npm install socket.io-client
   .\start-signals.ps1
   ```

### For Production (3 Laptops)

See **[SIGNAL_LAPTOP_SETUP.md](SIGNAL_LAPTOP_SETUP.md)** for complete setup instructions.

## 📖 Documentation

- **[RUN_DEMO.md](RUN_DEMO.md)** - Run complete demo on single laptop
- **[SIGNAL_LAPTOP_SETUP.md](SIGNAL_LAPTOP_SETUP.md)** - Setup signal nodes on separate laptops
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture details
- **[API_EXAMPLES.md](docs/API_EXAMPLES.md)** - REST API reference
- **[SIGNAL_NODE_GUIDE.md](docs/SIGNAL_NODE_GUIDE.md)** - Signal node implementation

## 🎮 Traffic Control Strategies

### ADAPTIVE Mode
- Triggered when **any signal detects HIGH density**
- Each signal operates independently
- Green time: 30-90 seconds based on local traffic
- Best for: Congested conditions

### GREEN WAVE Mode
- Triggered when **all signals detect LOW density**
- Signals coordinated for continuous flow
- Offset calculated based on distance and speed
- Best for: Light traffic, smooth flow

### Manual Mode
- Operator has full control
- Direct signal overrides
- Emergency vehicle priority
- Special event management

## 🛠️ Technology Stack

### Admin Control Center
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React 18, Recharts, Axios
- **Communication**: WebSocket, REST API
- **State Management**: In-memory (scalable to Redis)

### Signal Nodes
- **Detection**: Python, OpenCV, NumPy
- **Communication**: python-socketio
- **Processing**: Background subtraction, contour detection

## 📊 Features

### Real-Time Dashboard
- Live signal status cards
- Traffic density charts
- Vehicle count visualization
- System health monitoring
- Mode switching controls

### Decision Engine
- Density-based strategy selection
- Fail-safe mechanisms
- Connection monitoring
- Historical decision tracking

### Vehicle Detection
- OpenCV-based detection
- Background subtraction algorithm
- Configurable sensitivity
- Supports video files or live camera

## 🔧 Configuration

### Backend (.env)
```env
PORT=5000
MIN_GREEN_TIME_SEC=30
MAX_GREEN_TIME_SEC=90
YELLOW_TIME_SEC=5
DISTANCE_BETWEEN_SIGNALS_KM=2
DEFAULT_AVG_SPEED_KMPH=40
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

### Signal Node
```python
ADMIN_URL = 'http://192.168.1.100:5000'  # Admin laptop IP
SIGNAL_ID = 'A'  # or 'B'
VIDEO_SOURCE = 'traffic_video.mp4'  # or 0 for webcam
```

## 🧪 Testing

### Single Laptop Demo
```powershell
# Start everything on one laptop
.\setup.ps1              # First time only
.\start-backend.ps1      # Terminal 1
.\start-frontend.ps1     # Terminal 2
.\start-signals.ps1      # Terminal 3
```

### Multi-Laptop Setup
1. Admin laptop: Run backend + frontend
2. Signal A laptop: Run signal-node-with-camera.py
3. Signal B laptop: Run signal-node-with-camera.py

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- OpenCV community for computer vision tools
- Socket.IO for real-time communication
- React community for frontend framework

## 📞 Support

For issues and questions, please open an issue on GitHub.

---

**Built with ❤️ for smarter cities**
