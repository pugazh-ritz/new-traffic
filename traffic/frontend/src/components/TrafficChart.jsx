import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './TrafficChart.css';

const TrafficChart = ({ history }) => {
  if (!history || history.length === 0) {
    return (
      <div className="chart-container chart-empty">
        <p>No historical data available</p>
      </div>
    );
  }

  // Format data for chart
  const chartData = history.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    vehicles: point.vehicleCount,
    density: point.density === 'HIGH' ? 3 : point.density === 'MEDIUM' ? 2 : 1
  }));

  return (
    <div className="chart-container">
      <h3>Traffic Density Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            yAxisId="left"
            label={{ value: 'Vehicle Count', angle: -90, position: 'insideLeft' }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            domain={[0, 3]}
            ticks={[1, 2, 3]}
            tickFormatter={(value) => {
              if (value === 1) return 'LOW';
              if (value === 2) return 'MEDIUM';
              if (value === 3) return 'HIGH';
              return '';
            }}
          />
          <Tooltip />
          <Legend />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="vehicles" 
            stroke="#2196f3" 
            strokeWidth={2}
            name="Vehicles"
            dot={{ r: 3 }}
          />
          <Line 
            yAxisId="right"
            type="stepAfter" 
            dataKey="density" 
            stroke="#ff9800" 
            strokeWidth={2}
            name="Density Level"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrafficChart;
