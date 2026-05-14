# model_predictor_fixed.py
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import load_model
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class ModelPredictor:
    def __init__(self):
        self.models = {}
        
        # Resolve models directory - works in both local and Docker environments
        current_dir = os.path.dirname(os.path.abspath(__file__))
        self.models_dir = os.path.abspath(os.path.join(current_dir, '..', 'ml_models'))
        
        # Fallback for Docker container
        if not os.path.exists(self.models_dir):
            docker_models_dir = os.path.abspath(os.path.join('/app', 'ml_models'))
            if os.path.exists(docker_models_dir):
                self.models_dir = docker_models_dir
        
        self.load_all_models()
    
    def load_all_models(self):
        """Load all trained models without scalers"""
        crops = ['cotton', 'wheat', 'maize', 'rice', 'sugarcane']
        model_types = ['gru', 'lstm']
        
        print("🔄 Loading ML models...")
        print(f"📂 Models directory: {self.models_dir}")
        print(f"✓ Directory exists: {os.path.exists(self.models_dir)}")
        
        if os.path.exists(self.models_dir):
            print(f"📋 Files in directory: {os.listdir(self.models_dir)}")
        
        for crop in crops:
            for model_type in model_types:
                model_key = f"{crop}_{model_type}"
                model_path = os.path.join(self.models_dir, f"{model_key}_model.h5")
                
                if os.path.exists(model_path):
                    try:
                        # Load model without compilation
                        self.models[model_key] = load_model(model_path, compile=False)
                        print(f"✅ Loaded {model_key} model")
                        
                        # Check model input shape
                        model = self.models[model_key]
                        print(f"   Input shape: {model.input_shape}")
                        print(f"   Output shape: {model.output_shape}")
                        
                    except Exception as e:
                        print(f"❌ Error loading {model_key}: {str(e)}")
                else:
                    print(f"❌ Model file not found: {model_path}")
        
        print(f"🎯 Total models loaded: {len(self.models)}")
        print(f"📊 Models available: {list(self.models.keys())}")
    
    def prepare_weather_features(self, weather_data, crop):
        """Prepare weather features based on actual model requirements"""
        try:
            print(f"\n🔍 Preparing features for {crop}")
            print(f"   Received {len(weather_data)} days of data")
            
            # Convert to DataFrame
            df = pd.DataFrame(weather_data)
            print(f"   Original columns: {list(df.columns)}")
            
            # ✅ FIX: Ensure we have all necessary columns
            required_columns = {
                'T2M': 25.0,
                'T2M_MAX': 30.0,
                'T2M_MIN': 20.0,
                'PRECTOTCORR': 0.0,
                'RH2M': 60.0,
                'WS2M': 3.0,
                'DAILY_GDD': 15.0,
                'DRY_DAY': False,
                'date': pd.Timestamp.now().strftime('%Y-%m-%d')
            }
            
            # Add missing columns with default values
            for col, default in required_columns.items():
                if col not in df.columns:
                    df[col] = default
                    print(f"   ⚠️ Added missing column: {col} = {default}")
            
            # Convert types
            numeric_cols = ['T2M', 'T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'RH2M', 'WS2M', 'DAILY_GDD']
            for col in numeric_cols:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(required_columns[col])
            
            df['DRY_DAY'] = df['DRY_DAY'].astype(bool)
            
            # Calculate crop-specific base temperature for GDD
            base_temps = {
                'cotton': 15.0,
                'wheat': 5.0,
                'maize': 10.0,
                'rice': 10.0,
                'sugarcane': 12.0
            }
            base_temp = base_temps.get(crop, 10.0)
            
            # Recalculate GDD if needed
            if 'DAILY_GDD' not in df.columns or df['DAILY_GDD'].isna().any():
                df['DAILY_GDD'] = np.maximum(0, (df['T2M_MAX'] + df['T2M_MIN']) / 2 - base_temp)
            
            # Add cumulative GDD
            df['CUMULATIVE_GDD'] = df['DAILY_GDD'].cumsum()
            
            # Add crop-specific features
            self.add_crop_specific_features(df, crop)
            
            print(f"   After processing columns: {list(df.columns)}")
            print(f"   DataFrame shape: {df.shape}")
            
            # Get model to understand expected input shape
            model_key = f"{crop}_gru"
            if model_key in self.models:
                model = self.models[model_key]
                expected_shape = model.input_shape
                
                print(f"\n🎯 Model {model_key} expects:")
                print(f"   Input shape: {expected_shape}")
                print(f"   Need to create {expected_shape[2]} features")
                
                # ✅ FIX: Always prepare 21 features since models expect 21
                features = self.prepare_21_features(df, crop)
                
                print(f"   Created features shape: {features.shape}")
                print(f"   Features min: {features.min():.2f}, max: {features.max():.2f}")
                
                return features
            else:
                # Fallback to 21 features
                return self.prepare_21_features(df, crop)
                
        except Exception as e:
            print(f"❌ Error preparing features: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def prepare_21_features(self, df, crop):
        """Prepare exactly 21 features that the model expects"""
        n_days = len(df)
        n_features = 21
        features = np.zeros((1, n_days, n_features))
        
        print(f"   Creating {n_features} features for {n_days} days")
        
        # Define the 21 features in order
        feature_mapping = [
            # Basic weather features (0-7)
            ('T2M', 'avg_temp'),
            ('T2M_MAX', 'max_temp'),
            ('T2M_MIN', 'min_temp'),
            ('PRECTOTCORR', 'precipitation'),
            ('RH2M', 'humidity'),
            ('WS2M', 'wind_speed'),
            ('DAILY_GDD', 'growing_degree_days'),
            ('CUMULATIVE_GDD', 'cumulative_gdd'),
            
            # Derived features (8-14)
            ('HEAT_STRESS', 'heat_stress'),
            ('DRY_DAY', 'dry_day'),
            ('TEMP_7D_AVG', 'temp_7day_avg'),
            ('RAIN_7D_SUM', 'rain_7day_sum'),
            ('DRY_SPELL', 'dry_spell'),
            ('SIN_DOY', 'sin_day_of_year'),
            ('COS_DOY', 'cos_day_of_year'),
            
            # Additional features (15-20) - based on common agricultural models
            ('DAY_OF_YEAR', 'day_of_year'),
            ('SOLAR_RADIATION', 'solar_radiation'),
            ('SUNSHINE_HOURS', 'sunshine_hours'),
            ('SOIL_MOISTURE', 'soil_moisture'),
            ('EVAPOTRANSPIRATION', 'evapotranspiration'),
            ('CROP_COEFFICIENT', 'crop_coefficient')
        ]
        
        # Fill the first 15 features from DataFrame
        for i in range(min(15, len(feature_mapping))):
            col_name, feature_name = feature_mapping[i]
            
            if col_name in df.columns:
                # Get the column values
                if col_name == 'DRY_DAY':
                    # Convert boolean to 0/1
                    features[0, :, i] = df[col_name].astype(int).values
                else:
                    features[0, :, i] = df[col_name].values
                print(f"   Feature {i}: {feature_name} = {col_name}")
            else:
                # Set default values for missing features
                if feature_name == 'solar_radiation':
                    features[0, :, i] = 15.0  # MJ/m²/day
                elif feature_name == 'sunshine_hours':
                    features[0, :, i] = 8.0  # hours
                elif feature_name == 'soil_moisture':
                    features[0, :, i] = 0.5  # fraction
                elif feature_name == 'evapotranspiration':
                    # Estimate ET from temperature and humidity
                    avg_temp = df['T2M'].mean() if 'T2M' in df.columns else 25.0
                    humidity = df['RH2M'].mean() if 'RH2M' in df.columns else 60.0
                    features[0, :, i] = max(0, 0.0023 * (avg_temp + 17.8) * (100 - humidity) / 100)
                elif feature_name == 'crop_coefficient':
                    # Crop-specific Kc values
                    kc_values = {
                        'cotton': 1.15,
                        'wheat': 1.05,
                        'maize': 1.20,
                        'rice': 1.10,
                        'sugarcane': 1.25
                    }
                    features[0, :, i] = kc_values.get(crop, 1.0)
                else:
                    features[0, :, i] = 0.0
        
        # Fill remaining features (16-20)
        for i in range(15, n_features):
            # These are additional derived features
            if i == 15:  # Day of year (normalized)
                if 'DAY_OF_YEAR' in df.columns:
                    features[0, :, i] = df['DAY_OF_YEAR'].values / 365.0
                else:
                    features[0, :, i] = np.arange(n_days) / 365.0
            
            elif i == 16:  # Temperature amplitude (max-min)
                if 'T2M_MAX' in df.columns and 'T2M_MIN' in df.columns:
                    features[0, :, i] = df['T2M_MAX'] - df['T2M_MIN']
                else:
                    features[0, :, i] = 10.0
            
            elif i == 17:  # Rain intensity indicator
                if 'PRECTOTCORR' in df.columns:
                    features[0, :, i] = (df['PRECTOTCORR'] > 5).astype(int)
                else:
                    features[0, :, i] = 0.0
            
            elif i == 18:  # Wind speed squared (for wind pressure)
                if 'WS2M' in df.columns:
                    features[0, :, i] = df['WS2M'] ** 2
                else:
                    features[0, :, i] = 9.0
            
            elif i == 19:  # Temperature-humidity index
                if 'T2M' in df.columns and 'RH2M' in df.columns:
                    features[0, :, i] = df['T2M'] * (0.5 + df['RH2M'] / 200)
                else:
                    features[0, :, i] = 25.0
            
            elif i == 20:  # Season progress (0 to 1)
                features[0, :, i] = np.linspace(0, 1, n_days)
        
        print(f"   ✅ Created features with shape: {features.shape}")
        return features
    
    def add_crop_specific_features(self, df, crop):
        """Add crop-specific calculated features"""
        # Heat stress days (crop-specific thresholds)
        heat_thresholds = {
            'cotton': 35, 'wheat': 30, 'maize': 33, 
            'rice': 36, 'sugarcane': 38
        }
        threshold = heat_thresholds.get(crop, 35)
        df['HEAT_STRESS'] = (df['T2M_MAX'] > threshold).astype(int)
        
        # Dry spell (convert boolean to int)
        df['DRY_SPELL'] = df['DRY_DAY'].rolling(window=7, min_periods=1).sum().astype(int)
        
        # Rolling averages
        df['TEMP_7D_AVG'] = df['T2M'].rolling(window=7, min_periods=1).mean()
        df['RAIN_7D_SUM'] = df['PRECTOTCORR'].rolling(window=7, min_periods=1).sum()
        
        # ✅ SIMPLE FIX: Don't parse dates, just use day index
        # Create day of year based on index
        df['DAY_OF_YEAR'] = (df.index % 365) + 1
        df['SIN_DOY'] = np.sin(2 * np.pi * df['DAY_OF_YEAR'] / 365)
        df['COS_DOY'] = np.cos(2 * np.pi * df['DAY_OF_YEAR'] / 365)
        
        # Add more features for 21 total
        # Solar radiation estimate (simplified)
        df['SOLAR_RADIATION'] = 15.0 + 5 * np.sin(2 * np.pi * df['DAY_OF_YEAR'] / 365)
        
        # Sunshine hours estimate
        df['SUNSHINE_HOURS'] = 8.0 + 4 * np.sin(2 * np.pi * df['DAY_OF_YEAR'] / 365)
        
        # Soil moisture index (simplified)
        df['SOIL_MOISTURE'] = 0.5 + 0.2 * np.sin(2 * np.pi * df['DAY_OF_YEAR'] / 365)
        
        print(f"   Added crop-specific features for {crop}")
        
    def prepare_15_features(self, df, crop):
        """Prepare 15 features (common for many LSTM/GRU models)"""
        features_list = [
            'T2M',  # Average temperature
            'T2M_MAX',  # Max temperature
            'PRECTOTCORR',  # Precipitation
            'RH2M',  # Relative humidity
            'WS2M',  # Wind speed
            'DAILY_GDD',  # Daily GDD
            'CUMULATIVE_GDD',  # Cumulative GDD
            'HEAT_STRESS',  # Heat stress indicator
            'DRY_DAY',  # Dry day indicator
            'TEMP_7D_AVG',  # 7-day temp average
            'RAIN_7D_SUM',  # 7-day rain sum
            'DRY_SPELL',  # Dry spell length
            15.0,  # Solar radiation (placeholder)
            15.0,  # Sunshine hours (placeholder)
            0.5,  # Soil moisture index (placeholder),
        ]
        
        # Create features array
        n_days = len(df)
        n_features = 15
        features = np.zeros((1, n_days, n_features))
        
        for i in range(n_days):
            for j in range(min(n_features, len(features_list))):
                if j < 12:  # First 12 are from DataFrame
                    col_name = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'RH2M', 'WS2M', 
                               'DAILY_GDD', 'CUMULATIVE_GDD', 'HEAT_STRESS', 
                               'DRY_DAY', 'TEMP_7D_AVG', 'RAIN_7D_SUM', 'DRY_SPELL'][j]
                    features[0, i, j] = df.iloc[i][col_name] if col_name in df.columns else features_list[j]
                else:
                    features[0, i, j] = features_list[j]
        
        return features
    
    def prepare_7_features(self, df, crop):
        """Prepare 7 basic features (minimum set)"""
        basic_features = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'RH2M', 'DAILY_GDD', 'HEAT_STRESS', 'DRY_DAY']
        
        n_days = len(df)
        n_features = 7
        features = np.zeros((1, n_days, n_features))
        
        for i in range(n_days):
            for j, col_name in enumerate(basic_features):
                features[0, i, j] = df.iloc[i][col_name] if col_name in df.columns else 0
        
        return features
    
    def prepare_10_features(self, df, crop):
        """Prepare 10 features"""
        feature_cols = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'RH2M', 'WS2M', 
                       'DAILY_GDD', 'CUMULATIVE_GDD', 'HEAT_STRESS', 'DRY_DAY', 'TEMP_7D_AVG']
        
        n_days = len(df)
        n_features = 10
        features = np.zeros((1, n_days, n_features))
        
        for i in range(n_days):
            for j, col_name in enumerate(feature_cols):
                features[0, i, j] = df.iloc[i][col_name] if col_name in df.columns else 0
        
        return features
    
    def predict_yield(self, weather_data, crop='cotton', model_type='gru'):
        """Predict yield using loaded models"""
        try:
            model_key = f"{crop}_{model_type}"
            
            if model_key not in self.models:
                alt_model_key = f"{crop}_{'lstm' if model_type == 'gru' else 'gru'}"
                if alt_model_key in self.models:
                    model_key = alt_model_key
                else:
                    return {'error': f'No model found for {crop}'}
            
            print(f"\n🔮 Predicting for {crop} with {model_key}")
            
            # Prepare features
            features = self.prepare_weather_features(weather_data, crop)
            if features is None:
                return {'error': 'Failed to prepare features'}
            
            print(f"   Input shape: {features.shape}")
            print(f"   Expected shape: (1, 365, 21)")
            
            # Pad or truncate to 365 days
            current_days = features.shape[1]
            if current_days != 365:
                if current_days < 365:
                    # Pad with mean values
                    padding_days = 365 - current_days
                    mean_features = np.mean(features, axis=1, keepdims=True)
                    padding = np.repeat(mean_features, padding_days, axis=1)
                    features = np.concatenate([features, padding], axis=1)
                    print(f"   Padded to shape: {features.shape}")
                else:
                    # Take first 365 days
                    features = features[:, :365, :]
                    print(f"   Truncated to shape: {features.shape}")
            
            # Make prediction
            model = self.models[model_key]
            prediction = model.predict(features, verbose=0)
                    
            print(f"   Raw prediction: {prediction}")
            print(f"   Prediction shape: {prediction.shape}")
                    
            # Extract predicted value
            if prediction.ndim == 2:
                predicted_value = float(prediction[0][0])
            elif prediction.ndim == 3:
                predicted_value = float(prediction[0, -1, 0])  # Last time step
            else:
                predicted_value = float(prediction[0])
            
            # Crop-specific yield ranges
            yield_ranges = {
                'cotton': (1.5, 5.0),
                'wheat': (2.0, 5.0),
                'maize': (3.0, 8.0),
                'rice': (2.0, 6.0),
                'sugarcane': (40.0, 100.0)
            }
            
            min_yield, max_yield = yield_ranges.get(crop, (1.0, 10.0))
            
            # Ensure prediction is within reasonable range
            predicted_yield = np.clip(predicted_value, min_yield, max_yield)
            
            # Calculate confidence based on prediction quality
            weather_quality = self.assess_weather_quality(weather_data, crop)
            confidence = 0.7 + (weather_quality * 0.2)  # 70-90% confidence
            
            return {
                'crop': crop,
                'model_type': model_type,
                'predicted_yield': round(predicted_yield, 2),
                'confidence': round(confidence, 2),
                'units': 'tons/ha',
                'weather_summary': self.get_weather_summary(weather_data),
                'recommendation': self.generate_recommendation(crop, predicted_yield, weather_data),
                'model_used': model_key,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"❌ Prediction error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {'error': f'Prediction failed: {str(e)}'}
    
    def assess_weather_quality(self, weather_data, crop):
        """Assess quality of weather data for prediction"""
        if not weather_data:
            return 0.5
        
        # Check data completeness
        required_fields = ['T2M', 'T2M_MAX', 'PRECTOTCORR']
        completeness = sum(1 for field in required_fields if field in weather_data[0]) / len(required_fields)
        
        # Check data range
        avg_temp = np.mean([day.get('T2M', 25) for day in weather_data])
        
        optimal_temp_ranges = {
            'cotton': (20, 30),
            'wheat': (15, 25),
            'maize': (18, 28),
            'rice': (22, 32),
            'sugarcane': (20, 30)
        }
        
        min_temp, max_temp = optimal_temp_ranges.get(crop, (15, 30))
        temp_score = 1.0 if min_temp <= avg_temp <= max_temp else 0.5
        
        return (completeness + temp_score) / 2
    
    def get_weather_summary(self, weather_data):
        """Create summary of weather data"""
        if not weather_data:
            return {}
        
        avg_temp = np.mean([day.get('T2M', 0) for day in weather_data])
        total_rain = sum([day.get('PRECTOTCORR', 0) for day in weather_data])
        max_temp = max([day.get('T2M_MAX', 0) for day in weather_data])
        
        return {
            'avg_temperature': round(avg_temp, 1),
            'total_rainfall': round(total_rain, 1),
            'max_temperature': round(max_temp, 1),
            'days_analyzed': len(weather_data)
        }
    
    def generate_recommendation(self, crop, predicted_yield, weather_data):
        """Generate actionable recommendation"""
        base_yields = {
            'cotton': 4.3, 'wheat': 3.2, 'maize': 5.1, 
            'rice': 2.8, 'sugarcane': 65.0
        }
        
        base_yield = base_yields.get(crop, 3.0)
        yield_ratio = predicted_yield / base_yield
        
        if yield_ratio > 1.2:
            status = "EXCELLENT conditions"
            primary_advice = "Ideal for planting. Consider expanding area."
        elif yield_ratio > 1.0:
            status = "GOOD conditions"
            primary_advice = "Favorable for cultivation. Proceed as planned."
        elif yield_ratio > 0.8:
            status = "MODERATE conditions"
            primary_advice = "Suitable for cultivation with proper management."
        else:
            status = "CHALLENGING conditions"
            primary_advice = "Consider drought-resistant varieties and water conservation."
        
        # Add weather-specific advice
        avg_temp = np.mean([day.get('T2M', 25) for day in weather_data])
        total_rain = sum([day.get('PRECTOTCORR', 0) for day in weather_data])
        
        advice_details = []
        
        if total_rain < 10:
            advice_details.append("Irrigation required due to low rainfall")
        if avg_temp > 35:
            advice_details.append("Heat stress expected - provide shade/water")
        if total_rain > 50:
            advice_details.append("Ensure proper drainage to prevent waterlogging")
        
        return {
            'status': status,
            'yield_prediction': f"{predicted_yield} tons/ha (expected: {base_yield} tons/ha)",
            'primary_advice': primary_advice,
            'weather_considerations': advice_details,
            'yield_change': f"{((yield_ratio - 1) * 100):+.1f}%"
        }
    
    def get_loaded_models(self):
        """Return list of loaded models"""
        return {
            'models': list(self.models.keys()),
            'models_count': len(self.models)
        }

# Global instance
predictor = ModelPredictor()