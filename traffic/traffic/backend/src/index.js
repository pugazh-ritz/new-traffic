/**
 * Main Server Entry Point
 * Smart Traffic Management System - Admin Control Center
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

const apiRoutes = require('./routes/api');
const SignalSocketHandler = require('./sockets/signalHandler');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*', // In production, specify frontend URL
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Smart Traffic Admin Server',
    timestamp: Date.now()
  });
});

// Initialize socket handler
const signalSocketHandler = new SignalSocketHandler(io);
signalSocketHandler.initialize();

// Make socket handler available to routes
app.set('socketHandler', signalSocketHandler);

// API Routes
app.use('/api', apiRoutes);

// Video stream endpoint for parser monitor page
app.get('/media/traffic-video', (req, res) => {
  const configuredPath = process.env.TRAFFIC_VIDEO_PATH;
  const fallbackPaths = [
    configuredPath,
    path.resolve(__dirname, '../../traffic_video.mp4'),
    path.resolve(__dirname, '../../../traffic_video.mp4'),
    path.resolve(__dirname, '../../../vecteezy_traffic-cars-passing-in-road-with-asphalt-with-cracks-seen_36990287.mov')
  ].filter(Boolean);

  const videoPath = fallbackPaths.find((candidate) => fs.existsSync(candidate));
  if (!videoPath) {
    return res.status(404).json({
      success: false,
      error: 'Traffic video file not found',
      hint: 'Set TRAFFIC_VIDEO_PATH in backend environment to an absolute file path'
    });
  }

  return res.sendFile(videoPath);
});

// Latest parsed frame snapshots written by Python detector
app.get('/media/parsed/:signalId.jpg', (req, res) => {
  const signalId = String(req.params.signalId || '').trim().toUpperCase();
  if (!signalId) {
    return res.status(400).json({
      success: false,
      error: 'signalId is required'
    });
  }

  const parsedDir = process.env.PARSED_FRAME_OUTPUT_DIR
    ? path.resolve(process.env.PARSED_FRAME_OUTPUT_DIR)
    : path.resolve(__dirname, '../../../parsed_frames');
  const framePath = path.join(parsedDir, `${signalId}.jpg`);

  if (!fs.existsSync(framePath)) {
    return res.status(404).json({
      success: false,
      error: `Parsed frame not found for signal ${signalId}`
    });
  }

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.sendFile(framePath);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║  Smart Traffic Management System - Admin Server   ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  console.log(`[Server] HTTP Server running on port ${PORT}`);
  console.log(`[Server] Socket.IO ready for signal connections`);
  console.log(`[Server] Health check: http://localhost:${PORT}/health`);
  console.log(`[Server] API endpoint: http://localhost:${PORT}/api`);
  console.log('\n[System] Waiting for signal nodes to connect...\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...');
  server.close(() => {
    console.log('[Server] Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
