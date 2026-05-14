from flask import Flask, request, jsonify
from flask_cors import CORS
from model_predictor import predictor
from soil_analyzer import soil_analyzer  # Import from fixed analyzer
from satellite_predictor import satellite_predictor
import traceback
import numpy as np
import os
from datetime import datetime

def pad_to_365_days(features, target_days=365):
    """Pad 7 days of data to 365 days for model compatibility"""
    current_days = features.shape[1]
    if current_days >= target_days:
        return features[:, :target_days, :]
    
    # Pad with the mean of available days (better than zeros)
    padding_days = target_days - current_days
    mean_features = np.mean(features, axis=1, keepdims=True)
    padding = np.repeat(mean_features, padding_days, axis=1)
    padded_features = np.concatenate([features, padding], axis=1)
    return padded_features

app = Flask(__name__)
CORS(app)

# Initialize Google Earth Engine on startup
print("\n🚀 Initializing ML Service models...")
print("📦 Models loaded:")
print(f"   - Crop yield models: {predictor.get_loaded_models()['models_count']}")
print(f"   - Soil analysis: {soil_analyzer.get_model_status()['loaded']}")
try:
    # Try to initialize GEE (may fail if credentials not available, which is OK)
    from satellite_predictor import _init_gee
    _init_gee()
except Exception as e:
    print(f"ℹ️  GEE initialization not attempted (OK if not using GEE): {e}")

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    models_status = predictor.get_loaded_models()
    soil_status = soil_analyzer.get_model_status()
    return jsonify({
        'status': 'healthy',
        'yield_models_loaded': models_status['models_count'],
        'yield_models': models_status['models'],
        'soil_models_loaded': soil_status['loaded'],
        'soil_models_available': soil_status.get('models_available', []),
        'message': 'ML service running with pre-trained models'
    })

# =============== CLIMATE/CROP PREDICTION ENDPOINTS ===============

@app.route('/predict', methods=['POST'])
def predict():
    """Crop yield prediction endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
        
        weather_data = data.get('weather_data', [])
        crop = data.get('crop', 'cotton')
        model_type = data.get('model_type', 'gru')
        
        if not weather_data:
            return jsonify({'error': 'No weather data provided'}), 400
        
        print(f"\n📥 Received prediction request for {crop} using {model_type}")
        
        # Make prediction
        result = predictor.predict_yield(weather_data, crop, model_type)
        
        if 'error' in result:
            return jsonify(result), 400
        
        print(f"✅ Prediction successful: {result.get('predicted_yield', 'N/A')} tons/ha")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Prediction endpoint error: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """Predict for multiple crops at once"""
    try:
        data = request.get_json()
        weather_data = data.get('weather_data', [])
        crops = data.get('crops', ['cotton', 'wheat', 'maize', 'rice', 'sugarcane'])
        model_type = data.get('model_type', 'gru')
        
        results = {}
        for crop in crops:
            results[crop] = predictor.predict_yield(weather_data, crop, model_type)
        
        return jsonify({'predictions': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =============== SOIL ANALYSIS ENDPOINTS ===============

@app.route('/api/soil/district', methods=['POST'])
def analyze_soil_district():
    """Analyze soil based on district"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        district = data.get('district', 'Lahore')
        current_crop = data.get('currentCrop', None)  # Note: using currentCrop to match frontend
        
        if not district:
            return jsonify({
                'success': False,
                'error': 'District name is required'
            }), 400
        
        print(f"\n🌱 Received soil analysis request for {district}")
        
        # Analyze soil
        result = soil_analyzer.analyze_district(district, current_crop)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Soil analysis error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Soil analysis error: {str(e)}'
        }), 500

