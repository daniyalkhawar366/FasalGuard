import React, { useState, useEffect } from 'react';
import FasalGuardAuth from './FasalGuardAuth';
import HomePage from './HomePage';
import ContactPage from './ContactPage';
import AboutUs from './AboutUs';
import Profile from './Profile';
import PastTrends from './PastTrends'; 
import PredictionResults from './PredictionResults';
import CropPredictionPage from './CropPredictionPage';
import Services from './Service';
import WeatherVisualizations from './WeatherVisualizations';
import IrrigationCalculator from './IrrigationCalculator'
import CropComparisonMatrix from './CropComparisonMatrix';
import ReportGenerator from './ReportGenerator';
import SoilAnalysis from './soilAnalysis';
import SoilTrends from './components/SoilTrends';
import SatelliteAnalysis from './SatelliteAnalysis';
import FarmerHistoryPage from './FarmerHistoryPage';
import VoiceChat from './VoiceChat';
import HelpChatWidget from './components/HelpChatWidget';

import './global.css';

import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import AdminDashboard from './AdminDashboard';
import AdminSlaTracker from './admin/AdminSlaTracker';
import AdminHighRiskQueue from './admin/AdminHighRiskQueue';
import AdminActionAnalytics from './admin/AdminActionAnalytics';
import AdminEngagementHealth from './admin/AdminEngagementHealth';
import AdminGeographyOps from './admin/AdminGeographyOps';
import AdminUserActivity from './admin/AdminUserActivity';
import { useLanguage } from './context/LanguageContext';

