import axios from 'axios';
import { API_BASE_URL } from '../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API methods
const apiService = {
  // Get system status
  getStatus: async () => {
    const response = await api.get('/api/status');
    return response.data;
  },

  // Get all signals
  getSignals: async () => {
    const response = await api.get('/api/signals');
    return response.data;
  },

  // Get specific signal
  getSignal: async (signalId) => {
    const response = await api.get(`/api/signals/${signalId}`);
    return response.data;
  },

  // Get signal history
  getSignalHistory: async (signalId, limit = 50) => {
    const response = await api.get(`/api/signals/${signalId}/history`, {
      params: { limit }
    });
    return response.data;
  },

  // Switch to manual mode
  switchToManual: async () => {
    const response = await api.post('/api/mode/manual');
    return response.data;
  },

  // Switch to automatic mode
  switchToAutomatic: async () => {
    const response = await api.post('/api/mode/automatic');
    return response.data;
  },

  // Send manual override
  sendManualOverride: async (signalId, greenTime, redTime, yellowTime = 5) => {
    const response = await api.post('/api/manual/override', {
      signalId,
      greenTime,
      redTime,
      yellowTime
    });
    return response.data;
  },

  // Force strategy (for testing)
  forceStrategy: async (strategy) => {
    const response = await api.post('/api/strategy/force', {
      strategy
    });
    return response.data;
  },

  // Get decision explanation
  getDecisionExplanation: async () => {
    const response = await api.get('/api/decision/explanation');
    return response.data;
  },

  // Get statistics
  getStatistics: async () => {
    const response = await api.get('/api/statistics');
    return response.data;
  },

  // Get green wave config
  getGreenWaveConfig: async (baseSignal = 'A', speed = null) => {
    const response = await api.get('/api/config/green-wave', {
      params: { baseSignal, speed }
    });
    return response.data;
  },

  // Get adaptive config
  getAdaptiveConfig: async () => {
    const response = await api.get('/api/config/adaptive');
    return response.data;
  },

  // Trigger A release event for GREEN_WAVE demo synchronization
  triggerARelease: async () => {
    const response = await api.post('/api/green-wave/trigger-a-release');
    return response.data;
  }
};

export default apiService;
