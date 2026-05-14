import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './soilAnalysis.css';
import { useNavigate } from 'react-router-dom';

const SoilAnalysis = () => {
    const [pageLoading, setPageLoading] = useState(true);
    const [analysisType, setAnalysisType] = useState('district');
    const [district, setDistrict] = useState('Lahore');
    const [currentCrop, setCurrentCrop] = useState('');
    const [soilParams, setSoilParams] = useState({
        ph: 7.0,
        orgc: 1.0,
        nitrogen: 0.2,
        clay: 30,
        sand: 40,
        silt: 30,
        ec: 1.5
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    useEffect(() => {
        const timer = setTimeout(() => setPageLoading(false), 1200);
        return () => clearTimeout(timer);
    }, []);

    const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';
    
    const districts = [
        { name: 'Lahore', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/lahore_vrsi8u.jpg' },
        { name: 'Multan', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/multan_zvq422.jpg' },
        { name: 'Bahawalpur', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/bahawalpur_yfkazl.jpg' },
        { name: 'Gujrat', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225506/gujrat_vlwywy.jpg' },
        { name: 'Faisalabad', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225504/faisalabad_xkwuh4.jpg' },
        { name: 'Sargodha', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/sargodha_rl52yc.jpg' },
    ];

    const crops = [
        { name: 'Wheat', icon: '🌾' },
        { name: 'Rice', icon: '🍚' },
        { name: 'Maize', icon: '🌽' },
        { name: 'Sugarcane', icon: '🎋' },
        { name: 'Cotton', icon: '🧵' },
        { name: 'None', icon: '❌' }
    ];

    const handleAnalyze = async () => {
        setLoading(true);
        setError('');
        setResult(null);
        try {
            const token = localStorage.getItem('token');
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            let response;
            
            if (analysisType === 'district') {
                response = await axios.post(
                    `${API_BASE_URL}/api/soil/district`,
                    {
                        district,
                        currentCrop: currentCrop === 'None' ? null : currentCrop
                    },
                    { headers }
                );
            } else {
                response = await axios.post(
                    `${API_BASE_URL}/api/soil/manual`,
                    {
                        soil_params: soilParams,
                        district: district || 'Manual Input',
                        current_crop: currentCrop === 'None' ? null : currentCrop
                    },
                    { headers }
                );
            }

            if (response.data.success) {
                setResult(response.data);
            } else {
                setError(response.data.error || 'Analysis failed');
            }
        } catch (err) {
            console.error('Full error:', err);
            
            if (err.response) {
                const serverMsg = err.response.data?.message || err.response.data?.error || JSON.stringify(err.response.data) || 'Unknown error';
                setError(`Server error: ${err.response.status} - ${serverMsg}`);
            } else if (err.request) {
                setError('Cannot connect to server. Please make sure backend is running on port 5000.');
            } else {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleParamChange = (param, value) => {
        setSoilParams(prev => ({
            ...prev,
            [param]: parseFloat(value) || 0
        }));
    };

    const getScoreColor = (score) => {
        if (score >= 80) return '#22c55e';
        if (score >= 60) return '#f59e0b';
        if (score >= 40) return '#ea580c';
        return '#ef4444';
    };

    const getPriorityColor = (priority) => {
        switch(priority?.toLowerCase()) {
            case 'high': return '#ef4444';
            case 'medium': return '#f59e0b';
            case 'low': return '#22c55e';
            default: return '#3b82f6';
        }
    };

    const navigateToTrends = () => {
        navigate('/soil-trends');
    };

    if (loading) {
        return (
            <div className="soil-analysis-page">
                <div className="soil-loading">
                    <div className="spinner"></div>
                    <p>Analyzing soil data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="soil-analysis-page">
            {pageLoading && (
                <div className="soil-loading-overlay" aria-live="polite" aria-busy="true">
                    <div className="soil-loading-sprout">
                        <span className="soil-loading-stem" />
                        <span className="soil-loading-leaf soil-loading-leaf-left" />
                        <span className="soil-loading-leaf soil-loading-leaf-right" />
                        <span className="soil-loading-soil" />
                    </div>
                    <div className="soil-loading-label">Preparing soil insights...</div>
                </div>
            )}
            {/* Header */}
            <header className="soil-header">
                <nav className="soil-nav">
                    <button className="soil-logo-btn" onClick={() => navigate('/')}>
                        <span>🌱</span>
                        <span>FASALGUARD</span>
                    </button>
                    <button 
                        className="soil-nav-btn"
                        onClick={navigateToTrends}
                    >
                        📊 Past Trends
                    </button>
                </nav>
            </header>

            {/* Main Content */}
            <main>
                <div className="soil-analysis-container">
                    {/* Welcome Section */}
                    <div className="soil-welcome-section">
                        <h1 className="soil-page-title">Soil Health Analysis</h1>
                        <p className="soil-page-subtitle">
                            Get AI-powered soil analysis and crop recommendations
                        </p>
                    </div>

                    {/* Location Bar */}
                    <div className="location-bar">
                        <span>📍 {district}, Pakistan</span>
                    </div>

                    {/* Main Analysis Card */}
                    <div className="soil-main-card">
                        <h3 className="section-header">
                            <span>🌱</span>
                            Soil Analysis Settings
                        </h3>

                        {/* Analysis Type Selection */}
                        <div className="radio-group">
                            <div 
                                className={`radio-option ${analysisType === 'district' ? 'selected' : ''}`}
                                onClick={() => setAnalysisType('district')}
                            >
                                <input 
                                    type="radio" 
                                    id="districtOption" 
                                    name="analysisType" 
                                    value="district"
                                    checked={analysisType === 'district'}
                                    readOnly
                                />
                                <label htmlFor="districtOption">By District</label>
                            </div>
                            <div 
                                className={`radio-option ${analysisType === 'manual' ? 'selected' : ''}`}
                                onClick={() => setAnalysisType('manual')}
                            >
                                <input 
                                    type="radio" 
                                    id="manualOption" 
                                    name="analysisType" 
                                    value="manual"
                                    checked={analysisType === 'manual'}
                                    readOnly
                                />
                                <label htmlFor="manualOption">Manual Input</label>
                            </div>
                        </div>

                        {/* District Selection - Grid Style */}
                        <div className="form-group">
                            <label>
                                <span>📍</span>
                                Select District
                            </label>
                            <div className="cities-grid">
                                {districts.map((city) => (
                                    <div 
                                        key={city.name}
                                        className={`city-card ${district === city.name ? 'selected' : ''}`}
                                        onClick={() => setDistrict(city.name)}
                                    >
                                        <img 
                                            src={city.image} 
                                            alt={`${city.name} agricultural landscape`}
                                            className="city-image"
                                            onError={(e) => {
                                                e.target.src = `https://via.placeholder.com/400x250/1e293b/94a3b8?text=${city.name}+Fields`;
                                            }} 
                                        />
                                        <div className="city-overlay">
                                            <div className="city-name">{city.name}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Manual Parameters (Conditional) */}
                        {analysisType === 'manual' && (
                            <div className="form-group">
                                <label>
                                    <span>⚙️</span>
                                    Soil Parameters
                                </label>
                                <div className="param-grid">
                                    {Object.entries({
                                        ph: { label: 'pH Level', step: 0.1 },
                                        orgc: { label: 'Organic Carbon (%)', step: 0.01 },
                                        nitrogen: { label: 'Nitrogen (%)', step: 0.001 },
                                        clay: { label: 'Clay Content (%)', step: 0.1 },
                                        sand: { label: 'Sand Content (%)', step: 0.1 },
                                        silt: { label: 'Silt Content (%)', step: 0.1 },
                                        ec: { label: 'Salinity (EC dS/m)', step: 0.1 }
                                    }).map(([param, config]) => (
                                        <div key={param} className="param-input">
                                            <label>{config.label}</label>
                                            <input
                                                type="number"
                                                value={soilParams[param]}
                                                onChange={(e) => handleParamChange(param, e.target.value)}
                                                step={config.step}
                                                className="input-focus"
                                                placeholder={config.label}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Current Crop Selection - Grid Style */}
                        <div className="form-group">
                            <label>
                                <span>🌾</span>
                                Current Crop (Optional)
                            </label>
                            <div className="crops-grid">
                                {crops.map((crop) => (
                                    <div 
                                        key={crop.name}
                                        className={`crop-card ${currentCrop === crop.name ? 'selected' : ''}`}
                                        onClick={() => setCurrentCrop(crop.name)}
                                    >
                                        <div className="crop-icon">{crop.icon}</div>
                                        <div className="crop-name">{crop.name}</div>
                                    </div>
                                ))}
                            </div>
                            <p className="form-hint">Select "None" if no current crop</p>
                        </div>

                        {/* Analyze Button */}
                        <button 
                            className="analyze-btn button-hover"
                            onClick={handleAnalyze}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="loading-spinner"></div>
                                    Analyzing Soil...
                                </>
                            ) : (
                                <>
                                    <span>🔬</span>
                                    Analyze Soil
                                </>
                            )}
                        </button>

                        {/* Error Message */}
                        {error && (
                            <div className="error-message">
                                ❌ {error}
                                <p style={{ marginTop: '10px', fontSize: '14px' }}>
                                    Make sure backend is running and `REACT_APP_BACKEND_URL` is set for production.
                                </p>
                            </div>
                        )}

                        {/* Info Box */}
                        <div className="info-box">
                            <p className="info-text">
                                <strong>🌱 Powered by AI:</strong> We analyze soil parameters and district data to provide 
                                intelligent crop recommendations that maximize yield and soil health.
                            </p>
                        </div>
                    </div>

                    {/* Results Section */}
                    {result && (
                        <div className="result-container">
                            <div className="result-header">
                                <h2 className="soil-page-title">Soil Analysis Results</h2>
                                <div className="result-meta">
                                    <span>📍 {result.location?.district || district}</span>
                                    <span>📅 {new Date(result.timestamp || Date.now()).toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="result-summary">
                                <div className="summary-card">
                                    <h3>Soil Health Score</h3>
                                    <div 
                                        className="score-circle"
                                        style={{ 
                                            background: getScoreColor(result.analysis.overall_score) === '#22c55e' 
                                                ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                                                : getScoreColor(result.analysis.overall_score) === '#f59e0b'
                                                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                                : getScoreColor(result.analysis.overall_score) === '#ea580c'
                                                ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)'
                                                : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                        }}
                                    >
                                        {result.analysis.overall_score.toFixed(0)}
                                    </div>
                                    <p style={{ 
                                        color: getScoreColor(result.analysis.overall_score),
                                        fontWeight: '600',
                                        fontSize: '1.1rem'
                                    }}>
                                        {result.analysis.soil_health}
                                    </p>
                                </div>

                                <div className="summary-card">
                                    <h3>Recommended Crop</h3>
                                    <div className="crop-recommendation">
                                        {result.analysis.recommended_crop}
                                    </div>
                                    {result.crop_comparison && (
                                        <div className={`crop-comparison ${result.crop_comparison.should_change ? 'change' : 'keep'}`}>
                                            {result.crop_comparison.message}
                                        </div>
                                    )}
                                </div>

                                {result.analysis.parameter_scores && Object.keys(result.analysis.parameter_scores).length > 0 && (
                                    <div className="summary-card">
                                        <h3>Parameter Scores</h3>
                                        <div className="parameter-scores">
                                            {Object.entries(result.analysis.parameter_scores).slice(0, 3).map(([param, score]) => (
                                                <div key={param} className="param-score">
                                                    <span className="param-name">{param.replace('_', ' ')}</span>
                                                    <div className="score-bar">
                                                        <div 
                                                            className="score-fill"
                                                            style={{ 
                                                                width: `${score}%`,
                                                                backgroundColor: getScoreColor(score)
                                                            }}
                                                        ></div>
                                                    </div>
                                                    <span className="score-value">{score.toFixed(0)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Recommendations */}
                            {result.recommendations && result.recommendations.length > 0 && (
                                <div className="recommendations-section">
                                    <h3 className="section-header">
                                        <span>💡</span>
                                        Actionable Recommendations
                                    </h3>
                                    <div className="recommendations-list">
                                        {result.recommendations.slice(0, 3).map((rec, index) => (
                                            <div 
                                                key={index}
                                                className="recommendation-card"
                                                style={{ borderLeftColor: getPriorityColor(rec.priority) }}
                                            >
                                                <div className="rec-header">
                                                    <h4>{rec.type}</h4>
                                                    <span className={`priority-badge priority-${rec.priority?.toLowerCase() || 'medium'}`}>
                                                        {rec.priority || 'Medium'}
                                                    </span>
                                                </div>
                                                <p className="rec-action">{rec.action}</p>
                                                <p className="rec-reason">{rec.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="result-actions">
                                <button 
                                    className="action-btn button-hover"
                                    onClick={() => window.print()}
                                >
                                    🖨️ Print Report
                                </button>
                                <button 
                                    className="action-btn secondary button-hover"
                                    onClick={() => {
                                        setResult(null);
                                        setError('');
                                    }}
                                >
                                    🔄 New Analysis
                                </button>
                                <button 
                                    className="action-btn trends-btn button-hover"
                                    onClick={navigateToTrends}
                                >
                                    📊 View Past Trends
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SoilAnalysis;