// components/EnhancedIrrigationCalculator.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Droplets, Calendar, Clock, CloudRain, Cloud, 
  Thermometer, Wind, Sun, Activity, AlertCircle,
  TrendingUp, Shield, Zap, RefreshCw
} from 'lucide-react';
import './global.css';
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

export default function EnhancedIrrigationCalculator({ predictionData, city }) {
  const navigate = useNavigate();
  const [irrigationData, setIrrigationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [soilType, setSoilType] = useState('loamy');
  const [area, setArea] = useState(1);
  const [selectedCrop, setSelectedCrop] = useState('maize');
  const [irrigationSchedule, setIrrigationSchedule] = useState([]);

  const cropOptions = [
    { value: 'cotton', label: 'Cotton', icon: '🌱' },
    { value: 'wheat', label: 'Wheat', icon: '🌾' },
    { value: 'maize', label: 'Maize', icon: '🌽' },
    { value: 'rice', label: 'Rice', icon: '🍚' },
    { value: 'sugarcane', label: 'Sugarcane', icon: '🎋' }
  ];

  const soilTypes = [
    { value: 'sandy', label: 'Sandy Soil', color: '#f59e0b', desc: 'Fast drainage, needs frequent irrigation' },
    { value: 'loamy', label: 'Loamy Soil', color: '#10b981', desc: 'Ideal balance, moderate irrigation' },
    { value: 'clay', label: 'Clay Soil', color: '#8b5cf6', desc: 'Slow drainage, less frequent irrigation' },
    { value: 'silty', label: 'Silty Soil', color: '#0ea5e9', desc: 'Moderate drainage, regular irrigation' }
  ];

  // Memoized calculate function to prevent unnecessary recalculations
  const calculateIrrigation = useCallback(async (crop, soil, areaValue) => {
    if (!city || !crop) return;
    
    console.log('Calculating irrigation for:', { city, crop, soil, area: areaValue });
    
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/irrigation-calculation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          crop: crop || selectedCrop,
          soilType: soil || soilType,
          area_ha: areaValue || area,
          days: predictionData?.forecast?.length || 7
        })
      });
      
      const data = await response.json();
      if (data.success && data.irrigation_plan) {
        setIrrigationData(data.irrigation_plan);
        // Generate irrigation schedule from the new data
        generateIrrigationSchedule(data.irrigation_plan);
      } else {
        console.error('API returned error:', data);
        // Generate default schedule
        generateIrrigationSchedule(null);
      }
    } catch (error) {
      console.error('Irrigation calculation error:', error);
      // Generate default schedule on error
      generateIrrigationSchedule(null);
    } finally {
      setLoading(false);
    }
  }, [city, predictionData?.forecast?.length]);

  // Simplified generateIrrigationSchedule function
  const generateIrrigationSchedule = (data) => {
    const schedule = [];
    const today = new Date();
    const soilMoistureOffset = {
      sandy: -8,
      loamy: 0,
      clay: 6,
      silty: 3
    };
    let previousSoilMoisture = 70 + (soilMoistureOffset[soilType] || 0);
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // Use actual data if available, otherwise use defaults
      const baseWaterReq = Number(data?.current_daily_water_req_mm || 8);
      const baselineEt0 = Number(data?.et0 || 5);
      const rainfall = predictionData?.forecast?.[i]?.PRECTOTCORR || 0;
      const temp = predictionData?.forecast?.[i]?.T2M;
      const evapotranspiration = Number(
        (temp ? Math.max(2.5, Math.min(7, 0.18 * temp)) : baselineEt0).toFixed(2)
      );

      const waterRequirement = Number(
        Math.max(0, baseWaterReq + (evapotranspiration - baselineEt0) * 0.6 - rainfall * 0.35).toFixed(2)
      );

      const soilMoisture = Number(
        Math.max(
          40,
          Math.min(90, previousSoilMoisture + rainfall * 1.8 - waterRequirement * 0.9)
        ).toFixed(1)
      );
      previousSoilMoisture = soilMoisture;
      
      schedule.push({
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        waterRequirement,
        soilMoisture,
        evapotranspiration,
        rainfall: rainfall,
        irrigationNeeded: waterRequirement > rainfall + 1.5
      });
    }
    
    setIrrigationSchedule(schedule);
  };

  // Calculate irrigation when city changes or component mounts
  useEffect(() => {
    if (city) {
      calculateIrrigation(selectedCrop, soilType, area);
    }
  }, [city]);

  // Handler for crop change - simplified without timeout
  const handleCropChange = (crop) => {
    setSelectedCrop(crop);
    calculateIrrigation(crop, soilType, area);
  };

  // Handler for soil type change
  const handleSoilTypeChange = (soil) => {
    setSoilType(soil);
    calculateIrrigation(selectedCrop, soil, area);
  };

  // Handler for area change with debounce
  const handleAreaChange = (newArea) => {
    setArea(newArea);
    calculateIrrigation(selectedCrop, soilType, newArea);
  };

  // Chart data for irrigation schedule
  const scheduleChartData = {
    labels: irrigationSchedule.map(day => day.date.split(' ')[0]),
    datasets: [
      {
        label: 'Water Requirement (mm/day)',
        data: irrigationSchedule.map(day => day.waterRequirement),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2
      },
      {
        label: 'Soil Moisture (%)',
        data: irrigationSchedule.map(day => day.soilMoisture),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        yAxisID: 'y1'
      },
      {
        label: 'Rainfall (mm)',
        data: irrigationSchedule.map(day => day.rainfall),
        borderColor: '#0ea5e9',
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 2
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: { 
        labels: {
          color: '#334155',
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          }
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
        cornerRadius: 8
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
        type: 'linear',
        display: true,
        position: 'left',
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
          }
        },
        title: {
          display: true,
          text: 'Water (mm)',
          color: '#94a3b8'
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        max: 100,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          color: '#64748b',
        },
        title: {
          display: true,
          text: 'Moisture (%)',
          color: '#94a3b8'
        }
      }
    }
  };

  if (loading) {
    return (
      <div id="irrigation" style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f7fbf8 0%, #eef6f0 100%)',
        padding: '2rem'
      }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(14, 165, 233, 0.3)',
            borderTopColor: '#0ea5e9',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p>Calculating irrigation schedule for {selectedCrop}...</p>
        </div>
      </div>
    );
  }

  if (!irrigationData) {
    return (
      <div id="irrigation" style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(14, 165, 233, 0.3)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          maxWidth: '600px'
        }}>
          <Droplets size={64} color="#0ea5e9" style={{ marginBottom: '1.5rem', opacity: 0.7 }} />
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#0f172a',
            marginBottom: '1rem'
          }}>
            Smart Irrigation Calculator
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '2rem' }}>
            Select a city and crop to calculate optimal irrigation schedule
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="irrigation" style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #f7fbf8 0%, #eef6f0 100%)'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
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
          border: '1px solid rgba(14, 165, 233, 0.3)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
        }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '1rem'
          }}>
            Smart Irrigation Management
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1.1rem',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Optimizing water usage for {selectedCrop} in {city}
          </p>
        </div>

        {/* Controls */}
        <div style={{
          background: '#ffffff',
          padding: '1.5rem',
          borderRadius: '16px',
          border: '1px solid rgba(14, 165, 233, 0.2)',
          marginBottom: '2rem',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            alignItems: 'end'
          }}>
            {/* Crop Selection */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.75rem'
              }}>
                Select Crop
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {cropOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleCropChange(option.value)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '10px',
                      border: `2px solid ${selectedCrop === option.value ? '#0ea5e9' : '#e2e8f0'}`,
                      background: selectedCrop === option.value 
                        ? 'rgba(14, 165, 233, 0.12)' 
                        : '#ffffff',
                      color: selectedCrop === option.value ? '#0ea5e9' : '#334155',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      flex: '1',
                      minWidth: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Soil Type Selection - Enhanced visual buttons */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.75rem'
              }}>
                Soil Type
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem' 
              }}>
                {soilTypes.map(soil => (
                  <button
                    key={soil.value}
                    onClick={() => handleSoilTypeChange(soil.value)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      border: `2px solid ${soilType === soil.value ? soil.color : '#e2e8f0'}`,
                      background: soilType === soil.value 
                        ? `${soil.color}12`
                        : '#ffffff',
                      color: soilType === soil.value ? soil.color : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      textAlign: 'center',
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      marginBottom: '0.25rem' 
                    }}>
                      <div style={{ 
                        width: '14px', 
                        height: '14px', 
                        borderRadius: '50%', 
                        backgroundColor: soil.color,
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                      }}></div>
                      <span style={{ fontWeight: '600' }}>{soil.label.split(' ')[0]}</span>
                    </div>
                    <div style={{ 
                      fontSize: '0.75rem', 
                      opacity: 0.8,
                      lineHeight: '1.2',
                      color: '#64748b'
                    }}>
                      {soil.desc.split(',')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Area Input YEAH*/}
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#64748b',
                marginBottom: '0.75rem'
              }}>
                Area (hectares)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={area}
                  onChange={(e) => handleAreaChange(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: '#e2e8f0',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  background: 'rgba(14, 165, 233, 0.12)',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  minWidth: '100px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0ea5e9' }}>
                    {area}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>hectares</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          {[
            {
              title: 'Irrigation Depth',
              value: `${irrigationData.irrigation_depth_mm || 25} mm`,
              icon: <Droplets size={24} />,
              color: '#0ea5e9',
              description: 'Water depth per irrigation'
            },
            {
              title: 'Next Irrigation',
              value: `${irrigationData.days_until_next_irrigation || 7} days`,
              icon: <Calendar size={24} />,
              color: '#10b981',
              description: 'Days until next watering'
            },
            {
              title: 'Water Volume',
              value: `${irrigationData.irrigation_volume_m3 || 250} m³`,
              icon: <TrendingUp size={24} />,
              color: '#f59e0b',
              description: 'Total water required'
            },
            {
              title: 'Irrigation Interval',
              value: `${irrigationData.irrigation_interval_days || 7} days`,
              icon: <Clock size={24} />,
              color: '#8b5cf6',
              description: 'Days between irrigation'
            }
          ].map((metric, index) => (
            <div key={index} style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '14px',
              border: `1px solid ${metric.color}40`,
              boxShadow: '0 8px 20px rgba(15, 23, 42, 0.06)',
              transition: 'all 0.2s ease',
              cursor: 'default'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{
                  background: `${metric.color}20`,
                  width: '50px',
                  height: '50px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: metric.color
                }}>
                  {metric.icon}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: metric.color }}>
                    {metric.value}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>
                    {metric.title}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4' }}>
                {metric.description}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {/* Irrigation Schedule Chart */}
          <div style={{
            background: '#ffffff',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
            height: '520px'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1rem' 
            }}>
              <div style={{
                background: 'rgba(59, 130, 246, 0.2)',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6'
              }}>
                <Activity size={20} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.25rem', 
                  fontWeight: '600',
                  color: '#0f172a' 
                }}>
                  Irrigation Schedule
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.85rem' 
                }}>
                  7-day forecast for {selectedCrop}
                </p>
              </div>
            </div>
            <div style={{ height: '360px' }}>
              <Line data={scheduleChartData} options={chartOptions} />
            </div>
          </div>

          {/* Irrigation Method & Next Schedule */}
          <div style={{
            background: '#ffffff',
            padding: '1.5rem',
            borderRadius: '16px',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{
                background: 'rgba(14, 165, 233, 0.2)',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0ea5e9'
              }}>
                <Calendar size={20} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: '1.25rem', 
                  fontWeight: '600',
                  color: '#0f172a' 
                }}>
                  Next Irrigation
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.85rem' 
                }}>
                  Recommended timing and method
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(14, 165, 233, 0.1)',
              padding: '1rem',
              borderRadius: '10px',
              border: '1px solid rgba(14, 165, 233, 0.3)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: '#0ea5e9',
                marginBottom: '0.5rem'
              }}>
                {new Date(irrigationData.next_irrigation_date || Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                color: '#64748b',
                fontSize: '0.85rem'
              }}>
                <Clock size={14} />
                <span>in {irrigationData.days_until_next_irrigation || 7} days</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ 
                color: '#0f172a', 
                marginBottom: '0.75rem', 
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <Zap size={18} color="#f59e0b" />
                Recommended Method
              </h4>
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: '#f59e0b',
                  marginBottom: '0.25rem'
                }}>
                  {(irrigationData.irrigation_method?.recommended || 'Sprinkler Irrigation').split(' ')[0]}
                </div>
                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                  Efficiency: <strong style={{ color: '#10b981' }}>
                    {irrigationData.irrigation_method?.efficiency || 85}%
                  </strong>
                </div>
              </div>
            </div>

            <div>
              <h4 style={{ 
                color: '#0f172a', 
                marginBottom: '0.75rem', 
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CloudRain size={18} color="#3b82f6" />
                Daily Water Requirement
              </h4>
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: '2rem', 
                  fontWeight: 'bold', 
                  color: '#3b82f6'
                }}>
                  {irrigationData.current_daily_water_req_mm || 8.5} mm/day
                </div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  per hectare
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Water Saving Tips - Simplified */}
        {irrigationData.water_savings_tips && irrigationData.water_savings_tips.length > 0 && (
          <div style={{
            background: 'rgba(14, 165, 233, 0.08)',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
            marginBottom: '2rem'
          }}>
            <h3 style={{ 
              color: '#0ea5e9', 
              marginBottom: '1rem', 
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: '600'
            }}>
              <Shield size={24} />
              Water Conservation Tips
            </h3>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1rem'
            }}>
              {irrigationData.water_savings_tips.slice(0, 4).map((tip, i) => (
                <div key={i} style={{
                  background: '#ffffff',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(14, 165, 233, 0.3)',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  color: '#475569'
                }}>
                  <strong style={{ color: '#0ea5e9' }}>Tip {i + 1}:</strong> {tip}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Environmental Conditions - Simplified */}
        {predictionData?.forecast && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '1.5rem',
            border: '1px solid rgba(14, 165, 233, 0.2)',
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)'
          }}>
            <h3 style={{ 
              color: '#0f172a', 
              marginBottom: '1rem', 
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontWeight: '600'
            }}>
              <Cloud size={24} color="#0ea5e9" />
              Weather Conditions
            </h3>
            
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              fontSize: '0.9rem'
            }}>
              <div style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ color: '#ef4444', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Avg Temperature
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>
                  {(predictionData.forecast.reduce((sum, day) => sum + (day.T2M || day.temperature || 28), 0) / predictionData.forecast.length).toFixed(1)}°C
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ color: '#3b82f6', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Total Rainfall
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  {(predictionData.forecast.reduce((sum, day) => sum + (day.PRECTOTCORR || day.precipitation || 0), 0)).toFixed(1)} mm
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ color: '#f59e0b', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Wind Speed
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {(predictionData.forecast.reduce((sum, day) => sum + (day.WS2M || day.wind_speed || 3), 0) / predictionData.forecast.length).toFixed(1)} m/s
                </div>
              </div>
              
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ color: '#16a34a', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Evaporation
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#16a34a' }}>
                  {(irrigationData.et0 || 5.0).toFixed(1)} mm/day
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}