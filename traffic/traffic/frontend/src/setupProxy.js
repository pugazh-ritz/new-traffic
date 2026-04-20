const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const backendTarget = 'http://localhost:3001';

  // Proxy Socket.IO connections (must support WebSocket upgrades)
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
      ws: true,
    })
  );

  // Proxy REST API calls
  app.use(
    '/api',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
    })
  );

  // Proxy health check
  app.use(
    '/health',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
    })
  );

  // Proxy media/parsed frames from Python detector
  app.use(
    '/media',
    createProxyMiddleware({
      target: backendTarget,
      changeOrigin: true,
    })
  );
};
