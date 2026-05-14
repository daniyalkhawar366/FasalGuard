const express = require('express');
const router = express.Router();
const irrigationService = require('../services/irrigationService');
const comparisonService = require('../services/comparisonService');
const reportService = require('../services/reportService');
const WeatherController = require('../controllers/weatherController'); // Changed: uppercase
const mlPredictionController = require('../controllers/mlPredictionController');
const fs = require('fs');
const path = require('path');

// Instantiate the WeatherController
const weatherController = new WeatherController();

console.log('Weather controller instantiated:', weatherController);
console.log('getRealTimeWeather function:', typeof weatherController.getRealTimeWeather);

// Add body parser middleware to this router
router.use(express.json());
router.use(express.urlencoded({ extended: true }));

const clampText = (value = '', maxLen = 220) => {
  const str = String(value || '').replace(/\s+/g, ' ').trim();
  if (!str) return '';
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;
};

const safeNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const estimateSpeechSeconds = (sections) => {
  const words = sections.reduce((acc, section) => {
    const text = section?.text || '';
    return acc + text.split(/\s+/).filter(Boolean).length;
  }, 0);
  return Math.max(10, Math.round(words / 2.2));
};

const buildWeatherRiskSummary = (forecast = []) => {
  const windowDays = forecast.slice(0, 7);
  if (!windowDays.length) return 'Weather data is limited for the next week.';
  const hotDays = windowDays.filter((d) => Number(d.T2M_MAX || d.T2M || 0) >= 35).length;
  const rainTotal = windowDays.reduce((sum, d) => sum + Number(d.PRECTOTCORR || 0), 0);
  const windyDays = windowDays.filter((d) => Number(d.WS2M || 0) >= 6).length;
  const signals = [];
  if (hotDays > 0) signals.push(`${hotDays} hot day${hotDays === 1 ? '' : 's'} (>=35C)`);
  if (rainTotal >= 8) signals.push(`rain total ${Math.round(rainTotal)} mm`);
  if (windyDays > 0) signals.push(`${windyDays} windy day${windyDays === 1 ? '' : 's'}`);
  return signals.length ? `Next 3-7 days show ${signals.join(', ')}.` : 'No major weather risk signals in the next 3-7 days.';
};

const buildSatelliteVoiceSummary = ({ analysisResult, lang = 'en', mode = 'default' }) => {
  const city = analysisResult?.city || analysisResult?.location?.city || 'the selected field';
  const crop = analysisResult?.crop || analysisResult?.field_report?.crop || 'crop';
  const riskLevel = analysisResult?.field_report?.risk_level || analysisResult?.risk_level || 'Unknown';
  const health = analysisResult?.field_report?.health_label || analysisResult?.farmer_summary?.status_label || 'Unavailable';
  const confidence = safeNumber(analysisResult?.metrics?.confidence || analysisResult?.field_report?.confidence);
  const forecast = analysisResult?.weather_context?.forecast || analysisResult?.weather_context?.daily || [];
  const irrigation = analysisResult?.farmer_summary?.irrigation || {};
  const recommendations = Array.isArray(analysisResult?.recommendations) ? analysisResult.recommendations : [];
  const actionList = recommendations.map((rec) => rec.summary || rec.action || rec.recommendation || rec.title).filter(Boolean);
  const topActions = actionList.slice(0, mode === 'full' ? 5 : 3);
  const warnings = [];
  if (String(riskLevel).toLowerCase().includes('high')) warnings.push('High risk alert active');
  if (analysisResult?.diagnosis?.days_to_critical != null) warnings.push(`Critical window in ${analysisResult.diagnosis.days_to_critical} day(s)`);
  if (analysisResult?.weather_context?.summary?.rain_next_48h != null) {
    const rain48 = Number(analysisResult.weather_context.summary.rain_next_48h || 0);
    if (rain48 < 4) warnings.push('Low rain expected in 48 hours');
  }

  const sections = [
    {
      id: 'snapshot',
      title: 'Snapshot',
      text: clampText(`Field snapshot for ${city}. Crop ${crop}. Risk level ${riskLevel}. Field health ${health}.`, 180),
    },
    {
      id: 'top-crop',
      title: 'Top crop and confidence',
      text: clampText(confidence != null
        ? `Primary crop signal is ${crop} with model confidence ${Math.round(confidence * 100)} percent.`
        : `Primary crop signal is ${crop}. Model confidence is not reported.`, 180),
    },
    {
      id: 'weather-risk',
      title: 'Weather risks (3 to 7 days)',
      text: clampText(buildWeatherRiskSummary(forecast), 200),
    },
    {
      id: 'irrigation',
      title: 'Irrigation action (24 to 72 hours)',
      text: clampText(irrigation?.irrigate_now
        ? `Irrigate now. Apply ${irrigation.mm_low || ''}${irrigation.mm_low && irrigation.mm_high ? '-' : ''}${irrigation.mm_high || ''} mm within ${irrigation.timing_window || 'the next 24 to 72 hours'}.`
        : 'No immediate irrigation flagged for the next 24 to 72 hours.', 200),
    },
    {
      id: 'recommendations',
      title: 'Actionable recommendations',
      text: clampText(topActions.length
        ? `Top actions: ${topActions.join('; ')}.`
        : 'No specific recommendations available right now.', 240),
    },
    {
      id: 'warnings',
      title: 'Warning alerts',
      text: clampText(warnings.length ? warnings.join('. ') : 'No critical alerts at this time.', 160),
    },
  ];

  return { lang, mode, sections };
};

