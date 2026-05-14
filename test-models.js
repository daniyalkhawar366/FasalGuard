/**
 * Diagnostic Test - Check all model loading and endpoint connectivity
 * Run this after starting both backend and ML service
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:5000';
const ML_SERVICE_URL = 'http://localhost:5001';

async function test() {
  console.log('\n=== FasalGuard Model Diagnostic Test ===\n');

  // Test 1: Backend health
  console.log('1️⃣  Testing Backend Health...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`);
    console.log('   ✅ Backend healthy');
    console.log(`   - Status: ${response.data.status}`);
    console.log(`   - Crop models loaded: ${response.data.yield_models_loaded}`);
    console.log(`   - Soil models: ${response.data.soil_models_loaded ? 'LOADED ✅' : 'NOT LOADED ❌'}`);
    console.log(`   - ML Service available: ${response.data.mlServiceAvailable ? 'YES ✅' : 'NO ❌'}`);
  } catch (error) {
    console.log(`   ❌ Backend health check failed: ${error.message}`);
  }

  // Test 2: ML Service health
  console.log('\n2️⃣  Testing ML Service Health...');
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`);
    console.log('   ✅ ML Service healthy');
    console.log(`   - Yield models: ${response.data.yield_models_loaded}/10`);
    console.log(`   - Soil models loaded: ${response.data.soil_models_loaded ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Available soil models: ${response.data.soil_models_available.length}`);
    if (response.data.soil_models_available.length > 0) {
      console.log(`     ${response.data.soil_models_available.join(', ')}`);
    }
  } catch (error) {
    console.log(`   ❌ ML Service not running: ${error.message}`);
    console.log(`      Make sure to run: cd backend/ml_service && python app.py`);
  }

  // Test 3: Satellite analyze endpoint
  console.log('\n3️⃣  Testing Satellite Analysis Endpoint...');
  try {
    const payload = {
      latitude: 31.5204,
      longitude: 74.3587,
      crop: 'wheat',
      city: 'Lahore'
    };
    const response = await axios.post(
      `${BACKEND_URL}/api/satellite/analyze`,
      payload,
      { timeout: 10000 }
    );
    console.log('   ✅ Satellite analysis endpoint working');
    console.log(`   - Analysis status: ${response.data.status}`);
  } catch (error) {
    console.log(`   ❌ Satellite endpoint error: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      console.log('      → Backend not running or port mismatch');
    } else if (error.response?.status === 500) {
      console.log(`      → Server error: ${error.response.data?.error}`);
    }
  }

  // Test 4: Crop yield prediction
  console.log('\n4️⃣  Testing Crop Yield Prediction...');
  try {
    const weatherData = Array(7).fill(null).map((_, i) => ({
      date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
      T2M: 25 + Math.random() * 10,
      T2M_MAX: 32 + Math.random() * 5,
      T2M_MIN: 18 + Math.random() * 5,
      PRECTOTCORR: Math.random() * 5,
      RH2M: 50 + Math.random() * 30,
      WS2M: 2 + Math.random() * 4
    }));

    const response = await axios.post(
      `${ML_SERVICE_URL}/predict`,
      {
        weather_data: weatherData,
        crop: 'wheat',
        model_type: 'gru'
      },
      { timeout: 10000 }
    );
    console.log('   ✅ Prediction endpoint working');
    console.log(`   - Predicted yield: ${response.data.predicted_yield} tons/ha`);
  } catch (error) {
    console.log(`   ❌ Prediction error: ${error.message}`);
  }

  // Test 5: Soil analysis
  console.log('\n5️⃣  Testing Soil Analysis Endpoint...');
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/soil/district`,
      {
        district: 'Lahore',
        crop: 'Wheat'
      },
      { timeout: 10000 }
    );
    console.log('   ✅ Soil analysis endpoint working');
    console.log(`   - Status: ${response.data.success ? 'SUCCESS ✅' : 'FAILED ❌'}`);
  } catch (error) {
    console.log(`   ⚠️  Soil analysis error: ${error.message}`);
  }

  console.log('\n=== Test Complete ===\n');
  console.log('💡 If tests fail, ensure:');
  console.log('   1. Backend running: npm run dev (from backend/)');
  console.log('   2. ML Service running: python app.py (from backend/ml_service/)');
  console.log('   3. Python venv activated with dependencies installed');
  console.log('   4. MongoDB connection working\n');
}

test();
