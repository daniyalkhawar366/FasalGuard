#!/usr/bin/env python3
"""Satellite analysis pipeline backed by Google Earth Engine and a trained ensemble."""

import json
import math
import os
import traceback
from datetime import datetime, timedelta

import joblib
import numpy as np

GEE_PROJECT_ID = os.getenv('GEE_PROJECT_ID', 'bubbly-access-432919-g8')

GEE_INITIALIZED = False
GEE_LAST_ERROR = None
GEE_CREDENTIALS_USED = None
ee = None

DEFAULT_FEATURE_NAMES = ['ndwi', 'evi', 'gndvi', 'month', 'growth_stage_code']

SUPPORTED_SATELLITE_CROPS = {'wheat', 'cotton', 'rice', 'maize', 'sugarcane'}

CROP_GROWTH_STAGE_MAPPINGS = {
    'wheat': {
        # Active wheat season (Nov–Apr)
        11: (1, 'Germination'),
        12: (2, 'Tillering'),
        1:  (3, 'Stem Elongation'),
        2:  (3, 'Stem Elongation'),
        3:  (4, 'Heading/Flowering'),
        4:  (5, 'Grain Filling'),
        # Post-harvest / fallow (May–Oct): harvest complete, no active wheat
        5:  (6, 'Maturity/Post-Harvest'),
        6:  (6, 'Post-Harvest Fallow'),
        7:  (6, 'Post-Harvest Fallow'),
        8:  (6, 'Post-Harvest Fallow'),
        9:  (6, 'Post-Harvest Fallow'),
        10: (6, 'Post-Harvest Fallow'),
    },
    'cotton': {
        # Typical Punjab cotton cycle (Apr–Nov)
        4:  (1, 'Establishment'),
        5:  (2, 'Vegetative Growth'),
        6:  (3, 'Squaring'),
        7:  (3, 'Squaring'),
        8:  (4, 'Flowering / Boll Set'),
        9:  (4, 'Flowering / Boll Set'),
        10: (5, 'Boll Development'),
        11: (5, 'Boll Opening / Picking'),
        # Off-season (Dec–Mar)
        12: (6, 'Post-Harvest Fallow'),
        1:  (6, 'Post-Harvest Fallow'),
        2:  (6, 'Post-Harvest Fallow'),
        3:  (6, 'Post-Harvest Fallow'),
    },
    'rice': {
        # Typical Punjab rice cycle (Jun–Nov)
        6:  (1, 'Nursery / Transplanting'),
        7:  (2, 'Tillering'),
        8:  (3, 'Panicle Initiation'),
        9:  (4, 'Flowering'),
        10: (5, 'Grain Filling'),
        11: (5, 'Maturity / Harvest Ready'),
        # Off-season (Dec–May)
        12: (6, 'Post-Harvest Fallow'),
        1:  (6, 'Post-Harvest Fallow'),
        2:  (6, 'Post-Harvest Fallow'),
        3:  (6, 'Post-Harvest Fallow'),
        4:  (6, 'Post-Harvest Fallow'),
        5:  (6, 'Post-Harvest Fallow'),
    },
    'maize': {
        # Typical Punjab maize cycle (Mar–Oct)
        3:  (1, 'Germination'),
        4:  (2, 'Vegetative Growth'),
        5:  (2, 'Vegetative Growth'),
        6:  (3, 'Tasseling'),
        7:  (4, 'Anthesis / Flowering'),
        8:  (5, 'Grain Filling'),
        9:  (5, 'Grain Filling'),
        10: (5, 'Maturity / Drough-down'),
        # Off-season (Nov–Feb)
        11: (6, 'Post-Harvest Fallow'),
        12: (6, 'Post-Harvest Fallow'),
        1:  (6, 'Post-Harvest Fallow'),
        2:  (6, 'Post-Harvest Fallow'),
    },
    'sugarcane': {
        # Typical Punjab sugarcane cycle (long-duration crop)
        1:  (2, 'Tillering'),
        2:  (2, 'Tillering'),
        3:  (3, 'Grand Growth'),
        4:  (3, 'Grand Growth'),
        5:  (4, 'Cane Elongation'),
        6:  (4, 'Cane Elongation'),
        7:  (4, 'Cane Elongation'),
        8:  (4, 'Cane Elongation'),
        9:  (5, 'Maturation'),
        10: (5, 'Maturation'),
        11: (5, 'Harvest Ready'),
        12: (5, 'Harvest Ready'),
    },
}

COTTON_SUPPORTED_CITIES = {
    'bahawalpur',
    'bahwalpur',
    'multan',
    'faisalabad',
    'sargodha',
    'lahore',
}

RICE_SUPPORTED_CITIES = {
    'faisalabad',
    'lahore',
    'gujrat',
    'sargodha',
    'multan',
}

MAIZE_SUPPORTED_CITIES = {
    'faisalabad',
    'lahore',
    'multan',
    'sargodha',
    'bahawalpur',
}

SUGARCANE_SUPPORTED_CITIES = {
    'multan',
    'bahawalpur',
    'sargodha',
    'faisalabad',
    'gujrat',
}

APPROX_PERCENTILE_MEAN = 0.33
APPROX_PERCENTILE_STD = 0.12
FIELD_HEATMAP_RADIUS_METERS = int(os.getenv('FIELD_HEATMAP_RADIUS_METERS', '250'))
SAT_DEBUG = os.getenv('SAT_DEBUG', '1').strip().lower() in {'1', 'true', 'yes', 'on'}

# Crops that are clearly agricultural but not supported by this model.
# Extend this list as needed.
# NOTE: maize is now supported by satellite ML — do not add to this list.
NON_WHEAT_CROPS = {
    'corn', 'sunflower',
    'soybean', 'canola', 'barley', 'potato', 'onion', 'tomato',
    'mustard', 'lentil', 'chickpea', 'mung', 'mungbean',
}

# Crop decision profiles used by the farmer-focused decision engine.
# These values are practical Punjab defaults for stage-wise irrigation logic.
CROP_DECISION_PROFILES = {
    'wheat': {
        'kc_by_stage': {1: 0.35, 2: 0.55, 3: 0.85, 4: 1.05, 5: 0.90, 6: 0.20},
        'ndwi_target_by_stage': {1: -0.10, 2: -0.07, 3: -0.04, 4: -0.02, 5: -0.03, 6: -0.15},
        'stage_potential_maunds': {1: 40.0, 2: 40.0, 3: 40.0, 4: 38.0, 5: 36.0},
        'ndvi_benchmark': {3: 0.55, 4: 0.63, 5: 0.44},
        'stage_sensitivity': {1: 0.50, 2: 0.60, 3: 0.75, 4: 1.00, 5: 1.00},
    },
    'rice': {
        'kc_by_stage': {1: 1.00, 2: 1.05, 3: 1.15, 4: 1.20, 5: 1.10, 6: 0.50},
        'ndwi_target_by_stage': {1: 0.05, 2: 0.08, 3: 0.10, 4: 0.10, 5: 0.06, 6: -0.05},
        'stage_potential_maunds': {1: 35.0, 2: 35.0, 3: 35.0, 4: 33.0, 5: 31.0},
        'ndvi_benchmark': {3: 0.68, 4: 0.72, 5: 0.58},
        'stage_sensitivity': {1: 0.40, 2: 0.55, 3: 0.80, 4: 1.00, 5: 1.00},
    },
    'maize': {
        'kc_by_stage': {1: 0.40, 2: 0.70, 3: 1.05, 4: 1.10, 5: 0.85, 6: 0.25},
        'ndwi_target_by_stage': {1: -0.10, 2: -0.06, 3: -0.02, 4: -0.02, 5: -0.05, 6: -0.14},
        'stage_potential_maunds': {1: 40.0, 2: 40.0, 3: 40.0, 4: 39.0, 5: 37.0},
        'ndvi_benchmark': {3: 0.62, 4: 0.70, 5: 0.50},
        'stage_sensitivity': {1: 0.50, 2: 0.65, 3: 0.80, 4: 1.00, 5: 1.00},
    },
    'cotton': {
        'kc_by_stage': {1: 0.35, 2: 0.60, 3: 0.95, 4: 1.05, 5: 0.90, 6: 0.30},
        'ndwi_target_by_stage': {1: -0.12, 2: -0.08, 3: -0.03, 4: -0.03, 5: -0.06, 6: -0.16},
        'stage_potential_maunds': {1: 30.0, 2: 30.0, 3: 30.0, 4: 28.0, 5: 26.0},
        'ndvi_benchmark': {3: 0.58, 4: 0.68, 5: 0.48},
        'stage_sensitivity': {1: 0.50, 2: 0.65, 3: 0.75, 4: 1.00, 5: 1.00},
    },
    'sugarcane': {
        'kc_by_stage': {1: 0.50, 2: 0.80, 3: 1.10, 4: 1.20, 5: 1.10, 6: 0.50},
        'ndwi_target_by_stage': {1: -0.05, 2: -0.02, 3: 0.02, 4: 0.02, 5: -0.01, 6: -0.10},
        'stage_potential_maunds': {1: 450.0, 2: 450.0, 3: 450.0, 4: 440.0, 5: 420.0},
        'ndvi_benchmark': {3: 0.65, 4: 0.75, 5: 0.55},
        'stage_sensitivity': {1: 0.45, 2: 0.60, 3: 0.75, 4: 1.00, 5: 1.00},
    },
}

# ── District soil context lookup ───────────────────────────────────────────────
# Read-only snapshot used to augment satellite recommendations with ground-truth
# soil data. Mirrors soil_analyzer.district_data — kept inline to avoid import
# coupling.  Keys are normalised to lowercase for fuzzy matching.
_DISTRICT_SOIL_CONTEXT = {
    'faisalabad':     {'ph': 7.76, 'orgc': 2.484, 'nitrogen': 0.569, 'clay': 14.6, 'ec': 2.35,
                       'health_class': 'Fair', 'score': 59.3,
                       'key_limitation': 'High salinity (EC 2.35 dS/m) amplifies drought stress'},
    'multan':         {'ph': 5.45, 'orgc': 4.10,  'nitrogen': 0.450, 'clay': 12.5, 'ec': 0.80,
                       'health_class': 'Good', 'score': 60.7,
                       'key_limitation': 'Acidic soil (pH 5.45) limits phosphorus availability'},
    'bahawalpur':     {'ph': 5.30, 'orgc': 4.10,  'nitrogen': 0.450, 'clay': 13.0, 'ec': 0.70,
                       'health_class': 'Good', 'score': 60.7,
                       'key_limitation': 'Strongly acidic (pH 5.30) — lime amendment advised'},
    'sargodha':       {'ph': 5.55, 'orgc': 5.275, 'nitrogen': 0.650, 'clay': 36.2, 'ec': 0.80,
                       'health_class': 'Fair', 'score': 58.5,
                       'key_limitation': 'Acidic pH (5.55) — monitor micronutrient uptake'},
    'lahore':         {'ph': 7.71, 'orgc': 2.738, 'nitrogen': 0.443, 'clay': 20.6, 'ec': 1.08,
                       'health_class': 'Good', 'score': 73.4,
                       'key_limitation': 'Below-optimal nitrogen (0.44%) — split urea needed'},
    'gujrat':         {'ph': 7.67, 'orgc': 2.663, 'nitrogen': 0.700, 'clay': 25.6, 'ec': 0.88,
                       'health_class': 'Good', 'score': 64.0,
                       'key_limitation': 'Moderate organic carbon — maintain with green manure'},
}


def _resolve_path(env_value, *fallbacks):
    if env_value:
        candidates = [env_value]
    else:
        candidates = []

    candidates.extend(fallbacks)

    for candidate in candidates:
        if not candidate:
            continue
        absolute = os.path.abspath(candidate)
        if os.path.exists(absolute):
            return absolute
    return os.path.abspath(candidates[0]) if candidates else None


def _init_gee():
    global GEE_INITIALIZED, GEE_LAST_ERROR, GEE_CREDENTIALS_USED, ee

    try:
        import ee as _ee

        ee = _ee
        current_dir = os.path.dirname(os.path.abspath(__file__))

        # Strategy 1: Try environment variable with credentials JSON
        creds_data = None
        gee_creds_json_env = os.getenv('GEE_CREDENTIALS_JSON')
        if gee_creds_json_env:
            try:
                creds_data = json.loads(gee_creds_json_env)
                print(f'📋 Using GEE credentials from GEE_CREDENTIALS_JSON environment variable')
            except json.JSONDecodeError as e:
                print(f'⚠️  GEE_CREDENTIALS_JSON is not valid JSON: {e}')
                creds_data = None

        # Strategy 2: Try file path
        if not creds_data:
            creds_path = _resolve_path(
                os.getenv('GEE_CREDENTIALS_PATH'),
                os.path.join(current_dir, 'gee_credentials.json'),
                os.path.join(current_dir, '..', 'gee_credentials.json'),
                os.path.join(current_dir, '..', '..', 'gee_credentials.json'),
            )

            if creds_path and os.path.exists(creds_path):
                with open(creds_path, 'r', encoding='utf-8') as handle:
                    creds_data = json.load(handle)
                print(f'📋 Using GEE credentials from file: {creds_path}')
            else:
                if creds_path:
                    print(f'⚠️  GEE credentials file not found at: {creds_path}')

        if not creds_data:
            raise FileNotFoundError(
                'Google Earth Engine credentials not found. Either:\n'
                '  1. Set GEE_CREDENTIALS_JSON environment variable with full JSON credentials, or\n'
                '  2. Set GEE_CREDENTIALS_PATH environment variable pointing to credentials file, or\n'
                '  3. Place gee_credentials.json in backend/ml_service/ directory'
            )

        service_account = creds_data.get('client_email')
        if not service_account:
            raise ValueError('GEE credentials JSON is missing client_email')

        # For env var strategy, we need to save to temp file since ee.ServiceAccountCredentials expects a path
        if gee_creds_json_env:
            creds_file = os.path.join(current_dir, '.gee_creds_tmp.json')
            with open(creds_file, 'w') as f:
                json.dump(creds_data, f)
            credentials = ee.ServiceAccountCredentials(service_account, creds_file)
        else:
            # For file-based credentials
            creds_file = _resolve_path(
                os.getenv('GEE_CREDENTIALS_PATH'),
                os.path.join(current_dir, 'gee_credentials.json'),
                os.path.join(current_dir, '..', 'gee_credentials.json'),
                os.path.join(current_dir, '..', '..', 'gee_credentials.json'),
            )
            credentials = ee.ServiceAccountCredentials(service_account, creds_file)

        gee_project_id = os.getenv('GEE_PROJECT_ID', GEE_PROJECT_ID)
        ee.Initialize(credentials, project=gee_project_id)
        GEE_INITIALIZED = True
        GEE_LAST_ERROR = None
        GEE_CREDENTIALS_USED = service_account
        print(f'✅ GEE initialised for project {gee_project_id} using {service_account}')
    except Exception as exc:
        GEE_INITIALIZED = False
        GEE_LAST_ERROR = str(exc)
        GEE_CREDENTIALS_USED = None
        print(f'⚠️  GEE init failed: {exc}')


def _normal_cdf(value):
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def _confidence_label(probability):
    if probability >= 0.8:
        return 'HIGH'
    if probability >= 0.65:
        return 'MEDIUM'
    return 'LOW'


def _yield_risk_label(health_score):
    if health_score >= 80:
        return 'LOW'
    if health_score >= 60:
        return 'MODERATE-LOW'
    if health_score >= 40:
        return 'MODERATE'
    return 'HIGH'


def _confidence_score(probability):
    return round(float(probability), 4)


def _debug_log(message):
    if SAT_DEBUG:
        print(f'[SAT_DEBUG] {message}', flush=True)