const buildPredictionVoiceSummary = ({ predictionData, inputData, lang = 'en', mode = 'default' }) => {
  const city = predictionData?.location?.city || inputData?.city || 'the selected location';
  const forecast = Array.isArray(predictionData?.forecast) ? predictionData.forecast : [];
  const recs = Array.isArray(predictionData?.recommendations) ? predictionData.recommendations : [];
  const topRec = recs[0] || {};
  const cropName = topRec.crop || 'top crop';
  const confidence = safeNumber(topRec?.metrics?.ml_confidence || topRec?.confidence || topRec?.metrics?.confidence);
  const actionList = Array.isArray(topRec?.recommendation) ? topRec.recommendation : [];
  const topActions = actionList.slice(0, mode === 'full' ? 5 : 3);
  const warningSignals = [];
  if (forecast.some((d) => Number(d.T2M_MAX || d.T2M || 0) >= 38)) warningSignals.push('Heat stress risk days ahead');
  if (forecast.reduce((sum, d) => sum + Number(d.PRECTOTCORR || 0), 0) >= 12) warningSignals.push('Heavy rainfall window');

  const sections = [
    {
      id: 'snapshot',
      title: 'Snapshot',
      text: clampText(`Forecast snapshot for ${city}. ${inputData?.days || 7} day analysis window.`, 180),
    },
    {
      id: 'top-crop',
      title: 'Top crop and confidence',
      text: clampText(confidence != null
        ? `Top crop recommendation is ${cropName} with confidence ${Math.round(confidence * 100)} percent.`
        : `Top crop recommendation is ${cropName}. Confidence is not reported.`, 180),
    },
    {
      id: 'weather-risk',
      title: 'Weather risks (3 to 7 days)',
      text: clampText(buildWeatherRiskSummary(forecast), 200),
    },
    {
      id: 'irrigation',
      title: 'Irrigation action (24 to 72 hours)',
      text: 'Plan irrigation based on the next 2 to 3 days of rainfall and temperature. Avoid irrigation right before heavy rain.',
    },
    {
      id: 'recommendations',
      title: 'Actionable recommendations',
      text: clampText(topActions.length
        ? `Top actions: ${topActions.join('; ')}.`
        : 'No specific recommendations available right now.', 220),
    },
    {
      id: 'warnings',
      title: 'Warning alerts',
      text: clampText(warningSignals.length ? warningSignals.join('. ') : 'No critical alerts at this time.', 160),
    },
  ];

  return { lang, mode, sections };
};

