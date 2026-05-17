
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Thermometer, Droplets, Wind, Cloud, Sun, Activity } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function WeatherVisualizationsEnhanced({ forecast }) {
  const navigate = useNavigate();
  if (!forecast || forecast.length === 0) return null;

  const labels = forecast.map(day => 
    new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  );

  // Enhanced datasets for better visuals
  const temperatureData = {
    labels,
    datasets: [
      {
        label: 'Max Temperature (°C)',
        data: forecast.map(day => day.T2M_MAX),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.5,
        borderWidth: 3,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      },
      {
        label: 'Avg Temperature (°C)',
        data: forecast.map(day => day.T2M),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.5,
        borderWidth: 3,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      },
      {
        label: 'Min Temperature (°C)',
        data: forecast.map(day => day.T2M_MIN),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.5,
        borderWidth: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  const rainfallData = {
    labels,
    datasets: [
      {
        label: 'Rainfall (mm)',
        data: forecast.map(day => day.PRECTOTCORR),
        backgroundColor: forecast.map(day => 
          day.PRECTOTCORR > 10 ? '#1d4ed8' : 
          day.PRECTOTCORR > 5 ? '#3b82f6' : 
          '#60a5fa'
        ),
        borderColor: '#1e40af',
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
        barPercentage: 0.8,
        categoryPercentage: 0.8
      }
    ]
  };

  const humidityData = {
    labels,
    datasets: [
      {
        label: 'Relative Humidity (%)',
        data: forecast.map(day => day.RH2M),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.5,
        borderWidth: 3,
        pointBackgroundColor: '#8b5cf6',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const enhancedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'top',
        labels: {
          color: '#334155',
          font: {
            size: 13,
            family: "'Inter', sans-serif"
          },
          padding: 20
        }
      },
      tooltip: { 
        mode: 'index', 
        intersect: false,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#0f172a',
        bodyColor: '#334155',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: {
          size: 12,
          family: "'Inter', sans-serif"
        },
        bodyFont: {
          size: 11,
          family: "'Inter', sans-serif"
        },
        boxPadding: 6
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(15, 23, 42, 0.08)',
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
            family: "'Inter', sans-serif"
          }
        }
      },
      y: { 
        beginAtZero: true,
        grid: {
          color: 'rgba(15, 23, 42, 0.08)',
          drawBorder: false
        },
        ticks: {
          color: '#64748b',
          font: {
            size: 11,
            family: "'Inter', sans-serif"
          },
          padding: 10
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index'
    }
  };

  const weatherStats = {
    avgTemp: (forecast.reduce((sum, day) => sum + day.T2M, 0) / forecast.length).toFixed(1),
    maxTemp: Math.max(...forecast.map(day => day.T2M_MAX)).toFixed(1),
    minTemp: Math.min(...forecast.map(day => day.T2M_MIN)).toFixed(1),
    totalRain: forecast.reduce((sum, day) => sum + day.PRECTOTCORR, 0).toFixed(1),
    avgHumidity: (forecast.reduce((sum, day) => sum + day.RH2M, 0) / forecast.length).toFixed(0),
    avgWind: (forecast.reduce((sum, day) => sum + day.WS2M, 0) / forecast.length).toFixed(1),
    totalGDD: forecast.reduce((sum, day) => sum + (day.DAILY_GDD || 0), 0).toFixed(1),
    dryDays: forecast.filter(day => day.PRECTOTCORR === 0).length,
    rainyDays: forecast.filter(day => day.PRECTOTCORR > 0).length,
    hotDays: forecast.filter(day => day.T2M_MAX >= 35).length
  };

  return (
    <div id="weather" style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #f7fbf8 0%, #eef6f0 100%)'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <button
            onClick={() => navigate('/prediction-results')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#22c55e',
              padding: '0.75rem 1.25rem',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              boxShadow: '0 6px 16px rgba(15, 23, 42, 0.08)'
            }}
          >
            ← Back to Results
          </button>
        </div>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          padding: '2rem',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #22c55e 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '1rem'
          }}>
            Weather Analysis Dashboard
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1.1rem',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Comprehensive weather insights and visualizations for intelligent farming decisions
          </p>
        </div>

        {/* Weather Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {[
            {
              title: 'Temperature Range',
              value: `${weatherStats.minTemp}°C - ${weatherStats.maxTemp}°C`,
              icon: <Thermometer size={28} />,
              color: '#ef4444',
              description: 'Daily temperature variation'
            },
            {
              title: 'Total Rainfall',
              value: `${weatherStats.totalRain} mm`,
              icon: <Droplets size={28} />,
              color: '#3b82f6',
              description: 'Accumulated precipitation'
            },
            {
              title: 'Average Humidity',
              value: `${weatherStats.avgHumidity}%`,
              icon: <Cloud size={28} />,
              color: '#8b5cf6',
              description: 'Relative humidity level'
            },
            {
              title: 'Growing Degree Days',
              value: `${weatherStats.totalGDD} GDD`,
              icon: <Activity size={28} />,
              color: '#22c55e',
              description: 'Crop growth potential'
            }
          ].map((stat, index) => (
            <div key={index} style={{
              background: '#ffffff',
              padding: '2rem',
              borderRadius: '16px',
              border: `1px solid ${stat.color}30`,
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-8px)';
              e.target.style.boxShadow = `0 20px 40px ${stat.color}20`;
              e.target.style.border = `2px solid ${stat.color}`;
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
              e.target.style.border = `1px solid ${stat.color}40`;
            }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{
                  background: `${stat.color}20`,
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: stat.color
                }}>
                  {stat.icon}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: stat.color }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>
                    {stat.title}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5' }}>
                {stat.description}
              </div>
            </div>
          ))}
        </div>

        {/* Main Charts Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          {/* Temperature Chart */}
          <div style={{
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            height: '520px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}>
                <Thermometer size={24} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: '#0f172a' 
                }}>
                  Temperature Analysis
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.9rem' 
                }}>
                  Daily minimum, average, and maximum temperatures
                </p>
              </div>
            </div>
            <div style={{ height: '380px' }}>
              <Line data={temperatureData} options={enhancedOptions} />
            </div>
          </div>

          {/* Rainfall Chart */}
          <div style={{
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            height: '520px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.2)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6'
              }}>
                <Droplets size={24} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  fontWeight: '600',
                  color: '#0f172a' 
                }}>
                  Rainfall Distribution
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.9rem' 
                }}>
                  Daily precipitation accumulation
                </p>
              </div>
            </div>
            <div style={{ height: '380px' }}>
              <Bar data={rainfallData} options={enhancedOptions} />
            </div>
          </div>
        </div>

        {/* Secondary Chart */}
        <div style={{
          background: '#ffffff',
          padding: '2rem',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          marginBottom: '3rem',
          height: '460px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem', 
            marginBottom: '1.5rem' 
          }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.2)',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8b5cf6'
            }}>
              <Cloud size={24} />
            </div>
            <div>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '600',
                color: '#0f172a' 
              }}>
                Humidity Trends
              </h3>
              <p style={{ 
                margin: '0.25rem 0 0 0', 
                color: '#64748b',
                fontSize: '0.9rem' 
              }}>
                Daily relative humidity patterns
              </p>
            </div>
          </div>
          <div style={{ height: '320px' }}>
            <Line data={humidityData} options={enhancedOptions} />
          </div>
        </div>

        {/* Weather Conditions Summary */}
        <div style={{
          background: '#f4fbf6',
          borderRadius: '20px',
          padding: '2rem',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)'
        }}>
          <h3 style={{ 
            color: '#22c55e', 
            marginBottom: '1.5rem', 
            fontSize: '1.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: '600'
          }}>
            <Activity size={28} />
            Weather Conditions Summary
          </h3>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            fontSize: '1rem'
          }}>
            <div style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Sun size={20} color="#ef4444" />
                <span style={{ color: '#ef4444', fontWeight: '600' }}>Hot Days (≥35°C):</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                {weatherStats.hotDays} days
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>
                Potential heat stress risk
              </div>
            </div>
            
            <div style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Droplets size={20} color="#3b82f6" />
                <span style={{ color: '#3b82f6', fontWeight: '600' }}>Rainy Days:</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                {weatherStats.rainyDays} days
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>
                Natural irrigation availability
              </div>
            </div>
            
            <div style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Wind size={20} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontWeight: '600' }}>Dry Days:</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {weatherStats.dryDays} days
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>
                Irrigation requirement days
              </div>
            </div>
            
            <div style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(22, 163, 74, 0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Activity size={20} color="#16a34a" />
                <span style={{ color: '#16a34a', fontWeight: '600' }}>Avg Wind Speed:</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>
                {weatherStats.avgWind} m/s
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.5rem' }}>
                Evaporation rate indicator
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}