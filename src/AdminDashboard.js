import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon, Users, 
  Cloud, TrendingUp, AlertTriangle, CheckCircle,
  Download, RefreshCw, Database, Server,
  Crop, Thermometer, Droplets, Wind,
  Calendar, Clock, Activity, Layers,
  ChevronDown, Filter, Settings, Eye, Loader2, LogOut,
  Search, X, ChevronLeft, ChevronRight, Ban, UserCheck, Trash2, MessageSquare
} from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, BarChart, 
  Bar, Legend, Area, AreaChart
} from 'recharts';

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('today');
  const [activeTab, setActiveTab] = useState('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [suspendModal, setSuspendModal] = useState(null);
  const [activateModal, setActivateModal] = useState(null);
  const [emailBroadcastModal, setEmailBroadcastModal] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [querySearch, setQuerySearch] = useState('');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const navigate = useNavigate();
  const itemsPerPage = 5;
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // User action handlers
  const handleSuspendUser = (userId, userName) => {
    setSuspendModal({ userId, userName, action: 'suspend' });
  };

  const confirmSuspendUser = async () => {
    const { userId, userName } = suspendModal;
    setActionLoading(userId);
    setSuspendModal(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: 'Suspended by admin' })
      });

      if (!response.ok) throw new Error('Failed to suspend user');

      // Refresh data
      fetchDashboardData(true);
    } catch (error) {
      console.error('Suspend user error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateUser = (userId, userName) => {
    setActivateModal({ userId, userName, action: 'activate' });
  };

  const confirmActivateUser = async () => {
    const { userId, userName } = activateModal;
    setActionLoading(userId);
    setActivateModal(null);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to activate user');

      // Refresh data
      fetchDashboardData(true);
    } catch (error) {
      console.error('Activate user error:', error);
      alert('Failed to activate user. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Email broadcast handler
  const handleEmailBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
      return;
    }

    setBroadcastLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/broadcast-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: broadcastSubject,
          message: broadcastMessage
        })
      });

      if (!response.ok) throw new Error('Failed to send broadcast');

      const data = await response.json();
      
      // Close modal and reset
      setEmailBroadcastModal(false);
      setBroadcastSubject('');
      setBroadcastMessage('');
    } catch (error) {
      console.error('Broadcast email error:', error);
    } finally {
      setBroadcastLoading(false);
    }
  };

  // Fetch feedback/queries
  const fetchFeedback = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/feedback`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch feedback');
      
      const data = await response.json();
      setFeedbackList(data.data || []);
    } catch (error) {
      console.error('Fetch feedback error:', error);
    }
  };

  // Helper to detect whether a feedback already has a reply
  const hasReply = (f) => !!(f && (f.replied || f.reply || f.adminReply || f.admin_reply || (f.replies && f.replies.length > 0)));

  // Reply to feedback
  const handleReplyFeedback = async (feedbackId) => {
    if (!replyMessage.trim()) {
      setNotification({ type: 'error', message: 'Please enter a reply message' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setReplyLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/feedback/${feedbackId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reply: replyMessage })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reply');
      }

      // Refresh feedback list
      await fetchFeedback();
      
      // Close modal and reset
      setSelectedFeedback(null);
      setReplyMessage('');
      
      // Show success notification
      setNotification({ type: 'success', message: 'Reply sent successfully! Email has been delivered to the user.' });
      setTimeout(() => setNotification(null), 4000);
    } catch (error) {
      console.error('Reply feedback error:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to send reply. Please try again.' });
      setTimeout(() => setNotification(null), 4000);
    } finally {
      setReplyLoading(false);
    }
  };

  // Update feedback status
  const handleUpdateStatus = async (feedbackId, newStatus) => {
    // Prevent status change if a reply has already been sent
    const fb = feedbackList.find(f => f._id === feedbackId);
    if (hasReply(fb)) {
      setNotification({ type: 'error', message: 'Cannot change status after a reply has been sent.' });
      setTimeout(() => setNotification(null), 3000);
      // Refresh feedback to ensure UI consistency
      await fetchFeedback();
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/feedback/${feedbackId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update status');
      }

      // Refresh feedback list
      await fetchFeedback();
      
      setNotification({ type: 'success', message: 'Status updated successfully' });
      setTimeout(() => setNotification(null), 3000);
    } catch (error) {
      console.error('Update status error:', error);
      setNotification({ type: 'error', message: error.message || 'Failed to update status' });
      setTimeout(() => setNotification(null), 3000);
      // Refresh to revert any optimistic updates
      await fetchFeedback();
    }
  };

  // Logout handler for admin
  const handleLogout = () => {
    localStorage.removeItem('token');
    // optionally clear other admin session keys here
    // Force a full reload to ensure the app re-evaluates auth and doesn't redirect back to home
    window.location.assign('/login');
  };

  // Fetch dashboard data from backend
  const fetchDashboardData = async (forceRefresh = false) => {
    // Don't fetch if we have valid cached data and it's not a forced refresh
    if (!forceRefresh && dashboardData && lastFetchTime && (Date.now() - lastFetchTime) < CACHE_DURATION) {
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const withTimeout = async (url, options = {}, timeoutMs = 2500) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const startedAt = Date.now();
        try {
          const response = await fetch(url, { ...options, signal: controller.signal });
          return { response, ms: Date.now() - startedAt, ok: response.ok };
        } catch {
          return { response: null, ms: Date.now() - startedAt, ok: false };
        } finally {
          clearTimeout(timeoutId);
        }
      };

      // Demo mode: use lightweight endpoints only (skip /api/admin/dashboard and model checks).
      const [userStatsTimed, usersTimed, satelliteSummaryTimed, weatherTimed, analyticsTimed] = await Promise.all([
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/user-stats?days=30`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users?all=true`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users/satellite-summary`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/weather-stats?days=7`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/analytics?groupBy=month&metric=count`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      const userStatsRes = userStatsTimed;
      const usersRes = usersTimed;
      const satelliteSummaryRes = satelliteSummaryTimed;
      const weatherRes = weatherTimed;
      const analyticsRes = analyticsTimed;

      const userStats = userStatsRes.ok ? await userStatsRes.json() : { total_users: 0, active_users: 0 };
      const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
      const satelliteSummaryData = satelliteSummaryRes.ok ? await satelliteSummaryRes.json() : { summaries: {} };
      const satelliteByUser = satelliteSummaryData.summaries || {};
      const weatherData = weatherRes.ok ? await weatherRes.json() : { weather_stats: [] };

      // Fetch current weather for 5 cities
      const cities = ['Lahore', 'Multan', 'Bahawalpur', 'Gujrat', 'Faisalabad'];
      const weatherPromises = cities.map(city => 
        fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/weather?city=${encodeURIComponent(city)}&days=1`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );
      const weatherResults = await Promise.all(weatherPromises);
      console.log('Weather results:', weatherResults.filter(r => r).length, 'cities fetched');

      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : { analytics: [] };

      // Service checks for demo dashboard (5 services).
      const [coreApiCheck, weatherServiceCheck, satelliteServiceCheck, cropServiceCheck, soilServiceCheck] = await Promise.all([
        withTimeout(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/health`, {}, 2200),
        withTimeout(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/weather?city=Lahore&days=1`, {}, 2200),
        withTimeout(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users/satellite-summary`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }, 2200),
        withTimeout(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/predict/ml-health`, {}, 2200),
        withTimeout(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/soil/health`, {}, 2200),
      ]);

      // Process weather trends from API responses
      const weatherTrends = [];
      
      for (let i = 0; i < weatherResults.length; i++) {
        const result = weatherResults[i];
        if (!result || !result.success) continue;
        
        // Try different paths to get weather data
        const forecast = result.forecast || result.weather_data?.forecast || result.data?.forecast || [];
        const currentWeather = result.currentWeather || result.weather_data?.currentWeather || result.data?.currentWeather;
        
        // Get first day data
        const firstDay = forecast[0] || currentWeather || {};
        
        console.log(`${cities[i]} raw data:`, JSON.stringify(firstDay));
        
        weatherTrends.push({
          city: cities[i],
          temperature: parseFloat(firstDay.T2M) || 0,
          humidity: parseFloat(firstDay.RH2M) || 0,
          rainfall: parseFloat(firstDay.PRECTOTCORR) || 0,
          description: firstDay.weatherDescription || 'N/A'
        });
      }

      console.log('Final weather trends:', weatherTrends);

      // Predictions removed

      // Process users from real data
      const users = usersData.users && Array.isArray(usersData.users) ? usersData.users.map(user => {
        const lastActiveDate = new Date(user.lastActive);
        const now = new Date();
        const diffMs = now - lastActiveDate;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let lastActiveText;
        if (diffMins < 60) {
          lastActiveText = `${diffMins}m ago`;
        } else if (diffHours < 24) {
          lastActiveText = `${diffHours}h ago`;
        } else if (diffDays < 30) {
          lastActiveText = `${diffDays}d ago`;
        } else {
          lastActiveText = lastActiveDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role || 'user',
          accountStatus: user.accountStatus || 'active',
          predictions: user.predictions,
          lastActive: lastActiveText,
          status: user.status,
          satelliteSummary: satelliteByUser[user.id] || null,
        };
      }) : [];

      // Demo mode: skip model loading to keep admin fast.
      const modelPerformance = [];

      // Combine all data
      const combinedData = {
        total_predictions: Array.isArray(analyticsData.analytics)
          ? analyticsData.analytics.reduce((sum, item) => sum + (parseInt(item.value, 10) || 0), 0)
          : 0,
        active_users: userStats.active_users || 0,
        total_users: userStats.total_users || 0,
        model_accuracy: null,
        weather_requests: weatherData.total_requests || 0,
        system_health: [coreApiCheck, weatherServiceCheck, satelliteServiceCheck, cropServiceCheck, soilServiceCheck].every((item) => item.ok) ? 'Healthy' : 'Degraded',
        avg_response_time: (() => {
          const values = [coreApiCheck.ms, weatherServiceCheck.ms, satelliteServiceCheck.ms, cropServiceCheck.ms, soilServiceCheck.ms]
            .filter((value) => Number.isFinite(value));
          if (values.length === 0) return null;
          return values.reduce((sum, value) => sum + value, 0) / values.length;
        })(),
        weatherTrends,
        users,
        services: [
          {
            name: 'Core API',
            status: coreApiCheck.ok ? 'up' : 'down',
            response_time: coreApiCheck.ms,
            description: 'Backend API core availability',
          },
          {
            name: 'Weather Service',
            status: weatherServiceCheck.ok ? 'up' : 'down',
            response_time: weatherServiceCheck.ms,
            description: 'City weather ingestion and forecast',
          },
          {
            name: 'Satellite Service',
            status: satelliteServiceCheck.ok ? 'up' : 'down',
            response_time: satelliteServiceCheck.ms,
            description: 'Satellite activity tracking and outcomes',
          },
          {
            name: 'Crop Prediction Service',
            status: cropServiceCheck.ok ? 'up' : 'down',
            response_time: cropServiceCheck.ms,
            description: 'Crop prediction health endpoint',
          },
          {
            name: 'Soil Prediction Service',
            status: soilServiceCheck.ok ? 'up' : 'down',
            response_time: soilServiceCheck.ms,
            description: 'Soil analysis health endpoint',
          },
        ],
        modelPerformance
      };

      console.log('=== COMBINED DATA SUMMARY ===');
      console.log('Weather:', combinedData.weatherTrends.length);
      console.log('Users:', combinedData.users.length);
      console.log('Models:', combinedData.modelPerformance.length);
      console.log('Model Accuracy:', combinedData.model_accuracy);
      console.log('Weather Requests:', combinedData.weather_requests);
      console.log('===========================');

      setDashboardData(combinedData);
      setLastFetchTime(Date.now());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to fetch dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Manual refresh handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData(true);
  };

  // Generate default trends if no data available

  useEffect(() => {
    fetchDashboardData(true);
  }, [timeRange]);

  useEffect(() => {
    if (!dashboardData) {
      fetchDashboardData();
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'queries') {
      fetchFeedback();
    }
  }, [activeTab]);

  // Predictions removed - no filter/pagination needed anymore

  // Placeholders for removed predictions UI to satisfy ESLint
  // kept as empty values because predictions feature was intentionally removed
  const filteredPredictions = [];
  const paginatedPredictions = [];
  const totalPages = 1;

  const normalizedQuerySearch = querySearch.trim().toLowerCase();
  const filteredFeedbackList = (feedbackList || []).filter((item) => {
    if (!normalizedQuerySearch) return true;
    const name = String(item?.name || '').toLowerCase();
    const email = String(item?.email || '').toLowerCase();
    const message = String(item?.message || '').toLowerCase();
    return name.includes(normalizedQuerySearch)
      || email.includes(normalizedQuerySearch)
      || message.includes(normalizedQuerySearch);
  });

  const feedbackSummary = {
    total: feedbackList.length,
    pending: feedbackList.filter((f) => f.status === 'pending').length,
    resolved: feedbackList.filter((f) => f.status === 'done').length,
    replied: feedbackList.filter((f) => hasReply(f)).length,
  };

  const statsCards = [
    {
      id: 2,
      title: 'Total Users',
      value: dashboardData?.total_users || 0,
      icon: <Users size={22} />,
      color: '#34d399',
      trend: dashboardData?.active_users ? `${dashboardData.active_users} active` : 'N/A',
      description: 'Registered users',
      trendUp: true
    },
    {
      id: 3,
      title: 'Active Services',
      value: Array.isArray(dashboardData?.services)
        ? dashboardData.services.filter((service) => service.status === 'up').length
        : 0,
      icon: <Server size={22} />,
      color: '#3b82f6',
      trend: Array.isArray(dashboardData?.services)
        ? `${dashboardData.services.length} total`
        : 'N/A',
      description: 'Services currently online',
      trendUp: true
    },
    {
      id: 4,
      title: 'Weather API',
      value: dashboardData?.weather_requests != null ? dashboardData.weather_requests : 'N/A',
      icon: <Cloud size={22} />,
      color: '#6ee7b7',
      trend: dashboardData?.weatherTrends?.length > 0 ? `${dashboardData.weatherTrends.length} cities` : 'N/A',
      description: 'Weather data fetches',
      trendUp: true
    },
    {
      id: 5,
      title: 'System Health',
      value: dashboardData?.system_health || 'Unknown',
      icon: dashboardData?.system_health === 'Healthy' ? <CheckCircle size={22} /> : <AlertTriangle size={22} />,
      color: dashboardData?.system_health === 'Healthy' ? '#10b981' : '#ef4444',
      trend: dashboardData?.services ? `${dashboardData.services.filter(s => s.status === 'up').length}/${dashboardData.services.length} up` : 'N/A',
      description: 'All services running',
      trendUp: dashboardData?.system_health === 'Healthy'
    },
    {
      id: 6,
      title: 'Response Time',
      value: dashboardData?.avg_response_time ? `${Math.round(dashboardData.avg_response_time)}ms` : 'N/A',
      icon: <Activity size={22} />,
      color: '#a7f3d0',
      trend: dashboardData?.avg_response_time == null
        ? 'N/A'
        : dashboardData?.avg_response_time < 150
          ? 'Fast'
          : dashboardData?.avg_response_time < 300
            ? 'Normal'
            : 'Slow',
      description: 'API response time',
      trendUp: dashboardData?.avg_response_time != null && dashboardData.avg_response_time < 150
    }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card rounded-xl p-3">
          <p className="text-white font-semibold text-sm">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-gray-300 text-xs" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const clampPercent = (value) => Math.min(100, Math.max(0, value));

  const RadialGauge = ({ value, label, detail, color }) => {
    const safeValue = value == null ? 0 : clampPercent(value);
    const size = 220;
    const stroke = 16;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (safeValue / 100) * circumference;

    return (
      <div className="glass-card-lighter rounded-2xl p-4 flex flex-col items-center text-center">
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="30"
            fontWeight="700"
            fill="#111827"
          >
            {value == null ? 'N/A' : `${Math.round(safeValue)}%`}
          </text>
        </svg>
        <div className="text-base font-semibold text-gray-300 mt-2">{label}</div>
        <div className="text-sm text-gray-400 mt-1">{detail}</div>
      </div>
    );
  };

  const opsPages = [
    {
      title: 'SLA & Response Tracker',
      description: 'Pending older than 24h, response time, resolved rate.',
      path: '/admin/ops/sla',
      tintA: '#2563eb',
      tintB: '#0891b2',
    },
    {
      title: 'High-Risk Farmer Queue',
      description: 'Prioritize users with critical risk windows.',
      path: '/admin/ops/high-risk',
      tintA: '#dc2626',
      tintB: '#f97316',
    },
    {
      title: 'Action Completion Analytics',
      description: 'Pending vs done by week and crop.',
      path: '/admin/ops/action-completion',
      tintA: '#7c3aed',
      tintB: '#db2777',
    },
    {
      title: 'User Engagement Health',
      description: 'Login heatmap and feature usage split.',
      path: '/admin/ops/engagement',
      tintA: '#0f766e',
      tintB: '#10b981',
    },
    {
      title: 'Geography Operations',
      description: 'City risk distribution and unresolved queries.',
      path: '/admin/ops/geography',
      tintA: '#ca8a04',
      tintB: '#eab308',
    }
  ];

  const weatherChartData = useMemo(() => (
    (dashboardData?.weatherTrends || []).map((entry, index) => ({
      x: `${String(index + 1).padStart(2, '0')}:00`,
      city: entry.city,
      temperature: Number(entry.temperature) || 0,
      humidity: Number(entry.humidity) || 0,
      rainfall: Number(entry.rainfall) || 0,
    }))
  ), [dashboardData?.weatherTrends]);

  const navTabs = [
    { id: 'system', label: 'System', icon: Activity, accent: '#14b8a6' },
    { id: 'weather', label: 'Weather', icon: Cloud, accent: '#2563eb' },
    { id: 'users', label: 'Users', icon: Users, accent: '#16a34a' },
    { id: 'queries', label: 'Queries', icon: MessageSquare, accent: '#f59e0b' },
  ];

  // Loading overlay
  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7fbf8] via-[#eef6f0] to-[#f7fbf8] flex items-center justify-center">
        <div className="glass-card rounded-3xl p-12 text-center">
          <Loader2 size={48} className="text-green-400 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Loading Dashboard...</p>
          <p className="text-gray-400 text-sm mt-2">Fetching real-time data</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7fbf8] via-[#eef6f0] to-[#f7fbf8] flex items-center justify-center p-4">
        <div className="glass-card rounded-3xl p-12 text-center max-w-md">
          <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg font-semibold mb-2">Oops! Something went wrong</p>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="glass-button text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 mx-auto"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-light min-h-screen bg-gradient-to-br from-[#f7fbf8] via-[#eef6f0] to-[#f7fbf8] p-4 md:p-6 font-sans overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        
        * {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        /* Hide scrollbar */
        body::-webkit-scrollbar,
        html::-webkit-scrollbar,
        div::-webkit-scrollbar {
          width: 0px;
          height: 0px;
        }
        
        body,
        html {
          overflow-x: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(15, 23, 42, 0.08);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
        }
        
        .glass-card-lighter {
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(15, 23, 42, 0.08);
        }
        
        .glass-button {
          background: rgba(16, 185, 129, 0.15);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(16, 185, 129, 0.3);
          transition: all 0.3s ease;
        }
        
        .glass-button:hover {
          background: rgba(16, 185, 129, 0.25);
          border-color: rgba(16, 185, 129, 0.5);
          transform: translateY(-2px);
        }
        
        .text-glow {
          text-shadow: 0 0 0 rgba(0, 0, 0, 0);
        }

        .admin-light .text-white { color: #0f172a !important; }
        .admin-light .text-gray-400 { color: #64748b !important; }
        .admin-light .text-gray-300 { color: #334155 !important; }
        .admin-light .border-white\\/10 { border-color: rgba(15, 23, 42, 0.08) !important; }
        .admin-light .border-white\\/5 { border-color: rgba(15, 23, 42, 0.06) !important; }
        
        .hover-lift {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hover-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .loading-shimmer {
          animation: shimmer 2s infinite;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 200% 100%;
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .progress-glow {
          box-shadow: 0 0 20px currentColor;
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(16, 185, 129, 0.3);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(16, 185, 129, 0.5);
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
      `}</style>

      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="glass-card rounded-3xl mb-6 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-glow">
                FasalGuard Admin
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="glass-card-lighter text-white px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer outline-none hover:bg-white/10 transition-all"
                aria-label="Select time range"
              >
                <option value="today" className="bg-gray-800">Today</option>
                <option value="week" className="bg-gray-800">This Week</option>
                <option value="month" className="bg-gray-800">This Month</option>
                <option value="year" className="bg-gray-800">This Year</option>
              </select>
              <button
                onClick={() => window.location.reload()}
                className="glass-button text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 justify-center"
                aria-label="Refresh dashboard"
              >
                <RefreshCw size={18} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="glass-button text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 justify-center"
                aria-label="Logout admin"
                title="Logout"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="rounded-3xl mb-6 p-2 md:p-2.5"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.98) 55%, rgba(241,245,249,0.94) 100%)',
            border: '1px solid rgba(148,163,184,0.28)',
            boxShadow: '0 14px 30px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
                className={`group relative rounded-2xl px-3 py-3 md:px-4 md:py-3.5 text-sm transition-all duration-300 ${
                  isActive
                    ? 'text-slate-900 shadow-lg -translate-y-0.5'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-white/70'
                }`}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${tab.accent}2b 0%, ${tab.accent}52 100%)`,
                  border: `1px solid ${tab.accent}7d`,
                  boxShadow: `0 10px 20px ${tab.accent}2e`,
                } : {
                  border: '1px solid rgba(148,163,184,0.24)',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.9) 100%)',
                }}
                aria-label={`Switch to ${tab.label} tab`}
                role="tab"
                aria-selected={isActive}
              >
                <div className="flex items-center justify-center gap-2 md:gap-2.5">
                  <Icon size={16} style={{ opacity: isActive ? 1 : 0.86 }} />
                  <span className="font-semibold tracking-wide">{tab.label}</span>
                </div>
                {isActive && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-1.5 w-14 rounded-full"
                    style={{ background: tab.accent }}
                  />
                )}
              </button>
              );
            })}
          </div>
        </div>

        {/* Stats Grid - Show in System */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {statsCards.map((stat) => (
              <div 
                key={stat.id} 
                className="glass-card rounded-3xl p-6 hover-lift"
                title={stat.description}
              >
                <div className="flex justify-between items-start mb-6">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${stat.color}40, ${stat.color}20)`,
                      boxShadow: `0 8px 24px ${stat.color}30`
                    }}
                  >
                    <div style={{ color: stat.color }}>
                      {stat.icon}
                    </div>
                  </div>
                  {stat.trend && (
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                      stat.trendUp 
                        ? 'bg-green-500/20 text-green-300' 
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {stat.trend}
                    </span>
                  )}
                </div>
                <div className="text-4xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <h3 className="text-gray-300 font-semibold mb-1">
                  {stat.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {stat.description}
                </p>
                {/* Progress bar for accuracy and response time */}
                {(stat.title === 'Response Time') && (
                  <div className="mt-4 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ 
                        width: `${Math.max(0, 100 - (dashboardData?.avg_response_time || 0) / 3)}%`,
                        background: `linear-gradient(90deg, ${stat.color}, ${stat.color}dd)`
                      }}
                    ></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'system' && (
          <div className="glass-card rounded-3xl p-6 mb-6 hover-lift">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">System Pulse</h3>
              <span className="text-gray-400 text-sm">Live health gauges</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RadialGauge
                value={Array.isArray(dashboardData?.services) && dashboardData.services.length > 0
                  ? (dashboardData.services.filter((service) => service.status === 'up').length / dashboardData.services.length) * 100
                  : null}
                label="Service Uptime"
                detail={Array.isArray(dashboardData?.services)
                  ? `${dashboardData.services.filter((service) => service.status === 'up').length}/${dashboardData.services.length} services up`
                  : 'No service data'}
                color="#16a34a"
              />
              <RadialGauge
                value={dashboardData?.avg_response_time != null ? Math.max(0, 100 - dashboardData.avg_response_time / 5) : null}
                label="Response Time"
                detail={dashboardData?.avg_response_time != null ? `${Math.round(dashboardData.avg_response_time)} ms` : 'No response data'}
                color="#2563eb"
              />
              <RadialGauge
                value={dashboardData?.system_health === 'Healthy' ? 100 : dashboardData?.system_health === 'Degraded' ? 60 : 20}
                label="System Health"
                detail={dashboardData?.system_health || 'Unknown'}
                color="#d9a300"
              />
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="glass-card rounded-3xl p-6 mb-6 hover-lift">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">Operations Center</h3>
                <p className="text-gray-400 text-sm mt-1">Open focused pages for presentations.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {opsPages.map((item, index) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="glass-card-lighter rounded-2xl p-5 text-left transition-all hover:-translate-y-1 hover:shadow-xl"
                  style={{
                    background: `linear-gradient(135deg, ${item.tintA}16 0%, ${item.tintB}14 100%)`,
                    borderColor: `${item.tintA}33`,
                    boxShadow: `0 8px 24px ${item.tintA}22`,
                    animationDelay: `${index * 60}ms`,
                  }}
                >
                  <div className="mb-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide"
                    style={{ background: `${item.tintA}22`, color: item.tintA }}
                  >
                    OPS
                  </div>
                  <h4 className="text-white font-semibold mb-2">{item.title}</h4>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Charts Grid - System Tab - REMOVED */}
        {false && activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Crop Distribution */}
            <div className="glass-card rounded-3xl p-6 hover-lift">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Crop Prediction Distribution</h3>
                <button 
                  className="glass-card-lighter p-2.5 rounded-xl text-gray-300 hover:text-white transition-colors"
                  aria-label="Download chart"
                >
                  <Download size={18} />
                </button>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dashboardData?.cropDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {dashboardData?.cropDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Prediction Trends */}
            <div className="glass-card rounded-3xl p-6 hover-lift">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Prediction Trends</h3>
                  <p className="text-sm text-gray-400 mt-1">Last 12 months</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={dashboardData?.predictionTrends}>
                  <defs>
                    <linearGradient id="colorPredictions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="predictions" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorPredictions)"
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Weather Tab */}
        {activeTab === 'weather' && (
          <div className="grid grid-cols-1 gap-6 mb-6">
            <div className="glass-card rounded-3xl p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Temperature Trend</h3>
                <span className="text-gray-400 text-sm">Last sampled cities</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weatherChartData}>
                  <defs>
                    <linearGradient id="weatherTempFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                  <XAxis dataKey="x" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="temperature" name="Temp (C)" stroke="#2563eb" strokeWidth={3} fill="url(#weatherTempFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card rounded-3xl p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Humidity Trend</h3>
                <span className="text-gray-400 text-sm">Last sampled cities</span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weatherChartData}>
                  <defs>
                    <linearGradient id="weatherHumFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                  <XAxis dataKey="x" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#f59e0b" strokeWidth={3} fill="url(#weatherHumFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card rounded-3xl p-6 hover-lift">
              <h3 className="text-xl font-bold text-white mb-6">Current Weather - Major Cities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboardData?.weatherTrends && dashboardData.weatherTrends.length > 0 ? (
                  dashboardData.weatherTrends.map((weather, index) => (
                    <div key={index} className="glass-card-lighter rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-white text-lg font-bold">{weather.city}</h4>
                        <Cloud size={24} className="text-blue-400" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Thermometer size={18} className="text-red-400" />
                            <span className="text-gray-400 text-sm">Temperature</span>
                          </div>
                          <span className="text-white font-bold">{weather.temperature.toFixed(1)}°C</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Droplets size={18} className="text-blue-400" />
                            <span className="text-gray-400 text-sm">Humidity</span>
                          </div>
                          <span className="text-white font-bold">{weather.humidity.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Cloud size={18} className="text-cyan-400" />
                            <span className="text-gray-400 text-sm">Rainfall</span>
                          </div>
                          <span className="text-white font-bold">{weather.rainfall.toFixed(1)} mm</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-gray-300 text-sm text-center">{weather.description}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center text-gray-400 py-12">
                    No weather data available
                  </div>
                )}
              </div>
            </div>
            
            {/* Weather Statistics Summary */}
            <div className="glass-card rounded-3xl p-6 hover-lift">
              <h3 className="text-xl font-bold text-white mb-4">Weather Statistics Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card-lighter rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <Thermometer size={24} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Average Temperature</p>
                    <p className="text-white text-2xl font-bold">
                      {dashboardData?.weatherTrends?.length > 0
                        ? (dashboardData.weatherTrends.reduce((a, b) => a + b.temperature, 0) / dashboardData.weatherTrends.length).toFixed(1)
                        : 0}°C
                    </p>
                  </div>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Droplets size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Average Humidity</p>
                    <p className="text-white text-2xl font-bold">
                      {dashboardData?.weatherTrends?.length > 0
                        ? (dashboardData.weatherTrends.reduce((a, b) => a + b.humidity, 0) / dashboardData.weatherTrends.length).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Cloud size={24} className="text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Total Rainfall</p>
                    <p className="text-white text-2xl font-bold">
                      {dashboardData?.weatherTrends?.length > 0
                        ? (dashboardData.weatherTrends.reduce((a, b) => a + b.rainfall, 0)).toFixed(1)
                        : 0} mm
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Predictions Table - REMOVED */}
        {false && (
          <div className="glass-card rounded-3xl p-6 mb-6 hover-lift">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">
                {activeTab === 'predictions' ? 'All Predictions' : 'Recent Predictions'}
              </h3>
              <div className="flex items-center gap-3">
                {loading && <Loader2 size={18} className="text-green-400 animate-spin" />}
                <span className="text-gray-400 text-sm">
                  {filteredPredictions.length} results
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Crop</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Predicted Yield</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Confidence</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPredictions.length > 0 ? (
                    paginatedPredictions.map((prediction) => (
                      <tr 
                        key={prediction.id} 
                        className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => setSelectedPrediction(prediction)}
                      >
                        <td className="py-4 px-4 text-gray-300 text-sm">{prediction.time}</td>
                        <td className="py-4 px-4 text-gray-300 text-sm">{prediction.location}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
                              <Crop size={16} className="text-green-400" />
                            </div>
                            <span className="text-white font-medium">{prediction.crop}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-300 text-sm font-medium">{prediction.yield}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            prediction.confidence > 0.8 
                              ? 'bg-green-500/20 text-green-300' 
                              : prediction.confidence > 0.6 
                              ? 'bg-yellow-500/20 text-yellow-300' 
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {(prediction.confidence * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            prediction.status === 'Completed' || prediction.status === 'completed'
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {prediction.status.charAt(0).toUpperCase() + prediction.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button 
                            className="text-green-400 hover:text-green-300 transition-colors"
                            aria-label="View details"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        No predictions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                <p className="text-gray-400 text-sm">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="glass-button px-4 py-2 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={18} />
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="glass-button px-4 py-2 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                    aria-label="Next page"
                  >
                    Next
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prediction Details Modal - REMOVED */}
        {false && selectedPrediction && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedPrediction(null)}
          >
            <div 
              className="glass-card rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-white">Prediction Details</h3>
                <button 
                  onClick={() => setSelectedPrediction(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Crop Type</p>
                  <p className="text-white text-xl font-bold">{selectedPrediction.crop}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Predicted Yield</p>
                  <p className="text-white text-xl font-bold">{selectedPrediction.yield}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Confidence Score</p>
                  <p className="text-white text-xl font-bold">{(selectedPrediction.confidence * 100).toFixed(1)}%</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-sm mb-1">Status</p>
                  <p className="text-white text-xl font-bold">{selectedPrediction.status}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4 col-span-2">
                  <p className="text-gray-400 text-sm mb-1">Location</p>
                  <p className="text-white text-xl font-bold">{selectedPrediction.location}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPrediction(null)}
                className="glass-button w-full py-3 rounded-xl text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="glass-card rounded-3xl p-6 mb-6 hover-lift">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">User Management</h3>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">
                  {dashboardData?.users?.length || 0} users
                </span>
                <button
                  onClick={() => setEmailBroadcastModal(true)}
                  className="glass-button text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-500/30"
                  aria-label="Send broadcast email"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  <span className="hidden sm:inline">Broadcast Email</span>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Last Login</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Satellite Summary</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Account Status</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.users && dashboardData.users.length > 0 ? (
                    dashboardData.users.map((user) => (
                      <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 text-white font-medium">{user.name}</td>
                        <td className="py-4 px-4 text-gray-300 text-sm">{user.email}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            user.role === 'admin' 
                              ? 'bg-purple-500/20 text-purple-300' 
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {user.role || 'user'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-300 text-sm">{user.lastActive || 'Never'}</td>
                        <td className="py-4 px-4 text-gray-300 text-sm">
                          {user.satelliteSummary ? (
                            <div className="space-y-1">
                              <div className="font-semibold text-sm">{user.satelliteSummary.city} • {String(user.satelliteSummary.crop || '').toUpperCase()}</div>
                              <div className="text-xs">Risk: {user.satelliteSummary.risk_level || 'Unknown'}</div>
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/user-activity/${user.id}`)}
                                className="text-xs text-yellow-300 hover:text-yellow-200 underline"
                              >
                                View Activity
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div>No satellite run</div>
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/user-activity/${user.id}`)}
                                className="text-xs text-yellow-300 hover:text-yellow-200 underline"
                              >
                                View Activity
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            user.accountStatus === 'active' 
                              ? 'bg-green-500/20 text-green-300' 
                              : user.accountStatus === 'suspended'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {user.accountStatus || 'active'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          {user.role !== 'admin' && (
                            <div className="flex gap-2">
                              {(user.accountStatus === 'active' || !user.accountStatus) ? (
                                <button
                                  onClick={() => handleSuspendUser(user.id, user.name)}
                                  disabled={actionLoading === user.id}
                                  className="glass-button text-orange-400 hover:text-orange-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                                  title="Suspend user"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Ban size={14} />
                                  )}
                                  Suspend
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleActivateUser(user.id, user.name)}
                                  disabled={actionLoading === user.id}
                                  className="glass-button text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
                                  title="Activate user"
                                >
                                  {actionLoading === user.id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <UserCheck size={14} />
                                  )}
                                  Activate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Queries/Feedback Tab */}
        {activeTab === 'queries' && (
          <div className="glass-card rounded-3xl p-6 mb-6 hover-lift">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h3 className="text-xl font-bold text-white">User Queries & Feedback</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={fetchFeedback}
                    className="glass-button text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2"
                    aria-label="Refresh feedback list"
                  >
                    <RefreshCw size={16} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Total</p>
                  <p className="text-white text-2xl font-bold mt-1">{feedbackSummary.total}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Pending</p>
                  <p className="text-yellow-300 text-2xl font-bold mt-1">{feedbackSummary.pending}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Resolved</p>
                  <p className="text-green-300 text-2xl font-bold mt-1">{feedbackSummary.resolved}</p>
                </div>
                <div className="glass-card-lighter rounded-2xl p-4">
                  <p className="text-gray-400 text-xs uppercase tracking-wide">Replied</p>
                  <p className="text-blue-300 text-2xl font-bold mt-1">{feedbackSummary.replied}</p>
                </div>
              </div>

              <div className="glass-card-lighter rounded-2xl p-3 flex items-center gap-3">
                <Search size={16} className="text-gray-400" />
                <input
                  value={querySearch}
                  onChange={(e) => setQuerySearch(e.target.value)}
                  placeholder="Search by name, email, or message..."
                  className="bg-transparent outline-none text-white placeholder-gray-400 text-sm w-full"
                />
                {querySearch && (
                  <button
                    onClick={() => setQuerySearch('')}
                    className="text-gray-400 hover:text-white"
                    aria-label="Clear query search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Message</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeedbackList && filteredFeedbackList.length > 0 ? (
                    filteredFeedbackList.map((feedback) => (
                      <tr key={feedback._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-4 text-white font-medium">{feedback.name}</td>
                        <td className="py-4 px-4 text-gray-300 text-sm">{feedback.email}</td>
                        <td className="py-4 px-4 text-gray-300 text-sm max-w-xs">
                          <div className="line-clamp-2">
                            {feedback.message.substring(0, 120)}{feedback.message.length > 120 ? '...' : ''}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-300 text-sm">
                          {new Date(feedback.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4">
                          <select
                            value={feedback.status}
                            onChange={(e) => handleUpdateStatus(feedback._id, e.target.value)}
                            disabled={hasReply(feedback)}
                            title={hasReply(feedback) ? 'Status locked after reply' : 'Change status'}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border-0 ${hasReply(feedback) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'} ${
                              feedback.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-green-500/20 text-green-300'
                            }`}
                          >
                            <option value="pending">Pending</option>
                            <option value="done">Done</option>
                          </select>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedFeedback(feedback);
                                setReplyMessage('');
                              }}
                              className="glass-button text-green-400 hover:text-green-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                              title="Reply to feedback"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              Reply
                            </button>
                            <button
                              onClick={() => {
                                setSelectedFeedback(feedback);
                              }}
                              className="glass-button text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                              title="View full message"
                            >
                              <Eye size={14} />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-gray-400">
                        No feedback found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Reply/View Feedback Modal */}
        {selectedFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="glass-card rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Query Workspace</h3>
                  <p className="text-gray-400 text-sm mt-1">Review details and respond professionally</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFeedback(null);
                    setReplyMessage('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                <div className="glass-card-lighter rounded-2xl p-5 lg:col-span-1 space-y-4">
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Name</p>
                    <p className="text-white font-semibold mt-1">{selectedFeedback.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Email</p>
                    <p className="text-white text-sm mt-1 break-all">{selectedFeedback.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Submitted</p>
                    <p className="text-white text-sm mt-1">{new Date(selectedFeedback.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-2 ${
                      selectedFeedback.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-green-500/20 text-green-300'
                    }`}>
                      {selectedFeedback.status}
                    </span>
                    {hasReply(selectedFeedback) && (
                      <span className="inline-block ml-2 px-3 py-1 rounded-full text-xs font-bold mt-2 bg-blue-500/20 text-blue-300">
                        replied
                      </span>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm font-semibold">User Message</label>
                    <div className="glass-card-lighter rounded-xl p-4 mt-2">
                      <p className="text-white whitespace-pre-wrap">{selectedFeedback.message}</p>
                    </div>
                  </div>

                  {selectedFeedback.reply && (
                    <div>
                      <label className="text-gray-400 text-sm font-semibold">Admin Reply</label>
                      <div className="glass-card-lighter rounded-xl p-4 mt-2 bg-green-500/10 border border-green-500/20">
                        <p className="text-white whitespace-pre-wrap">{selectedFeedback.reply}</p>
                        <p className="text-gray-400 text-xs mt-2">
                          Replied on: {new Date(selectedFeedback.repliedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!selectedFeedback.reply && (
                <div className="border-t border-white/10 pt-6">
                  <label className="text-white font-semibold mb-2 block">Send Reply</label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your response here..."
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 transition-all resize-none"
                    rows="5"
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => handleReplyFeedback(selectedFeedback._id)}
                      disabled={replyLoading || !replyMessage.trim()}
                      className="glass-button bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {replyLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>
                          Send Reply
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFeedback(null);
                        setReplyMessage('');
                      }}
                      className="glass-button text-gray-300 px-6 py-3 rounded-xl font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selectedFeedback.reply && (
                <div className="border-t border-white/10 pt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedFeedback(null);
                      setReplyMessage('');
                    }}
                    className="glass-button text-gray-300 px-6 py-3 rounded-xl font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Custom Notification Toast */}
        {notification && (
          <div 
            className="fixed top-6 right-6 z-50 glass-card rounded-2xl p-5 shadow-2xl animate-slideIn"
            style={{
              background: notification.type === 'success' 
                ? 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)'
                : 'linear-gradient(135deg, rgba(239,68,68,0.95) 0%, rgba(220,38,38,0.95) 100%)',
              maxWidth: '400px',
              backdropFilter: 'blur(20px)',
              border: notification.type === 'success' 
                ? '1px solid rgba(16,185,129,0.3)'
                : '1px solid rgba(239,68,68,0.3)'
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {notification.type === 'success' ? (
                  <CheckCircle size={24} color="#fff" />
                ) : (
                  <AlertTriangle size={24} color="#fff" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-white font-semibold text-sm mb-1">
                  {notification.type === 'success' ? 'Success' : 'Error'}
                </h4>
                <p className="text-white text-sm opacity-95">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="flex-shrink-0 text-white hover:text-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* System Health */}
        {activeTab === 'system' && (
          <div className="glass-card rounded-3xl p-6 hover-lift mb-6">
            <h3 className="text-xl font-bold text-white mb-6">System Health</h3>
            <div className="space-y-4">
              {dashboardData?.services.map((service, index) => (
                <div key={index} className="glass-card-lighter rounded-2xl p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'up' ? 'bg-green-400' : 'bg-red-400'
                    }`} style={{
                      boxShadow: service.status === 'up'
                        ? '0 0 12px rgba(74, 222, 128, 0.6)'
                        : '0 0 12px rgba(248, 113, 113, 0.6)'
                    }}></div>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{service.name}</h4>
                      <p className="text-gray-400 text-xs mt-0.5">{service.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">
                      {service.response_time != null ? `${Math.round(service.response_time)} ms` : 'N/A'}
                    </p>
                    <p className="text-gray-400 text-xs uppercase">{service.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Model Performance Chart - Models Tab */}
        {activeTab === 'models' && (
          <div className="mt-6">
            {/* Model Statistics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="glass-card rounded-2xl p-5 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <Database size={24} className="text-green-400" />
                  <span className="text-gray-400 text-xs font-medium">MODELS</span>
                </div>
                <p className="text-white text-3xl font-bold mb-1">{dashboardData?.modelPerformance?.length || 0}</p>
                <p className="text-gray-400 text-sm">Active Models</p>
              </div>
              
              <div className="glass-card rounded-2xl p-5 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <TrendingUp size={24} className="text-blue-400" />
                  <span className="text-gray-400 text-xs font-medium">ACCURACY</span>
                </div>
                <p className="text-white text-3xl font-bold mb-1">
                  {dashboardData?.model_accuracy?.toFixed(1) || 0}%
                </p>
                <p className="text-gray-400 text-sm">Average Score</p>
              </div>
              
              <div className="glass-card rounded-2xl p-5 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <BarChart3 size={24} className="text-purple-400" />
                  <span className="text-gray-400 text-xs font-medium">TOTAL</span>
                </div>
                <p className="text-white text-3xl font-bold mb-1">
                  {dashboardData?.modelPerformance?.reduce((sum, m) => sum + m.predictions, 0) || 0}
                </p>
                <p className="text-gray-400 text-sm">Predictions Made</p>
              </div>
              
              <div className="glass-card rounded-2xl p-5 hover-lift">
                <div className="flex items-center justify-between mb-3">
                  <CheckCircle size={24} className="text-yellow-400" />
                  <span className="text-gray-400 text-xs font-medium">TOP MODEL</span>
                </div>
                <p className="text-white text-xl font-bold mb-1 truncate">
                  {dashboardData?.modelPerformance?.length > 0
                    ? dashboardData.modelPerformance.reduce((best, current) => 
                        current.accuracy > best.accuracy ? current : best
                      ).name.split('_')[0]
                    : 'N/A'
                  }
                </p>
                <p className="text-gray-400 text-sm">
                  {dashboardData?.modelPerformance?.length > 0
                    ? `${dashboardData.modelPerformance.reduce((best, current) => 
                        current.accuracy > best.accuracy ? current : best
                      ).accuracy.toFixed(1)}% accuracy`
                    : 'No data'
                  }
                </p>
              </div>
            </div>

            {/* Model Accuracy Chart - Full Width */}
            <div className="glass-card rounded-3xl p-6 hover-lift">
              <h3 className="text-xl font-bold text-white mb-6">Model Accuracy Comparison</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={dashboardData?.modelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    dataKey="accuracy" 
                    fill="#10b981" 
                    radius={[8, 8, 0, 0]}
                    name="Accuracy (%)"
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card rounded-3xl p-6 hover-lift mt-6">
              <h3 className="text-xl font-bold text-white mb-6">Model Performance</h3>
              <div className="space-y-5">
                {dashboardData?.modelPerformance.map((model, index) => (
                  <div key={index} className="border-l-4 border-green-400 pl-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-white font-semibold">{model.name}</h4>
                      <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-xs font-bold">
                        {model.accuracy.toFixed(1)}% accuracy
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400 mb-3">
                      <span>Predictions: {model.predictions}</span>
                      <span>Avg Confidence: {model.avg_confidence}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full progress-glow transition-all duration-1000"
                        style={{ width: `${model.accuracy}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Suspend Confirmation Modal */}
        {suspendModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setSuspendModal(null)}
          >
            <div 
              className="glass-card rounded-3xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-white">Confirm Suspension</h3>
                <button 
                  onClick={() => setSuspendModal(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-gray-300 text-lg mb-2">
                  Are you sure you want to suspend <span className="text-white font-bold">{suspendModal.userName}</span>?
                </p>
                <p className="text-gray-400 text-sm">
                  This user will not be able to log in or use the application until reactivated.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSuspendModal(null)}
                  className="flex-1 glass-button px-6 py-3 rounded-xl text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSuspendUser}
                  className="flex-1 px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-orange-500 to-red-500"
                >
                  Suspend User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Activate Confirmation Modal */}
        {activateModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setActivateModal(null)}
          >
            <div 
              className="glass-card rounded-3xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-white">Confirm Activation</h3>
                <button 
                  onClick={() => setActivateModal(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="mb-6">
                <p className="text-gray-300 text-lg mb-2">
                  Are you sure you want to activate <span className="text-white font-bold">{activateModal.userName}</span>?
                </p>
                <p className="text-gray-400 text-sm">
                  This user will regain full access to the application and be able to log in.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setActivateModal(null)}
                  className="flex-1 glass-button px-6 py-3 rounded-xl text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmActivateUser}
                  className="flex-1 px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-green-500 to-emerald-500"
                >
                  Activate User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Broadcast Modal */}
        {emailBroadcastModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setEmailBroadcastModal(false)}
          >
            <div 
              className="glass-card rounded-3xl p-8 max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">Broadcast Email</h3>
                  <p className="text-gray-400 text-sm mt-1">Send an email to all registered users</p>
                </div>
                <button 
                  onClick={() => setEmailBroadcastModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label="Close modal"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-white font-medium mb-2">Subject</label>
                  <input
                    type="text"
                    value={broadcastSubject}
                    onChange={(e) => setBroadcastSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="w-full glass-card-lighter text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                </div>
                <div>
                  <label className="block text-white font-medium mb-2">Message</label>
                  <textarea
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows="6"
                    className="w-full glass-card-lighter text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-green-500/50 resize-none"
                  />
                </div>
                <div className="glass-card-lighter rounded-xl p-4">
                  <p className="text-gray-400 text-sm">
                    📧 This email will be sent to <span className="text-white font-bold">{dashboardData?.total_users || 0}</span> users
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setEmailBroadcastModal(false)}
                  disabled={broadcastLoading}
                  className="flex-1 glass-button px-6 py-3 rounded-xl text-white font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmailBroadcast}
                  disabled={broadcastLoading || !broadcastSubject.trim() || !broadcastMessage.trim()}
                  className="flex-1 px-6 py-3 rounded-xl text-white font-medium bg-gradient-to-r from-blue-500 to-purple-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {broadcastLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      Send Broadcast
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;