// CORS middleware (if not already in main app)
router.use((req, res, next) => {
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
  ];
  const configuredOrigins = String(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];
  const requestOrigin = req.headers.origin;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
  }
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Irrigation Calculator Endpoint
router.post('/irrigation-calculation', async (req, res) => {
  try {
    console.log('Irrigation calculation request:', req.body);
    
    const { city, crop, soilType = 'loamy', area_ha = 1, days = 7 } = req.body;
    
    if (!city || !crop) {
      return res.status(400).json({ 
        success: false, 
        error: 'City and crop are required' 
      });
    }
    
    console.log(`Getting weather for ${city}...`);
    
    // Get weather data
    const weatherResponse = await weatherController.getRealTimeWeather(city, days);
    const weatherForecast = weatherResponse.forecast || [];
    
    console.log(`Weather data received: ${weatherForecast.length} days`);
    
    // Calculate irrigation
    const irrigationPlan = irrigationService.calculateIrrigationSchedule(
      crop.toLowerCase(), 
      weatherForecast, 
      soilType, 
      area_ha
    );
    
    res.json({
      success: true,
      city,
      crop,
      weather_days: days,
      irrigation_plan: irrigationPlan,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Irrigation calculation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Multi-crop Water Requirement Comparison
router.post('/water-requirements', async (req, res) => {
  try {
    console.log('Water requirements request:', req.body);
    
    const { city, crops = ['cotton', 'wheat', 'maize', 'rice', 'sugarcane'], area_ha = 1, days = 7 } = req.body;
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        error: 'City is required' 
      });
    }
    
    const weatherResponse = await weatherController.getRealTimeWeather(city, days);
    const weatherForecast = weatherResponse.forecast || [];
    const waterRequirements = irrigationService.calculateMultiCropWaterRequirements(crops, weatherForecast, area_ha);
    
    // Calculate comparison metrics
    const comparison = Object.entries(waterRequirements).map(([crop, data]) => ({
      crop: crop.charAt(0).toUpperCase() + crop.slice(1),
      daily_water_mm: data.daily_water_mm,
      seasonal_water_m3: data.seasonal_water_requirement_m3,
      water_efficiency: data.water_efficiency || 'Moderate',
      irrigation_method: data.irrigation_method?.recommended || 'Sprinkler',
      water_cost: parseFloat((data.seasonal_water_requirement_m3 * 0.5).toFixed(0))
    }));
    
    res.json({
      success: true,
      city,
      total_crops: comparison.length,
      water_requirements: waterRequirements,
      comparison: comparison.sort((a, b) => a.daily_water_mm - b.daily_water_mm),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Water requirements error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Crop Comparison Matrix
router.post('/crop-comparison', async (req, res) => {
  try {
    console.log('Crop comparison request:', req.body);
    
    const { city, days = 7 } = req.body;
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        error: 'City is required' 
      });
    }
    
    const weatherResponse = await weatherController.getRealTimeWeather(city, days);
    const comparisonResult = await comparisonService.generateComparisonMatrix(city, weatherResponse);
    const comparisonMatrix = comparisonResult.comparison_matrix || [];
    
    // Generate visualization data
    const visualizationData = comparisonResult.visualization_data || comparisonService.generateVisualizationData(comparisonMatrix);
    
    res.json({
      success: true,
      city,
      comparison_matrix: comparisonMatrix,
      visualization_data: visualizationData,
      summary: {
        best_crop: comparisonMatrix[0]?.crop || 'N/A',
        highest_profit: [...comparisonMatrix].sort((a, b) => b.profit_per_ha - a.profit_per_ha)[0]?.crop || 'N/A',
        most_water_efficient: [...comparisonMatrix].sort((a, b) => b.normalized_score - a.normalized_score)[0]?.crop || 'N/A',
        lowest_risk: [...comparisonMatrix].sort((a, b) => a.normalized_score - b.normalized_score)[0]?.crop || 'N/A'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Crop comparison error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Generate Comprehensive Report
router.post('/generate-report', async (req, res) => {
  try {
    console.log('Generate report request:', req.body);
    
    const { city, days = 7, includeIrrigation = true, includeComparison = true } = req.body;
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        error: 'City is required' 
      });
    }
    
    console.log(`📄 Generating comprehensive report for ${city}...`);
    
    // Get all necessary data
    const weatherResponse = await weatherController.getRealTimeWeather(city, days);
    const weatherData = weatherResponse.forecast || [];
    
    // Get ML predictions
    const mlPredictions = await mlPredictionController.predictBatchWithML(
      weatherData,
      ['cotton', 'wheat', 'maize', 'rice', 'sugarcane']
    );
    
    // Get crop recommendations
    const cropRecController = require('../controllers/cropRecommendationController');
    const historicalTrends = cropRecController.getHistoricalTrends(city);
    const recommendations = await cropRecController.analyzeCropSuitabilityWithML(
      city, 
      weatherData, 
      historicalTrends
    );
    
    // Get irrigation data if requested
    let irrigationData = null;
    if (includeIrrigation && recommendations.length > 0) {
      const topCrop = recommendations[0].cropKey;
      irrigationData = irrigationService.calculateIrrigationSchedule(
        topCrop, 
        weatherData, 
        'loamy', 
        1
      );
    }
    
    // Get comparison data if requested
    let comparisonData = null;
    if (includeComparison) {
      comparisonData = await comparisonService.generateComparisonMatrix(city, weatherResponse);
    }
    
    // Prepare data for report
    const reportData = {
      location: { city },
      forecast: weatherData,
      recommendations: recommendations,
      predictions: mlPredictions.predictions,
      analysis: {
        ml_predictions: Object.keys(mlPredictions.predictions).length,
        total_crops: 5,
        weather_days: days
      },
      irrigationData,
      comparisonData,
      generatedAt: new Date().toISOString()
    };
    
    // Generate PDF report
    const report = await reportService.generatePredictionReport(reportData, {
      city,
      days,
      name: req.body.name || 'Farmer'
    });
    
    res.json({
      success: true,
      message: 'Report generated successfully',
      report: {
        id: report.reportId,
        download_url: report.downloadUrl,
        file_name: report.fileName,
        generated_at: new Date().toISOString()
      },
      preview_data: {
        top_crop: recommendations[0]?.crop || 'N/A',
        predicted_yield: recommendations[0]?.metrics?.ml_predicted_yield || 'N/A',
        confidence: recommendations[0]?.metrics?.ml_confidence || 'N/A'
      }
    });
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Download Report
router.get('/download-report/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const filePath = path.join(__dirname, '../reports', `${reportId}.pdf`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Report not found' 
      });
    }
    
    res.download(filePath, `FasalGuard_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    
  } catch (error) {
    console.error('Report download error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Visualizations Data Endpoint
router.post('/visualizations', async (req, res) => {
  try {
    console.log('Visualizations request:', req.body);
    
    const { city, days = 7 } = req.body;
    
    if (!city) {
      return res.status(400).json({ 
        success: false, 
        error: 'City is required' 
      });
    }
    
    const weatherResponse = await weatherController.getRealTimeWeather(city, days);
    const weatherData = weatherResponse.forecast || [];
    const comparisonResult = await comparisonService.generateComparisonMatrix(city, weatherResponse);
    const comparisonMatrix = comparisonResult.comparison_matrix || [];
    
    // Generate various visualization data
    const visualizations = {
      // Weather charts
      weather: {
        labels: weatherData.map(day => 
          new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
        ),
        datasets: [
          {
            label: 'Temperature (°C)',
            data: weatherData.map(day => day.T2M),
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)'
          },
          {
            label: 'Rainfall (mm)',
            data: weatherData.map(day => day.PRECTOTCORR),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.1)',
            type: 'bar',
            yAxisID: 'y1'
          }
        ]
      },
      
      // Yield comparison
      yield_comparison: {
        labels: comparisonMatrix.map(crop => crop.crop),
        datasets: [{
          label: 'Predicted Yield (tons/ha)',
          data: comparisonMatrix.map(crop => crop.predicted_yield),
          backgroundColor: [
            'rgba(22, 163, 74, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(20, 184, 166, 0.8)'
          ]
        }]
      },
      
      // Profit comparison
      profit_comparison: {
        labels: comparisonMatrix.map(crop => crop.crop),
        datasets: [{
          label: 'Profit per hectare (PKR)',
          data: comparisonMatrix.map(crop => crop.profit_per_ha),
          backgroundColor: 'rgba(34, 197, 94, 0.8)'
        }]
      },
      
      // Water efficiency
      water_efficiency: {
        labels: comparisonMatrix.map(crop => crop.crop),
        datasets: [
          {
            label: 'Water Requirement',
            data: comparisonMatrix.map(crop => {
              const req = {
                cotton: 600, wheat: 450, maize: 700, rice: 1500, sugarcane: 2000
              }[crop.cropKey] || 500;
              return req;
            }),
            backgroundColor: 'rgba(29, 78, 216, 0.8)'
          },
          {
            label: 'Water Efficiency Score',
            data: comparisonMatrix.map(crop => {
              const score = comparisonService.calculateWaterEfficiencyScore(crop.cropKey, {});
              return score;
            }),
            backgroundColor: 'rgba(20, 184, 166, 0.8)'
          }
        ]
      },
      
      // Radar chart for top 3 crops
      radar_chart: comparisonService.generateRadarChartData(comparisonMatrix.slice(0, 3))
    };
    
    res.json({
      success: true,
      city,
      visualizations,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Visualizations error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Voice summary endpoint
router.post('/voice-summary', async (req, res) => {
  try {
    const { type, analysis, input, options } = req.body || {};
    const lang = options?.lang || req.headers['x-language'] || 'en';
    const mode = options?.mode === 'full' ? 'full' : 'default';

    if (type === 'satellite') {
      if (!analysis) {
        return res.status(400).json({ success: false, error: 'analysis payload is required' });
      }
      const script = buildSatelliteVoiceSummary({ analysisResult: analysis, lang, mode });
      return res.json({
        success: true,
        script,
        estimated_seconds: estimateSpeechSeconds(script.sections),
      });
    }

    if (type === 'prediction') {
      if (!analysis) {
        return res.status(400).json({ success: false, error: 'analysis payload is required' });
      }
      const script = buildPredictionVoiceSummary({ predictionData: analysis, inputData: input, lang, mode });
      return res.json({
        success: true,
        script,
        estimated_seconds: estimateSpeechSeconds(script.sections),
      });
    }

    return res.status(400).json({ success: false, error: 'type must be satellite or prediction' });
  } catch (error) {
    console.error('Voice summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Soil type recommendation
router.post('/soil-analysis', async (req, res) => {
  try {
    const { city, crop } = req.body;
    
    if (!city || !crop) {
      return res.status(400).json({ 
        success: false, 
        error: 'City and crop are required' 
      });
    }
    
    // In real implementation, this would come from soil database or API
    // For now, we'll use a simplified recommendation
    const soilRecommendations = {
      cotton: {
        best_soil: 'Loamy',
        ph_range: '6.0-7.5',
        nutrients: { nitrogen: 'High', phosphorus: 'Medium', potassium: 'Medium' },
        improvement_tips: [
          'Add organic matter to improve water retention',
          'Maintain soil pH around 6.5',
          'Use cover crops to prevent erosion'
        ]
      },
      wheat: {
        best_soil: 'Loamy to Clay Loam',
        ph_range: '6.0-7.5',
        nutrients: { nitrogen: 'High', phosphorus: 'Medium', potassium: 'Medium' },
        improvement_tips: [
          'Add well-decomposed FYM before sowing',
          'Ensure proper drainage in heavy soils',
          'Test soil for micronutrient deficiencies'
        ]
      },
      maize: {
        best_soil: 'Well-drained Loamy',
        ph_range: '5.8-7.0',
        nutrients: { nitrogen: 'Very High', phosphorus: 'High', potassium: 'Medium' },
        improvement_tips: [
          'Deep ploughing to break hard pans',
          'Add compost for better structure',
          'Maintain soil moisture during germination'
        ]
      },
      rice: {
        best_soil: 'Clay to Clay Loam',
        ph_range: '5.5-6.5',
        nutrients: { nitrogen: 'High', phosphorus: 'Medium', potassium: 'High' },
        improvement_tips: [
          'Pudding for water retention',
          'Level field for uniform water distribution',
          'Add organic matter to heavy soils'
        ]
      },
      sugarcane: {
        best_soil: 'Deep Loamy',
        ph_range: '6.5-7.5',
        nutrients: { nitrogen: 'High', phosphorus: 'Medium', potassium: 'Very High' },
        improvement_tips: [
          'Deep ploughing (30-45 cm)',
          'Add FYM and press mud',
          'Ensure good drainage'
        ]
      }
    };
    
    const recommendation = soilRecommendations[crop.toLowerCase()] || soilRecommendations.cotton;
    
    res.json({
      success: true,
      city,
      crop,
      soil_recommendation: recommendation,
      general_soil_tips: [
        'Get soil tested every 2-3 years',
        'Add organic matter regularly',
        'Practice crop rotation',
        'Maintain soil cover'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Soil analysis error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;