@app.route('/api/soil/manual', methods=['POST'])
def analyze_soil_manual():
    """Analyze soil based on manual parameters"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        soil_params = data.get('soil_params', {})
        district = data.get('district', 'Manual Input')
        current_crop = data.get('current_crop', None)
        
        if not soil_params:
            return jsonify({
                'success': False,
                'error': 'Soil parameters are required'
            }), 400
        
        print(f"\n🧪 Received manual soil analysis request")
        
        # Analyze soil
        result = soil_analyzer.analyze_manual(soil_params, district, current_crop)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Manual soil analysis error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Soil analysis error: {str(e)}'
        }), 500

@app.route('/api/soil/districts', methods=['GET'])
def get_soil_districts():
    """Get list of available districts with soil data"""
    try:
        districts = soil_analyzer.get_available_districts()
        return jsonify({
            'success': True,
            'districts': districts,
            'count': len(districts)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/soil/district/<district_name>', methods=['GET'])
def get_district_details(district_name):
    """Get detailed soil information for a district"""
    try:
        details = soil_analyzer.get_district_details(district_name)
        
        if not details:
            return jsonify({
                'success': False,
                'error': f'District {district_name} not found'
            }), 404
        
        return jsonify({
            'success': True,
            'district': details
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/soil/models', methods=['GET'])
def get_soil_models():
    """Get information about loaded soil models"""
    try:
        return jsonify(soil_analyzer.get_model_info())
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# =============== FRONTEND COMPATIBILITY ENDPOINTS ===============

@app.route('/api/predict/ai-prediction', methods=['POST'])
def ai_prediction():
    """AI crop prediction endpoint - for CropPredictionPage.js"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No JSON data provided'
            }), 400
        
        city = data.get('city', '')
        days = data.get('days', 7)
        
        print(f"\n🤖 Received AI prediction request for {city} ({days} days)")
        
        # For now, use soil analysis as fallback
        # In the future, this could call a dedicated AI model
        if city:
            # Use soil analysis for the city
            result = soil_analyzer.analyze_district(city, None)
            if result['success']:
                result['city'] = city
                result['days'] = days
                result['weather_used'] = False
                return jsonify(result)
        
        # Fallback response
        result = {
            'success': True,
            'city': city,
            'days': days,
            'analysis': {
                'soil_health': 'Good',
                'recommended_crop': 'Wheat',
                'overall_score': 75.5,
                'parameter_scores': {
                    'pH': 80,
                    'Organic Carbon': 70,
                    'Nitrogen': 65,
                    'Salinity': 85,
                    'Clay Content': 75
                }
            },
            'recommendations': [
                {
                    'type': 'Crop Selection',
                    'action': 'Plant Wheat',
                    'priority': 'High',
                    'reason': 'Best suited for current soil conditions'
                }
            ],
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'weather_used': False
        }
        
        print(f"✅ AI prediction successful for {city}")
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ AI prediction error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'AI prediction error: {str(e)}'
        }), 500

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """Get weather data - for CropPredictionPage.js"""
    try:
        city = request.args.get('city', 'Lahore')
        days = int(request.args.get('days', 7))
        
        print(f"\n🌤️ Received weather request for {city} ({days} days)")
        
        # Mock weather data response matching the frontend structure
        weather_data = {
            'city': city,
            'country': 'Pakistan',
            'forecast': []
        }
        
        # Generate mock forecast data
        import random
        for i in range(days):
            weather_data['forecast'].append({
                'date': f'2024-01-{15 + i:02d}',
                'T2M': 25 + (i % 3) - 1,  # Temperature
                'T2M_MAX': 30 + (i % 4) - 2,  # Max temperature
                'T2M_MIN': 15 + (i % 3) - 1,  # Min temperature
                'PRECTOTCORR': 0 if i < 3 else 5 if i < 5 else 10,  # Precipitation
                'RH2M': 60 + (i % 20),  # Humidity
                'WS2M': 5 + (i % 5),  # Wind speed
                'ALLSKY_SFC_SW_DWN': 200 + (i % 100)  # Solar radiation
            })
        
        print(f"✅ Weather data generated for {city}")
        
        return jsonify(weather_data)
        
    except Exception as e:
        print(f"❌ Weather endpoint error: {str(e)}")
        traceback.print_exc()
        return jsonify({
            'error': f'Weather data error: {str(e)}'
        }), 500

# =============== BACKWARD COMPATIBILITY ENDPOINTS ===============

@app.route('/soil/analyze/district', methods=['POST'])
def legacy_analyze_soil_district():
    """Legacy endpoint for backward compatibility"""
    return analyze_soil_district()

@app.route('/soil/analyze/manual', methods=['POST'])
def legacy_analyze_soil_manual():
    """Legacy endpoint for backward compatibility"""
    return analyze_soil_manual()

@app.route('/soil/districts', methods=['GET'])
def legacy_get_soil_districts():
    """Legacy endpoint for backward compatibility"""
    return get_soil_districts()

@app.route('/soil/district/<district_name>', methods=['GET'])
def legacy_get_district_details(district_name):
    """Legacy endpoint for backward compatibility"""
    return get_district_details(district_name)

@app.route('/soil/models', methods=['GET'])
def legacy_get_soil_models():
    """Legacy endpoint for backward compatibility"""
    return get_soil_models()

# =============== SATELLITE ANALYSIS ENDPOINTS ===============

