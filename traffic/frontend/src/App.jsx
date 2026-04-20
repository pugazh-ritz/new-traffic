import React, { useState, useEffect } from 'react';
import socketService from './services/socketService';
import apiService from './services/apiService';
import SystemStatus from './components/SystemStatus';
import SignalCard from './components/SignalCard';
import ControlPanel from './components/ControlPanel';
import TrafficChart from './components/TrafficChart';
import ParserMonitor from './components/ParserMonitor';
import './App.css';

function App() {
  const [systemState, setSystemState] = useState({
    systemMode: 'AUTOMATIC',
    currentStrategy: null,
    totalSignals: 0,
    onlineSignals: 0,
    signals: [],
    decision: {},
    greenWaveTimer: null
  });

  const [selectedSignalHistory, setSelectedSignalHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [activeView, setActiveView] = useState('dashboard');

  // Connect to Socket.IO on mount
  useEffect(() => {
    console.log('[App] Initializing connection...');

    socketService.connect();
    setConnectionStatus('connecting');

    // Listen for state updates
    socketService.on('state:update', (data) => {
      console.log('[App] State update received:', data);
      setSystemState({
        systemMode: data.systemMode,
        currentStrategy: data.currentStrategy,
        totalSignals: data.totalSignals,
        onlineSignals: data.onlineSignals,
        signals: data.signals || [],
        decision: data.decision || {},
        greenWaveTimer: data.greenWaveTimer || null
      });
      setConnectionStatus('connected');
    });

    // Initial data fetch
    fetchInitialData();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Fetch initial data from API
  const fetchInitialData = async () => {
    try {
      const response = await apiService.getStatus();
      if (response.success) {
        setSystemState({
          systemMode: response.data.systemMode,
          currentStrategy: response.data.currentStrategy,
          totalSignals: response.data.totalSignals,
          onlineSignals: response.data.onlineSignals,
          signals: response.data.signals || [],
          decision: response.data.decision || {},
          greenWaveTimer: response.data.greenWaveTimer || null
        });
      }
    } catch (error) {
      console.error('[App] Error fetching initial data:', error);
    }
  };

  // Fetch history for first signal
  useEffect(() => {
    if (systemState.signals.length > 0) {
      const firstSignal = systemState.signals[0];
      fetchSignalHistory(firstSignal.signalId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemState.signals.length]);

  const fetchSignalHistory = async (signalId) => {
    try {
      const response = await apiService.getSignalHistory(signalId, 30);
      if (response.success) {
        setSelectedSignalHistory(response.data.history);
      }
    } catch (error) {
      console.error('[App] Error fetching signal history:', error);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>Smart Traffic Management System</h1>
          <p>Centralized Admin Control Center</p>
        </div>
        <div className={`connection-badge ${connectionStatus}`}>
          {connectionStatus === 'connected' && 'Connected'}
          {connectionStatus === 'connecting' && 'Connecting...'}
          {connectionStatus === 'disconnected' && 'Disconnected'}
        </div>
      </header>

      <div className="view-toggle">
        <button
          className={activeView === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard View
        </button>
        <button
          className={activeView === 'parser' ? 'active' : ''}
          onClick={() => setActiveView('parser')}
        >
          Parser View
        </button>
      </div>

      <main className="app-main">
        {activeView === 'parser' ? (
          <ParserMonitor systemState={systemState} />
        ) : (
          <>
            <SystemStatus
              systemMode={systemState.systemMode}
              currentStrategy={systemState.currentStrategy}
              totalSignals={systemState.totalSignals}
              onlineSignals={systemState.onlineSignals}
              decision={systemState.decision}
              greenWaveTimer={systemState.greenWaveTimer}
              signals={systemState.signals}
            />

            <section className="signals-section">
              <h2>Traffic Signal Nodes</h2>
              <div className="signals-grid">
                {systemState.signals.length > 0 ? (
                  systemState.signals.map(signal => (
                    <SignalCard
                      key={signal.signalId}
                      signal={signal}
                      currentStrategy={systemState.currentStrategy}
                      greenWaveTimer={systemState.greenWaveTimer}
                    />
                  ))
                ) : (
                  <>
                    <SignalCard signal={null} />
                    <SignalCard signal={null} />
                  </>
                )}
              </div>
            </section>

            <div className="dashboard-grid">
              <div className="dashboard-section">
                <TrafficChart history={selectedSignalHistory} />
              </div>

              <div className="dashboard-section">
                <ControlPanel
                  systemMode={systemState.systemMode}
                  currentStrategy={systemState.currentStrategy}
                  signals={systemState.signals}
                />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>Smart City Project 2026 | Real-time Traffic Coordination System</p>
      </footer>
    </div>
  );
}

export default App;