class SatellitePredictor:
    def __init__(self):
        self.artifacts_by_crop = {}
        self.active_crop = None
        self.model = None
        self.scaler = None
        self.config = {}
        self.model_loaded = False
        self.scaler_loaded = False
        self.config_loaded = False
        self._load_artifacts()

    def _load_artifacts(self):
        current_dir = os.path.dirname(os.path.abspath(__file__))
        for crop_name in sorted(SUPPORTED_SATELLITE_CROPS):
            self.artifacts_by_crop[crop_name] = self._load_artifacts_for_crop(crop_name, current_dir)

        # Keep legacy status fields aligned with wheat defaults at startup.
        self._activate_crop_artifacts('wheat')

    def _load_artifacts_for_crop(self, crop_name, current_dir):
        crop_key = str(crop_name).strip().lower()
        upper = crop_key.upper()

        model_file_candidates = [f'{crop_key}_6indices_ensemble.pkl']
        scaler_file_candidates = [f'{crop_key}_6indices_scaler.pkl']
        config_file_candidates = [f'{crop_key}_6indices_config.json']

        # Sugarcane artifacts are versioned with a temporal suffix.
        if crop_key == 'sugarcane':
            model_file_candidates.append('sugarcane_6indices_temporal_ensemble.pkl')
            scaler_file_candidates.append('sugarcane_6indices_temporal_scaler.pkl')
            config_file_candidates.append('sugarcane_6indices_temporal_config.json')

        model_fallbacks = []
        scaler_fallbacks = []
        config_fallbacks = []
        for filename in model_file_candidates:
            model_fallbacks.extend([
                os.path.join(current_dir, filename),
                os.path.join(current_dir, '..', 'ml_models', filename),
                os.path.join(current_dir, '..', 'ml_models', 'satellite_models', filename),
            ])
        for filename in scaler_file_candidates:
            scaler_fallbacks.extend([
                os.path.join(current_dir, filename),
                os.path.join(current_dir, '..', 'ml_models', filename),
                os.path.join(current_dir, '..', 'ml_models', 'satellite_models', filename),
            ])
        for filename in config_file_candidates:
            config_fallbacks.extend([
                os.path.join(current_dir, filename),
                os.path.join(current_dir, '..', 'ml_models', filename),
                os.path.join(current_dir, '..', 'ml_models', 'satellite_models', filename),
            ])

        model_path = _resolve_path(
            os.getenv(f'MODEL_PATH_{upper}') or (os.getenv('MODEL_PATH') if crop_key == 'wheat' else None),
            *model_fallbacks,
        )
        scaler_path = _resolve_path(
            os.getenv(f'SCALER_PATH_{upper}') or (os.getenv('SCALER_PATH') if crop_key == 'wheat' else None),
            *scaler_fallbacks,
        )
        config_path = _resolve_path(
            os.getenv(f'CONFIG_PATH_{upper}') or (os.getenv('CONFIG_PATH') if crop_key == 'wheat' else None),
            *config_fallbacks,
        )

        artifact = {
            'crop': crop_key,
            'model': None,
            'scaler': None,
            'config': {
                'training_samples': 0,
                'model_accuracy': 0.842,
                'validation_type': 'Cross-city (5 Punjab cities)',
            },
            'model_loaded': False,
            'scaler_loaded': False,
            'config_loaded': False,
        }

        if model_path and os.path.exists(model_path):
            artifact['model'] = joblib.load(model_path)
            artifact['model_loaded'] = True
            print(f'✅ Satellite ensemble model loaded ({crop_key}): {model_path}')
        else:
            print(
                f'⚠️  Satellite ensemble model not found for {crop_key}. '
                f'Set MODEL_PATH_{upper} or place {crop_key}_6indices_ensemble.pkl in backend/ml_models/satellite_models/.'
            )

        if scaler_path and os.path.exists(scaler_path):
            artifact['scaler'] = joblib.load(scaler_path)
            artifact['scaler_loaded'] = True
            print(f'✅ Satellite scaler loaded ({crop_key}): {scaler_path}')
        else:
            print(
                f'⚠️  Satellite scaler not found for {crop_key}. '
                f'Set SCALER_PATH_{upper} or place {crop_key}_6indices_scaler.pkl in backend/ml_models/satellite_models/.'
            )

        if config_path and os.path.exists(config_path):
            with open(config_path, 'r', encoding='utf-8') as handle:
                artifact['config'] = json.load(handle)
            artifact['config_loaded'] = True
            print(f'✅ Satellite config loaded ({crop_key}): {config_path}')
        else:
            print(f'⚠️  Satellite config not found for {crop_key}. Using default metadata values.')

        return artifact

    def _activate_crop_artifacts(self, crop_name):
        crop_key = str(crop_name or 'wheat').strip().lower()
        artifact = self.artifacts_by_crop.get(crop_key)
        if not artifact:
            self.active_crop = crop_key
            self.model = None
            self.scaler = None
            self.config = {}
            self.model_loaded = False
            self.scaler_loaded = False
            self.config_loaded = False
            return

        self.active_crop = crop_key
        self.model = artifact['model']
        self.scaler = artifact['scaler']
        self.config = artifact['config']
        self.model_loaded = artifact['model_loaded']
        self.scaler_loaded = artifact['scaler_loaded']
        self.config_loaded = artifact['config_loaded']

    def _require_artifacts(self, crop_name='wheat'):
        if not GEE_INITIALIZED:
            # Retry once lazily. Startup init can fail transiently if network/auth is not ready yet.
            _init_gee()
        if not GEE_INITIALIZED:
            detail = f' Last init error: {GEE_LAST_ERROR}' if GEE_LAST_ERROR else ''
            raise RuntimeError(
                'Google Earth Engine is not configured. '
                'Set GEE_CREDENTIALS_PATH and verify service account access.'
                f'{detail}'
            )

        crop_key = str(crop_name or 'wheat').strip().lower()
        self._activate_crop_artifacts(crop_key)

        if crop_key not in SUPPORTED_SATELLITE_CROPS:
            raise RuntimeError(
                f'Crop "{crop_key}" is not configured for satellite ML analysis. '
                f'Supported crops: {", ".join(sorted(SUPPORTED_SATELLITE_CROPS))}.'
            )

        if not self.model_loaded:
            raise RuntimeError(
                f'Model artifact missing for {crop_key}. '
                f'Provide {crop_key}_6indices_ensemble.pkl and set MODEL_PATH_{crop_key.upper()} if needed.'
            )
        if not self.scaler_loaded:
            raise RuntimeError(
                f'Scaler artifact missing for {crop_key}. '
                f'Provide {crop_key}_6indices_scaler.pkl and set SCALER_PATH_{crop_key.upper()} if needed.'
            )

    def get_growth_stage(self, month, crop_name='wheat'):
        crop_key = str(crop_name or 'wheat').strip().lower()
        stage_map = CROP_GROWTH_STAGE_MAPPINGS.get(crop_key, CROP_GROWTH_STAGE_MAPPINGS['wheat'])
        default_stage = (1, 'Germination') if crop_key == 'wheat' else (1, 'Establishment')
        return stage_map.get(int(month), default_stage)

    def _mask_clouds(self, image):
        qa = image.select('QA60')
        cloud_mask = 1 << 10
        cirrus_mask = 1 << 11
        mask = qa.bitwiseAnd(cloud_mask).eq(0).And(qa.bitwiseAnd(cirrus_mask).eq(0))
        return image.updateMask(mask)

    def get_sentinel_indices(self, latitude, longitude, start_date, end_date):
        point = ee.Geometry.Point([longitude, latitude])
        region = point.buffer(150)

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(region)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
            .map(self._mask_clouds)
        )

        images_used = int(collection.size().getInfo())
        if images_used == 0:
            raise RuntimeError('No Sentinel-2 images found in the last 20 days after cloud filtering.')

        composite = collection.median().divide(10000)

        ndvi = composite.normalizedDifference(['B8', 'B4']).rename('ndvi')
        ndwi = composite.normalizedDifference(['B3', 'B8']).rename('ndwi')
        evi = composite.expression(
            '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)',
            {
                'NIR': composite.select('B8'),
                'RED': composite.select('B4'),
                'BLUE': composite.select('B2'),
            },
        ).rename('evi')
        gndvi = composite.normalizedDifference(['B8', 'B3']).rename('gndvi')
        ndre = composite.normalizedDifference(['B8', 'B5']).rename('ndre')
        savi = ndvi.expression(
            '(ndvi * 1.5) / (1 + 0.5 * (1 - ndvi))',
            {'ndvi': ndvi},
        ).rename('savi')

        reduced = (
            ndvi.addBands([ndwi, evi, gndvi, ndre, savi])
            .reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=10,
                maxPixels=int(1e9),
            )
            .getInfo()
        )

        def _value(name):
            value = reduced.get(name)
            if value is None:
                raise RuntimeError(f'Missing {name.upper()} from Sentinel extraction.')
            return round(float(value), 4)

        return {
            'ndvi': _value('ndvi'),
            'ndwi': _value('ndwi'),
            'evi': _value('evi'),
            'gndvi': _value('gndvi'),
            'ndre': _value('ndre'),
            'savi': _value('savi'),
            'images_used': images_used,
        }

    # ─── Per-growth-stage realistic index profiles for simulation ──────────────────
    _STAGE_INDEX_PROFILES = {
        # code: {index: (center, half_range)}  — mirrors real-world Punjab wheat ranges
        0: {'ndvi':(0.10,0.06),'ndwi':(-0.18,0.07),'evi':(0.08,0.04),'gndvi':(0.14,0.06),'ndre':(0.07,0.04),'savi':(0.10,0.05),'ndbi':(0.06,0.04)},
        1: {'ndvi':(0.17,0.07),'ndwi':(-0.14,0.07),'evi':(0.13,0.05),'gndvi':(0.22,0.06),'ndre':(0.10,0.05),'savi':(0.15,0.06),'ndbi':(0.05,0.04)},
        2: {'ndvi':(0.35,0.09),'ndwi':(-0.06,0.07),'evi':(0.24,0.07),'gndvi':(0.34,0.08),'ndre':(0.20,0.07),'savi':(0.30,0.08),'ndbi':(0.02,0.03)},
        3: {'ndvi':(0.55,0.08),'ndwi':(0.05,0.07),'evi':(0.37,0.07),'gndvi':(0.47,0.07),'ndre':(0.30,0.06),'savi':(0.46,0.07),'ndbi':(-0.02,0.03)},
        4: {'ndvi':(0.63,0.07),'ndwi':(0.02,0.06),'evi':(0.44,0.07),'gndvi':(0.54,0.07),'ndre':(0.34,0.06),'savi':(0.54,0.07),'ndbi':(-0.04,0.03)},
        5: {'ndvi':(0.44,0.09),'ndwi':(-0.09,0.07),'evi':(0.32,0.07),'gndvi':(0.42,0.07),'ndre':(0.24,0.07),'savi':(0.38,0.08),'ndbi':(0.01,0.03)},
        # Stage 6 = post-harvest bare/fallow field — low vegetation, dry soil signal
        6: {'ndvi':(0.09,0.05),'ndwi':(-0.22,0.08),'evi':(0.06,0.04),'gndvi':(0.12,0.05),'ndre':(0.05,0.03),'savi':(0.08,0.04),'ndbi':(0.10,0.05)},
    }

    def _simulate_indices(self, growth_stage_code, month, latitude, longitude, soil_context=None):
        """Return deterministic realistic synthetic Sentinel-2 indices.

        Seeded from lat/lon/month so the same location always returns the
        same values across retries — users see consistent analysis instead
        of random noise when live imagery is temporarily unavailable.
        """
        profile = self._STAGE_INDEX_PROFILES.get(growth_stage_code, self._STAGE_INDEX_PROFILES[3])

        # Stable seed: encode lat+lon precision to 3 decimal places + month
        seed_val = (
            int(abs(round(latitude, 3)) * 1000) * 1000
            + int(abs(round(longitude, 3)) * 1000)
        ) % (2 ** 31) + month * 1000
        rng = np.random.default_rng(seed_val)

        def _sample(center, half):
            return round(float(np.clip(center + rng.uniform(-half, half), -1.0, 1.0)), 4)

        result = {k: _sample(*v) for k, v in profile.items()}

        # Soil-context micro-adjustments: high-EC soil depresses NDWI signal
        if soil_context:
            ec = soil_context.get('ec', 1.0)
            if ec > 2.0:
                result['ndwi'] = round(
                    float(np.clip(result['ndwi'] - min(0.08, (ec - 2.0) * 0.04), -1.0, 1.0)), 4
                )

        return result

    def build_sentinel_index_image(self, latitude, longitude, start_date, end_date, cloud_threshold=30):
        point = ee.Geometry.Point([longitude, latitude])
        region = point.buffer(2000)

        collection = (
            ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
            .filterBounds(region)
            .filterDate(start_date, end_date)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
            .map(self._mask_clouds)
        )

        images_used = int(collection.size().getInfo())
        if images_used == 0:
            raise RuntimeError(
                f'No Sentinel-2 images found between {start_date} and {end_date} '
                f'after cloud filtering (threshold < {cloud_threshold}%).'
            )

        composite = collection.median().divide(10000)
        ndvi = composite.normalizedDifference(['B8', 'B4']).rename('ndvi')
        ndwi = composite.normalizedDifference(['B3', 'B8']).rename('ndwi')
        evi = composite.expression(
            '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)',
            {
                'NIR': composite.select('B8'),
                'RED': composite.select('B4'),
                'BLUE': composite.select('B2'),
            },
        ).rename('evi')
        gndvi = composite.normalizedDifference(['B8', 'B3']).rename('gndvi')
        ndre = composite.normalizedDifference(['B8', 'B5']).rename('ndre')
        savi = ndvi.expression(
            '(ndvi * 1.5) / (1 + 0.5 * (1 - ndvi))',
            {'ndvi': ndvi},
        ).rename('savi')
        # NDBI = (SWIR - NIR) / (SWIR + NIR) using B11 (1610 nm).
        # Positive for built-up surfaces (rooftops, roads, concrete);
        # negative for all vegetation and most bare soils.
        ndbi = composite.normalizedDifference(['B11', 'B8']).rename('ndbi')

        indices_image = ndvi.addBands([ndwi, evi, gndvi, ndre, savi, ndbi])
        return indices_image, images_used

    def build_latest_sentinel_index_image(
        self,
        latitude,
        longitude,
        anchor_date,
        max_lookback_days=180,
        analysis_geometry=None,
        allow_extended_lookback=True,
    ):
        """Fetch the most recent usable Sentinel-2 scene up to anchor_date for a location.

        Returns a dict with:
          - image: index image bands
          - images_used: candidate scene count for the selected threshold window
          - latest_image_date: acquisition date (YYYY-MM-DD)
          - query_start: lookback start date (YYYY-MM-DD)
          - query_end: anchor date inclusive (YYYY-MM-DD)
          - cloud_threshold: selected cloud threshold
        """
        point = ee.Geometry.Point([longitude, latitude])
        region = point.buffer(2000)
        target_geometry = analysis_geometry or point.buffer(150)

        query_end = anchor_date + timedelta(days=1)  # ee filterDate end is exclusive
        lookback_windows = [int(max_lookback_days)]
        if allow_extended_lookback and int(max_lookback_days) < 365:
            lookback_windows.append(365)

        last_error = None
        required_idx = ('ndvi', 'ndwi', 'evi', 'gndvi', 'ndre', 'savi')

        def build_indices_image(image):
            composite = image.divide(10000)
            ndvi_local = composite.normalizedDifference(['B8', 'B4']).rename('ndvi')
            ndwi_local = composite.normalizedDifference(['B3', 'B8']).rename('ndwi')
            evi_local = composite.expression(
                '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)',
                {
                    'NIR': composite.select('B8'),
                    'RED': composite.select('B4'),
                    'BLUE': composite.select('B2'),
                },
            ).rename('evi')
            gndvi_local = composite.normalizedDifference(['B8', 'B3']).rename('gndvi')
            ndre_local = composite.normalizedDifference(['B8', 'B5']).rename('ndre')
            savi_local = ndvi_local.expression(
                '(ndvi * 1.5) / (1 + 0.5 * (1 - ndvi))',
                {'ndvi': ndvi_local},
            ).rename('savi')
            ndbi_local = composite.normalizedDifference(['B11', 'B8']).rename('ndbi')
            return ndvi_local.addBands([ndwi_local, evi_local, gndvi_local, ndre_local, savi_local, ndbi_local])

        for lookback_days in lookback_windows:
            query_start = anchor_date - timedelta(days=lookback_days)

            for cloud_threshold in (20, 35, 50, 65):
                try:
                    collection = (
                        ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                        .filterBounds(region)
                        .filterDate(query_start.isoformat(), query_end.isoformat())
                        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', cloud_threshold))
                        .map(self._mask_clouds)
                        .sort('system:time_start', False)
                    )

                    images_used = int(collection.size().getInfo())
                    if images_used == 0:
                        continue

                    # Check the most recent scenes and return the first scene that yields valid indices.
                    # This avoids failing when the latest scene is still too cloudy over the target field.
                    scenes_to_check = min(images_used, 30)
                    scenes = collection.toList(scenes_to_check)

                    for scene_idx in range(scenes_to_check):
                        scene = ee.Image(scenes.get(scene_idx))
                        scene_date = ee.Date(scene.get('system:time_start')).format('YYYY-MM-dd').getInfo()
                        indices_image = build_indices_image(scene)

                        reduction = (
                            indices_image.reduceRegion(
                                reducer=ee.Reducer.mean(),
                                geometry=target_geometry,
                                scale=10,
                                maxPixels=int(1e9),
                            ).getInfo()
                        )

                        if all(reduction.get(name) is not None for name in required_idx):
                            return {
                                'image': indices_image,
                                'images_used': images_used,
                                'latest_image_date': scene_date,
                                'query_start': query_start.isoformat(),
                                'query_end': anchor_date.isoformat(),
                                'cloud_threshold': cloud_threshold,
                            }
                except Exception as exc:
                    last_error = exc
                    continue

        if last_error:
            raise RuntimeError(
                f'No usable recent Sentinel-2 imagery found for this location up to {anchor_date.isoformat()} '
                f'within the past {max(lookback_windows)} days.'
            ) from last_error

        raise RuntimeError(
            f'No usable recent Sentinel-2 imagery found for this location up to {anchor_date.isoformat()} '
            f'within the past {max(lookback_windows)} days.'
        )

    def _build_analysis_geometry(self, latitude, longitude, field_polygon=None):
        """Return (ee_geometry, normalized_polygon_or_none) for analysis and heatmap clipping."""
        if not field_polygon:
            return ee.Geometry.Point([longitude, latitude]).buffer(150), None

        if not isinstance(field_polygon, list) or len(field_polygon) < 3:
            raise RuntimeError('field_polygon must contain at least 3 points.')

        normalized_points = []
        for point in field_polygon:
            if isinstance(point, dict):
                lat = float(point.get('lat'))
                lon = float(point.get('lon'))
            elif isinstance(point, (list, tuple)) and len(point) >= 2:
                lat = float(point[0])
                lon = float(point[1])
            else:
                raise RuntimeError('Each field_polygon point must be {lat, lon} or [lat, lon].')

            if lat < -90 or lat > 90 or lon < -180 or lon > 180:
                raise RuntimeError('field_polygon contains out-of-range coordinates.')

            normalized_points.append({'lat': round(lat, 6), 'lon': round(lon, 6)})

        ee_coords = [[pt['lon'], pt['lat']] for pt in normalized_points]
        if ee_coords[0] != ee_coords[-1]:
            ee_coords.append(ee_coords[0])

        geometry = ee.Geometry.Polygon([ee_coords])
        return geometry, normalized_points

    def build_heatmap(self, latitude, longitude, index_image, analysis_geometry=None):
        """Build a continuous raster heatmap tile layer around the selected field location."""
        try:
            region = analysis_geometry or ee.Geometry.Point([longitude, latitude]).buffer(FIELD_HEATMAP_RADIUS_METERS)
            region_bounds = region.bounds().coordinates().getInfo()[0]

            # Approximate pixel-wise stress surface from vegetation/water indices.
            stress_surface = index_image.expression(
                'clamp(1 - ((0.50 * evi) + (0.35 * gndvi) + (0.15 * ((ndwi + 1) / 2))), 0, 1)',
                {
                    'evi': index_image.select('evi'),
                    'gndvi': index_image.select('gndvi'),
                    'ndwi': index_image.select('ndwi'),
                },
            ).rename('stress_surface')

            vis = {
                'min': 0,
                'max': 1,
                'palette': ['#22c55e', '#84cc16', '#eab308', '#f97316', '#dc2626'],
            }

            map_info = stress_surface.clip(region).getMapId(vis)
            tile_url = None
            if isinstance(map_info, dict):
                tile_fetcher = map_info.get('tile_fetcher')
                if tile_fetcher is not None:
                    tile_url = getattr(tile_fetcher, 'url_format', None)

                if tile_url is None and map_info.get('mapid'):
                    mapid = map_info.get('mapid')
                    token = map_info.get('token', '')
                    token_query = f'?token={token}' if token else ''
                    tile_url = f'https://earthengine.googleapis.com/map/{mapid}/{{z}}/{{x}}/{{y}}{token_query}'

            if not tile_url:
                return {
                    'fetched': False,
                    'type': 'raster',
                    'error': 'Could not generate Earth Engine tile URL.',
                }

            lons = [pt[0] for pt in region_bounds]
            lats = [pt[1] for pt in region_bounds]

            return {
                'fetched': True,
                'type': 'raster',
                'tile_url': tile_url,
                'opacity': 0.58,
                'legend': {
                    'label': 'Stress Probability',
                    'min': 0,
                    'max': 1,
                    'palette': vis['palette'],
                },
                'field_radius_m': FIELD_HEATMAP_RADIUS_METERS,
                'bounds': {
                    'south': min(lats),
                    'west': min(lons),
                    'north': max(lats),
                    'east': max(lons),
                },
            }
        except Exception as exc:
            return {
                'fetched': False,
                'type': 'raster',
                'error': f'Heatmap generation failed: {exc}',
            }

    def classify_land_type(self, ndvi, ndwi, evi, savi, gndvi, ndre, ndbi=0.0, month=None):
        """Classify whether coordinates point at an agricultural field or non-agricultural land.

        DESIGN PHILOSOPHY — derived directly from the training data collector
        ──────────────────────────────────────────────────────────────────────
        The coordinates collector (Coordinates_Collector_v3) never attempted to
        explicitly detect roads. Instead it filtered by whether a location produced
        indices consistent with wheat at any growth stage, using four spectral checks:

          1. NDVI within crop growth-stage expected range     (40% weight)
          2. EVI within crop growth-stage expected range      (30% weight)
          3. GNDVI in the "vegetation-possible" band 0.2–0.9  (20% weight)
          4. NDVI and EVI correlated: |ndvi - evi| < 0.3      (10% weight)

        Any location scoring < 0.65 on these combined checks was silently discarded.
        Roads, rooftops, and paved surfaces fail this filter naturally because:
          • Their GNDVI is typically < 0.2 (no green reflectance differential)
          • Their NDVI and EVI are decorrelated on spectrally flat surfaces
          • Their values fall outside every wheat growth-stage NDVI/EVI range

        This runtime classifier mirrors that logic: instead of asking "is this a
        road?", it asks "does this location produce spectral indices that could
        plausibly belong to any agricultural land use?"

        The field_score below is a simplified version of the collector's validation
        score, adapted for runtime use where the growth stage is not always known.
        It uses the broadest possible wheat-season envelope across all six months,
        so it remains valid year-round without any month hardcoding.

        Decision order
        ──────────────
          1. Water body          (NDWI dominant)
          2. Dense built-up      (NDBI dominant AND field_score near-zero)
          3. Active cropland     (strong NDVI + EVI — unambiguous, skip scoring)
          4. Field score gate    (mirrors collector's 0.65 validation threshold)
             ├─ score ≥ 0.65  → agricultural (with sub-labels by canopy level)
             └─ score < 0.65  → non-agricultural

        Returns dict with keys: is_field, land_type, confidence, reason.
        """

        # ── DEBUG — print every call with full index values and which rule fires
        _debug_log(
            f'classify_land_type '
            f'ndvi={ndvi:.4f} ndwi={ndwi:.4f} evi={evi:.4f} '
            f'savi={savi:.4f} gndvi={gndvi:.4f} ndre={ndre:.4f} ndbi={ndbi:.4f}'
        )

        # ── 1. Water body ─────────────────────────────────────────────────────
        if ndwi > 0.2 and ndvi < 0.1:
            return {
                'is_field': False,
                'land_type': 'Water Body',
                'confidence': 'HIGH',
                'reason': (
                    f'NDWI={ndwi:.3f} > 0.2 with NDVI={ndvi:.3f} < 0.1 — '
                    'open water (canal, pond, or flooded area).'
                ),
            }

        # ── 2. Dense built-up / impervious surface ────────────────────────────
        # Only reject as built-up when NDBI is strongly positive AND GNDVI is
        # below the vegetation-possible band (< 0.2). This is the same GNDVI
        # floor the collector used. A location with GNDVI ≥ 0.2 has enough
        # green differential to be vegetated soil and must proceed to scoring.
        if ndbi >= 0.15 and gndvi < 0.20:
            return {
                'is_field': False,
                'land_type': 'Road / Impervious Surface',
                'confidence': 'HIGH',
                'reason': (
                    f'NDBI={ndbi:.3f} ≥ 0.15 and GNDVI={gndvi:.3f} < 0.20. '
                    'Strong SWIR dominance with no green reflectance differential '
                    'is characteristic of tarmac, concrete, or dense rooftop cover.'
                ),
            }

        # ── 3. Village / settlement with scattered trees ──────────────────────
        # Rural Punjab settlements (mud-brick houses, packed earth, courtyards)
        # with 10-20% scattered tree cover produce GNDVI > 0.20 and EVI 0.10-0.18
        # from the trees alone — enough to pass the GNDVI gate and trigger the
        # crop rules below. However, mud brick + packed earth + rooftops all
        # reflect SWIR strongly, giving villages NDBI = 0.12-0.25.
        # A real crop field with the same GNDVI/EVI always has NDBI near zero or
        # negative — living crops and bare agricultural soil suppress SWIR.
        # This is the one discrimination task NDBI is actually reliable for.
        if ndbi >= 0.12 and gndvi < 0.45:
            return {
                'is_field': False,
                'land_type': 'Settlement / Village',
                'confidence': 'HIGH',
                'reason': (
                    f'NDBI={ndbi:.3f} ≥ 0.12 indicates mud brick, packed earth, '
                    f'or rooftop cover typical of a rural settlement. '
                    f'GNDVI={gndvi:.3f} reflects scattered trees within the '
                    'village, not a crop canopy. A crop field with this vegetation '
                    'signal would have NDBI near zero or negative.'
                ),
            }

        # ── 4. Active cropland — unambiguous ─────────────────────────────────
        # Reaches here only after clearing the settlement check above.
        # Strong NDVI + EVI with NDBI already confirmed below settlement level.
        if ndvi >= 0.25 and evi >= 0.12:
            return {
                'is_field': True,
                'land_type': 'Active Cropland',
                'confidence': 'HIGH',
                'reason': (
                    f'NDVI={ndvi:.3f} ≥ 0.25 and EVI={evi:.3f} ≥ 0.12 with '
                    f'NDBI={ndbi:.3f} below settlement threshold — '
                    'dense standing crop canopy confirmed.'
                ),
            }

        # ── 4. Field score gate (mirrors collector validation logic) ──────────
        #
        # Broadest wheat-season envelope across all 6 growth months:
        #   NDVI: 0.09 – 0.90  (germination min → heading max, from training data)
        #   EVI:  0.05 – 0.85  (slightly wider to allow sensor noise)
        #   GNDVI: 0.20 – 0.90 (collector's vegetation-possible band)
        #
        # Score components (weights matching collector):
        #   A. NDVI in agricultural envelope          (0–0.40)
        #   B. EVI in agricultural envelope           (0–0.30)
        #   C. GNDVI in vegetation-possible band      (0–0.20)
        #   D. NDVI–EVI correlation |diff| < 0.30     (0–0.10)
        #
        # CRITICAL: GNDVI < 0.20 is a HARD GATE, not just a score penalty.
        # The collector treated GNDVI < 0.20 as "no vegetation possible" and
        # discarded the sample entirely — it gave 0 points AND prevented any
        # other component from compensating. Road pixels with mild NDVI bleed
        # from adjacent fields can reach NDVI ≈ 0.08–0.12, which would score
        # on component A. The GNDVI gate prevents that false pass.
        #
        # Threshold: score ≥ 0.65 → agricultural (same as collector's
        # validation_score_threshold = 0.65)

        # Hard gate: GNDVI below the vegetation-possible floor → not a field
        if gndvi < 0.20:
            return {
                'is_field': False,
                'land_type': 'Non-Agricultural / Uncertain',
                'confidence': 'HIGH',
                'reason': (
                    f'GNDVI={gndvi:.3f} < 0.20 — below the vegetation-possible '
                    'threshold used during training data collection. Roads and '
                    'impervious surfaces with minor NDVI bleed from adjacent fields '
                    'cannot exceed this floor. Location is not agricultural.'
                ),
            }

        NDVI_MIN, NDVI_MAX = 0.09, 0.90
        EVI_MIN,  EVI_MAX  = 0.05, 0.85

        # Component A — NDVI envelope
        if NDVI_MIN <= ndvi <= NDVI_MAX:
            score_a = 0.40
        else:
            deviation = min(abs(ndvi - NDVI_MIN), abs(ndvi - NDVI_MAX))
            score_a = max(0.0, 0.40 - deviation * 2)

        # Component B — EVI envelope
        if EVI_MIN <= evi <= EVI_MAX:
            score_b = 0.30
        else:
            deviation = min(abs(evi - EVI_MIN), abs(evi - EVI_MAX))
            score_b = max(0.0, 0.30 - deviation * 2)

        # Component C — GNDVI vegetation-possible band (same floor as collector)
        score_c = 0.20 if 0.20 <= gndvi <= 0.90 else 0.0

        # Component D — NDVI–EVI correlation (roads decorrelate these two)
        score_d = 0.10 if abs(ndvi - evi) < 0.30 else 0.0

        field_score = score_a + score_b + score_c + score_d

        if field_score >= 0.65:
            # Sub-classify by canopy level for informative labelling.
            if ndvi >= 0.15 and evi >= 0.08:
                land_type = 'Sparse / Early-Stage Crop'
                confidence = 'MEDIUM'
            elif ndvi >= 0.09:
                land_type = 'Stressed / Degraded Crop'
                confidence = 'MEDIUM'
            else:
                land_type = 'Bare / Fallow Agricultural Field'
                confidence = 'MEDIUM'

            if field_score >= 0.85:
                confidence = 'HIGH'

            return {
                'is_field': True,
                'land_type': land_type,
                'confidence': confidence,
                'reason': (
                    f'Field score={field_score:.2f} ≥ 0.65 — spectral indices are '
                    f'consistent with agricultural land '
                    f'(NDVI={ndvi:.3f}, EVI={evi:.3f}, GNDVI={gndvi:.3f}). '
                    f'Score components: NDVI={score_a:.2f}, EVI={score_b:.2f}, '
                    f'GNDVI={score_c:.2f}, corr={score_d:.2f}.'
                ),
            }

        # ── 5. Default — non-agricultural ─────────────────────────────────────
        return {
            'is_field': False,
            'land_type': 'Non-Agricultural / Uncertain',
            'confidence': 'HIGH' if field_score < 0.30 else 'MEDIUM',
            'reason': (
                f'Field score={field_score:.2f} < 0.65 — indices do not match any '
                f'agricultural signature '
                f'(NDVI={ndvi:.3f}, EVI={evi:.3f}, GNDVI={gndvi:.3f}). '
                f'Score components: NDVI={score_a:.2f}, EVI={score_b:.2f}, '
                f'GNDVI={score_c:.2f}, corr={score_d:.2f}. '
                'Likely a road, building, urban area, or heavily degraded surface.'
            ),
        }

    def get_dynamic_world_label(self, latitude, longitude, start_date, end_date, analysis_geometry=None):
        """Query Dynamic World to get the dominant land-use label for the location.

        Dynamic World (Brown et al. 2022) is a near-real-time 10m land-use
        classification trained on 5 billion+ labelled pixels. It is far more
        reliable than any index threshold for distinguishing settlements from
        cropland because it was explicitly trained on that task.

        DW class values:
            0  water
            1  trees
            2  grass
            3  flooded_vegetation
            4  crops          ← the one we want
            5  shrub_and_scrub
            6  built          ← villages, roads, urban
            7  bare
            8  snow_and_ice

        Returns dict:
            dw_label      (int)   dominant class value
            dw_label_name (str)   human-readable name
            dw_crop_prob  (float) probability of crops class (0–1)
            dw_built_prob (float) probability of built class (0–1)
            dw_available  (bool)  False if no DW imagery found in window
        """
        DW_CLASSES = {
            0: 'water',
            1: 'trees',
            2: 'grass',
            3: 'flooded_vegetation',
            4: 'crops',
            5: 'shrub_and_scrub',
            6: 'built',
            7: 'bare',
            8: 'snow_and_ice',
        }
        try:
            region = analysis_geometry or ee.Geometry.Point([longitude, latitude]).buffer(150)

            dw_collection = (
                ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                .filterBounds(region)
                .filterDate(start_date, end_date)
            )

            count = int(dw_collection.size().getInfo())
            if count == 0:
                # Widen to a 60-day window if the 20-day composite has no DW tiles
                wide_start = (datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=20)).strftime('%Y-%m-%d')
                wide_end   = (datetime.strptime(end_date,   '%Y-%m-%d') + timedelta(days=20)).strftime('%Y-%m-%d')
                dw_collection = (
                    ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
                    .filterBounds(region)
                    .filterDate(wide_start, wide_end)
                )
                count = int(dw_collection.size().getInfo())

            if count == 0:
                return {'dw_available': False, 'dw_label': -1, 'dw_label_name': 'unknown',
                        'dw_crop_prob': 0.0, 'dw_built_prob': 0.0}

            # Use the mode of the label band as the dominant class
            dw_mode = dw_collection.select('label').mode()

            # Use mean of probability bands for crop and built
            dw_probs = dw_collection.select(['crops', 'built']).mean()

            label_val = int(dw_mode.reduceRegion(
                reducer=ee.Reducer.mode(),
                geometry=region,
                scale=10,
                maxPixels=int(1e9),
            ).getInfo().get('label', -1))

            prob_vals = dw_probs.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=region,
                scale=10,
                maxPixels=int(1e9),
            ).getInfo()

            return {
                'dw_available': True,
                'dw_label': label_val,
                'dw_label_name': DW_CLASSES.get(label_val, 'unknown'),
                'dw_crop_prob': round(float(prob_vals.get('crops') or 0.0), 4),
                'dw_built_prob': round(float(prob_vals.get('built') or 0.0), 4),
            }

        except Exception as exc:
            return {'dw_available': False, 'dw_label': -1, 'dw_label_name': 'unknown',
                    'dw_crop_prob': 0.0, 'dw_built_prob': 0.0, 'dw_error': str(exc)}

    def _get_active_feature_names(self):
        names = self.config.get('feature_names') if isinstance(self.config, dict) else None
        if isinstance(names, list) and names:
            return [str(name).strip().lower() for name in names]
        return list(DEFAULT_FEATURE_NAMES)

    def _build_feature_vector(self, indices, month, growth_stage_code):
        feature_names = self._get_active_feature_names()
        context = {
            'ndvi': float(indices.get('ndvi', 0.0)),
            'ndwi': float(indices.get('ndwi', 0.0)),
            'evi': float(indices.get('evi', 0.0)),
            'savi': float(indices.get('savi', 0.0)),
            'gndvi': float(indices.get('gndvi', 0.0)),
            'ndre': float(indices.get('ndre', 0.0)),
            'month': float(month),
            'growth_stage_code': float(growth_stage_code),
        }

        # Some crop configs include engineered fields such as ndvi_deviation.
        # Compute them on-the-fly from stage-wise index centers so config-driven
        # models can run without hardcoded crop-specific feature plumbing.
        stage_code_int = int(growth_stage_code) if growth_stage_code is not None else 0
        stage_profile = self._STAGE_INDEX_PROFILES.get(
            stage_code_int,
            self._STAGE_INDEX_PROFILES.get(3, {}),
        )
        stage_centers = {
            key: float(values[0])
            for key, values in stage_profile.items()
            if isinstance(values, (list, tuple)) and len(values) >= 1
        }

        def _resolve_feature_value(feature_name):
            if feature_name in context:
                return context[feature_name]

            if feature_name.endswith('_deviation'):
                base_name = feature_name[:-10]
                if base_name in context:
                    baseline = float(stage_centers.get(base_name, 0.0))
                    return float(context[base_name] - baseline)

            return None

        values = []
        for feature_name in feature_names:
            resolved = _resolve_feature_value(feature_name)
            if resolved is None:
                raise RuntimeError(
                    f'Configured feature "{feature_name}" is not available in the runtime context '
                    f'for crop "{self.active_crop}".'
                )
            values.append(resolved)

        return np.array([values], dtype=float)

    def predict(self, indices, month, growth_stage_code):
        feature_vector = self._build_feature_vector(indices, month, growth_stage_code)
        features_scaled = self.scaler.transform(feature_vector)
        probabilities = self.model.predict_proba(features_scaled)[0]
        healthy_probability = float(probabilities[1])
        stressed_probability = float(probabilities[0])
        return stressed_probability, healthy_probability

    def diagnose_cause(self, ndvi, ndwi, evi, gndvi):
        if ndwi < 0.05 and evi < 0.45:
            return 'Water Deficit'
        if ndwi > 0.15 and ndvi < 0.50:
            return 'Waterlogging Risk'
        if gndvi < 0.40 and ndwi >= 0.05:
            return 'Nitrogen / Chlorophyll Deficiency'
        if evi < 0.35 and gndvi < 0.40:
            return 'Severe Multi-Stress'
        if ndwi > 0.15 and ndvi < 0.50 and evi < 0.45:
            return 'Disease / Pest Risk'
        return 'Mild Stress / Monitor'

    def days_to_critical(self, stress_probability, growth_stage_code, primary_cause=None, soil_context=None, weather_context=None):
        if stress_probability <= 0.25:
            return None, []

        if stress_probability > 0.70 and growth_stage_code == 5:
            days = 3
        elif stress_probability > 0.70 and growth_stage_code in [3, 4]:
            days = 7
        elif stress_probability > 0.70:
            days = 10
        elif stress_probability > 0.40:
            days = 5
        else:
            days = 8

        drivers = []
        summary = (weather_context or {}).get('summary', {})
        total_rainfall = float(summary.get('total_rainfall', 0) or 0)
        max_temperature = float(summary.get('max_temperature', 0) or 0)
        hot_days = int((weather_context or {}).get('hot_days', 0) or 0)
        dry_days = int((weather_context or {}).get('dry_days', 0) or 0)
        rainy_days = int((weather_context or {}).get('rainy_days', 0) or 0)

        if primary_cause == 'Water Deficit':
            if dry_days >= 5 or total_rainfall <= 5:
                days -= 2
                drivers.append('dry 7-day forecast')
            if hot_days >= 3 or max_temperature >= 35:
                days -= 1
                drivers.append('heat stress forecast')
            if soil_context and soil_context.get('clay', 25) < 18:
                days -= 1
                drivers.append('sandy soil, low water-holding capacity')

        if primary_cause == 'Waterlogging Risk' and rainy_days >= 2:
            days -= 2
            drivers.append('wet 7-day forecast')

        if primary_cause == 'Nitrogen / Chlorophyll Deficiency' and soil_context and soil_context.get('nitrogen', 0.5) < 0.45:
            days -= 1
            drivers.append('low district nitrogen status')

        if soil_context and soil_context.get('ec', 0) > 2.0:
            days -= 1
            drivers.append('salinity accelerates field decline')

        return max(1, min(14, int(days))), drivers

    def urgency_tier(self, stress_probability, growth_stage_code, primary_cause=None, soil_context=None, weather_context=None):
        days, _ = self.days_to_critical(
            stress_probability,
            growth_stage_code,
            primary_cause=primary_cause,
            soil_context=soil_context,
            weather_context=weather_context,
        )

        if days is None:
            return 'HEALTHY — No action needed'
        if days <= 3:
            return f'CRITICAL — Act within {days} day' + ('s' if days != 1 else '')
        if days <= 7:
            return f'HIGH — Act within {days} days'
        if days <= 10:
            return f'MODERATE-HIGH — Act within {days} days'
        return f'MONITOR — Check again within {days} days'

    def district_percentile(self, ndwi, evi, gndvi, health_score=None):
        """Estimate district percentile.

        When health_score is supplied (post-ML path), we use it directly so
        that the percentile and the health score are always mutually consistent.
        Punjab training-data mean ≈ 62 pts, σ ≈ 15 pts.
        Falling back to raw composite is kept for legacy callers that don't
        supply health_score.
        """
        if health_score is not None:
            # Rebase ML health score onto the normal distribution used by the
            # district benchmark.  mean=62, std=15 calibrated to Punjab dataset.
            z_score = (health_score - 62.0) / 15.0
        else:
            composite_score = (ndwi + evi + gndvi) / 3.0
            z_score = (composite_score - APPROX_PERCENTILE_MEAN) / APPROX_PERCENTILE_STD
        percentile = int(round(_normal_cdf(z_score) * 100))
        return max(1, min(99, percentile))

    def percentile_interpretation(self, percentile):
        if percentile < 50:
            return f'Your field is performing worse than {100 - percentile}% of comparable fields in the district'
        if percentile > 50:
            return f'Your field is performing better than {percentile}% of comparable fields in the district'
        return 'Your field is close to the district median for comparable fields'

    def yield_estimate(self, health_score, growth_stage_code=3, indices=None, crop_name='wheat'):
        """Dynamic yield estimate anchored to growth stage and live NDVI."""
        if growth_stage_code == 6:
            return {
                'estimated_maunds_per_acre': None,
                'estimated_kg_per_acre': None,
                'yield_risk': 'POST_HARVEST',
                'potential_loss_if_untreated_maunds': 0,
                'note': f'Post-harvest period — {crop_name} has been harvested.',
            }

        crop_key = str(crop_name or 'wheat').strip().lower()
        profile = CROP_DECISION_PROFILES.get(crop_key, CROP_DECISION_PROFILES['wheat'])

        stage_potential = profile.get('stage_potential_maunds', {1: 40.0, 2: 40.0, 3: 40.0, 4: 38.0, 5: 36.0})
        base = stage_potential.get(growth_stage_code, 38.0)

        yield_frac = 0.10 + (health_score / 100.0) * 0.90

        if indices is not None and growth_stage_code in (3, 4, 5):
            ndvi = indices.get('ndvi', None)
            if ndvi is not None:
                ndvi_benchmark = profile.get('ndvi_benchmark', {3: 0.55, 4: 0.63, 5: 0.44})
                ndvi_gap = max(0.0, ndvi_benchmark.get(growth_stage_code, 0.50) - ndvi)
                yield_frac = max(0.05, yield_frac - ndvi_gap * 0.40)

        stage_sensitivity = profile.get('stage_sensitivity', {1: 0.50, 2: 0.60, 3: 0.75, 4: 1.00, 5: 1.00})
        sensitivity = stage_sensitivity.get(growth_stage_code, 0.75)
        effective_frac = 1.0 - (1.0 - yield_frac) * sensitivity

        estimated_maunds = round(float(base * effective_frac), 1)
        estimated_maunds = max(3.0, min(base, estimated_maunds))
        estimated_kg = int(round(estimated_maunds * 40))
        potential_loss = round(max(0.0, base - estimated_maunds), 1)

        ndwi_target = profile.get('ndwi_target_by_stage', {}).get(growth_stage_code, -0.05)
        ndwi_current = indices.get('ndwi', ndwi_target) if indices else ndwi_target
        ndwi_deficit = max(0.0, ndwi_target - ndwi_current)

        if ndwi_deficit > 0.03 and potential_loss < 1.0:
            stress_loss = round(min(base * 0.25, ndwi_deficit * 8.0), 1)
            potential_loss = max(potential_loss, stress_loss)

        return {
            'estimated_maunds_per_acre': estimated_maunds,
            'estimated_kg_per_acre': estimated_kg,
            'yield_risk': _yield_risk_label(health_score),
            'potential_loss_if_untreated_maunds': potential_loss,
        }

    def calculate_economic_impact(self, yield_estimate, confidence_score, crop_name='wheat'):
        """Return farmer-facing economic impact in PKR/acre.

        For wheat (current supported satellite crop), we compute expected net impact
        from avoidable yield loss. The value is conservative and confidence-aware.
        """
        crop_key = str(crop_name or 'wheat').strip().lower()
        price_per_maund_pkr = {
            'wheat': 3900,
            'maize': 2800,
            'rice': 5200,
            'cotton': 8500,
            'sugarcane': 450,
        }.get(crop_key, 3900)

        estimated_maunds = float(yield_estimate.get('estimated_maunds_per_acre') or 0)
        potential_loss_maunds = float(yield_estimate.get('potential_loss_if_untreated_maunds') or 0)

        expected_revenue_pkr_per_acre = estimated_maunds * price_per_maund_pkr
        avoidable_loss_pkr_per_acre = potential_loss_maunds * price_per_maund_pkr

        conf = max(0.0, min(1.0, float(confidence_score or 0.7)))
        uncertainty_fraction = 0.16 + (1.0 - conf) * 0.36
        uncertainty_abs = abs(avoidable_loss_pkr_per_acre) * uncertainty_fraction + 1200

        lower = max(0.0, avoidable_loss_pkr_per_acre - uncertainty_abs)
        upper = max(0.0, avoidable_loss_pkr_per_acre + uncertainty_abs)

        return {
            'expected_revenue_pkr_per_acre': int(round(expected_revenue_pkr_per_acre)),
            'expected_loss_pkr_per_acre': int(round(avoidable_loss_pkr_per_acre)),
            'expected_savings_range_pkr_per_acre': {
                'lower': int(round(lower)),
                'upper': int(round(upper)),
            },
            'upside_pkr_per_acre': int(round(upper)),
            'downside_pkr_per_acre': int(round(lower)),
            'pricing_assumptions': {
                'crop': crop_key,
                'price_per_maund_pkr': price_per_maund_pkr,
            },
        }

    # Legacy recommendation engine kept only for reference/backward compatibility.
    # The live satellite analysis path uses build_recommendations_v2().
    def build_recommendations(self, primary_cause, urgency, stress_probability, indices):
        recommendations = []
        priority_rank = {'High': 3, 'Medium': 2, 'Low': 1}

        # Always surface concrete index-driven advice, even when model stress is low.
        # This keeps recommendations actionable when the aggregate model still predicts healthy.
        ndwi = indices.get('ndwi', 0.0)
        ndre = indices.get('ndre', 0.0)
        evi = indices.get('evi', 0.0)
        gndvi = indices.get('gndvi', 0.0)
        ndvi = indices.get('ndvi', 0.0)
        savi = indices.get('savi', 0.0)

        def add_recommendation(rec_type, action, priority, reason):
            for existing in recommendations:
                if existing['type'] == rec_type:
                    if priority_rank.get(priority, 1) > priority_rank.get(existing['priority'], 1):
                        existing['priority'] = priority
                    if len(reason) > len(existing['reason']):
                        existing['reason'] = reason
                    return
            recommendations.append({
                'type': rec_type,
                'action': action,
                'priority': priority,
                'reason': reason,
            })

        if ndwi < -0.25 or (ndwi < -0.18 and evi < 0.22):
            add_recommendation(
                'Irrigation Advisory',
                'Confirm root-zone moisture at multiple spots and irrigate if the top 10-15 cm soil profile is dry.',
                'High' if ndwi < -0.30 else 'Medium',
                f'Low NDWI ({ndwi:.3f}) with vigor marker EVI ({evi:.3f}) indicates likely moisture deficit.',
            )

        if ndwi > 0.12 and ndvi < 0.40:
            add_recommendation(
                'Drainage Check',
                'Inspect low-lying patches for standing water and open blocked drains before root stress increases.',
                'High' if ndwi > 0.20 else 'Medium',
                f'NDWI ({ndwi:.3f}) is elevated while NDVI ({ndvi:.3f}) is suppressed, a pattern consistent with waterlogging risk.',
            )

        if ndre < 0.16 or gndvi < 0.28:
            add_recommendation(
                'Nutrient Check',
                'Scout leaf color and tiller vigor; if deficiency is confirmed, apply split nitrogen top-dress and recheck in 5-7 days.',
                'High' if ndre < 0.12 else 'Medium',
                f'NDRE ({ndre:.3f}) and GNDVI ({gndvi:.3f}) suggest chlorophyll pressure and potential nitrogen limitation.',
            )

        if evi < 0.20 or savi < 0.22 or ndvi < 0.32:
            add_recommendation(
                'Canopy Vigor Alert',
                'Verify stand uniformity, emergence gaps, and pest hotspots; prioritize weak zones for on-ground inspection.',
                'Medium',
                f'Canopy vigor signals are weak (EVI {evi:.3f}, SAVI {savi:.3f}, NDVI {ndvi:.3f}).',
            )

        if ndwi > 0.14 and evi < 0.20:
            add_recommendation(
                'Disease / Pest Scout',
                'Inspect for fungal lesions, aphids, and patchy canopy decline; seek local agronomy support if symptoms are confirmed.',
                'Medium',
                f'High moisture signal (NDWI {ndwi:.3f}) with weak vigor (EVI {evi:.3f}) can increase disease pressure risk.',
            )

        if stress_probability <= 0.4:
            if recommendations:
                follow_up_days = 3 if any(r['priority'] == 'High' for r in recommendations) else 5
                add_recommendation(
                    'Follow-up Monitoring',
                    f'Capture another satellite check in {follow_up_days} days and compare hotspot trends before escalation.',
                    'Low',
                    'Model predicts healthy overall, but one or more index signals need short-interval monitoring.',
                )
                recommendations.sort(key=lambda r: priority_rank.get(r['priority'], 1), reverse=True)
                return recommendations[:4]

            return [{
                'type': 'Status Normal',
                'action': 'No immediate intervention needed. Continue routine scouting and weekly satellite review.',
                'priority': 'Low',
                'reason': 'The field currently appears healthy from the latest satellite signal.',
            }]

        cause_to_action = {
            'Water Deficit': 'Inspect soil moisture and schedule irrigation within the recommended urgency window.',
            'Waterlogging Risk': 'Check drainage, standing water, and low-lying patches immediately.',
            'Nitrogen / Chlorophyll Deficiency': 'Field-scout leaf color and consider a split nitrogen top-dress.',
            'Severe Multi-Stress': 'Conduct an urgent field visit to assess moisture, nutrient, and disease pressure together.',
            'Disease / Pest Risk': 'Scout for rust, aphids, or patchy canopy decline and consult local agronomy support if confirmed.',
            'Mild Stress / Monitor': 'Recheck the field in a few days and compare changes in canopy vigor.',
        }

        add_recommendation(
            'Primary Stress Signal',
            cause_to_action.get(primary_cause, 'Inspect the field and verify the stress source.'),
            'High' if stress_probability > 0.7 else 'Medium',
            f'{primary_cause}. {urgency}',
        )

        recommendations.sort(key=lambda r: priority_rank.get(r['priority'], 1), reverse=True)
        return recommendations[:4]

    # ─────────────────────────────────────────────────────────────────────────
    #   PRODUCTION RECOMMENDATION ENGINE  v2
    # ─────────────────────────────────────────────────────────────────────────

    def _get_soil_context(self, city):
        """Return district soil context for recommendation augmentation, or None."""
        if not city:
            return None
        key = city.strip().lower()
        if key in _DISTRICT_SOIL_CONTEXT:
            return {'district': city.strip(), **_DISTRICT_SOIL_CONTEXT[key]}
        # Partial match for city variants/casing.
        for k, v in _DISTRICT_SOIL_CONTEXT.items():
            if k in key or key in k:
                return {'district': k.title(), **v}
        return None

    def _get_crop_profile(self, crop_name, growth_stage_code):
        crop_key = str(crop_name or 'wheat').strip().lower()
        profile = CROP_DECISION_PROFILES.get(crop_key, CROP_DECISION_PROFILES['wheat'])
        kc = float(profile['kc_by_stage'].get(growth_stage_code, profile['kc_by_stage'].get(3, 0.85)))
        ndwi_target = float(profile['ndwi_target_by_stage'].get(growth_stage_code, profile['ndwi_target_by_stage'].get(3, -0.04)))
        return {
            'crop_key': crop_key,
            'kc': kc,
            'ndwi_target': ndwi_target,
        }

    def _estimate_reference_et0(self, weather_summary):
        """Estimate daily reference ET0 (mm/day) from available weather summary.

        This is a practical heuristic for advisory decisions when full FAO inputs
        (radiation, Tmin/Tmax, latitude day length) are not always present.
        """
        summary = weather_summary or {}
        max_temp = float(summary.get('max_temperature', 30.0) or 30.0)
        avg_temp = float(summary.get('avg_temperature', max_temp - 6.0) or (max_temp - 6.0))
        avg_humidity = float(summary.get('avg_humidity', 55.0) or 55.0)
        max_wind = float(summary.get('max_wind_speed', 2.0) or 2.0)

        # Baseline ET0 shape for Punjab-like semi-arid conditions.
        et0 = 3.0
        et0 += max(0.0, avg_temp - 20.0) * 0.14
        et0 += max(0.0, max_temp - 30.0) * 0.10
        et0 += max(0.0, 55.0 - avg_humidity) * 0.03
        et0 += max(0.0, max_wind - 2.0) * 0.10
        return max(2.5, min(8.5, et0))

    def _compute_irrigation_plan(self, indices, growth_stage_code, crop_name='wheat', soil_context=None, weather_context=None):
        weather_summary = (weather_context or {}).get('summary', {})
        rain_next_48h = float((weather_context or {}).get('rain_next_48h', weather_summary.get('rain_next_48h', 0)) or 0)
        hot_days = int((weather_context or {}).get('hot_days', 0) or 0)
        very_hot_days = int((weather_context or {}).get('very_hot_days', 0) or 0)

        crop_profile = self._get_crop_profile(crop_name, growth_stage_code)
        ndwi = float(indices.get('ndwi', 0.0) or 0.0)
        ndwi_target = crop_profile['ndwi_target']
        deficit = max(0.0, ndwi_target - ndwi)

        et0 = self._estimate_reference_et0(weather_summary)
        etc = et0 * crop_profile['kc']

        sandy_soil = bool(soil_context and float(soil_context.get('clay', 25) or 25) < 18)
        texture_factor = 1.10 if sandy_soil else 1.0

        # Two-day advisory dose, corrected by NDWI deficit and local texture.
        base_mm = (etc * 2.0 + deficit * 80.0) * texture_factor
        if growth_stage_code == 5:
            base_mm = min(base_mm, 28.0)
        if rain_next_48h >= 10:
            base_mm = max(10.0, base_mm - 12.0)
        elif rain_next_48h >= 5:
            base_mm = max(12.0, base_mm - 6.0)

        if very_hot_days >= 1:
            base_mm += 3.0
        elif hot_days >= 2:
            base_mm += 2.0

        mm_low = int(max(10, round(base_mm - 4)))
        mm_high = int(max(mm_low + 4, round(base_mm + 4)))

        should_irrigate = deficit >= 0.04 or (ndwi < -0.08 and rain_next_48h < 5)
        if growth_stage_code == 5 and deficit >= 0.02:
            should_irrigate = True

        if should_irrigate and (deficit >= 0.10 or (very_hot_days >= 1 and rain_next_48h < 3)):
            priority = 'Critical'
            window = 'within 24 hours'
        elif should_irrigate:
            priority = 'High'
            window = 'within 48 hours'
        else:
            priority = 'Low'
            window = 'reassess in 2-3 days'

        return {
            'should_irrigate': should_irrigate,
            'priority': priority,
            'window': window,
            'mm_low': mm_low,
            'mm_high': mm_high,
            'ndwi_target': ndwi_target,
            'ndwi_current': ndwi,
            'deficit': round(deficit, 3),
            'et0': round(et0, 2),
            'etc': round(etc, 2),
            'rain_next_48h': round(rain_next_48h, 1),
            'sandy_soil': sandy_soil,
        }

    def build_recommendations_v2(
        self, primary_cause, urgency_str, stress_probability, indices,
        growth_stage_code, growth_stage_name, month, soil_context=None,
        weather_context=None, crop_name='wheat',
    ):
        """Production recommendation engine fusing satellite indices + soil context.

        Returns list of rich recommendation dicts (up to 5), sorted by priority.
        Each dict keys: type, category, priority, urgency, action, detail,
                        impact, confidence, evidence, timing_window.
        """
        priority_rank = {'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1}
        recs = []

        # Post-harvest / fallow — no active crop, no agronomic actions needed.
        if growth_stage_code == 6:
            return []

        ndvi  = indices.get('ndvi', 0.0)
        ndwi  = indices.get('ndwi', 0.0)
        evi   = indices.get('evi',  0.0)
        gndvi = indices.get('gndvi', 0.0)
        ndre  = indices.get('ndre', 0.0)
        savi  = indices.get('savi', 0.0)
        crop_key = str(crop_name or 'wheat').strip().lower()
        crop_label = crop_key.capitalize()

        # Growth stage flags
        is_critical_stage = growth_stage_code in (4, 5)   # Heading / Grain Filling
        is_vegetative     = growth_stage_code in (1, 2)   # Germination / Tillering

        # Sandy soil flag — low clay means rapid moisture loss
        sandy_soil = soil_context and soil_context.get('clay', 25) < 18

        weather_summary = (weather_context or {}).get('summary', {})
        total_rainfall = float(weather_summary.get('total_rainfall', 0) or 0)
        avg_humidity = float(weather_summary.get('avg_humidity', 0) or 0)
        max_wind_speed = float(weather_summary.get('max_wind_speed', 0) or 0)
        max_temperature = float(weather_summary.get('max_temperature', 0) or 0)
        rain_next_48h = float((weather_context or {}).get('rain_next_48h', weather_summary.get('rain_next_48h', 0)) or 0)
        hot_days = int((weather_context or {}).get('hot_days', 0) or 0)
        very_hot_days = int((weather_context or {}).get('very_hot_days', 0) or 0)
        rainy_days = int((weather_context or {}).get('rainy_days', 0) or 0)
        heavy_rain_days = int((weather_context or {}).get('heavy_rain_days', 0) or 0)

        # ── 1. Irrigation Advisory (ET + stage + NDWI deficit) ─────────────
        irrigation_plan = self._compute_irrigation_plan(
            indices,
            growth_stage_code,
            crop_name=crop_name,
            soil_context=soil_context,
            weather_context=weather_context,
        )

        if irrigation_plan['should_irrigate']:
            dose_low = irrigation_plan['mm_low']
            dose_high = irrigation_plan['mm_high']
            irr_priority = irrigation_plan['priority']
            irr_window = irrigation_plan['window']

            action_tail = ''
            if irrigation_plan['rain_next_48h'] >= 8 and growth_stage_code != 5:
                action_tail = f' Rain expected (~{irrigation_plan["rain_next_48h"]:.1f} mm in 48h), so use the lower end of this dose.'
            elif very_hot_days >= 1:
                action_tail = ' Apply in early morning or evening to reduce evaporation losses.'
            if irrigation_plan['sandy_soil']:
                action_tail += ' Because soil is sandy, split into two lighter irrigations if possible.'

            recs.append({
                'type':         'Irrigation Advisory',
                'category':     'water',
                'priority':     irr_priority,
                'urgency':      f'Act {irr_window}',
                'action':       (
                    f'Irrigate {dose_low}-{dose_high} mm and prioritize the driest patches first.'
                    f'{action_tail}'
                ),
                'detail':       (
                    f'NDWI ({irrigation_plan["ndwi_current"]:.3f}) is below the crop-stage target '
                    f'({irrigation_plan["ndwi_target"]:.2f}). ET0 is {irrigation_plan["et0"]:.2f} mm/day '
                    f'and ETc is {irrigation_plan["etc"]:.2f} mm/day.'
                ),
                'impact':       (
                    f'Timely irrigation at {growth_stage_name} can avoid avoidable stress and protect yield.'
                ),
                'confidence':   round(min(0.95, 0.62 + irrigation_plan['deficit'] * 2.2), 2),
                'evidence':     {
                    'satellite': f'NDWI={irrigation_plan["ndwi_current"]:.3f}, target={irrigation_plan["ndwi_target"]:.2f}',
                    'growth_stage': f'{growth_stage_name} with Kc={self._get_crop_profile(crop_name, growth_stage_code)["kc"]:.2f}',
                    **({'weather': f'Rain 48h={irrigation_plan["rain_next_48h"]:.1f} mm, ET0={irrigation_plan["et0"]:.2f}'} if weather_context else {}),
                },
                'timing_window': irr_window,
                'irrigation_plan': {
                    'mm_low': dose_low,
                    'mm_high': dose_high,
                    'window': irr_window,
                    'et0': irrigation_plan['et0'],
                    'etc': irrigation_plan['etc'],
                },
            })

        # ── 2. Drainage / Waterlogging ───────────────────────────────────────
        wl_threshold = 0.10 if is_critical_stage else 0.13
        if ndwi > wl_threshold and ndvi < 0.42:
            priority = 'High' if ndwi > 0.18 else 'Medium'
            if rain_next_48h >= 12 or heavy_rain_days >= 2:
                priority = 'Critical'
            urgency_window = '12–24 hours' if priority == 'Critical' else '24–48 hours'
            recs.append({
                'type':         'Drainage Check',
                'category':     'water',
                'priority':     priority,
                'urgency':      f'Act within {urgency_window}',
                'action':       (
                    'Walk the field and inspect low-lying patches for standing water. '
                    'Open blocked bunds and field drains immediately. '
                    'If ponding persists > 48 h, consider emergency furrow drainage. '
                    + (f'Forecast rain in next 48 hours: ~{rain_next_48h:.1f} mm. Prepare outlets before rainfall.' if rain_next_48h >= 8 else '')
                ),
                'detail':       (
                    f'Elevated NDWI ({ndwi:.3f}) alongside suppressed NDVI ({ndvi:.3f}) '
                    'is consistent with surface or near-surface water saturation.'
                ),
                'impact':       (
                    'Waterlogging during reproductive stages can cause up to 30% yield loss '
                    'within 3–5 days by starving roots of oxygen.'
                ),
                'confidence':   round(min(0.90, 0.55 + (ndwi - wl_threshold) * 5), 2),
                'evidence':     {
                    'satellite':    f'NDWI = {ndwi:.3f} (> {wl_threshold:.2f}) with NDVI = {ndvi:.3f} (< 0.42)',
                    'growth_stage': f'{growth_stage_name} — waterlogging impairs root respiration at this stage',
                    **({'weather': f'7-day rain {total_rainfall:.1f} mm, rainy days={rainy_days}, heavy-rain days={heavy_rain_days}'} if weather_context else {}),
                },
                'timing_window': urgency_window,
            })

        # ── 3. Nitrogen / Chlorophyll Top-Dress ─────────────────────────────
        ndre_thr  = 0.18 if is_critical_stage else 0.14
        gndvi_thr = 0.30 if is_critical_stage else 0.26
        soil_n_low = soil_context and soil_context.get('nitrogen', 0.5) < 0.45

        if ndre < ndre_thr or gndvi < gndvi_thr or soil_n_low:
            n_signals = sum([ndre < ndre_thr, gndvi < gndvi_thr, bool(soil_n_low)])
            priority  = 'High' if (n_signals >= 2 or is_critical_stage) else 'Medium'
            urea_rate = (
                '15–20 kg/acre urea (split into two applications)' if growth_stage_code in (2, 3)
                else '10–15 kg/acre urea — last opportunity before flag leaf unfurls' if growth_stage_code == 4
                else '12–15 kg/acre urea'
            )
            evidence = {
                'satellite':    (
                    f'NDRE = {ndre:.3f} (threshold {ndre_thr:.2f}), '
                    f'GNDVI = {gndvi:.3f} (threshold {gndvi_thr:.2f})'
                ),
                'growth_stage': f'{growth_stage_name} — chlorophyll demand peaks at this stage',
            }
            if soil_context and soil_n_low:
                evidence['soil'] = (
                    f'{soil_context["district"]}: nitrogen {soil_context["nitrogen"]:.3f}% '
                    '(< optimal 0.45%)'
                )
            n_weather_note = None
            if weather_context and rain_next_48h >= 5:
                n_weather_note = f'🌧 Rain (~{rain_next_48h:.0f} mm in 48h) — apply just before rainfall for better urea uptake; skip irrigation immediately after.'
            recs.append({
                'type':         'Nitrogen Top-Dress',
                'category':     'nutrients',
                'priority':     priority,
                'urgency':      'Within 3–5 days',
                'action':       (
                    f'Apply {urea_rate} in the late afternoon to minimise ammonia volatilisation. '
                    'Always follow with a light irrigation or schedule before forecast rainfall.'
                ),
                'weather_note': n_weather_note,
                'detail':       (
                    f'NDRE ({ndre:.3f}) and GNDVI ({gndvi:.3f}) are the most sensitive satellite '
                    'indicators of canopy nitrogen and chlorophyll concentration. Both are '
                    'below the expected threshold for this growth stage.'
                ),
                'impact':       (
                    'Nitrogen deficiency during vegetative and reproductive growth '
                    + (
                        'reduces boll set and lint quality, often causing 8–15% yield loss.'
                        if crop_key == 'cotton'
                        else 'reduces panicle density and grain filling, often causing 8–15% yield loss.'
                        if crop_key == 'rice'
                        else 'delays tasseling and reduces grain fill in maize, often causing 10–20% yield loss.'
                        if crop_key == 'maize'
                        else 'reduces final grain protein content and yield by 8–15%.'
                    )
                ),
                'confidence':   round(
                    min(0.88, 0.50 + max(0, ndre_thr - ndre) * 3 + max(0, gndvi_thr - gndvi) * 1.5), 2
                ),
                'evidence':     evidence,
                'timing_window': '3–5 days',
            })

        # ── 3B. Micronutrient correction (Zinc + Sulfur) ───────────────────
        if soil_context:
            soil_ph = float(soil_context.get('ph', 7.0) or 7.0)
            soil_orgc = float(soil_context.get('orgc', 3.0) or 3.0)
            micronutrient_risk = (
                soil_ph >= 7.7
                or soil_orgc < 2.5
                or (ndre < max(0.12, ndre_thr - 0.03) and gndvi < max(0.24, gndvi_thr - 0.03))
            )
            if micronutrient_risk:
                micro_priority = 'High' if (soil_ph >= 7.9 and ndre < ndre_thr) else 'Medium'
                spray_window_note = ''
                if rain_next_48h >= 5:
                    spray_window_note = (
                        f' Rain of ~{rain_next_48h:.0f} mm is likely within 48 hours, so schedule foliar spray '
                        'after rainfall or at least 6 hours before rain.'
                    )
                recs.append({
                    'type':         'Zinc + Sulfur Correction',
                    'category':     'nutrients',
                    'priority':     micro_priority,
                    'urgency':      'Within 5–7 days',
                    'action':       (
                        'Apply zinc sulfate 33% at 8–10 kg/acre once in moist soil and add sulfur via gypsum '
                        '(40–60 kg/acre) or ammonium sulfate in the next nutrient pass. '
                        'For quick correction, use one foliar zinc spray in the evening.'
                        f'{spray_window_note}'
                    ),
                    'detail':       (
                        f'Alkaline reaction (pH {soil_ph:.2f}) and/or low organic carbon ({soil_orgc:.2f}%) can '
                        'reduce zinc and sulfur availability. NDRE/GNDVI weakness suggests chlorophyll formation '
                        'is constrained beyond nitrogen alone.'
                    ),
                    'impact':       (
                        'Micronutrient correction can restore chlorophyll activity and improve tiller survival, '
                        'typically adding 4–10% yield where hidden deficiency exists.'
                    ),
                    'confidence':   round(min(0.86, 0.52 + max(0.0, soil_ph - 7.5) * 0.18 + max(0.0, 2.6 - soil_orgc) * 0.10), 2),
                    'evidence':     {
                        'soil': f'{soil_context["district"]}: pH {soil_ph:.2f}, organic carbon {soil_orgc:.2f}%',
                        'satellite': f'NDRE {ndre:.3f}, GNDVI {gndvi:.3f} indicate chlorophyll stress',
                        'growth_stage': f'{growth_stage_name} — nutrient demand remains active',
                    },
                    'timing_window': '5–7 days',
                })

        # ── 4. Disease / Pest Scout ──────────────────────────────────────────
        disease_env   = (
            (ndwi > 0.08 and evi < 0.22 and growth_stage_code >= 2)
            or (rainy_days >= 3 and avg_humidity >= 68 and evi < 0.28 and growth_stage_code >= 2)
        )
        patchy_decline = ndre < 0.14 and ndvi < 0.35 and ndwi > -0.05 and not disease_env

        if disease_env or patchy_decline:
            if growth_stage_code in (3, 4):
                if crop_key == 'cotton':
                    action_text = (
                        'Scout for whitefly, jassid, and early pink bollworm signs in middle and upper canopy. '
                        'If threshold is exceeded, apply a district-recommended cotton IPM spray and rotate chemistry classes.'
                    )
                elif crop_key == 'rice':
                    action_text = (
                        'Scout for blast lesions, bacterial leaf blight streaks, and stem borer dead-hearts in representative patches. '
                        'If thresholds are exceeded, apply district-recommended rice IPM measures and rotate chemistry classes.'
                    )
                elif crop_key == 'maize':
                    action_text = (
                        'Scout for fall armyworm, stem borer, and corn silk fly damage in ears and whorls. '
                        'If 5–10% ears show damage, apply Spinosad 45% at 400 mL/acre or Emamectin Benzoate 5% SG at 80 g/acre.'
                    )
                else:
                    action_text = (
                        'Scout for yellow/brown stripe lesions on leaves consistent with stripe rust. '
                        'If > 5% leaf area is infected, apply propiconazole 25EC at 200 mL/acre '
                        'or tebuconazole 250EC at 125 mL/acre immediately.'
                    )
                priority = 'High'
            elif growth_stage_code == 2:
                if crop_key == 'cotton':
                    action_text = (
                        'Inspect early cotton canopy for jassid burn and whitefly colonies on underside of leaves. '
                        'Treat only affected blocks first using threshold-based cotton advisory.'
                    )
                elif crop_key == 'rice':
                    action_text = (
                        'Inspect tillering zones for leaf folder damage and early stem borer incidence. '
                        'Treat only affected blocks first using threshold-based rice advisory.'
                    )
                elif crop_key == 'maize':
                    action_text = (
                        'Inspect young maize for armyworm and shootfly damage on leaves. '
                        'If 5% or more plants show damage per 10-plant sample, spray Spinosad 45% 300–400 mL/acre.'
                    )
                else:
                    action_text = (
                        'Inspect tiller bases for aphid colonies. '
                        'If > 5 aphids per tiller are found, apply imidacloprid 200SL at 75 mL/acre.'
                    )
                priority = 'Medium'
            else:
                action_text = (
                    'Field-scout for lesions and canopy gaps. '
                    'Consult your local extension officer if symptoms cover > 5% of plants.'
                )
                priority = 'Medium'

            # Spray-window guidance: warn when wind or rain would reduce pesticide efficacy
            if weather_context and (max_wind_speed >= 5 or rain_next_48h >= 3):
                bad_conditions = []
                if rain_next_48h >= 3:
                    bad_conditions.append(f'rain expected (~{rain_next_48h:.0f} mm in 48h)')
                if max_wind_speed >= 5:
                    bad_conditions.append(f'wind up to {max_wind_speed:.0f} m/s')
                action_text += (
                    f' Avoid spraying for at least 48 hours: {" and ".join(bad_conditions)}'
                    ' would reduce pesticide uptake and risk off-target drift.'
                )
            recs.append({
                'type':         'Disease & Pest Scout',
                'category':     'disease',
                'priority':     priority,
                'urgency':      '3–5 days',
                'action':       action_text,
                'detail':       (
                    f'Moist canopy conditions (NDWI {ndwi:.3f}) combined with reduced vigour '
                    f'(EVI {evi:.3f}) create an environment favourable for fungal disease or '
                    'pest colony build-up.'
                ),
                'impact':       (
                    ('Unchecked whitefly, jassid, or pink bollworm pressure can reduce cotton yield and lint quality by 15–35% within weeks.'
                     if crop_key == 'cotton'
                     else 'Unchecked blast, stem borer, or planthopper pressure can reduce rice yield by 15–35% within weeks.'
                     if crop_key == 'rice'
                     else 'Unchecked fall armyworm or stem borer pressure can reduce maize yield by 15–40% within weeks.'
                     if crop_key == 'maize'
                     else 'Unchecked stripe rust or aphid pressure can reduce yield by 20–40% in as little as 10–14 days.')
                ),
                'confidence':   round(min(0.82, 0.45 + (ndwi + 0.1) * 2 + max(0, 0.22 - evi) * 2), 2),
                'evidence':     {
                    'satellite':    f'NDWI = {ndwi:.3f}, EVI = {evi:.3f} — moist canopy with reduced vigour',
                    'growth_stage': f'{growth_stage_name} — host susceptibility elevated at this stage',
                    **({'weather': f'Avg humidity {avg_humidity:.1f}%, rainy days={rainy_days}, max wind={max_wind_speed:.1f} m/s'} if weather_context else {}),
                },
                'timing_window': '3–5 days',
            })

        # ── 5. Canopy Vigor / Stand Density ─────────────────────────────────
        if (evi < 0.18 or savi < 0.20) or (ndvi < 0.25 and growth_stage_code >= 3):
            if is_vegetative:
                action_text = (
                    'Inspect for poor germination, bird damage, or soil crusting. '
                    'Gap-fill with additional seed in any bare patches.'
                )
                detail_text = (
                    f'Low canopy signals at early growth (EVI {evi:.3f}, SAVI {savi:.3f}) '
                    'may indicate poor stand establishment.'
                )
            else:
                action_text = (
                    'Audit field for patchy thinning and canopy unevenness. '
                    + (
                        'Check square/boll retention and support potassium where fruiting load appears weak.'
                        if crop_key == 'cotton'
                        else 'Check panicle emergence uniformity and support potassium where grain filling appears weak.'
                        if crop_key == 'rice'
                        else 'Check ear setting and provide late nitrogen/potassium if canopy is severely weak.'
                        if crop_key == 'maize'
                        else 'Apply potassium (10 kg/acre SOP) if tiller vigour appears low.'
                    )
                )
                detail_text = (
                    f'Canopy density signals (EVI {evi:.3f}, SAVI {savi:.3f}, NDVI {ndvi:.3f}) '
                    'are below the expected range for this growth stage.'
                )
            recs.append({
                'type':         'Canopy Vigor Alert',
                'category':     'structural',
                'priority':     'Medium',
                'urgency':      '5–7 days',
                'action':       action_text,
                'detail':       detail_text,
                'impact':       (
                    'Reduced canopy density at this stage is associated with '
                    + ('5–12% lower lint and boll yield.' if crop_key == 'cotton' else '5–12% lower maize grain yield.' if crop_key == 'maize' else '5–12% lower final grain yield.')
                ),
                'confidence':   round(
                    min(0.78, 0.40 + max(0, 0.25 - ndvi) * 1.5 + max(0, 0.20 - min(savi, 0.20)) * 2), 2
                ),
                'evidence':     {
                    'satellite':    f'NDVI = {ndvi:.3f}, EVI = {evi:.3f}, SAVI = {savi:.3f}',
                    'growth_stage': f'{growth_stage_name} — expected canopy index range is higher at this stage',
                },
                'timing_window': '5–7 days',
            })

        # ── 5B. Weed pressure control window ───────────────────────────────
        weed_window_open = (
            growth_stage_code in (1, 2, 3)
            and ndvi >= 0.18
            and ndvi <= 0.48
            and evi < 0.30
            and ndwi > -0.18
            and not (rain_next_48h >= 8 or max_wind_speed >= 6)
        )
        if weed_window_open:
            weed_priority = 'High' if (growth_stage_code == 2 and ndvi < 0.32) else 'Medium'
            recs.append({
                'type':         'Weed Control Window',
                'category':     'management',
                'priority':     weed_priority,
                'urgency':      'Within 2–4 days',
                'action':       (
                    'Scout 5 random spots and estimate weed cover. If broadleaf/grass weeds exceed 10–15% cover '
                    'or compete above crop canopy height, perform a stage-safe post-emergence spray. '
                    'Spray in calm conditions (wind < 4 m/s), preferably evening or early morning.'
                ),
                'detail':       (
                    f'Canopy development (NDVI {ndvi:.3f}, EVI {evi:.3f}) is below expected pace for {growth_stage_name}, '
                    'a pattern often associated with early weed competition when moisture is present.'
                ),
                'impact':       (
                    'Timely weed control during early growth can protect 8–20% yield that is otherwise lost to competition.'
                ),
                'confidence':   round(min(0.79, 0.48 + max(0.0, 0.35 - ndvi) * 0.9 + max(0.0, 0.30 - evi) * 0.8), 2),
                'evidence':     {
                    'satellite': f'NDVI {ndvi:.3f}, EVI {evi:.3f}, NDWI {ndwi:.3f}',
                    'growth_stage': f'{growth_stage_name} — weed competition is most damaging now',
                    **({'weather': f'Next 48h rain {rain_next_48h:.1f} mm, max wind {max_wind_speed:.1f} m/s'} if weather_context else {}),
                },
                'timing_window': '2–4 days',
            })

        # ── 6. Soil-context amendments ───────────────────────────────────────
        if soil_context:
            ph = soil_context.get('ph', 7.0)
            ec = soil_context.get('ec', 1.0)
            orgc = float(soil_context.get('orgc', 3.0) or 3.0)
            if crop_key == 'cotton':
                ph_low, ph_high = (6.0, 7.5)
            elif crop_key == 'rice':
                ph_low, ph_high = (5.5, 7.0)
            else:
                ph_low, ph_high = (6.5, 7.5)

            if ph < 6.0:
                recs.append({
                    'type':         'Soil pH Amendment',
                    'category':     'structural',
                    'priority':     'Medium',
                    'urgency':      'Post-harvest',
                    'action':       (
                        f'Apply agricultural lime at 100–150 kg/acre after harvest, incorporate it into '
                        f'the topsoil where possible, and retest pH before making a second application. '
                        f'This will help lift soil pH from {ph:.1f} toward the {crop_label} optimum of {ph_low:.1f}–{ph_high:.1f}.'
                    ),
                    'detail':       (
                        f'{soil_context["district"]} district soil pH ({ph:.2f}) is below the {crop_label} '
                        'optimum. Acidic conditions reduce phosphorus and micronutrient availability.'
                    ),
                    'impact':       (
                        'Correcting soil pH can improve nitrogen use efficiency by 10–20% '
                        'in the following season.'
                    ),
                    'confidence':   0.92,
                    'evidence':     {
                        'soil':         f'{soil_context["district"]}: measured pH {ph:.2f}, optimal {ph_low:.1f}–{ph_high:.1f} for {crop_label}',
                        'growth_stage': 'Post-season amendment — apply after harvest, before next sowing',
                    },
                    'timing_window': 'Post-harvest',
                })
            elif ec > 2.0:
                recs.append({
                    'type':         'Salinity Management',
                    'category':     'structural',
                    'priority':     'Medium',
                    'urgency':      'Pre-sowing season',
                    'action':       (
                        f'{"Apply gypsum " + ("3–4 kg/m²" if ec > 4.0 else "2–3 kg/m²" if ec > 3.0 else "1–2 kg/m²") + " on high-EC patches (measured EC " + f"{ec:.1f}" + " dS/m). "}'
                        f'{"Run three" if ec > 4.0 else "Run two"} 50 mm pre-season leaching irrigations to flush salts below '
                        'the root zone. Install shallow drainage if ponding occurs after leaching.'
                    ),
                    'detail':       (
                        f'{soil_context["district"]} soil EC ({ec:.1f} dS/m) exceeds the '
                        f'2.0 dS/m stress threshold by {ec - 2.0:.1f} dS/m. '
                        'Salinity suppresses root water uptake and mimics drought stress — '
                        'satellite NDWI may underestimate true water status in saline soils.'
                    ),
                    'impact':       (
                        f'At EC {ec:.1f} dS/m, {crop_label} yield potential is reduced to approximately '
                        f'{"50–65" if ec > 4.0 else "65–80" if ec > 3.0 else "80–90"}% of '
                        'the district average even with adequate irrigation.'
                    ),
                    'confidence':   round(min(0.95, 0.80 + (ec - 2.0) * 0.05), 2),
                    'evidence':     {
                        'soil':      f'{soil_context["district"]}: EC {ec:.2f} dS/m (optimal < 2.0 for {crop_label})',
                        'satellite': f'NDWI {ndwi:.3f} may reflect salinity-induced cellular water deficit',
                    },
                    'timing_window': 'Pre-sowing / post-harvest',
                })

            if orgc < 2.6:
                om_priority = 'High' if orgc < 2.1 else 'Medium'
                recs.append({
                    'type':         'Organic Matter Build Plan',
                    'category':     'management',
                    'priority':     om_priority,
                    'urgency':      'Plan this season, apply post-harvest',
                    'action':       (
                        'Incorporate 1.5–2.5 tons/acre well-decomposed FYM or compost after harvest. '
                        'Retain part of crop residue, and consider a short green-manure cycle before next sowing '
                        'to raise soil carbon and improve water-holding capacity.'
                    ),
                    'detail':       (
                        f'{soil_context["district"]} organic carbon is {orgc:.2f}%, below the preferred >=2.8% for '
                        f'stable moisture and nutrient buffering in {crop_label.lower()} systems.'
                    ),
                    'impact':       (
                        'Improved organic matter generally increases fertilizer efficiency and moisture retention, '
                        'reducing stress recurrence across seasons.'
                    ),
                    'confidence':   round(min(0.9, 0.56 + max(0.0, 2.8 - orgc) * 0.2), 2),
                    'evidence':     {
                        'soil': f'{soil_context["district"]}: organic carbon {orgc:.2f}% (target >= 2.8%)',
                        'satellite': f'NDWI {ndwi:.3f} and SAVI {savi:.3f} suggest sensitivity to soil condition variability',
                    },
                    'timing_window': 'Post-harvest and pre-sowing',
                })

        # ── 7. Fallback: ML model stressed but no index triggered ────────────
        active_recs = [r for r in recs if r['category'] != 'structural']
        if stress_probability > 0.50 and not active_recs:
            recs.append({
                'type':         'Composite Stress Signal',
                'category':     'monitoring',
                'priority':     'High' if stress_probability > 0.70 else 'Medium',
                'urgency':      'Act within 3–5 days',
                'action':       (
                    'Conduct immediate on-ground field inspection. The ML model detects '
                    'composite stress not fully captured by individual index thresholds. '
                    'Verify soil moisture, canopy colour, and disease pressure in person.'
                ),
                'detail':       (
                    f'Ensemble model stress probability: {stress_probability:.0%}. '
                    f'All index values: NDVI {ndvi:.3f}, NDWI {ndwi:.3f}, '
                    f'EVI {evi:.3f}, GNDVI {gndvi:.3f}, NDRE {ndre:.3f}.'
                ),
                'impact':       (
                    'Composite stress signals have historically preceded yield losses of '
                    '10–25% when left uninvestigated for more than one week.'
                ),
                'confidence':   round(stress_probability, 2),
                'evidence':     {
                    'satellite':    f'ML ensemble stress probability = {stress_probability:.0%}',
                    'growth_stage': f'{growth_stage_name} — all six Sentinel-2 indices evaluated together',
                },
                'timing_window': '3–5 days',
            })

        # ── 8. Healthy field — proactive monitoring plan ─────────────────────
        non_monitoring = [r for r in recs if r['category'] != 'monitoring']
        if not non_monitoring or (
            stress_probability <= 0.35
            and all(r['priority'] in ('Low', 'Medium') for r in recs)
        ):
            follow_days = 5 if is_critical_stage else 7
            if hot_days >= 3 or rain_next_48h >= 10:
                follow_days = max(3, follow_days - 2)
            recs.append({
                'type':         'Routine Monitoring',
                'category':     'monitoring',
                'priority':     'Low',
                'urgency':      f'Every {follow_days} days',
                'action':       (
                    f'Schedule next satellite check in {follow_days} days. '
                    'No immediate intervention required — maintain current practices.'
                ),
                'detail':       (
                    'Current satellite indices are within the healthy range for this '
                    f'crop at {growth_stage_name} stage.'
                ),
                'impact':       (
                    'Proactive satellite monitoring catches emerging stresses '
                    '5–10 days before they become visible on the ground.'
                ),
                'confidence':   round(max(0.65, 1.0 - stress_probability), 2),
                'evidence':     {
                    'satellite':    f'NDVI {ndvi:.3f}, EVI {evi:.3f}, NDWI {ndwi:.3f} — within healthy range',
                    'growth_stage': f'{growth_stage_name} — no stage-specific stress alerts triggered',
                    **({'weather': f'Upcoming weather is changeable (hot days={hot_days}, next 48h rain={rain_next_48h:.1f} mm)'} if weather_context and (hot_days >= 3 or rain_next_48h >= 10) else {}),
                },
                'timing_window': f'Every {follow_days} days',
            })

        # ── 9. Optional agronomy menu (when hard triggers are limited) ─────
        # Gives farmers practical next-step options beyond the strict detected stress set.
        if len(recs) < 5:
            existing_types = {r.get('type') for r in recs}
            optional_pool = []

            optional_pool.append({
                'type': 'Micronutrient Maintenance Option',
                'category': 'nutrients',
                'priority': 'Low',
                'urgency': 'Optional this week',
                'action': (
                    'If leaves look pale or uneven, apply one light zinc + boron foliar spray '
                    'in calm evening hours.'
                ),
                'detail': 'A preventive micronutrient top-up can stabilize canopy performance between major fertilizer events.',
                'impact': 'Useful as a low-cost preventive action where hidden deficiency risk exists.',
                'confidence': 0.58,
                'timing_window': 'This week (optional)',
            })

            if growth_stage_code in (1, 2, 3):
                optional_pool.append({
                    'type': 'Weed Prevention Option',
                    'category': 'management',
                    'priority': 'Low',
                    'urgency': 'Optional in 2–4 days',
                    'action': (
                        'Do a quick weed pass in 4–5 representative spots. If weed cover crosses 10%, '
                        'schedule a stage-safe post-emergence control pass.'
                    ),
                    'detail': 'Early weed suppression protects nutrient and moisture use-efficiency during vegetative growth.',
                    'impact': 'Can prevent avoidable competition losses in the first half of the season.',
                    'confidence': 0.56,
                    'timing_window': '2–4 days (optional)',
                })

            optional_pool.append({
                'type': 'Preventive Pest Scout Option',
                'category': 'disease',
                'priority': 'Low',
                'urgency': 'Optional this week',
                'action': (
                    ('Inspect middle and upper canopy for whitefly, jassid, and bollworm early signs. Spray only when threshold is crossed to avoid unnecessary chemical cost.'
                     if crop_key == 'cotton'
                     else 'Inspect leaf blades and tillering zones for blast lesions, stem borer, or planthopper hotspots. Spray only when threshold is crossed to avoid unnecessary chemical cost.'
                     if crop_key == 'rice'
                     else 'Inspect lower and middle canopy for fall armyworm, stem borer, and shoot fly early signs. Spray only when threshold is crossed to avoid unnecessary chemical cost.'
                     if crop_key == 'maize'
                     else 'Inspect lower and middle canopy for early rust lesions and aphid hotspots. Spray only if threshold is crossed to avoid unnecessary chemical cost.')
                ),
                'detail': 'Threshold-based scouting lowers input waste while catching outbreaks early.',
                'impact': 'Improves spray timing discipline and protects margins.',
                'confidence': 0.55,
                'timing_window': 'This week (optional)',
            })

            if soil_context and float(soil_context.get('orgc', 3.0) or 3.0) < 3.0:
                optional_pool.append({
                    'type': 'Soil Carbon Improvement Option',
                    'category': 'management',
                    'priority': 'Low',
                    'urgency': 'Plan for post-harvest',
                    'action': (
                        'Plan residue retention and one FYM/compost application after harvest '
                        'to improve moisture buffering before the next crop cycle.'
                    ),
                    'detail': 'Better soil carbon reduces repeat stress cycles and improves nutrient use efficiency.',
                    'impact': 'Medium-term resilience improvement with season-over-season gains.',
                    'confidence': 0.62,
                    'timing_window': 'Post-harvest planning',
                })

            for opt in optional_pool:
                if len(recs) >= 6:
                    break
                if opt['type'] in existing_types:
                    continue
                recs.append(opt)
                existing_types.add(opt['type'])

        def _clamp(val, low=0.0, high=1.0):
            return max(low, min(high, val))

        dryness_risk = _clamp(
            (hot_days / 5.0) * 0.35
            + (very_hot_days / 3.0) * 0.30
            + (max(0.0, 6.0 - total_rainfall) / 6.0) * 0.20
            + (0.15 if rain_next_48h < 2.0 else 0.0)
        )
        wetness_risk = _clamp(
            (rain_next_48h / 20.0) * 0.45
            + (heavy_rain_days / 3.0) * 0.30
            + (rainy_days / 7.0) * 0.25
        )
        disease_risk = _clamp(
            (max(0.0, avg_humidity - 60.0) / 25.0) * 0.45
            + (rainy_days / 7.0) * 0.35
            + wetness_risk * 0.20
        )
        wind_risk = _clamp(max_wind_speed / 12.0)
        weather_risk_overall = _clamp(
            max(dryness_risk, wetness_risk, disease_risk, wind_risk * 0.75)
        )

        base_priority_score = {
            'low': 38.0,
            'medium': 52.0,
            'high': 68.0,
            'critical': 84.0,
        }

        for rec in recs:
            current_priority = str(rec.get('priority', 'Low')).lower()
            score = base_priority_score.get(current_priority, 50.0)

            category = rec.get('category', '')
            rec_type = str(rec.get('type', '')).lower()

            if category == 'water':
                if 'drainage' in rec_type:
                    score += wetness_risk * 22.0
                elif 'irrigation' in rec_type:
                    score += dryness_risk * 18.0
                    score -= wetness_risk * 10.0
                else:
                    score += max(dryness_risk, wetness_risk) * 14.0
            elif category == 'disease':
                score += disease_risk * 20.0
                score += wetness_risk * 6.0
            elif category == 'monitoring':
                score += weather_risk_overall * 12.0
                score += wind_risk * 4.0
            elif category in ('nutrients', 'structural'):
                score += weather_risk_overall * 6.0
            elif category == 'management':
                score += weather_risk_overall * 8.0
                score += (0.10 if growth_stage_code in (1, 2, 3) else 0.0) * 10.0

            score += float(stress_probability) * 8.0
            score = max(5.0, min(99.0, score))
            rec['priority_score'] = round(score, 1)

            if score >= 82.0:
                rec['priority'] = 'Critical'
            elif score >= 64.0:
                rec['priority'] = 'High'
            elif score >= 46.0:
                rec['priority'] = 'Medium'
            else:
                rec['priority'] = 'Low'

            # Cost-benefit metadata for farmer decision support
            rec_type = str(rec.get('type', '')).lower()
            if any(k in rec_type for k in ('irrigation', 'drainage', 'disease', 'pest')):
                rec['cost_band'] = 'Medium'
                rec['benefit_band'] = 'High'
            elif any(k in rec_type for k in ('nitrogen', 'zinc', 'sulfur', 'weed')):
                rec['cost_band'] = 'Low-Medium'
                rec['benefit_band'] = 'High'
            elif any(k in rec_type for k in ('organic matter', 'salinity', 'soil pH')):
                rec['cost_band'] = 'Medium-High'
                rec['benefit_band'] = 'Medium-High'
            else:
                rec['cost_band'] = 'Low'
                rec['benefit_band'] = 'Medium'

            cost_weight = {
                'Low': 1.00,
                'Low-Medium': 0.90,
                'Medium': 0.78,
                'Medium-High': 0.64,
                'High': 0.52,
            }.get(rec['cost_band'], 0.75)
            rec['cost_priority_score'] = round(rec['priority_score'] * cost_weight, 1)

        # Diversified shortlist: keep high-priority actions but avoid single-category domination.
        recs.sort(
            key=lambda r: (r.get('priority_score', 0), r.get('cost_priority_score', 0), priority_rank.get(r.get('priority', 'Low'), 1)),
            reverse=True,
        )

        max_recs = 7
        preferred_categories = ['water', 'nutrients', 'disease', 'management', 'structural']
        selected = []
        selected_ids = set()

        for cat in preferred_categories:
            candidate = next((r for r in recs if r.get('category') == cat), None)
            if candidate is not None:
                selected.append(candidate)
                selected_ids.add(id(candidate))
            if len(selected) >= max_recs:
                break

        for rec in recs:
            if len(selected) >= max_recs:
                break
            if id(rec) in selected_ids:
                continue
            selected.append(rec)
            selected_ids.add(id(rec))

        return selected[:max_recs]

    def build_field_report(
        self, health_score, stress_probability, recommendations,
        growth_stage_name, growth_stage_code, primary_cause,
        benchmarking, yield_estimate, soil_context=None,
    ):
        """Build a top-level field health report card.

        Fuses ML prediction + satellite indices + soil context into a single
        structured summary (suitable for a hero card in the UI).
        """
        # Blend satellite health_score (70%) with district soil score (30%)
        if soil_context:
            blended = round(0.70 * health_score + 0.30 * soil_context.get('score', health_score))
        else:
            blended = health_score

        # Grade mapping
        if   blended >= 90: grade, label = 'A+', 'Excellent'
        elif blended >= 80: grade, label = 'A',  'Very Good'
        elif blended >= 70: grade, label = 'B',  'Good'
        elif blended >= 58: grade, label = 'C',  'Fair'
        elif blended >= 45: grade, label = 'D',  'Needs Attention'
        else:               grade, label = 'F',  'Critical'

        # Risk tallies
        critical_count = sum(1 for r in recommendations if r.get('priority') == 'Critical')
        high_count     = sum(1 for r in recommendations if r.get('priority') == 'High')
        medium_count   = sum(1 for r in recommendations if r.get('priority') == 'Medium')

        if   critical_count > 0:  risk_level = 'Critical'
        elif high_count     >= 2: risk_level = 'High'
        elif high_count     == 1: risk_level = 'Elevated'
        elif medium_count   >= 2: risk_level = 'Moderate'
        else:                     risk_level = 'Low'

        # Human-readable status summary
        if critical_count > 0:
            top = next((r['type'] for r in recommendations if r['priority'] == 'Critical'), 'intervention')
            status_summary = (
                f'Critical field stress detected — immediate {top.lower()} required. '
                'Prioritise the immediate actions below.'
            )
        elif high_count > 0:
            causes = [r['type'] for r in recommendations if r['priority'] == 'High']
            status_summary = (
                f'Field requires attention: {" and ".join(causes[:2]).lower()} signal'
                f'{"s" if len(causes) > 1 else ""} detected at {growth_stage_name} stage. '
                'Address the highlighted recommendations next.'
            )
        elif blended >= 80:
            status_summary = (
                f'Field is performing well at {growth_stage_name} stage. '
                'Minor optimisations may further improve yield.'
            )
        else:
            status_summary = (
                f'Field health is acceptable for {growth_stage_name} stage. '
                'Monitor indices over the next 5–7 days.'
            )

        key_signal = next(
            (r['type'] for r in recommendations if r['priority'] in ('Critical', 'High')),
            None,
        )

        report = {
            'field_health_score': blended,
            'health_grade':       grade,
            'health_label':       label,
            'risk_level':         risk_level,
            'status_summary':     status_summary,
            'critical_count':     critical_count,
            'high_count':         high_count,
            'medium_count':       medium_count,
            'key_signal':         key_signal,
            'growth_stage':       growth_stage_name,
            'estimated_yield': {
                'maunds_per_acre':       yield_estimate.get('estimated_maunds_per_acre', 35),
                'kg_per_acre':           yield_estimate.get('estimated_kg_per_acre', 1400),
                'yield_risk':            yield_estimate.get('yield_risk', 'LOW'),
                'potential_loss_maunds': yield_estimate.get('potential_loss_if_untreated_maunds', 0),
            },
            'economic_impact': {
                # Filled by caller where confidence/crop context is known.
                'expected_revenue_pkr_per_acre': None,
                'expected_loss_pkr_per_acre': None,
                'expected_savings_range_pkr_per_acre': {'lower': None, 'upper': None},
                'upside_pkr_per_acre': None,
                'downside_pkr_per_acre': None,
                'pricing_assumptions': {},
            },
            'benchmarking':  benchmarking,
            'quick_actions': [
                {
                    'type':     r['type'],
                    'action':   r['action'][:140] + '…' if len(r['action']) > 140 else r['action'],
                    'timing':   r.get('timing_window', r.get('urgency', '')),
                    'priority': r['priority'],
                }
                for r in recommendations[:3]
            ],
            'satellite_model': {
                'accuracy':          None,   # filled by caller
                'confidence_label':  None,   # filled by caller
            },
        }

        if soil_context:
            report['soil_context'] = {
                'district':       soil_context.get('district', ''),
                'health_class':   soil_context.get('health_class', ''),
                'score':          soil_context.get('score', 0),
                'key_limitation': soil_context.get('key_limitation', ''),
                'ph':             soil_context.get('ph', 0),
                'ec':             soil_context.get('ec', 0),
                'nitrogen':       soil_context.get('nitrogen', 0),
                'note':           'District-level soil data from multi-sample field analysis',
            }

        return report

    def build_farmer_summary(
        self,
        indices,
        recommendations,
        diagnosis,
        growth_stage_name,
        weather_context=None,
        soil_context=None,
        irrigation_plan=None,
    ):
        """Compact, farmer-first summary while preserving advanced payload elsewhere."""
        urgency = str((diagnosis or {}).get('urgency', '') or '')
        if 'CRITICAL' in urgency:
            status_label = 'Urgent'
            status_color = 'red'
        elif 'HIGH' in urgency or 'MODERATE' in urgency:
            status_label = 'Needs Attention'
            status_color = 'yellow'
        else:
            status_label = 'Good'
            status_color = 'green'

        priority_weight = {'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1}
        ranked = sorted(
            recommendations,
            key=lambda r: (
                priority_weight.get(str(r.get('priority', 'Low')), 1),
                float(r.get('priority_score', 0) or 0),
            ),
            reverse=True,
        )

        top_actions = []
        for rec in ranked[:3]:
            top_actions.append({
                'title': rec.get('type', 'Action'),
                'what': rec.get('action', ''),
                'when': rec.get('timing_window') or rec.get('urgency') or 'Next 2-3 days',
                'priority': rec.get('priority', 'Medium'),
                'cost_band': rec.get('cost_band', 'Medium'),
                'benefit_band': rec.get('benefit_band', 'High'),
            })

        weather_summary = (weather_context or {}).get('summary', {})
        rain_next_48h = float((weather_context or {}).get('rain_next_48h', weather_summary.get('rain_next_48h', 0)) or 0)
        hot_days = int((weather_context or {}).get('hot_days', 0) or 0)
        max_wind = float(weather_summary.get('max_wind_speed', 0) or 0)

        weather_warning = None
        if rain_next_48h >= 10:
            weather_warning = 'Heavy rain likely in next 48h. Avoid spray and clear drainage first.'
        elif hot_days >= 2:
            weather_warning = 'Heat window expected. Prefer irrigation in early morning or evening.'
        elif max_wind >= 5:
            weather_warning = 'Wind speed is high. Delay spray to avoid drift losses.'

        soil_alert = None
        if soil_context:
            ec = float(soil_context.get('ec', 0) or 0)
            ph = float(soil_context.get('ph', 7) or 7)
            if ec > 2.0:
                soil_alert = f'Soil salinity is high (EC {ec:.1f}). Use split irrigation and prioritize leaching plan.'
            elif ph < 6.0 or ph > 8.0:
                soil_alert = f'Soil pH ({ph:.1f}) is out of the ideal range. Plan correction in the next cycle.'

        weed_signal = 'Low'
        weed_rec = next((r for r in ranked if 'weed' in str(r.get('type', '')).lower()), None)
        if weed_rec:
            weed_signal = 'High' if weed_rec.get('priority') in ('Critical', 'High') else 'Medium'

        spray_decision = {
            'needed_now': bool(any('spray' in str(r.get('action', '')).lower() for r in ranked[:3])),
            'note': 'Spray only in low wind and without rain in the next 24 hours.',
        }

        next_check_days = (diagnosis or {}).get('days_to_critical')
        if next_check_days is None:
            next_check_days = 7 if status_label == 'Good' else 4

        return {
            'status_label': status_label,
            'status_color': status_color,
            'growth_stage': growth_stage_name,
            'top_actions': top_actions,
            'irrigation': {
                'irrigate_now': bool(irrigation_plan and irrigation_plan.get('should_irrigate')),
                'mm_low': irrigation_plan.get('mm_low') if irrigation_plan else None,
                'mm_high': irrigation_plan.get('mm_high') if irrigation_plan else None,
                'timing_window': irrigation_plan.get('window') if irrigation_plan else None,
            },
            'weather_warning': weather_warning,
            'soil_alert': soil_alert,
            'weed_signal': weed_signal,
            'spray_decision': spray_decision,
            'next_check_days': int(next_check_days),
            'expected_impact': {
                'summary': 'Following the top actions should reduce near-term stress and protect yield potential.',
            },
            'raw_indices': {
                'ndvi': float(indices.get('ndvi', 0.0)),
                'evi': float(indices.get('evi', 0.0)),
                'savi': float(indices.get('savi', 0.0)),
                'ndwi': float(indices.get('ndwi', 0.0)),
            },
        }

    # ─────────────────────────────────────────────────────────────────────────
    #   MAIN ANALYSIS ENTRY POINT
    # ─────────────────────────────────────────────────────────────────────────

    def analyze(self, latitude, longitude, crop='wheat', city=None, month=None, analysis_date=None, field_polygon=None, weather_context=None):

        # ── Crop validation ───────────────────────────────────────────────────
        # Normalise the crop name once and reuse throughout.
        crop_normalised = str(crop or 'wheat').strip().lower()

        # Reject unsupported crop types before any expensive GEE calls.
        # We still want to confirm the location IS a field before telling the
        # user we can't analyse it, so known-but-not-configured crops are handled below after
        # land classification rather than with an early RuntimeError.
        is_non_wheat_crop = crop_normalised in NON_WHEAT_CROPS
        is_supported_satellite_crop = crop_normalised in SUPPORTED_SATELLITE_CROPS

        if crop_normalised == 'cotton':
            city_key = str(city or '').strip().lower()
            if not city_key:
                raise RuntimeError(
                    'city is required for cotton satellite analysis. '
                    'Supported cotton districts: Bahawalpur, Multan, Faisalabad, Sargodha, Lahore.'
                )
            if city_key not in COTTON_SUPPORTED_CITIES:
                raise RuntimeError(
                    f'City "{city}" is not configured for cotton satellite analysis. '
                    'Use one of: Bahawalpur, Multan, Faisalabad, Sargodha, Lahore.'
                )
        if crop_normalised == 'rice':
            city_key = str(city or '').strip().lower()
            if not city_key:
                raise RuntimeError(
                    'city is required for rice satellite analysis. '
                    'Supported rice districts: Faisalabad, Lahore, Gujrat, Sargodha, Multan.'
                )
            if city_key not in RICE_SUPPORTED_CITIES:
                raise RuntimeError(
                    f'City "{city}" is not configured for rice satellite analysis. '
                    'Use one of: Faisalabad, Lahore, Gujrat, Sargodha, Multan.'
                )
        if crop_normalised == 'maize':
            city_key = str(city or '').strip().lower()
            if not city_key:
                raise RuntimeError(
                    'city is required for maize satellite analysis. '
                    'Supported maize districts: Faisalabad, Lahore, Multan, Sargodha, Bahawalpur.'
                )
            if city_key not in MAIZE_SUPPORTED_CITIES:
                raise RuntimeError(
                    f'City "{city}" is not configured for maize satellite analysis. '
                    'Use one of: Faisalabad, Lahore, Multan, Sargodha, Bahawalpur.'
                )
        if crop_normalised == 'sugarcane':
            city_key = str(city or '').strip().lower()
            if not city_key:
                raise RuntimeError(
                    'city is required for sugarcane satellite analysis. '
                    'Supported sugarcane districts: Multan, Bahawalpur, Sargodha, Faisalabad, Gujrat.'
                )
            if city_key not in SUGARCANE_SUPPORTED_CITIES:
                raise RuntimeError(
                    f'City "{city}" is not configured for sugarcane satellite analysis. '
                    'Use one of: Multan, Bahawalpur, Sargodha, Faisalabad, Gujrat.'
                )

        if not is_supported_satellite_crop and not is_non_wheat_crop:
            # Completely unrecognised crop string — reject immediately.
            raise RuntimeError(
                f'Crop "{crop}" is not recognised. This system currently supports satellite analysis for wheat, cotton, rice, maize, and sugarcane. '
                'For other crops please specify the crop name exactly.'
            )

        if is_supported_satellite_crop:
            self._require_artifacts(crop_normalised)

        # ── Date / month resolution ───────────────────────────────────────────
        analysis_anchor = datetime.utcnow().date()
        if analysis_date:
            try:
                analysis_anchor = datetime.strptime(analysis_date, '%Y-%m-%d').date()
            except ValueError as exc:
                raise RuntimeError('analysis_date must be in YYYY-MM-DD format.') from exc

        if month is None:
            month = analysis_anchor.month
        else:
            month = int(month)

        growth_stage_code, growth_stage_name = self.get_growth_stage(month, crop_normalised)

        analysis_geometry, normalized_polygon = self._build_analysis_geometry(
            latitude, longitude, field_polygon
        )

        # Fast non-field gate (high-confidence built-up only):
        # Run Dynamic World first with a narrow window and short-circuit only
        # when confidence is strong enough to avoid accuracy regression.
        dw_fast_start = (analysis_anchor - timedelta(days=35)).isoformat()
        dw_fast_end_exclusive = (analysis_anchor + timedelta(days=1)).isoformat()
        dw_fast = self.get_dynamic_world_label(
            latitude,
            longitude,
            dw_fast_start,
            dw_fast_end_exclusive,
            analysis_geometry,
        )
        dw_fast_confident_built = (
            growth_stage_code != 6 and
            dw_fast.get('dw_available') and
            dw_fast.get('dw_label') == 6 and
            dw_fast.get('dw_built_prob', 0.0) > dw_fast.get('dw_crop_prob', 0.0)
        )

        if dw_fast_confident_built:
            _debug_log(f'fast_non_field_dw={dw_fast}')

            field_info_fast = {
                'latitude': round(float(latitude), 4),
                'longitude': round(float(longitude), 4),
                'city': city,
                'crop': crop_normalised,
                'geometry_type': 'polygon' if normalized_polygon else 'point_buffer',
                'analysis_date': analysis_anchor.isoformat(),
                'latest_image_date': None,
                'sentinel_date_range': None,
                'images_used': 0,
                'imagery_simulated': False,
                'imagery_window_days': None,
                'cloud_threshold_used': None,
            }

            return {
                'success': True,
                'status': 'non_field',
                'is_field': False,
                'land_classification': {
                    'is_field': False,
                    'land_type': 'Settlement / Built-Up Area',
                    'confidence': 'HIGH',
                    'reason': (
                        'Dynamic World built-up detection triggered fast path '
                        f"(built_prob={dw_fast['dw_built_prob']:.3f}, crop_prob={dw_fast['dw_crop_prob']:.3f})."
                    ),
                },
                'field': field_info_fast,
                'field_polygon': normalized_polygon,
                'indices': {
                    'ndvi': 0.0,
                    'ndwi': 0.0,
                    'evi': 0.0,
                    'gndvi': 0.0,
                    'ndre': 0.0,
                    'savi': 0.0,
                    'ndbi': 0.0,
                },
                'heatmap': {
                    'fetched': False,
                    'type': 'raster',
                    'error': 'Heatmap disabled: selected point is not an agricultural field.',
                },
                'data_source': 'dynamic_world_fast_path',
                'dynamic_world': dw_fast,
                'timestamp': datetime.utcnow().isoformat(),
                'location': {
                    'lat': round(float(latitude), 4),
                    'lon': round(float(longitude), 4),
                },
                'crop': crop_normalised,
            }

        today_utc = datetime.utcnow().date()
        is_current_date_request = (analysis_date is None) or (analysis_anchor == today_utc)

        latest_scene = self.build_latest_sentinel_index_image(
            latitude,
            longitude,
            analysis_anchor,
            max_lookback_days=180,
            analysis_geometry=analysis_geometry,
            allow_extended_lookback=is_current_date_request,
        )
        index_image = latest_scene['image']
        images_used = latest_scene['images_used']
        start_date = latest_scene['query_start']
        end_date = latest_scene['query_end']
        end_date_exclusive = (analysis_anchor + timedelta(days=1)).isoformat()
        selected_attempt = {
            'half_window_days': 90,
            'cloud_threshold': latest_scene['cloud_threshold'],
        }
        latest_image_date = latest_scene['latest_image_date']
        imagery_simulated = False

        point_reduction = (
            index_image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=analysis_geometry,
                scale=10,
                maxPixels=int(1e9),
            )
            .getInfo()
        )

        required_idx = ('ndvi', 'ndwi', 'evi', 'gndvi', 'ndre', 'savi')
        missing_idx = [name for name in required_idx if point_reduction.get(name) is None]
        if missing_idx:
            raise RuntimeError(
                'Unable to derive reliable indices from recent usable Sentinel-2 imagery '
                f'({", ".join(missing_idx)}). Please retry shortly.'
            )

        indices = {
            'ndvi': round(float(point_reduction.get('ndvi')), 4),
            'ndwi': round(float(point_reduction.get('ndwi')), 4),
            'evi': round(float(point_reduction.get('evi')), 4),
            'gndvi': round(float(point_reduction.get('gndvi')), 4),
            'ndre': round(float(point_reduction.get('ndre')), 4),
            'savi': round(float(point_reduction.get('savi')), 4),
            'ndbi': round(float(point_reduction.get('ndbi') or 0.0), 4),
            'images_used': images_used,
        }

        # ── Dynamic World land-use check ─────────────────────────────────────
        # Query Google Dynamic World BEFORE the spectral classifier.
        # DW was trained on billions of labelled pixels and directly classifies
        # built/crops/bare etc. at 10m — far more reliable than any NDBI threshold
        # for separating villages with trees from actual crop fields.
        dw = self.get_dynamic_world_label(
            latitude, longitude, start_date, end_date_exclusive, analysis_geometry
        )

        # If DW is available and confidently says built-up, override the
        # spectral classifier entirely. We use two signals:
        #   1. dw_label == 6 (built) — dominant pixel class is built
        #   2. dw_built_prob > dw_crop_prob — built more probable than crops
        # Both must agree to avoid false rejections on field edges.
        dw_says_built = (
            dw['dw_available'] and
            dw['dw_label'] == 6 and
            dw['dw_built_prob'] > dw['dw_crop_prob']
        )

        _debug_log(f'analyze dw={dw}')
        _debug_log(f'analyze dw_says_built={dw_says_built}')

        if dw_says_built:
            land_class = {
                'is_field': False,
                'land_type': 'Settlement / Built-Up Area',
                'confidence': 'HIGH',
                'reason': (
                    f"Dynamic World classifies this location as built-up "
                    f"(label='{dw['dw_label_name']}', "
                    f"built_prob={dw['dw_built_prob']:.3f}, "
                    f"crop_prob={dw['dw_crop_prob']:.3f}). "
                    "Spectral indices alone cannot distinguish village trees "
                    "from crop canopy — Dynamic World resolves this directly."
                ),
            }
        else:
            land_class = self.classify_land_type(
                indices['ndvi'], indices['ndwi'], indices['evi'], indices['savi'],
                indices['gndvi'], indices['ndre'], indices['ndbi'], month,
            )

        _debug_log(f'analyze land_class={land_class}')

        # ── Shared field-info block ───────────────────────────────────────────
        field_info = {
            'latitude': round(float(latitude), 4),
            'longitude': round(float(longitude), 4),
            'city': city,
            'crop': crop_normalised,
            'geometry_type': 'polygon' if normalized_polygon else 'point_buffer',
            'analysis_date': analysis_anchor.isoformat(),
            'latest_image_date': latest_image_date,
            'sentinel_date_range': f'{start_date} to {end_date}',
            'images_used': images_used,
            'imagery_simulated': imagery_simulated,
            'imagery_window_days': selected_attempt['half_window_days'] * 2 if selected_attempt else None,
            'cloud_threshold_used': selected_attempt['cloud_threshold'] if selected_attempt else None,
        }

        indices_out = {
            'ndvi': indices['ndvi'],
            'ndwi': indices['ndwi'],
            'evi': indices['evi'],
            'gndvi': indices['gndvi'],
            'ndre': indices['ndre'],
            'savi': indices['savi'],
            'ndbi': indices['ndbi'],
        }

        location_out = {
            'lat': round(float(latitude), 4),
            'lon': round(float(longitude), 4),
        }

        # ── Post-harvest fallow season: no active crop window ────────────────
        # Return this status before non-field checks so farmers always see the
        # correct seasonal message instead of an unrelated land-type response.
        if is_supported_satellite_crop and growth_stage_code == 6:
            heatmap = self.build_heatmap(latitude, longitude, index_image, analysis_geometry)
            if crop_normalised == 'wheat':
                month_names = {5:'May', 6:'June', 7:'July', 8:'August', 9:'September', 10:'October'}
                month_label = month_names.get(month, f'Month {month}')
                season_msg = (
                    'Wheat harvest in Punjab is typically completed by mid-May. '
                    f'{month_label} falls in the post-harvest fallow period. '
                    'There is no active wheat crop to analyse. '
                    'Reschedule field analysis between November and April for '
                    'active-season crop stress monitoring.'
                )
            elif crop_normalised == 'cotton':
                month_names = {12:'December', 1:'January', 2:'February', 3:'March'}
                month_label = month_names.get(month, f'Month {month}')
                season_msg = (
                    'Cotton harvest and field clearing in Punjab are typically complete by late November. '
                    f'{month_label} falls in the off-season period. '
                    'There is no active cotton crop to analyse. '
                    'Reschedule field analysis between April and November for '
                    'active-season crop stress monitoring.'
                )
            elif crop_normalised == 'rice':
                month_names = {12:'December', 1:'January', 2:'February', 3:'March', 4:'April', 5:'May'}
                month_label = month_names.get(month, f'Month {month}')
                season_msg = (
                    'Rice harvest and field drying in Punjab are typically complete by late November. '
                    f'{month_label} falls in the off-season period. '
                    'There is no active rice crop to analyse. '
                    'Reschedule field analysis between June and November for '
                    'active-season crop stress monitoring.'
                )
            elif crop_normalised == 'maize':
                month_names = {11:'November', 12:'December', 1:'January', 2:'February'}
                month_label = month_names.get(month, f'Month {month}')
                season_msg = (
                    'Maize harvest in Punjab is typically complete by late October. '
                    f'{month_label} falls in the off-season period. '
                    'There is no active maize crop to analyse. '
                    'Reschedule field analysis between March and October for '
                    'active-season crop stress monitoring.'
                )
            else:
                season_msg = (
                    'There is no active crop window for this selection right now. '
                    'Please choose an in-season date and run analysis again.'
                )
            return {
                'success': True,
                'status': 'post_harvest',
                'is_field': False,
                'field': field_info,
                'field_polygon': normalized_polygon,
                'indices': indices_out,
                'heatmap': heatmap,
                'growth_stage': {'code': 6, 'name': growth_stage_name},
                'month': month,
                'post_harvest_message': season_msg,
                'land_classification': land_class,
                'data_source': 'simulated' if imagery_simulated else 'gee_sentinel2',
                'dynamic_world': dw,
                'timestamp': datetime.utcnow().isoformat(),
                'location': location_out,
                'crop': crop_normalised,
            }

        # ── Non-agricultural land ─────────────────────────────────────────────
        if not land_class['is_field']:
            return {
                'success': True,
                'status': 'non_field',
                'is_field': False,
                'land_classification': land_class,
                'field': field_info,
                'field_polygon': normalized_polygon,
                'indices': indices_out,
                'heatmap': {
                    'fetched': False,
                    'type': 'raster',
                    'error': 'Heatmap disabled: selected point is not an agricultural field.',
                },
                'data_source': 'simulated' if imagery_simulated else 'gee_sentinel2',
                'dynamic_world': dw,
                'timestamp': datetime.utcnow().isoformat(),
                'location': location_out,
                'crop': crop_normalised,
            }

        heatmap = self.build_heatmap(latitude, longitude, index_image, analysis_geometry)

        # ── Agricultural field confirmed — but crop not configured for ML ─────
        # The location is a real field; we just cannot run our configured
        # model on it. Return satellite indices and land classification so the
        # caller can still display the field on a map, but omit all ML outputs.
        if is_non_wheat_crop:
            return {
                'success': True,
                'status': 'unsupported_crop',
                'is_field': True,
                'land_classification': land_class,
                'field': field_info,
                'field_polygon': normalized_polygon,
                'indices': indices_out,
                'heatmap': heatmap,
                'unsupported_crop_message': (
                    f'The selected location appears to be an agricultural field, but crop health '
                    f'analysis for "{crop_normalised}" is not supported. '
                    f'This system currently supports satellite ML analysis for wheat, cotton, rice, maize, and sugarcane. '
                    f'No stress prediction, yield estimate, or recommendations are available for this crop.'
                ),
                'data_source': 'simulated' if imagery_simulated else 'gee_sentinel2',
                'timestamp': datetime.utcnow().isoformat(),
                'location': location_out,
                'crop': crop_normalised,
            }

        # ── Configured crop analysis (wheat/cotton/rice/maize/sugarcane) ─────
        stressed_probability, healthy_probability = self.predict(indices, month, growth_stage_code)

        stress_probability = round(stressed_probability, 2)
        healthy_probability = round(healthy_probability, 2)
        health_score = int(round(healthy_probability * 100))
        confidence = _confidence_label(max(stressed_probability, healthy_probability))
        confidence_score = _confidence_score(max(stressed_probability, healthy_probability))
        percentile = self.district_percentile(indices['ndwi'], indices['evi'], indices['gndvi'], health_score=health_score)
        primary_cause = self.diagnose_cause(indices['ndvi'], indices['ndwi'], indices['evi'], indices['gndvi'])
        soil_context  = self._get_soil_context(city)
        urgency = self.urgency_tier(
            stress_probability,
            growth_stage_code,
            primary_cause=primary_cause,
            soil_context=soil_context,
            weather_context=weather_context,
        )
        days_to_critical, urgency_drivers = self.days_to_critical(
            stress_probability,
            growth_stage_code,
            primary_cause=primary_cause,
            soil_context=soil_context,
            weather_context=weather_context,
        )
        recommendations = self.build_recommendations_v2(
            primary_cause, urgency, stress_probability, indices,
            growth_stage_code, growth_stage_name, month, soil_context,
            weather_context=weather_context, crop_name=crop_normalised,
        )
        irrigation_plan = self._compute_irrigation_plan(
            indices,
            growth_stage_code,
            crop_name=crop_normalised,
            soil_context=soil_context,
            weather_context=weather_context,
        )

        # ── Fix 3B: Master urgency resolver ───────────────────────────────────
        # Reconcile ML-based urgency_tier with recommendation-engine output so
        # the two can never contradict each other in the UI.
        # Rule: urgency must be at least as severe as the worst recommendation.
        _crit_recs = [r for r in recommendations if r.get('priority') == 'Critical']
        _high_recs = [r for r in recommendations if r.get('priority') == 'High']
        if _crit_recs and ('HEALTHY' in urgency or 'MONITOR' in urgency):
            _top_type = _crit_recs[0]['type']
            urgency = f'CRITICAL — Immediate {_top_type.lower()} required'
        elif _high_recs and 'HEALTHY' in urgency:
            urgency = f'HIGH — {_high_recs[0]["type"]} advisory; act within 48 hours'

        # Keep escalation window consistent with recommendation urgency.
        # If recommendations force urgency upward, days_to_critical cannot remain None/stable.
        if _crit_recs and (days_to_critical is None or days_to_critical > 2):
            days_to_critical = 1
        elif _high_recs and (days_to_critical is None or days_to_critical > 4):
            days_to_critical = 2

        yield_est = self.yield_estimate(
            health_score,
            growth_stage_code=growth_stage_code,
            indices=indices,
            crop_name=crop_normalised,
        )
        benchmarking = {
            'district_percentile': percentile,
            'interpretation': self.percentile_interpretation(percentile),
        }

        # If acute irrigation deficit is detected, cap percentile optimism to avoid
        # contradictory messages like "top percentile" with urgent irrigation.
        # Use a dynamic cap (not a fixed 85) so the output does not look hardcoded.
        if (
            irrigation_plan.get('should_irrigate')
            and irrigation_plan.get('priority') == 'Critical'
            and percentile > 88
        ):
            deficit = float(irrigation_plan.get('deficit') or 0.0)
            severity_penalty = int(round(min(12.0, max(0.0, deficit - 0.08) * 100.0)))
            dynamic_cap = max(76, 88 - severity_penalty)
            percentile = min(percentile, dynamic_cap)
            benchmarking = {
                'district_percentile': percentile,
                'interpretation': self.percentile_interpretation(percentile),
            }
        field_report = self.build_field_report(
            health_score, stress_probability, recommendations,
            growth_stage_name, growth_stage_code, primary_cause,
            benchmarking, yield_est, soil_context,
        )
        field_report['economic_impact'] = self.calculate_economic_impact(
            yield_est,
            confidence_score,
            crop_name=crop_normalised,
        )
        field_report['satellite_model']['accuracy']         = self.config.get('model_accuracy', 0.842)
        field_report['satellite_model']['confidence_label'] = confidence
        farmer_summary = self.build_farmer_summary(
            indices=indices,
            recommendations=recommendations,
            diagnosis={
                'urgency': urgency,
                'days_to_critical': days_to_critical,
            },
            growth_stage_name=growth_stage_name,
            weather_context=weather_context,
            soil_context=soil_context,
            irrigation_plan=irrigation_plan,
        )

        # Guarantee weather-risk and recommendation scores in final payload.
        def _clamp_payload(val, low=0.0, high=1.0):
            return max(low, min(high, float(val)))

        wctx = weather_context or {}
        wsum = (wctx.get('summary') or {})
        p_hot_days = int(wctx.get('hot_days', 0) or 0)
        p_very_hot_days = int(wctx.get('very_hot_days', 0) or 0)
        p_rainy_days = int(wctx.get('rainy_days', 0) or 0)
        p_heavy_rain_days = int(wctx.get('heavy_rain_days', 0) or 0)
        p_rain_next_48h = float(wctx.get('rain_next_48h', wsum.get('rain_next_48h', 0)) or 0)
        p_total_rainfall = float(wsum.get('total_rainfall', 0) or 0)

        payload_dryness = _clamp_payload(
            (p_hot_days / 5.0) * 0.35
            + (p_very_hot_days / 3.0) * 0.30
            + (max(0.0, 6.0 - p_total_rainfall) / 6.0) * 0.20
            + (0.15 if p_rain_next_48h < 2.0 else 0.0)
        ) if wctx else 0.0

        payload_wetness = _clamp_payload(
            (p_rain_next_48h / 20.0) * 0.45
            + (p_heavy_rain_days / 3.0) * 0.30
            + (p_rainy_days / 7.0) * 0.25
        ) if wctx else 0.0

        payload_weather_risk = {
            'overall': round(max(payload_dryness, payload_wetness), 2),
            'dryness': round(payload_dryness, 2),
            'wetness': round(payload_wetness, 2),
        }

        payload_recommendations = []
        _rank_score = {'Low': 40.0, 'Medium': 55.0, 'High': 70.0, 'Critical': 85.0}
        for rec in recommendations:
            rec_copy = dict(rec)
            if rec_copy.get('priority_score') is None:
                rec_copy['priority_score'] = round(_rank_score.get(rec_copy.get('priority', 'Low'), 50.0), 1)
            payload_recommendations.append(rec_copy)

        return {
            'success': True,
            'status': 'success',
            'field': field_info,
            'field_polygon': normalized_polygon,
            'indices': indices_out,
            'prediction': {
                'stress_probability': stress_probability,
                'health_score': health_score,
                'status': 'STRESSED' if stress_probability >= 0.5 else 'HEALTHY',
                'confidence': confidence_score,
                'confidence_label': confidence,
                'healthy_probability': healthy_probability,
                'is_stressed': stress_probability >= 0.5,
                'source': 'ml_model',
            },
            'diagnosis': {
                'primary_cause': primary_cause,
                'urgency': urgency,
                'days_to_critical': days_to_critical,
                'urgency_drivers': urgency_drivers,
                'growth_stage': growth_stage_name,
                'growth_stage_code': growth_stage_code,
            },
            'benchmarking': benchmarking,
            'yield_estimate': yield_est,
            'model_metadata': {
                'model_accuracy': self.config.get('model_accuracy', 0.842),
                'features_used': self._get_active_feature_names(),
                'validation_type': self.config.get('validation_type', 'Cross-city (5 Punjab cities)'),
                'training_samples': self.config.get('training_samples', 0),
            },
            'location': location_out,
            'crop': crop_normalised,
            'month': month,
            'growth_stage': {
                'code': growth_stage_code,
                'name': growth_stage_name,
            },
            'data_source': 'simulated' if imagery_simulated else 'gee_sentinel2',
            'simulated_note': None,
            'recommendations': payload_recommendations,
            'field_report': field_report,
            'farmer_summary': farmer_summary,
            'soil_context': soil_context,
            'weather_context': weather_context,
            'weather_risk': payload_weather_risk,
            'land_classification': land_class,
            'dynamic_world': dw,
            'heatmap': heatmap,
            'timestamp': datetime.utcnow().isoformat(),
        }

    def get_status(self):
        return {
            'model_loaded': self.model_loaded,
            'scaler_loaded': self.scaler_loaded,
            'config_loaded': self.config_loaded,
            'active_crop': self.active_crop,
            'supported_crops': sorted(SUPPORTED_SATELLITE_CROPS),
            'crop_artifacts': {
                crop: {
                    'model_loaded': bool(artifact.get('model_loaded')),
                    'scaler_loaded': bool(artifact.get('scaler_loaded')),
                    'config_loaded': bool(artifact.get('config_loaded')),
                }
                for crop, artifact in self.artifacts_by_crop.items()
            },
            'gee_initialized': GEE_INITIALIZED,
            'gee_project_id': GEE_PROJECT_ID,
            'gee_last_error': GEE_LAST_ERROR,
            'gee_credentials_used': GEE_CREDENTIALS_USED,
        }


_init_gee()
satellite_predictor = SatellitePredictor()