@app.route('/satellite/analyze', methods=['POST'])
def analyze_satellite():
    """Satellite-based crop stress prediction using Sentinel-2 indices"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'error': 'No JSON data provided'}), 400

        lat = data.get('latitude', data.get('lat'))
        lon = data.get('longitude', data.get('lon'))
        crop = data.get('crop', 'wheat')
        city = data.get('city')
        month = data.get('month', None)
        analysis_date = data.get('analysis_date', None)
        field_polygon = data.get('field_polygon', None)
        weather_data = data.get('weather_data', [])

        if lat is None or lon is None:
            return jsonify({'status': 'error', 'error': 'latitude and longitude are required'}), 400

        weather_context = None
        if isinstance(weather_data, list) and weather_data:
            weather_summary = predictor.get_weather_summary(weather_data)
            avg_humidity = float(np.mean([day.get('RH2M', 0) for day in weather_data])) if weather_data else 0.0
            max_wind_speed = float(max([day.get('WS2M', 0) for day in weather_data])) if weather_data else 0.0
            rain_next_48h = float(sum([day.get('PRECTOTCORR', 0) for day in weather_data[:2]])) if weather_data else 0.0

            weather_summary['avg_humidity'] = round(avg_humidity, 1)
            weather_summary['max_wind_speed'] = round(max_wind_speed, 1)
            weather_summary['rain_next_48h'] = round(rain_next_48h, 1)

            weather_context = {
                'summary': weather_summary,
                'quality': predictor.assess_weather_quality(weather_data, crop),
                'forecast_days': len(weather_data),
                'hot_days': sum(1 for day in weather_data if day.get('T2M_MAX', 0) >= 35),
                'very_hot_days': sum(1 for day in weather_data if day.get('T2M_MAX', 0) >= 38),
                'dry_days': sum(1 for day in weather_data if day.get('PRECTOTCORR', 0) < 1),
                'rainy_days': sum(1 for day in weather_data if day.get('PRECTOTCORR', 0) >= 5),
                'heavy_rain_days': sum(1 for day in weather_data if day.get('PRECTOTCORR', 0) >= 10),
                'rain_next_48h': round(rain_next_48h, 1),
            }

        print(f"\n🛰️  Satellite analysis: ({lat}, {lon}) crop={crop}")
        result = satellite_predictor.analyze(
            float(lat), float(lon), crop, city, month, analysis_date, field_polygon, weather_context
        )
        # Use Response with json.dumps instead of jsonify to preserve all fields
        import json
        from flask import Response
        return Response(json.dumps(result), mimetype='application/json')

    except Exception as e:
        print(f"❌ Satellite analysis error: {str(e)}")
        traceback.print_exc()
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/satellite/health', methods=['GET'])
def satellite_health():
    """Health check for satellite analysis service"""
    status = satellite_predictor.get_status()
    return jsonify({
        'success': True,
        'model_loaded': status['model_loaded'],
        'gee_initialized': status['gee_initialized'],
        'gee_last_error': status.get('gee_last_error'),
        'gee_credentials_used': status.get('gee_credentials_used'),
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting ML Prediction Service with Soil Analysis...")
    print("=" * 60)
    
    # Print climate/crop model status
    climate_models = predictor.get_loaded_models()
    print(f"\n🌾 Climate/Crop Models Status:")
    print(f"   Models loaded: {climate_models['models_count']}")
    print(f"   Available: {climate_models['models']}")
    
    # Print soil model status
    soil_status = soil_analyzer.get_model_status()
    print(f"\n🌱 Soil Analysis Models Status:")
    print(f"   Models loaded: {soil_status['loaded']}")
    if soil_status['loaded']:
        print(f"   Available: {', '.join(soil_status.get('models_available', []))}")
        if 'limitation_names' in soil_status:
            print(f"   Limitations: {', '.join(soil_status['limitation_names'])}")
    else:
        print(f"   ❌ Soil models not loaded")
    
    print(f"\n📡 API Endpoints:")
    print(f"   /health - Health check")
    print(f"   /predict - Crop yield prediction")
    print(f"   /api/soil/district - Soil analysis by district")
    print(f"   /api/soil/manual - Soil analysis with manual parameters")
    print(f"   /api/weather - Weather data (for frontend)")
    print(f"   /api/predict/ai-prediction - AI crop prediction")
    port = int(os.getenv('PORT', '5001'))
    print(f"\n🔧 Running on port {port}")
    print("=" * 60)

    app.run(host='0.0.0.0', port=port, debug=False)