import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sprout, MapPin, Navigation, Calendar, Leaf, ArrowLeft, CloudRain, Droplets, Thermometer, Sun, CloudLightning, Eye, Wind, BarChart3 } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

export default function CropPredictionPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [pageLoading, setPageLoading] = useState(false);
  const [predictionData, setPredictionData] = useState({
    city: '',
    latitude: '',
    longitude: '',
    days: 7
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  useEffect(() => {
    let shouldShow = false;
    try {
      shouldShow = sessionStorage.getItem('cp_page_load') === '1';
      sessionStorage.removeItem('cp_page_load');
    } catch {
      shouldShow = false;
    }
    if (!shouldShow) return;
    setPageLoading(true);
    const timer = setTimeout(() => setPageLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  // Fixed image URLs using reliable CDN sources for Pakistani cities
  const supportedCities = [
    { name: 'Lahore', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/lahore_vrsi8u.jpg' },
    { name: 'Multan', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/multan_zvq422.jpg' },
    { name: 'Bahawalpur', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/bahawalpur_yfkazl.jpg' },
    { name: 'Gujrat', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225506/gujrat_vlwywy.jpg' },
    { name: 'Faisalabad', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225504/faisalabad_xkwuh4.jpg' },
    { name: 'Sargodha', image: 'https://res.cloudinary.com/dun1zalow/image/upload/v1765225505/sargodha_rl52yc.jpg' },
  ];

  // Fetch weather data when city is selected
  const fetchWeatherData = async (cityName) => {
    setLoadingWeather(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/weather?city=${cityName}&days=7`);
      if (response.ok) {
        const data = await response.json();
        console.log('🌤️ Weather data received:', data);
        setWeatherData(data);
      } else {
        console.error('Failed to fetch weather data');
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const selectCity = (cityName) => {
    setPredictionData({...predictionData, city: cityName});
    setShowCitySelector(false);
    fetchWeatherData(cityName);
  };

  const handleCropPrediction = async () => {
    if (!predictionData.city && (!predictionData.latitude || !predictionData.longitude)) {
      alert(t('pleaseSelectLocation', 'Please enter either city name or coordinates'));
      return;
    }

    if (predictionData.city && !supportedCities.find(c => c.name === predictionData.city)) {
      alert(`${t('selectSupportedCity', 'Please select one of the supported cities')}: ${supportedCities.map(c => c.name).join(', ')}`);
      return;
    }

    setIsLoading(true);
    try {
      const requestData = {
        city: predictionData.city,
        days: predictionData.days
      };

      console.log('🌱 Sending AI prediction request:', requestData);

      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/predict/ai-prediction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('🤖 Full AI prediction response:', result);

      if (result.success) {
        // Persist prediction + input so direct URL loads / refresh keep showing results
        try {
          localStorage.setItem('predictionData', JSON.stringify(result));
          localStorage.setItem('inputData', JSON.stringify(predictionData));
        } catch (e) {
          console.warn('Could not write prediction data to localStorage', e);
        }

        navigate('/prediction-results', {
          state: {
            predictionData: result,
            inputData: predictionData
          }
        });
      } else {
        alert(`${t('predictionFailed', 'Prediction failed')}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ AI Prediction error:', error);
      alert(t('backendCheck', 'Failed to get prediction. Please check if backend is running on port 5000'));
    } finally {
      setIsLoading(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f7fbf8 0%, #eef6f0 50%, #f7fbf8 100%)',
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#0f172a',
      padding: 0,
      margin: 0,
      position: 'relative',
      overflowX: 'hidden',
    },
    header: {
      background: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(16px) saturate(160%)',
      borderBottom: '1px solid rgba(34, 197, 94, 0.2)',
      padding: '1.25rem 2rem',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      maxWidth: '1400px',
      margin: '0 auto',
    },
    logoButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '2rem',
      fontWeight: '700',
      color: '#22c55e',
      padding: '0.5rem 1rem',
      borderRadius: '12px',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      textDecoration: 'none',
    },
    navButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      background: 'rgba(34, 197, 94, 0.12)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      color: '#22c55e',
      padding: '0.875rem 1.75rem',
      borderRadius: '14px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '600',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      textDecoration: 'none',
      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)',
    },
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '2rem 1rem',
    },
    loadingOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(247, 251, 248, 0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1200,
      backdropFilter: 'blur(4px)'
    },
    welcomeSection: {
      textAlign: 'center',
      marginBottom: '3rem',
      padding: '0 1rem',
    },
    pageTitle: {
      fontSize: '3rem',
      fontWeight: '300',
      color: '#0f172a',
      marginBottom: '0.5rem',
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    pageSubtitle: {
      fontSize: '1.2rem',
      color: '#64748b',
      maxWidth: '600px',
      margin: '0 auto',
      lineHeight: '1.6',
    },
    locationBar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      background: '#ffffff',
      backdropFilter: 'blur(10px)',
      padding: '1rem 1.5rem',
      borderRadius: '20px',
      marginBottom: '2rem',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      maxWidth: '400px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    weatherMainCard: {
      background: '#ffffff',
      backdropFilter: 'blur(30px)',
      borderRadius: '28px',
      padding: '2.5rem',
      marginBottom: '2.5rem',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: '2.5rem',
      alignItems: 'start',
      position: 'relative',
      overflow: 'hidden',
    },
    // pseudo-element styles moved to the inline <style> block as CSS classes
    currentWeather: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
    },
    tempHeader: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: '0.5rem',
      marginBottom: '1rem',
    },
    tempDisplay: {
      fontSize: '7rem',
      fontWeight: '200',
      color: '#0f172a',
      lineHeight: 1,
      letterSpacing: '-0.05em',
    },
    weatherTitle: {
      fontSize: '2.5rem',
      fontWeight: '300',
      color: '#0f172a',
      marginBottom: '0.75rem',
    },
    weatherDesc: {
      fontSize: '1rem',
      color: '#64748b',
      lineHeight: '1.6',
      maxWidth: '500px',
    },
    hourlyForecast: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      height: '140px',
      borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
      paddingBottom: '1.5rem',
      marginTop: '1.5rem',
    },
    hourlyItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      flex: 1,
      textAlign: 'center',
      padding: '0 0.25rem',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
    },
    hourlyTime: {
      fontSize: '0.85rem',
      color: '#64748b',
      marginBottom: '0.5rem',
      fontWeight: '500',
    },
    hourlyIcon: {
      width: '32px',
      height: '32px',
      marginBottom: '0.5rem',
    },
    hourlyTemp: {
      fontSize: '1.25rem',
      fontWeight: '600',
      color: '#0f172a',
    },
    sidePanel: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
    },
    statItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '1.5rem 1rem',
      background: '#f8fafc',
      borderRadius: '16px',
      border: '1px solid rgba(34, 197, 94, 0.1)',
      transition: 'all 0.3s ease',
    },
    statIcon: {
      width: '24px',
      height: '24px',
      marginBottom: '0.75rem',
    },
    statValue: {
      fontSize: '1.75rem',
      fontWeight: '600',
      color: '#22c55e',
      marginBottom: '0.25rem',
    },
    statLabel: {
      fontSize: '0.85rem',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '0.5rem',
    },
    statDesc: {
      fontSize: '0.8rem',
      color: '#64748b',
      lineHeight: '1.4',
    },
    uvBar: {
      height: '4px',
      background: 'linear-gradient(90deg, #ef4444 0%, #f59e0b 33%, #eab308 66%, #22c55e 100%)',
      borderRadius: '2px',
      marginTop: '0.75rem',
      overflow: 'hidden',
    },
    uvSegment: {
      height: '100%',
      background: '#22c55e',
      width: '50%',
    },
    citiesSection: {
      marginBottom: '2.5rem',
    },
    citiesHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#0f172a',
      marginBottom: '2rem',
    },
    citiesRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '1.5rem',
      maxWidth: '1100px',
      margin: '0 auto',
    },
    cityCard: {
      position: 'relative',
      height: '180px',
      borderRadius: '20px',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      background: '#ffffff',
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
    },
    cityCardHover: {
      transform: 'translateY(-8px) scale(1.02)',
      borderColor: '#22c55e',
      boxShadow: '0 20px 40px rgba(34, 197, 94, 0.2)',
    },
    cityCardSelected: {
      border: '2px solid #22c55e',
      transform: 'translateY(-4px) scale(1.01)',
      boxShadow: '0 15px 35px rgba(34, 197, 94, 0.3)',
    },
    cityImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'all 0.4s ease',
    },
    cityOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%)',
      display: 'flex',
      alignItems: 'flex-end',
      padding: '1.25rem',
      opacity: 0,
      transition: 'all 0.3s ease',
    },
    cityName: {
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      padding: '0.75rem 1.25rem',
      borderRadius: '12px',
      color: '#fff',
      fontWeight: '600',
      fontSize: '1rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    },
    predictionCard: {
      background: '#ffffff',
      backdropFilter: 'blur(30px) saturate(150%)',
      borderRadius: '28px',
      padding: '3rem',
      border: '1px solid rgba(34, 197, 94, 0.25)',
      boxShadow: '0 18px 36px rgba(15, 23, 42, 0.08)',
    },
    sectionHeader: {
      fontSize: '1.5rem',
      fontWeight: '600',
      color: '#0f172a',
      marginBottom: '2rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      position: 'relative',
    },
    // pseudo-element styles moved to the inline <style> block as CSS classes
    inputGroup: {
      marginBottom: '2.5rem',
    },
    label: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#475569',
      marginBottom: '1rem',
      fontSize: '1rem',
      fontWeight: '500',
    },
    input: {
      width: '100%',
      padding: '1.25rem 1.5rem',
      borderRadius: '16px',
      border: '1px solid rgba(148, 163, 184, 0.35)',
      background: '#ffffff',
      color: '#0f172a',
      fontSize: '1rem',
      outline: 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08) inset',
    },
    grid2col: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1.25rem',
    },
    durationButtons: {
      display: 'flex',
      gap: '1rem',
    },
    durationButton: {
      flex: 1,
      padding: '1.25rem',
      border: '1px solid rgba(148, 163, 184, 0.35)',
      background: '#ffffff',
      color: '#334155',
      borderRadius: '16px',
      cursor: 'pointer',
      fontSize: '1rem',
      fontWeight: '500',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(10px)',
    },
    durationButtonActive: {
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: '#fff',
      borderColor: '#22c55e',
      transform: 'translateY(-2px)',
      boxShadow: '0 8px 25px rgba(34, 197, 94, 0.3)',
    },
    button: {
      width: '100%',
      padding: '1.5rem 3rem',
      border: 'none',
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      color: '#fff',
      borderRadius: '20px',
      cursor: 'pointer',
      fontSize: '1.125rem',
      fontWeight: '600',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      boxShadow: '0 10px 30px rgba(34, 197, 94, 0.3)',
      marginTop: '1rem',
    },
    infoBox: {
      background: '#eef6f0',
      borderRadius: '16px',
      padding: '1.75rem',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      marginTop: '2.5rem',
      backdropFilter: 'blur(10px)',
    },
    infoText: {
      margin: 0,
      color: '#475569',
      fontSize: '1rem',
      lineHeight: '1.6',
    },
  };

  const getIcon = (iconType) => {
    const commonProps = { size: 24, strokeWidth: 1.5 };
    switch (iconType) {
      case 'rain': return <CloudRain {...commonProps} color="#06b6d4" />;
      case 'thunder': return <CloudLightning {...commonProps} color="#eab308" />;
      case 'sun': return <Sun {...commonProps} color="#f59e0b" />;
      default: return <CloudRain {...commonProps} color="#94a3b8" />;
    }
  };

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes cpCloudFloat {
          0% { transform: translateX(-30px); opacity: 0.6; }
          50% { transform: translateX(30px); opacity: 1; }
          100% { transform: translateX(-30px); opacity: 0.6; }
        }
        .cp-cloud-loader {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #22c55e;
          font-weight: 700;
        }
        .cp-cloud {
          width: 58px;
          height: 32px;
          background: #e2f2e9;
          border-radius: 20px;
          position: relative;
          box-shadow: 0 10px 20px rgba(34, 197, 94, 0.2);
          animation: cpCloudFloat 2.8s ease-in-out infinite;
        }
        .cp-cloud::before,
        .cp-cloud::after {
          content: '';
          position: absolute;
          background: #eef8f2;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          top: -12px;
        }
        .cp-cloud::before { left: 6px; }
        .cp-cloud::after { right: 6px; }
      `}</style>

      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div className="cp-cloud-loader">
            <div className="cp-cloud" />
            <div>{t('fetchingPrediction', 'Fetching AI prediction...')}</div>
          </div>
        </div>
      )}
      {pageLoading && (
        <div className="cp-loading-overlay" aria-live="polite" aria-busy="true">
          <div className="cp-loading-sky">
            <div className="cp-loading-sun" />
            <div className="cp-loading-cloud" />
            <div className="cp-loading-rain">
              {Array.from({ length: 8 }).map((_, idx) => (
                <span key={`cp-drop-${idx}`} className="cp-loading-drop" />
              ))}
            </div>
          </div>
          <div className="cp-loading-label">Preparing crop forecast...</div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cpCloudFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes cpRainFall {
          0% { transform: translateY(-8px); opacity: 0.2; }
          50% { opacity: 0.8; }
          100% { transform: translateY(10px); opacity: 0.2; }
        }
        .cp-loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(247, 251, 248, 0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          z-index: 2000;
          backdrop-filter: blur(4px);
        }
        .cp-loading-sky {
          position: relative;
          width: 220px;
          height: 140px;
        }
        .cp-loading-sun {
          position: absolute;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid #f59e0b;
          top: 12px;
          right: 36px;
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
        }
        .cp-loading-cloud {
          position: absolute;
          width: 120px;
          height: 38px;
          border-radius: 999px;
          border: 2px solid #f59e0b;
          top: 40px;
          left: 30px;
          background: rgba(255, 255, 255, 0.6);
          animation: cpCloudFloat 3.6s ease-in-out infinite;
        }
        .cp-loading-cloud::before,
        .cp-loading-cloud::after {
          content: "";
          position: absolute;
          border: 2px solid #f59e0b;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.6);
        }
        .cp-loading-cloud::before {
          width: 44px;
          height: 44px;
          top: -24px;
          left: 18px;
        }
        .cp-loading-cloud::after {
          width: 54px;
          height: 54px;
          top: -30px;
          left: 52px;
        }
        .cp-loading-rain {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 12px;
          height: 50px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          padding: 0 40px;
        }
        .cp-loading-drop {
          width: 4px;
          height: 16px;
          background: #cbd5e1;
          border-radius: 999px;
          animation: cpRainFall 1.1s ease-in-out infinite;
        }
        .cp-loading-drop:nth-child(2n) { animation-delay: -0.3s; }
        .cp-loading-drop:nth-child(3n) { animation-delay: -0.6s; }
        .cp-loading-label {
          color: #1b4332;
          font-weight: 700;
          font-size: 0.95rem;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        /* Green scrollbar styles */
        ::-webkit-scrollbar {
          width: 12px;
          height: 12px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.08);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border-radius: 10px;
          border: 2px solid rgba(15, 23, 42, 0.08);
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
        }
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #22c55e rgba(15, 23, 42, 0.08);
        }
        .input-focus:focus {
          border-color: #22c55e !important;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
          transform: translateY(-1px);
        }
        .button-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 35px rgba(34, 197, 94, 0.4);
        }
        .city-card-hover:hover .city-overlay {
          opacity: 1;
        }
        .hourly-item:hover {
          transform: translateY(-4px);
        }
        .stat-item:hover {
          transform: translateY(-2px);
          background: rgba(34, 197, 94, 0.1);
          border-color: #22c55e;
        }
        .weather-main-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34, 197, 94, 0.3), transparent);
          pointer-events: none;
        }
        .section-header::after {
          content: "";
          position: absolute;
          bottom: -0.75rem;
          left: 0;
          width: 40px;
          height: 2px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border-radius: 1px;
        }
        @media (max-width: 1024px) {
          .weather-main-card { grid-template-columns: 1fr; gap: 1.5rem; }
          .side-panel { flex-direction: row; justify-content: space-around; }
        }
        @media (max-width: 768px) {
          .page-title { font-size: 2.5rem; }
          .cities-row { grid-template-columns: repeat(2, 1fr); }
          .duration-buttons { flex-direction: column; }
          .grid2col { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Header */}
      <header style={styles.header}>
        <nav style={styles.nav}>
          <motion.button 
            style={styles.logoButton}
            onClick={() => navigate('/')}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(34, 197, 94, 0.08)' }}
            whileTap={{ scale: 0.95 }}
          >
            <Leaf size={32} />
            <span>FASALGUARD</span>
          </motion.button>
          <motion.button 
            style={styles.navButton}
            onClick={() => navigate('/past-trends')}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(34, 197, 94, 0.2)', boxShadow: '0 4px 16px rgba(34, 197, 94, 0.25)' }}
            whileTap={{ scale: 0.95 }}
          >
            <BarChart3 size={20} />
            {t('pastTrends', 'Past Trends')}
          </motion.button>
        </nav>
      </header>

      {/* Main Content */}
      <main>
        <div style={styles.container}>
          <div style={styles.welcomeSection}>
            <motion.h1 
              style={styles.pageTitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              {t('cropPredictionTitle', 'Smart Crop Insights')}
            </motion.h1>
            <motion.p 
              style={styles.pageSubtitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              {t('cropPredictionSubtitle', 'Harness weather data and AI to discover the perfect crops for your region. Start by selecting your city below.')}
            </motion.p>
          </div>

          {/* Location Bar */}
          <motion.div 
            style={styles.locationBar}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <MapPin size={20} color="#22c55e" />
            <span style={{ fontWeight: '500' }}>{predictionData.city || t('chooseCity', 'Choose a city')}</span>, Pakistan
          </motion.div>

          {/* City Selector - Only if no city selected */}
          <AnimatePresence>
            {showCitySelector && (
              <motion.div 
                style={styles.citiesSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
              >
                <div style={styles.citiesHeader}>
                  <Sprout size={24} color="#22c55e" />
                  {t('selectGrowingRegion', 'Select Your Growing Region')}
                </div>
                <div style={styles.citiesRow}>
                  {supportedCities.map((city, index) => (
                    <motion.div
                      key={city.name}
                      style={{ ...styles.cityCard, ...(predictionData.city === city.name ? styles.cityCardSelected : {}) }}
                      onClick={() => selectCity(city.name)}
                      className="city-card-hover"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1, duration: 0.5 }}
                      whileHover={predictionData.city !== city.name ? { y: -8 } : {}}
                      whileTap={{ scale: 0.98 }}
                    >
                      <img 
                        src={city.image} 
                        alt={`${city.name} agricultural landscape`}
                        style={styles.cityImage}
                        onError={(e) => {
                          e.target.src = `https://via.placeholder.com/400x250/1e293b/94a3b8?text=${city.name}+Fields`;
                        }} 
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '1rem',
                        left: 0,
                        right: 0,
                        textAlign: 'center',
                      }}>
                        <div style={{
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          color: '#ffffff',
                          textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.6)'
                        }}>{city.name}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Weather Dashboard - Always visible once city selected, with smooth transition */}
          <AnimatePresence>
            {predictionData.city && (
              <motion.div 
                className="weather-main-card"
                style={styles.weatherMainCard}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6 }}
              >
                <div style={styles.currentWeather}>
                  <div style={styles.tempHeader}>
                    <motion.div 
                      style={styles.tempDisplay}
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      {loadingWeather ? '--' : weatherData?.forecast?.[0]?.T2M ? Math.round(weatherData.forecast[0].T2M) : '--'}°
                    </motion.div>
                    <div style={{ fontSize: '2.5rem', color: '#94a3b8', fontWeight: '300' }}>C</div>
                  </div>
                  <div style={styles.weatherTitle}>
                    {loadingWeather ? t('loading', 'Loading...') : weatherData?.forecast?.[0]?.PRECTOTCORR > 5 ? 'Rainy Day' : weatherData?.forecast?.[0]?.T2M > 30 ? 'Hot & Sunny' : 'Pleasant Day'}
                  </div>
                  <div style={styles.weatherDesc}>
                    {loadingWeather ? 'Fetching weather data...' : 
                     weatherData?.forecast?.[0] ? 
                     `Current temperature ${Math.round(weatherData.forecast[0].T2M)}°C with ${weatherData.forecast[0].PRECTOTCORR > 0 ? 'rainfall expected' : 'clear skies'}. Humidity at ${Math.round(weatherData.forecast[0].RH2M)}%.` :
                     'Weather data will appear here'}
                  </div>
                  
                  <div style={styles.hourlyForecast}>
                    {weatherData?.forecast?.slice(0, 6).map((day, index) => {
                      const date = new Date(day.date);
                      const hour = date.getHours() || (6 + index * 3);
                      const timeStr = index === 0 ? 'Now' : `${hour}:00`;
                      const temp = Math.round(day.T2M);
                      const rain = day.PRECTOTCORR;
                      const iconType = rain > 5 ? 'rain' : rain > 0 ? 'rain' : day.T2M > 30 ? 'sun' : 'rain';
                      
                      return (
                        <motion.div 
                          key={index}
                          style={styles.hourlyItem}
                          className="hourly-item"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1, duration: 0.4 }}
                          whileHover={{ y: -4 }}
                        >
                          <div style={styles.hourlyTime}>{timeStr}</div>
                          <div style={styles.hourlyIcon}>{getIcon(iconType)}</div>
                          <div style={styles.hourlyTemp}>{temp}°</div>
                        </motion.div>
                      );
                    }) || [
                      { time: 'Now', temp: '--', icon: 'rain' },
                      { time: '15:00', temp: '--', icon: 'rain' },
                      { time: '16:00', temp: '--', icon: 'rain' },
                      { time: '17:00', temp: '--', icon: 'rain' },
                      { time: '18:00', temp: '--', icon: 'sun' },
                      { time: '19:00', temp: '--', icon: 'rain' },
                    ].map((item, index) => (
                      <motion.div 
                        key={index}
                        style={styles.hourlyItem}
                        className="hourly-item"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1, duration: 0.4 }}
                        whileHover={{ y: -4 }}
                      >
                        <div style={styles.hourlyTime}>{item.time}</div>
                        <div style={styles.hourlyIcon}>{getIcon(item.icon)}</div>
                        <div style={styles.hourlyTemp}>{item.temp}°</div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div style={styles.sidePanel}>
                  <motion.div 
                    style={styles.statItem}
                    whileHover={{ y: -2 }}
                    className="stat-item"
                  >
                    <div style={styles.statIcon}><Wind size={24} color="#22c55e" /></div>
                    <div style={styles.statValue}>{weatherData?.forecast?.[0]?.WS2M ? `${Math.round(weatherData.forecast[0].WS2M)} m/s` : '--'}</div>
                    <div style={styles.statLabel}>Wind</div>
                    <div style={styles.statDesc}>Current wind speed</div>
                  </motion.div>

                  <motion.div 
                    style={styles.statItem}
                    whileHover={{ y: -2 }}
                    className="stat-item"
                  >
                    <div style={styles.statIcon}><Droplets size={24} color="#06b6d4" /></div>
                    <div style={styles.statValue}>{weatherData?.forecast?.[0]?.RH2M ? `${Math.round(weatherData.forecast[0].RH2M)}%` : '--'}</div>
                    <div style={styles.statLabel}>Humidity</div>
                    <div style={styles.statDesc}>Relative humidity</div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats Grid - Below main weather */}
          {predictionData.city && (
            <motion.div 
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <motion.div style={styles.statItem} whileHover={{ y: -2 }} className="stat-item">
                <div style={styles.statIcon}><Thermometer size={24} color="#22c55e" /></div>
                <div style={styles.statValue}>{weatherData?.forecast?.[0]?.T2M_MAX ? `${Math.round(weatherData.forecast[0].T2M_MAX)}°` : '--'}</div>
                <div style={styles.statLabel}>Max Temp</div>
                <div style={styles.statDesc}>Today's maximum</div>
              </motion.div>
              <motion.div style={styles.statItem} whileHover={{ y: -2 }} className="stat-item">
                <div style={styles.statIcon}><CloudRain size={24} color="#06b6d4" /></div>
                <div style={styles.statValue}>{weatherData?.forecast?.[0]?.PRECTOTCORR ? `${weatherData.forecast[0].PRECTOTCORR.toFixed(1)}mm` : '--'}</div>
                <div style={styles.statLabel}>Rainfall</div>
                <div style={styles.statDesc}>Precipitation today</div>
              </motion.div>
              <motion.div style={styles.statItem} whileHover={{ y: -2 }} className="stat-item">
                <div style={styles.statIcon}><Eye size={24} color="#94a3b8" /></div>
                <div style={styles.statDesc}>2" expected in next 24h</div>
              </motion.div>
              <motion.div style={styles.statItem} whileHover={{ y: -2 }} className="stat-item">
                <div style={styles.statIcon}><Eye size={24} color="#eab308" /></div>
                <div style={styles.statValue}>6 mi</div>
                <div style={styles.statLabel}>Visibility</div>
                <div style={styles.statDesc}>Dew point is 25° now</div>
              </motion.div>
              <motion.div style={styles.statItem} whileHover={{ y: -2 }} className="stat-item">
                <div style={styles.statIcon}><Droplets size={24} color="#16a34a" /></div>
                <div style={styles.statValue}>82%</div>
                <div style={styles.statLabel}>Humidity</div>
                <div style={styles.statDesc}>The dew point is 25° right now</div>
              </motion.div>
            </motion.div>
          )}

          {/* Prediction Settings */}
          <motion.div 
            style={styles.predictionCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className="section-header" style={styles.sectionHeader}>
              <Sprout size={24} color="#22c55e" />
              Tailored Prediction Settings
            </h3>
            
            {/* Manual Coordinates */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                <Navigation size={20} color="#94a3b8" />
                Manual Coordinates (Optional - Override City)
              </label>
              <div style={styles.grid2col}>
                <input
                  type="number"
                  step="any"
                  value={predictionData.latitude}
                  onChange={(e) => setPredictionData({...predictionData, latitude: e.target.value})}
                  placeholder="Latitude (e.g., 31.5204)"
                  style={styles.input}
                  className="input-focus"
                />
                <input
                  type="number"
                  step="any"
                  value={predictionData.longitude}
                  onChange={(e) => setPredictionData({...predictionData, longitude: e.target.value})}
                  placeholder="Longitude (e.g., 74.3587)"
                  style={styles.input}
                  className="input-focus"
                />
              </div>
            </div>

            {/* Forecast Duration */}
            <div style={styles.inputGroup}>
              <label style={styles.label}>
                <Calendar size={20} color="#94a3b8" />
                Analysis Period
              </label>
              <div style={styles.durationButtons}>
                {[7, 14, 30].map((days) => (
                  <motion.button
                    key={days}
                    onClick={() => setPredictionData({...predictionData, days})}
                    style={{
                      ...styles.durationButton,
                      ...(predictionData.days === days ? styles.durationButtonActive : {}),
                    }}
                    className="input-focus"
                    whileHover={predictionData.days !== days ? { scale: 1.02 } : {}}
                    whileTap={{ scale: 0.98 }}
                  >
                    {days} Days
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <motion.button
              onClick={handleCropPrediction}
              disabled={isLoading || !predictionData.city}
              style={styles.button}
              className="button-hover"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={isLoading ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.5 }}
            >
              {isLoading ? (
                <>
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    border: '2px solid transparent', 
                    borderTop: '2px solid #fff', 
                    borderRadius: '50%', 
                    animation: 'spin 1s linear infinite' 
                  }}></div>
                  Crafting Your Recommendations...
                </>
              ) : (
                <>
                  <Sprout size={24} />
                  Generate Crop Insights
                </>
              )}
            </motion.button>

            <div style={styles.infoBox}>
              <p style={styles.infoText}>
                <strong>🌱 Powered by Nature:</strong> We blend {predictionData.days}-day forecasts with soil insights and AI to recommend resilient crops that thrive in your local climate—boosting yields sustainably.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}