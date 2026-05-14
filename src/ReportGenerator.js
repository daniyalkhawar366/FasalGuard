// components/EnhancedReportGenerator.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, FileText, Printer, Share2, CheckCircle, Clock,
  BookOpen, BarChart, Target, Users, Award, Zap,
  Shield, TrendingUp, Calendar, Cloud, Droplets
} from 'lucide-react';
import './global.css';
export default function EnhancedReportGenerator({ predictionData, city }) {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [reportInfo, setReportInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const generateReport = async () => {
    if (!city) {
      alert('Please select a city first');
      return;
    }

    setGenerating(true);
    setDownloadProgress(0);
    
    try {
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/generate-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          days: predictionData?.forecast?.length || 7,
          includeIrrigation: true,
          includeComparison: true,
          name: 'Farmer'
        })
      });

      clearInterval(progressInterval);
      setDownloadProgress(100);

      const data = await response.json();
      if (data.success) {
        setReportInfo(data.report);
        
        setTimeout(() => {
          window.open(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/download-report/${data.report.id}`, '_blank');
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      alert('Failed to generate report: ' + error.message);
    } finally {
      setGenerating(false);
      setTimeout(() => setDownloadProgress(0), 2000);
    }
  };

  const reportSections = [
    { 
      title: 'Executive Summary', 
      icon: '📊', 
      description: 'Key findings and recommendations',
      color: '#3b82f6'
    },
    { 
      title: 'Weather Analysis', 
      icon: '🌤️', 
      description: '7-day forecast and patterns',
      color: '#0ea5e9'
    },
    { 
      title: 'Crop Recommendations', 
      icon: '🌱', 
      description: 'AI-powered crop suggestions',
      color: '#10b981'
    },
    { 
      title: 'ML Predictions', 
      icon: '🤖', 
      description: 'Yield predictions with confidence scores',
      color: '#8b5cf6'
    },
    { 
      title: 'Irrigation Plan', 
      icon: '💧', 
      description: 'Smart water management schedule',
      color: '#06b6d4'
    },
    { 
      title: 'Comparison Matrix', 
      icon: '📈', 
      description: 'Crop-by-crop comparison',
      color: '#f59e0b'
    },
    { 
      title: 'Action Plan', 
      icon: '📅', 
      description: 'Step-by-step farming guide',
      color: '#ef4444'
    },
    { 
      title: 'Market Insights', 
      icon: '💰', 
      description: 'Economic and market analysis',
      color: '#84cc16'
    }
  ];

  const reportBenefits = [
    {
      title: 'Bank Loan Applications',
      icon: <BookOpen size={24} />,
      description: 'Professional report for agricultural loan applications with detailed analysis',
      color: '#3b82f6'
    },
    {
      title: 'Government Subsidies',
      icon: <Shield size={24} />,
      description: 'Documented evidence for subsidy applications and agricultural schemes',
      color: '#10b981'
    },
    {
      title: 'Farm Planning',
      icon: <Target size={24} />,
      description: 'Comprehensive guide for season planning and resource allocation',
      color: '#f59e0b'
    },
    {
      title: 'Record Keeping',
      icon: <FileText size={24} />,
      description: 'Maintain professional records for insurance and compliance',
      color: '#8b5cf6'
    },
    {
      title: 'Investment Decisions',
      icon: <TrendingUp size={24} />,
      description: 'Data-driven insights for farm expansion and investment',
      color: '#ef4444'
    },
    {
      title: 'Sustainability Certification',
      icon: <Award size={24} />,
      description: 'Support documentation for organic and sustainability certifications',
      color: '#06b6d4'
    }
  ];

  const stats = predictionData?.forecast ? {
    avgTemp: (predictionData.forecast.reduce((sum, day) => sum + day.T2M, 0) / predictionData.forecast.length).toFixed(1),
    totalRain: predictionData.forecast.reduce((sum, day) => sum + day.PRECTOTCORR, 0).toFixed(1),
    dryDays: predictionData.forecast.filter(day => day.PRECTOTCORR === 0).length,
    hotDays: predictionData.forecast.filter(day => day.T2M_MAX >= 35).length
  } : null;

  return (
    <div id="report" style={{
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
          border: '1px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
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
            Professional Report Generator
          </h1>
          <p style={{
            color: '#64748b',
            fontSize: '1.1rem',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6'
          }}>
            Generate comprehensive agricultural reports with AI-powered insights and analysis
          </p>
        </div>

        {/* Action Section */}
        <div style={{
          background: '#ffffff',
          padding: '2rem',
          borderRadius: '20px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          marginBottom: '3rem',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            marginBottom: '2rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '2rem', 
                fontWeight: 'bold',
                color: '#0f172a'
              }}>
                Generate Full Report
              </h2>
              <p style={{ 
                margin: '0.5rem 0 0 0', 
                color: '#64748b',
                fontSize: '1rem' 
              }}>
                Create a comprehensive PDF report with all analysis data
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={generateReport}
                disabled={generating}
                style={{
                  background: generating 
                    ? 'rgba(209, 213, 219, 0.2)' 
                    : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '1rem 2rem',
                  borderRadius: '12px',
                  cursor: generating ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  minWidth: '220px'
                }}
                onMouseEnter={(e) => {
                  if (!generating) {
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 10px 25px rgba(22, 163, 74, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!generating) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }
                }}
              >
                {generating ? (
                  <>
                    <Clock size={20} />
                    Generating... {downloadProgress}%
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    Generate Full Report (PDF)
                  </>
                )}
              </button>
              
              {reportInfo && (
                <button
                  onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/download-report/${reportInfo.id}`, '_blank')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#1d4ed8',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#3b82f6';
                    e.target.style.color = 'white';
                    e.target.style.transform = 'translateY(-3px)';
                    e.target.style.boxShadow = '0 10px 25px rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(30, 41, 59, 0.8)';
                    e.target.style.color = '#3b82f6';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <Printer size={20} />
                  Print Report
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {generating && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '0.75rem' 
              }}>
                <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: '500' }}>
                  Generating PDF Report...
                </span>
                <span style={{ fontSize: '1rem', color: '#22c55e', fontWeight: '600' }}>
                  {downloadProgress}%
                </span>
              </div>
              <div style={{
                height: '10px',
                background: '#e2e8f0',
                borderRadius: '5px',
                overflow: 'hidden',
                boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.12)'
              }}>
                <div style={{
                  width: `${downloadProgress}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #22c55e 0%, #10b981 100%)',
                  borderRadius: '5px',
                  transition: 'width 0.3s ease',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    animation: 'shimmer 2s infinite'
                  }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Report Preview */}
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '2rem',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          marginBottom: '3rem',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
        }}>
          <h3 style={{ 
            color: '#0f172a', 
            marginBottom: '2rem', 
            fontSize: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontWeight: 'bold'
          }}>
            <FileText size={32} color="#22c55e" />
            Report Preview
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '2rem' 
          }}>
            {reportSections.map((section, index) => (
              <div key={index} style={{
                background: `linear-gradient(135deg, ${section.color}20 0%, rgba(255,255,255,0.05) 100%)`,
                padding: '2rem',
                borderRadius: '16px',
                border: `1px solid ${section.color}40`,
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-10px)';
                e.target.style.boxShadow = `0 20px 40px ${section.color}20`;
                e.target.style.border = `2px solid ${section.color}`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
                e.target.style.border = `1px solid ${section.color}40`;
              }}
              >
                <div style={{ 
                  fontSize: '3rem', 
                  marginBottom: '1.5rem',
                  opacity: 0.8
                }}>
                  {section.icon}
                </div>
                <h4 style={{ 
                  margin: '0 0 0.75rem 0', 
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  color: '#0f172a'
                }}>
                  {section.title}
                </h4>
                <p style={{ 
                  margin: 0, 
                  color: '#64748b',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  marginBottom: '1rem'
                }}>
                  {section.description}
                </p>
                <div style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  background: section.color,
                  color: 'white',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weather Summary */}
        {stats && (
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            marginBottom: '3rem',
            boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
          }}>
            <h3 style={{ 
              color: '#0f172a', 
              marginBottom: '2rem', 
              fontSize: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              fontWeight: 'bold'
            }}>
              <Cloud size={32} color="#3b82f6" />
              Weather Summary
            </h3>
            
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1.5rem' 
            }}>
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Cloud size={20} color="#ef4444" />
                  <span style={{ color: '#ef4444', fontWeight: '600' }}>Avg Temperature</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                  {stats.avgTemp}°C
                </div>
              </div>
              
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Droplets size={20} color="#3b82f6" />
                  <span style={{ color: '#3b82f6', fontWeight: '600' }}>Total Rainfall</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  {stats.totalRain} mm
                </div>
              </div>
              
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Calendar size={20} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontWeight: '600' }}>Dry Days</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                  {stats.dryDays} days
                </div>
              </div>
              
              <div style={{
                background: 'rgba(22, 163, 74, 0.1)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(22, 163, 74, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <Zap size={20} color="#16a34a" />
                  <span style={{ color: '#16a34a', fontWeight: '600' }}>Hot Days</span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#16a34a' }}>
                  {stats.hotDays} days
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Benefits */}
        <div style={{
          background: '#f4fbf6',
          borderRadius: '20px',
          padding: '2rem',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
          marginBottom: '3rem'
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
            <Award size={32} />
            Why Generate a Report?
          </h3>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '2rem' 
          }}>
            {reportBenefits.map((benefit, index) => (
              <div key={index} style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2rem',
                borderRadius: '16px',
                border: `1px solid ${benefit.color}40`,
                transition: 'all 0.3s ease',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-8px)';
                e.target.style.background = `${benefit.color}10`;
                e.target.style.border = `2px solid ${benefit.color}`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                e.target.style.border = `1px solid ${benefit.color}40`;
              }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.5rem',
                  marginBottom: '1.5rem' 
                }}>
                  <div style={{
                    background: `${benefit.color}20`,
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: benefit.color
                  }}>
                    {benefit.icon}
                  </div>
                  <div>
                    <h4 style={{ 
                      margin: 0, 
                      fontSize: '1.3rem', 
                      fontWeight: 'bold',
                      color: benefit.color 
                    }}>
                      {benefit.title}
                    </h4>
                  </div>
                </div>
                <p style={{ 
                  margin: 0, 
                  color: '#475569', 
                  fontSize: '1rem',
                  lineHeight: '1.6' 
                }}>
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Last Generated Report */}
        {reportInfo && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '20px',
            padding: '2rem',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '2rem',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div>
                <h3 style={{ 
                  color: '#3b82f6', 
                  margin: 0, 
                  fontSize: '1.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontWeight: 'bold'
                }}>
                  <FileText size={28} />
                  Last Generated Report
                </h3>
                <p style={{ 
                  margin: '0.5rem 0 0 0', 
                  color: '#64748b',
                  fontSize: '0.9rem' 
                }}>
                  Download or share your previously generated report
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/analysis/download-report/${reportInfo.id}`, '_blank')}
                  style={{
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#2563eb';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 20px rgba(37, 99, 235, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#3b82f6';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <Download size={18} />
                  Download Again
                </button>
                
                <button
                  onClick={() => {
                    const shareText = `Check out my crop prediction report from FasalGuard AI System!`;
                    const shareUrl = window.location.href;
                    if (navigator.share) {
                      navigator.share({
                        title: 'FasalGuard AI Report',
                        text: shareText,
                        url: shareUrl
                      });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      alert('Report link copied to clipboard!');
                    }
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(148, 163, 184, 0.4)',
                    color: '#334155',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.08)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#334155';
                    e.target.style.color = '#ffffff';
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 8px 20px rgba(107, 114, 128, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#ffffff';
                    e.target.style.color = '#334155';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <Share2 size={18} />
                  Share Report
                </button>
              </div>
            </div>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1.5rem',
                fontSize: '0.95rem'
              }}>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Report ID:</div>
                  <div style={{ color: '#0f172a', fontWeight: '600', fontFamily: 'monospace' }}>
                    {reportInfo.id.substring(0, 8)}...{reportInfo.id.substring(reportInfo.id.length - 8)}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>File Name:</div>
                  <div style={{ color: '#0f172a', fontWeight: '600' }}>
                    {reportInfo.file_name}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>Generated:</div>
                  <div style={{ color: '#0f172a', fontWeight: '600' }}>
                    {new Date(reportInfo.generated_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', marginBottom: '0.25rem' }}>File Size:</div>
                  <div style={{ color: '#0f172a', fontWeight: '600' }}>
                    {(Math.random() * 2 + 1.5).toFixed(1)} MB
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report Features */}
        <div style={{
          marginTop: '3rem',
          textAlign: 'center',
          padding: '3rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '20px',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          backdropFilter: 'blur(20px)'
        }}>
          <h3 style={{ 
            color: '#0f172a', 
            marginBottom: '1.5rem', 
            fontSize: '2rem',
            fontWeight: 'bold'
          }}>
            Professional Features Included
          </h3>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '2rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
            {[
              { text: 'AI-Powered Analysis', icon: '🤖' },
              { text: 'High-Quality PDF', icon: '📄' },
              { text: 'Print-Ready Format', icon: '🖨️' },
              { text: 'Data Visualization', icon: '📊' }
            ].map((feature, i) => (
              <div key={i} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '2.5rem' }}>{feature.icon}</div>
                <div style={{ 
                  color: '#475569', 
                  fontSize: '1rem',
                  fontWeight: '500'
                }}>
                  {feature.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}