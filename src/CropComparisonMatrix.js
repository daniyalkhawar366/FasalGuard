// components/EnhancedCropComparison.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Droplets, AlertTriangle, CheckCircle, Filter, Leaf, Clock } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale, // ADD THIS
  PointElement,      // ADD THIS
  LineElement,       // ADD THIS
  Filler             // ADD THIS (optional for fill effects)
} from 'chart.js';
import { Bar, Radar } from 'react-chartjs-2';

// REGISTER ALL REQUIRED COMPONENTS
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale, // Register radar scale
  PointElement,      // Register points for radar
  LineElement,       // Register lines for radar
  Filler             // Register fill for radar
);

export default function EnhancedCropComparison({ predictionData, city }) {
  const navigate = useNavigate();
  const [comparisonData, setComparisonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [selectedCrops, setSelectedCrops] = useState(['cotton', 'wheat', 'maize', 'rice', 'sugarcane']);
  const [chartKey, setChartKey] = useState(Date.now()); // ADD THIS for chart refresh

  const fetchComparisonData = async () => {
    if (!city) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/crop-comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          days: predictionData?.forecast?.length || 7
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setComparisonData(data.comparison_matrix);
        setChartKey(Date.now()); // Update key when data changes
      }
    } catch (error) {
      console.error('Comparison data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (city) {
      fetchComparisonData();
    }
  }, [city, predictionData]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
      }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(34, 197, 94, 0.3)',
            borderTopColor: '#22c55e',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p>Loading comparison matrix...</p>
        </div>
      </div>
    );
  }

  if (!comparisonData) return null;

  const sortedData = [...comparisonData].sort((a, b) => {
    switch (sortBy) {
      case 'yield': return b.predicted_yield - a.predicted_yield;
      case 'roi': return b.roi - a.roi;
      case 'water': return b.water_efficiency === 'Excellent' ? 1 : -1;
      case 'duration': return a.growth_duration - b.growth_duration;
      default: return b.normalized_score - a.normalized_score;
    }
  }).filter(crop => selectedCrops.includes(crop.cropKey));

  const enhancedOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        labels: {
          color: '#334155',
          font: {
            size: 13,
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
        cornerRadius: 8,
        padding: 12
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
          }
        }
      }
    }
  };

  const getScoreColor = (score) => {
    if (score >= 85) return '#10b981';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
  };

  const getEfficiencyColor = (efficiency) => {
    switch (efficiency) {
      case 'Excellent': return '#10b981';
      case 'Good': return '#f59e0b';
      case 'Moderate': return '#ef4444';
      default: return '#94a3b8';
    }
  };

  // Prepare data for radar chart
  const radarData = {
    labels: sortedData.slice(0, 5).map(crop => crop.crop),
    datasets: [
      {
        label: 'Composite Score',
        data: sortedData.slice(0, 5).map(crop => crop.normalized_score),
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: '#22c55e',
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#22c55e',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      },
      {
        label: 'Water Efficiency',
        data: sortedData.slice(0, 5).map(crop => {
          const eff = crop.water_efficiency;
          if (eff === 'Excellent') return 100;
          if (eff === 'Good') return 80;
          if (eff === 'Moderate') return 60;
          return 40;
        }),
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6',
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2
      }
    ]
  };

  // Radar chart options
  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        labels: {
          color: '#334155',
          font: {
            size: 12
          }
        }
      },
      tooltip: { 
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#0f172a',
        bodyColor: '#334155',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      }
    },
    scales: {
      r: {
        angleLines: {
          color: 'rgba(15, 23, 42, 0.08)'
        },
        grid: {
          color: 'rgba(15, 23, 42, 0.08)'
        },
        pointLabels: {
          color: '#64748b',
          font: {
            size: 11,
            family: "'Inter', sans-serif"
          }
        },
        ticks: {
          color: '#64748b',
          backdropColor: 'transparent',
          showLabelBackdrop: false
        },
        beginAtZero: true,
        min: 0,
        max: 100
      }
    },
    elements: {
      line: {
        tension: 0.3
      }
    }
  };

  return (
    <div id="comparison" style={{
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
          border: '1px solid rgba(34, 197, 94, 0.2)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '700',
            color: '#0f172a',
            marginBottom: '1rem'
          }}>
            Crop Comparison Dashboard
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1.1rem',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Compare crop performance based on yield, water efficiency, and growing conditions
          </p>
        </div>

        {/* Top Crops Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2.5rem'
        }}>
          {sortedData.slice(0, 5).map((crop, index) => (
            <div key={crop.cropKey} style={{
              background: '#ffffff',
              padding: '1.5rem',
              borderRadius: '18px',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              position: 'relative',
              boxShadow: '0 10px 22px rgba(15, 23, 42, 0.08)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-10px)';
              e.target.style.boxShadow = '0 25px 50px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            >
              {/* Rank Badge */}
              <div style={{
                position: 'absolute',
                top: '-15px',
                right: '20px',
                background: index === 0 ? '#f59e0b' : index === 1 ? '#94a3b8' : index === 2 ? '#d97706' : '#1e293b',
                color: 'white',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '1.2rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}>
                #{index + 1}
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.75rem', 
                marginBottom: '1.25rem' 
              }}>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22c55e'
                }}>
                  <Leaf size={26} />
                </div>
                <div>
                  <h3 style={{ 
                    margin: 0,
                    color: '#0f172a',
                    fontSize: '1.25rem',
                    fontWeight: '700'
                  }}>
                    {crop.crop}
                  </h3>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: '#64748b',
                    marginTop: '0.25rem' 
                  }}>
                    {crop.cropKey} • Score: <span style={{ 
                      color: getScoreColor(crop.normalized_score),
                      fontWeight: 'bold' 
                    }}>{Math.round(crop.normalized_score)}%</span>
                  </div>
                </div>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '1.25rem',
                fontSize: '0.95rem'
              }}>
                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    <TrendingUp size={18} color="#22c55e" />
                    <span style={{ color: '#64748b' }}>Yield</span>
                  </div>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: '#22c55e' 
                  }}>
                    {crop.predicted_yield?.toFixed(1) || 'N/A'} t/ha
                  </div>
                </div>

                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    <Clock size={18} color="#3b82f6" />
                    <span style={{ color: '#64748b' }}>Duration</span>
                  </div>
                  <div style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: 'bold', 
                    color: '#3b82f6' 
                  }}>
                    {crop.growth_duration} days
                  </div>
                </div>

                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    <Droplets size={18} color="#0ea5e9" />
                    <span style={{ color: '#64748b' }}>Water Eff.</span>
                  </div>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold', 
                    color: getEfficiencyColor(crop.water_efficiency)
                  }}>
                    {crop.water_efficiency}
                  </div>
                </div>

                <div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    marginBottom: '0.5rem' 
                  }}>
                    <AlertTriangle size={18} color="#ef4444" />
                    <span style={{ color: '#64748b' }}>Risk Level</span>
                  </div>
                  <div style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold', 
                    color: crop.composite_score >= 70 ? '#10b981' :
                           crop.composite_score >= 50 ? '#f59e0b' : '#ef4444'
                  }}>
                    {crop.composite_score >= 70 ? 'Low' : 
                     crop.composite_score >= 50 ? 'Medium' : 'High'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="resp-grid-2" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '2rem',
          marginBottom: '3rem',
          height: '650px'
        }}>
          {/* Yield Comparison Chart */}
          <div style={{
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '20px',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{
                background: 'rgba(34, 197, 94, 0.2)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#22c55e'
              }}>
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '1.3rem',
                  fontWeight: '600'
                }}>
                  Yield Comparison (tons/ha)
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.9rem' 
                }}>
                  Predicted yield for each crop
                </p>
              </div>
            </div>
            <div style={{ height: '400px' }}>
              <Bar
                key={`bar-${chartKey}`}
                data={{
                  labels: sortedData.map(crop => crop.crop),
                  datasets: [{
                    label: 'Yield (tons/ha)',
                    data: sortedData.map(crop => crop.predicted_yield || 0),
                    backgroundColor: sortedData.map((_, i) => 
                      i === 0 ? '#22c55e' : 
                      i === 1 ? '#3b82f6' : 
                      i === 2 ? '#f59e0b' : 
                      '#8b5cf6'
                    ),
                    borderRadius: 8,
                    borderSkipped: false
                  }]
                }}
                options={enhancedOptions}
              />
            </div>
          </div>

          {/* Radar Chart */}
          <div style={{
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '20px',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
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
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0,
                  color: '#0f172a',
                  fontSize: '1.3rem',
                  fontWeight: '600'
                }}>
                  Performance Radar
                </h3>
                <p style={{ 
                  margin: '0.25rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.9rem' 
                }}>
                  Composite score vs water efficiency
                </p>
              </div>
            </div>
            <div style={{ height: '416px' }}>
              <Radar
                key={`radar-${chartKey}`} // ADD KEY for proper refresh
                data={radarData}
                options={radarOptions}
              />
            </div>
          </div>
        </div>

        {/* Detailed Comparison Table */}
        <div style={{
          background: '#ffffff',
          padding: '2rem',
          borderRadius: '20px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          marginBottom: '3rem',
          overflowX: 'auto'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '2rem'
          }}>
            <div>
              <h3 style={{ 
                margin: 0, 
                fontSize: '1.8rem', 
                fontWeight: 'bold',
                color: '#0f172a' 
              }}>
                Detailed Comparison Table
              </h3>
              <p style={{ 
                margin: '0.5rem 0 0 0', 
                color: '#64748b',
                fontSize: '0.9rem' 
              }}>
                Complete breakdown of all crop metrics and scores
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Filter size={18} color="#64748b" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  minWidth: '160px',
                  backdropFilter: 'blur(10px)',
                  cursor: 'pointer'
                }}
              >
                <option value="score">Sort by Score</option>
                <option value="yield">Sort by Yield</option>
                <option value="roi">Sort by ROI</option>
                <option value="water">Sort by Water Efficiency</option>
                <option value="duration">Sort by Duration</option>
              </select>
            </div>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              fontSize: '0.95rem',
              minWidth: '1200px'
            }}>
              <thead>
                <tr style={{ 
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderBottom: '2px solid rgba(34, 197, 94, 0.3)'
                }}>
                  {[
                    'Rank', 'Crop', 'Yield (t/ha)', 'Score', 'Water Efficiency',
                    'Growth Duration', 'Risk Level', 'ROI', 'ML Confidence'
                  ].map((header, index) => (
                    <th key={index} style={{ 
                      padding: '1.25rem', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      color: '#334155',
                      fontSize: '0.95rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((crop, index) => (
                  <tr key={crop.cropKey} style={{ 
                    borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
                    background: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(34, 197, 94, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = index % 2 === 0 ? '#ffffff' : '#f8fafc';
                  }}
                  >
                    <td style={{ 
                      padding: '1.25rem',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      color: '#0f172a'
                    }}>
                      #{index + 1}
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      fontWeight: '600',
                      color: '#0f172a',
                      fontSize: '1.1rem'
                    }}>
                      {crop.crop}
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      color: '#22c55e'
                    }}>
                      {crop.predicted_yield?.toFixed(1) || 'N/A'}
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: getScoreColor(crop.normalized_score)
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '8px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${crop.normalized_score}%`,
                            height: '100%',
                            background: getScoreColor(crop.normalized_score),
                            borderRadius: '4px'
                          }}></div>
                        </div>
                        <span>{Math.round(crop.normalized_score)}%</span>
                      </div>
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        background: `${getEfficiencyColor(crop.water_efficiency)}20`,
                        color: getEfficiencyColor(crop.water_efficiency),
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        <Droplets size={14} />
                        {crop.water_efficiency}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left',
                      color: '#64748b',
                      fontWeight: '600'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={14} />
                        {crop.growth_duration} days
                      </div>
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left'
                    }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        background: crop.composite_score >= 70 ? 'rgba(16, 185, 129, 0.2)' :
                                  crop.composite_score >= 50 ? 'rgba(245, 158, 11, 0.2)' :
                                  'rgba(239, 68, 68, 0.2)',
                        color: crop.composite_score >= 70 ? '#10b981' :
                               crop.composite_score >= 50 ? '#f59e0b' : '#ef4444',
                        fontSize: '0.85rem',
                        fontWeight: '600'
                      }}>
                        <AlertTriangle size={14} />
                        {crop.composite_score >= 70 ? 'Low' : 
                         crop.composite_score >= 50 ? 'Medium' : 'High'}
                      </span>
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      color: crop.roi >= 50 ? '#10b981' : '#f59e0b'
                    }}>
                      {crop.roi?.toFixed(1) || '0'}%
                    </td>
                    <td style={{ 
                      padding: '1.25rem',
                      textAlign: 'left',
                      fontWeight: '600'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{
                          width: '80px',
                          height: '8px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${crop.ml_confidence * 100}%`,
                            height: '100%',
                            background: crop.ml_confidence >= 0.8 ? '#10b981' :
                                      crop.ml_confidence >= 0.6 ? '#f59e0b' : '#ef4444',
                            borderRadius: '4px'
                          }}></div>
                        </div>
                        <span style={{
                          color: crop.ml_confidence >= 0.8 ? '#10b981' :
                                 crop.ml_confidence >= 0.6 ? '#f59e0b' : '#ef4444'
                        }}>
                          {Math.round(crop.ml_confidence * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights Section */}
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '20px',
          padding: '2.5rem',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          backdropFilter: 'blur(10px)'
        }}>
          <h3 style={{ 
            color: '#22c55e', 
            marginBottom: '2rem', 
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontWeight: 'bold'
          }}>
            <CheckCircle size={32} />
            Key Insights & Recommendations
          </h3>
          
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {sortedData[0] && (
              <div style={{ 
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1.5rem',
                borderRadius: '15px',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-5px)';
                e.target.style.boxShadow = '0 10px 30px rgba(34, 197, 94, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div style={{
                    background: '#22c55e',
                    color: 'white',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem'
                  }}>
                    1
                  </div>
                  <h4 style={{ 
                    margin: 0, 
                    fontSize: '1.3rem', 
                    fontWeight: '600',
                    color: '#22c55e' 
                  }}>
                    Top Recommendation
                  </h4>
                </div>
                <p style={{ 
                  color: '#475569', 
                  fontSize: '1rem', 
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: '#0f172a' }}>{sortedData[0].crop}</strong> is the best overall choice with a 
                  score of <strong style={{ color: '#22c55e' }}>{Math.round(sortedData[0].normalized_score)}%</strong>. 
                  It offers excellent yield potential of <strong>{sortedData[0].predicted_yield?.toFixed(1)} tons/ha</strong> 
                  with <strong>{sortedData[0].water_efficiency}</strong> water efficiency.
                </p>
                <div style={{ 
                  background: 'rgba(34, 197, 94, 0.2)', 
                  padding: '0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#22c55e',
                  fontWeight: '500'
                }}>
                  💡 Recommendation: Ideal for maximizing production with available resources
                </div>
              </div>
            )}
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1.5rem',
              borderRadius: '15px',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.boxShadow = '0 10px 30px rgba(245, 158, 11, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  background: '#f59e0b',
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  2
                </div>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: '1.3rem', 
                  fontWeight: '600',
                  color: '#f59e0b' 
                }}>
                  Water Efficient Choice
                </h4>
              </div>
              {sortedData.find(c => c.water_efficiency === 'Excellent') ? (
                <p style={{ 
                  color: '#475569', 
                  fontSize: '1rem', 
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: '#0f172a' }}>{sortedData.find(c => c.water_efficiency === 'Excellent')?.crop}</strong> 
                  offers <strong style={{ color: '#10b981' }}>Excellent</strong> water efficiency, making it ideal for 
                  regions with limited water resources or drought conditions.
                </p>
              ) : (
                <p style={{ 
                  color: '#475569', 
                  fontSize: '1rem', 
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }}>
                  <strong style={{ color: '#0f172a' }}>{sortedData.find(c => c.water_efficiency === 'Good')?.crop || sortedData[1]?.crop}</strong> 
                  offers good water efficiency with balanced yield performance.
                </p>
              )}
              <div style={{ 
                background: 'rgba(245, 158, 11, 0.2)', 
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#f59e0b',
                fontWeight: '500'
              }}>
                💧 Best for water conservation and sustainable farming
              </div>
            </div>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1.5rem',
              borderRadius: '15px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-5px)';
              e.target.style.boxShadow = '0 10px 30px rgba(59, 130, 246, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  background: '#3b82f6',
                  color: 'white',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem'
                }}>
                  3
                </div>
                <h4 style={{ 
                  margin: 0, 
                  fontSize: '1.3rem', 
                  fontWeight: '600',
                  color: '#3b82f6' 
                }}>
                  Quick Turnaround
                </h4>
              </div>
              {(() => {
                const quickCrop = [...sortedData].sort((a, b) => a.growth_duration - b.growth_duration)[0];
                return (
                  <p style={{ 
                    color: '#475569', 
                    fontSize: '1rem', 
                    lineHeight: '1.6',
                    marginBottom: '1rem'
                  }}>
                    <strong style={{ color: '#0f172a' }}>{quickCrop?.crop}</strong> has the shortest growing period 
                    of <strong style={{ color: '#3b82f6' }}>{quickCrop?.growth_duration} days</strong>, allowing for 
                    quicker harvests and potential multiple cropping cycles per year.
                  </p>
                );
              })()}
              <div style={{ 
                background: 'rgba(59, 130, 246, 0.2)', 
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#3b82f6',
                fontWeight: '500'
              }}>
                ⏱️ Ideal for farmers wanting faster returns or multiple harvests
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}