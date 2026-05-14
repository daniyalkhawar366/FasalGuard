//just to make sure it redeploys

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');


require('dotenv').config({ path: './config.env' });

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Import routes and controllers
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const predictionRoutes = require('./routes/predictionRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const adminRoutes = require('./routes/adminRoutes');
const analysisRoutes = require('./routes/analysisRoutes'); // Added this line
const WeatherController = require('./controllers/weatherController');
const soilAnalysisRoutes = require('./routes/soilAnalysisRoutes');
const satelliteRoutes = require('./routes/satelliteRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const soilAnalysisService = require('./services/soilAnalysisService');
const { buildDistrictSoilTrendSummary } = require('./utils/soilTrendHelper');


const app = express();

const defaultFrontendOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
];

const configuredFrontendOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultFrontendOrigins, ...configuredFrontendOrigins])];

// Middleware - MOVE THIS BEFORE ROUTES
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
mongoose.connect(mongoUri)
.then(() => {
  console.log('✅ Connected to MongoDB Atlas');
  console.log(`📊 Database: ${mongoose.connection.name}`);
})
.catch((error) => {
  console.error('❌ MongoDB Atlas connection error:', error);
  console.error('💡 Make sure to update your MONGODB_URI in config.env');
  process.exit(1);
});

// Import and attach helper functions
const cropHelpers = require('./utils/cropHelpers');
const weatherHelpers = require('./utils/weatherHelpers');

// Attach helpers to app locals for use in routes
app.locals.getCropSpecificRecommendations = cropHelpers.getCropSpecificRecommendations;
app.locals.getCropSpecificAdvantages = cropHelpers.getCropSpecificAdvantages;
app.locals.getCropSpecificIssues = cropHelpers.getCropSpecificIssues;
app.locals.getPlantingWindow = cropHelpers.getPlantingWindow;
app.locals.getWaterRequirements = cropHelpers.getWaterRequirements;
app.locals.generateRealisticWeather = weatherHelpers.generateRealisticWeather;
app.locals.getWeatherDescription = weatherHelpers.getWeatherDescription;
app.locals.weatherController = new WeatherController();
app.locals.soilAnalysisService = soilAnalysisService;
app.locals.buildDistrictSoilTrendSummary = buildDistrictSoilTrendSummary;

// Routes - UPDATED ORDER
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/predict', predictionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/analysis', analysisRoutes); // Added this line
app.use('/api/soil', soilAnalysisRoutes);
app.use('/api/satellite', satelliteRoutes);
app.use('/api/voice', voiceRoutes);


// Weather API endpoint
app.get('/api/weather', async (req, res) => {
  try {
    const { city, days = 7, lat, lon, latitude, longitude } = req.query;
    const finalLat = latitude ?? lat;
    const finalLon = longitude ?? lon;

    if (!city && (finalLat === undefined || finalLon === undefined)) {
      return res.status(400).json({
        success: false,
        error: 'City parameter or latitude/longitude is required'
      });
    }

    const forecastDays = parseInt(days, 10);
    let weatherData;
    let cityLabel = city;

    if (city) {
      console.log(`🌤️ Fetching weather for ${city}...`);
      weatherData = await app.locals.weatherController.getRealTimeWeather(city, forecastDays);
    } else {
      console.log(`🌤️ Fetching weather for coords ${finalLat}, ${finalLon}...`);
      weatherData = await app.locals.weatherController.getRealTimeWeatherByCoords(
        parseFloat(finalLat),
        parseFloat(finalLon),
        forecastDays,
      );
      cityLabel = weatherData?.summary?.city || `Lat:${finalLat},Lon:${finalLon}`;
    }

    res.json({
      success: true,
      city: cityLabel,
      forecast: weatherData.forecast,
      summary: weatherData.summary
    });
  } catch (error) {
    console.error('❌ Weather fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch weather data'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FasalGuard API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Analysis routes: http://localhost:${PORT}/api/analysis/*`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error('💡 Close the old backend process or run: npm run start:clean');
    process.exit(1);
  }

  console.error('❌ Server startup failed:', err?.message || err);
  process.exit(1);
});

module.exports = app;