function App() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setUser(data.user);
          setIsAuthenticated(true);
          console.log('User authenticated:', data.user);
        } else {
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        }
      })
      .catch(error => {
        console.error('Token verification failed:', error);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData, token) => {
    console.log('handleLogin called with:', { userData, token });
    localStorage.setItem('token', token);
    setUser(userData);
    setIsAuthenticated(true);
    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/home');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        color: '#10b981'
      }}>
        {t('loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="App" style={{ minHeight: '100vh' }}>
      <Routes location={location}>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <FasalGuardAuth onLogin={handleLogin} initialView="login" />
        } />
        <Route path="/signup" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <FasalGuardAuth onLogin={handleLogin} initialView="signup" />
        } />
        <Route path="/verify" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <FasalGuardAuth onLogin={handleLogin} initialView="otp" />
        } />
        <Route path="/forgot-password" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <FasalGuardAuth onLogin={handleLogin} initialView="forgot-password" />
        } />
        <Route path="/reset-password" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <FasalGuardAuth onLogin={handleLogin} initialView="reset-password" />
        } />
        
        {/* Default route - redirects to login if not authenticated */}
        <Route path="/" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
        } />
        
        {/* Protected routes */}
        <Route path="/home" element={
          isAuthenticated ? <HomePage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/contact" element={
          isAuthenticated ? <ContactPage /> : <Navigate to="/login" replace />
        } />
        <Route path="/about" element={
          isAuthenticated ? <AboutUs onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/profile" element={
          isAuthenticated ? <Profile user={user} /> : <Navigate to="/login" replace />
        } />
        <Route path="/past-trends" element={
          isAuthenticated ? <PastTrends onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/soil-analysis" element={
          isAuthenticated ? <SoilAnalysis user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        {/* Add the SoilTrends route */}
        <Route path="/soil-trends" element={
          isAuthenticated ? <SoilTrends user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/satellite-analysis" element={
          isAuthenticated ? <SatelliteAnalysis user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
        } />
        <Route path="/satellite-history" element={
          isAuthenticated ? <FarmerHistoryPage /> : <Navigate to="/login" replace />
        } />
        <Route path="/prediction-results" element={
          isAuthenticated ? <PredictionResults /> : <Navigate to="/login" replace />
        } />
        <Route path="/crop-prediction" element={
          isAuthenticated ? <CropPredictionPage /> : <Navigate to="/login" replace />
        } />
        <Route path="/voice-chat" element={
          isAuthenticated ? <VoiceChat /> : <Navigate to="/login" replace />
        } />
        <Route path="/services" element={
          isAuthenticated ? <Services /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin" element={
          isAuthenticated && user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/sla" element={
          isAuthenticated && user?.role === 'admin' ? <AdminSlaTracker /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/high-risk" element={
          isAuthenticated && user?.role === 'admin' ? <AdminHighRiskQueue /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/action-completion" element={
          isAuthenticated && user?.role === 'admin' ? <AdminActionAnalytics /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/alert-effectiveness" element={
          isAuthenticated && user?.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/engagement" element={
          isAuthenticated && user?.role === 'admin' ? <AdminEngagementHealth /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/ops/geography" element={
          isAuthenticated && user?.role === 'admin' ? <AdminGeographyOps /> : <Navigate to="/login" replace />
        } />
        <Route path="/admin/user-activity/:userId" element={
          isAuthenticated && user?.role === 'admin' ? <AdminUserActivity /> : <Navigate to="/login" replace />
        } />
        
        {/* Individual pages that need to receive props */}
        <Route path="/prediction-results/weather" element={
          isAuthenticated ? <WeatherVisualizationsDarkWrapper /> : <Navigate to="/login" replace />
        } />
        
        <Route path="/prediction-results/irrigation" element={
          isAuthenticated ? <IrrigationCalculatorDarkWrapper /> : <Navigate to="/login" replace />
        } />
        
        <Route path="/prediction-results/matrix" element={
          isAuthenticated ? <CropComparisonMatrixDarkWrapper /> : <Navigate to="/login" replace />
        } />
        
        <Route path="/prediction-results/report" element={
          isAuthenticated ? <ReportGeneratorDarkWrapper /> : <Navigate to="/login" replace />
        } />

        {/* Catch-all route */}
        <Route path="*" element={
          isAuthenticated ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
        } />
      </Routes>
      {isAuthenticated && <HelpChatWidget user={user} />}
    </div>
  );

  function WeatherVisualizationsDarkWrapper() {
    const location = useLocation();
    const { predictionData } = location.state || {
      predictionData: JSON.parse(localStorage.getItem('predictionData'))
    };
    const resolvedCity = predictionData?.location?.city || null;
    console.log('[DEBUG] WeatherVisualizations wrapper - resolvedCity:', resolvedCity, { predictionData });

    return <WeatherVisualizations forecast={predictionData?.forecast || []} />;
  }

  function IrrigationCalculatorDarkWrapper() {
    const location = useLocation();
    const { predictionData, inputData } = location.state || {
      predictionData: JSON.parse(localStorage.getItem('predictionData')),
      inputData: JSON.parse(localStorage.getItem('inputData'))
    };
    const resolvedCity = predictionData?.location?.city || inputData?.city || null;
    console.log('[DEBUG] IrrigationCalculator wrapper - resolvedCity:', resolvedCity, { predictionData, inputData });

    return (
      <IrrigationCalculator
        predictionData={predictionData}
        city={resolvedCity}
      />
    );
  }

  function CropComparisonMatrixDarkWrapper() {
    const location = useLocation();
    const { predictionData, inputData } = location.state || {
      predictionData: JSON.parse(localStorage.getItem('predictionData')),
      inputData: JSON.parse(localStorage.getItem('inputData'))
    };
    const resolvedCity = predictionData?.location?.city || inputData?.city || null;
    console.log('[DEBUG] CropComparisonMatrix wrapper - resolvedCity:', resolvedCity, { predictionData, inputData });

    return (
      <CropComparisonMatrix
        predictionData={predictionData}
        city={resolvedCity}
      />
    );
  }

  function ReportGeneratorDarkWrapper() {
    const location = useLocation();
    const { predictionData, inputData } = location.state || {
      predictionData: JSON.parse(localStorage.getItem('predictionData')),
      inputData: JSON.parse(localStorage.getItem('inputData'))
    };
    const resolvedCity = predictionData?.location?.city || inputData?.city || null;
    console.log('[DEBUG] ReportGenerator wrapper - resolvedCity:', resolvedCity, { predictionData, inputData });

    return (
      <ReportGenerator
        predictionData={predictionData}
        city={resolvedCity}
      />
    );
  }
}

export default App;