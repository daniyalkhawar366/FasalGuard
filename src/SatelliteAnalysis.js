import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polygon, FeatureGroup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { EditControl } from 'react-leaflet-draw';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import './SatelliteAnalysis.css';
import { useLanguage } from './context/LanguageContext';
import CompactWeatherInfo from './components/CompactWeatherInfo';

// Fix Leaflet default icon broken by webpack asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const buildCityLabelIcon = (labelText, isUrdu) => L.divIcon({
  className: 'sat-city-label-icon',
  html: `<div class="sat-city-label ${isUrdu ? 'urdu' : 'english'}">${labelText}</div>`,
  iconSize: [120, 28],
  iconAnchor: [60, 14],
});

// ─── city data ────────────────────────────────────────────────────────────────
const CITIES = {
  'Faisalabad':     { lat: 31.418, lon: 73.079, zoom: 10, urName: 'فیصل آباد', desc: 'Central Punjab food belt', urDesc: 'وسطی پنجاب کا زرعی مرکز', bounds: [[31.05, 72.70], [31.80, 73.50]] },
  'Lahore':         { lat: 31.550, lon: 74.344, zoom: 10, urName: 'لاہور', desc: 'Eastern Punjab agricultural hub', urDesc: 'مشرقی پنجاب کا زرعی مرکز', bounds: [[31.20, 74.00], [31.85, 74.60]] },
  'Multan':         { lat: 30.157, lon: 71.524, zoom: 10, urName: 'ملتان', desc: 'South Punjab wheat zone', urDesc: 'جنوبی پنجاب کا گندم زون', bounds: [[29.80, 71.15], [30.55, 71.95]] },
  'Gujrat':         { lat: 32.574, lon: 74.078, zoom: 10, urName: 'گجرات', desc: 'Northeast Punjab mixed-cropping zone', urDesc: 'شمال مشرقی پنجاب کا مخلوط کاشت کا علاقہ', bounds: [[32.25, 73.75], [32.90, 74.45]] },
  'Bahawalpur':     { lat: 29.395, lon: 71.672, zoom: 10, urName: 'بہاولپور', desc: 'Cholistan agricultural belt', urDesc: 'چولستان زرعی بیلٹ', bounds: [[29.05, 71.25], [29.75, 72.10]] },
  'Sargodha':       { lat: 32.083, lon: 72.671, zoom: 10, urName: 'سرگودھا', desc: 'Northern Punjab wheat belt', urDesc: 'شمالی پنجاب گندم بیلٹ', bounds: [[31.75, 72.30], [32.45, 73.10]] },
};

// Returns true when a point falls inside at least one city's agricultural zone
const isInAnyCityBounds = (lat, lon, cityNames = Object.keys(CITIES)) =>
  cityNames.some((name) => {
    const city = CITIES[name];
    if (!city) return false;
    const [[s, w], [n, e]] = city.bounds;
    return lat >= s && lat <= n && lon >= w && lon <= e;
  });

const CROP_CITY_MAP = {
  Wheat: ['Faisalabad', 'Lahore', 'Multan', 'Bahawalpur', 'Sargodha'],
  Cotton: ['Faisalabad', 'Lahore', 'Multan', 'Bahawalpur', 'Sargodha'],
  Rice: ['Faisalabad', 'Lahore', 'Multan', 'Sargodha', 'Gujrat'],
  Maize: ['Faisalabad', 'Lahore', 'Multan', 'Bahawalpur', 'Sargodha'],
  Sugarcane: ['Faisalabad', 'Multan', 'Bahawalpur', 'Sargodha', 'Gujrat'],
};

const CROP_SEASON_MONTHS = {
  Wheat: [11, 12, 1, 2, 3, 4],
  Cotton: [4, 5, 6, 7, 8, 9, 10, 11],
  Rice: [6, 7, 8, 9, 10, 11],
  Maize: [3, 4, 5, 6, 7, 8, 9, 10],
  Sugarcane: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
};

const CROPS = [
  { name: 'Wheat', urName: 'گندم', icon: '', active: true  },
  { name: 'Cotton', urName: 'کپاس', icon: '', active: true },
  { name: 'Rice', urName: 'چاول', icon: '', active: true },
  { name: 'Maize', urName: 'مکئی', icon: '', active: true },
  { name: 'Sugarcane', urName: 'گنا', icon: '', active: true },
];

const MAP_MAX_ZOOM = 19;

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';
const VOICE_REPORT_LANGUAGES = [
  { id: 'en-US', label: 'English' },
  { id: 'ur-PK', label: 'اردو' },
];

const SAT_OUTCOME_SESSION_KEY = 'sat_outcome_session_id';
const SAT_LAST_RESULT_KEY = 'sat_last_result_state_v1';
const SAT_HISTORY_REPORT_KEY = 'sat_history_full_report_v1';
const SAT_COST_TRACKER_KEY = 'sat_cost_tracker_state_v1';
const SAT_COST_TRACKER_FALLBACK_KEY = 'sat_cost_tracker_state_v1:fallback';

const ensureOutcomeSessionId = () => {
  try {
    const existing = localStorage.getItem(SAT_OUTCOME_SESSION_KEY);
    if (existing) return existing;

    const generated = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `sat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SAT_OUTCOME_SESSION_KEY, generated);
    return generated;
  } catch {
    return `sat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const formatShortDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
};

const trendPillClass = (trend) => {
  const key = String(trend || '').toLowerCase();
  if (key === 'improving') return 'improving';
  if (key === 'worsening') return 'worsening';
  return 'mixed';
};

const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

const stripEmojiText = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(EMOJI_REGEX, '').replace(/\s{2,}/g, ' ').trim();
};

const stripEmojiDeep = (value) => {
  if (typeof value === 'string') return stripEmojiText(value);
  if (Array.isArray(value)) return value.map(stripEmojiDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmojiDeep(v)]));
  }
  return value;
};

const buildFriendlyAnalysisError = (rawMessage, tr) => {
  const clean = stripEmojiText(String(rawMessage || ''));
  const normalized = clean.toLowerCase();

  if (
    normalized.includes('too cloudy')
    || normalized.includes('masked')
    || normalized.includes('cloud-free sentinel-2 imagery')
    || normalized.includes('no usable recent sentinel-2 imagery')
  ) {
    return tr(
      'Latest satellite scenes are being checked. A usable image was not ready yet; please retry in a moment.',
      'تازہ سیٹلائٹ تصاویر چیک کی جا رہی ہیں۔ قابل استعمال تصویر ابھی دستیاب نہیں؛ براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔'
    );
  }

  if (normalized.includes('city is required') || normalized.includes('not configured for')) {
    return tr(
      'Please select a supported city for the selected crop and try again.',
      'براہ کرم منتخب فصل کے لیے سپورٹ شدہ شہر منتخب کریں اور دوبارہ کوشش کریں۔'
    );
  }

  if (normalized.includes('analysis_date')) {
    return tr(
      'Please select a valid analysis date and try again.',
      'براہ کرم درست تجزیاتی تاریخ منتخب کریں اور دوبارہ کوشش کریں۔'
    );
  }

  return tr(
    'Analysis could not be completed right now. Please try again shortly.',
    'اس وقت تجزیہ مکمل نہیں ہو سکا۔ براہ کرم تھوڑی دیر بعد دوبارہ کوشش کریں۔'
  );
};

const normalizeRiskLevel = (value) => {
  const key = String(value || '').toLowerCase();
  if (key.includes('high') || key.includes('critical')) return 'High';
  if (key.includes('moderate') || key.includes('medium')) return 'Moderate';
  if (key.includes('low')) return 'Low';
  return 'Low';
};

const extractTopTasks = (result) => {
  const recs = Array.isArray(result?.recommendations) ? result.recommendations : [];
  const tasks = recs
    .map((rec) => rec?.action || rec?.recommendation || rec?.type || '')
    .map((text) => String(text || '').trim())
    .filter(Boolean);

  if (tasks.length >= 3) return tasks.slice(0, 3);

  const fallback = [
    'Irrigate by tomorrow morning if soil is dry.',
    'Avoid heavy fertilizer before rain windows.',
    'Inspect weak patches and treat only hotspots.',
  ];
  return [...tasks, ...fallback].slice(0, 3);
};

const localizeRiskLabel = (risk, languageCode) => {
  const normalizedRisk = String(risk || 'Low');
  const isUrdu = String(languageCode || '').toLowerCase().startsWith('ur');
  const isHindi = String(languageCode || '').toLowerCase().startsWith('hi');
  const key = normalizedRisk.toLowerCase();
  if (isUrdu) {
    if (key.includes('high')) return 'زیادہ';
    if (key.includes('moderate')) return 'درمیانہ';
    return 'کم';
  }
  if (isHindi) {
    if (key.includes('high')) return 'उच्च';
    if (key.includes('moderate')) return 'मध्यम';
    return 'कम';
  }
  return normalizedRisk;
};

const localizeSimpleLine = (line, languageCode) => {
  const source = String(line || '').trim();
  if (!source) return '';
  const normalized = String(languageCode || '').toLowerCase();
  if (normalized.startsWith('ur')) {
    return source
      .replace(/irrigate/gi, 'آبپاشی کریں')
      .replace(/prioritize/gi, 'ترجیح دیں')
      .replace(/dry|driest/gi, 'خشک')
      .replace(/patches/gi, 'حصے')
      .replace(/apply/gi, 'استعمال کریں')
      .replace(/early morning/gi, 'صبح سویرے')
      .replace(/evening/gi, 'شام')
      .replace(/reduce evaporation losses/gi, 'بخاراتی نقصان کم کریں')
      .replace(/because soil is sandy/gi, 'کیونکہ مٹی ریتلی ہے')
      .replace(/split into two lighter irrigations if possible/gi, 'ممکن ہو تو دو ہلکی آبپاشیوں میں تقسیم کریں')
      .replace(/avoid heavy fertilizer before rain windows/gi, 'بارش سے پہلے زیادہ کھاد نہ دیں')
      .replace(/inspect weak patches and treat only hotspots/gi, 'کمزور حصے چیک کریں اور صرف متاثرہ جگہوں پر علاج کریں');
  }
  if (normalized.startsWith('hi')) {
    return source
      .replace(/irrigate/gi, 'सिंचाई करें')
      .replace(/prioritize/gi, 'प्राथमिकता दें')
      .replace(/dry|driest/gi, 'सूखे')
      .replace(/patches/gi, 'हिस्सों')
      .replace(/apply/gi, 'उपयोग करें')
      .replace(/early morning/gi, 'सुबह जल्दी')
      .replace(/evening/gi, 'शाम')
      .replace(/reduce evaporation losses/gi, 'वाष्पीकरण नुकसान कम करें')
      .replace(/because soil is sandy/gi, 'क्योंकि मिट्टी रेतीली है')
      .replace(/split into two lighter irrigations if possible/gi, 'संभव हो तो दो हल्की सिंचाइयों में बांटें')
      .replace(/avoid heavy fertilizer before rain windows/gi, 'बारिश से पहले भारी खाद न दें')
      .replace(/inspect weak patches and treat only hotspots/gi, 'कमजोर हिस्सों की जांच करें और सिर्फ प्रभावित हिस्सों का उपचार करें');
  }
  return source;
};

const localizeIrrigationWindow = (value, languageCode) => {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const normalized = String(languageCode || '').toLowerCase();
  if (normalized.startsWith('ur')) {
    return raw
      .replace(/within\s*24\s*-?\s*48\s*hours?/gi, '24 سے 48 گھنٹوں میں')
      .replace(/today/gi, 'آج')
      .replace(/tomorrow/gi, 'کل')
      .replace(/after\s*(\d+)\s*days?/gi, '$1 دن بعد');
  }
  if (normalized.startsWith('hi')) {
    return raw
      .replace(/within\s*24\s*-?\s*48\s*hours?/gi, '24 से 48 घंटों में')
      .replace(/today/gi, 'आज')
      .replace(/tomorrow/gi, 'कल')
      .replace(/after\s*(\d+)\s*days?/gi, '$1 दिन बाद');
  }
  return raw;
};

const buildFarmerVoiceReport = ({ analysisResult, languageCode = 'en-US' }) => {
  if (!analysisResult) return '';

  const isUrdu = String(languageCode || '').toLowerCase().startsWith('ur');
  const isHindi = String(languageCode || '').toLowerCase().startsWith('hi');
  const crop = String(analysisResult?.crop || 'crop');
  const city = analysisResult?.city || analysisResult?.soil_context?.district || 'your area';
  const field = analysisResult?.field_report || {};
  const risk = normalizeRiskLevel(field?.risk_level || analysisResult?.risk_level || 'Low');
  const localizedRisk = localizeRiskLabel(risk, languageCode);
  const expectedYield = Number(field?.estimated_yield?.maunds_per_acre);
  const potentialLoss = Number(field?.estimated_yield?.potential_loss_maunds);
  const irrigationWindowRaw = analysisResult?.farmer_summary?.irrigation?.timing_window || 'within 24-48 hours';
  const irrigationWindow = localizeIrrigationWindow(irrigationWindowRaw, languageCode);
  const actionLines = extractTopTasks(analysisResult)
    .slice(0, 3)
    .map((line) => localizeSimpleLine(line, languageCode));

  if (isUrdu) {
    return [
      'یہ آپ کی سیٹلائٹ رپورٹ کا آسان خلاصہ ہے۔',
      `فصل: ${crop}۔ جگہ: ${city}۔`,
      `فیلڈ رسک لیول: ${localizedRisk}۔`,
      Number.isFinite(expectedYield)
        ? `متوقع پیداوار تقریباً ${expectedYield.toFixed(1)} من فی ایکڑ ہے۔`
        : 'متوقع پیداوار کے اعداد ابھی محدود ہیں۔',
      Number.isFinite(potentialLoss) && potentialLoss > 0
        ? `اگر ایکشن نہ لیا جائے تو ممکنہ نقصان ${potentialLoss.toFixed(1)} من فی ایکڑ ہو سکتا ہے۔`
        : 'اس وقت فوری بڑے نقصان کا اشارہ نہیں، مگر باقاعدہ نگرانی ضروری ہے۔',
      `آبپاشی کا بہتر وقت: ${irrigationWindow}۔`,
      'آسان ایکشن پلان:',
      ...actionLines.map((line, index) => `${index + 1}. ${line}`),
      'مشورہ: پہلے فوری ایکشن کریں، پھر 2 سے 3 دن بعد دوبارہ فیلڈ چیک کریں۔',
    ].join('\n');
  }

  if (isHindi) {
    return [
      'यह आपकी सैटेलाइट रिपोर्ट का आसान सार है।',
      `फसल: ${crop}। स्थान: ${city}।`,
      `फील्ड जोखिम स्तर: ${localizedRisk}।`,
      Number.isFinite(expectedYield)
        ? `अनुमानित पैदावार लगभग ${expectedYield.toFixed(1)} maund प्रति acre है।`
        : 'अनुमानित पैदावार का डेटा अभी सीमित है।',
      Number.isFinite(potentialLoss) && potentialLoss > 0
        ? `अगर समय पर कार्य न किया जाए, तो संभावित नुकसान ${potentialLoss.toFixed(1)} maund प्रति acre हो सकता है।`
        : 'अभी बड़े नुकसान का संकेत कम है, फिर भी नियमित निगरानी जरूरी है।',
      `सिंचाई की बेहतर विंडो: ${irrigationWindow}।`,
      'सरल कार्य योजना:',
      ...actionLines.map((line, index) => `${index + 1}. ${line}`),
      'सलाह: पहले जरूरी काम करें, फिर 2-3 दिन बाद खेत को दोबारा जांचें।',
    ].join('\n');
  }

  return [
    'Here is your satellite report in simple words.',
    `Crop: ${crop}. Area: ${city}.`,
    `Field risk level: ${risk}.`,
    Number.isFinite(expectedYield)
      ? `Expected yield is about ${expectedYield.toFixed(1)} maunds per acre.`
      : 'Expected yield data is limited right now.',
    Number.isFinite(potentialLoss) && potentialLoss > 0
      ? `If no action is taken, possible loss can reach ${potentialLoss.toFixed(1)} maunds per acre.`
      : 'No major immediate loss signal, but regular monitoring is still important.',
    `Best irrigation window: ${irrigationWindow}.`,
    'Simple action plan:',
    ...actionLines.map((line, index) => `${index + 1}. ${line}`),
    'Advice: complete urgent actions first, then recheck the field in 2 to 3 days.',
  ].join('\n');
};

const toDateInputValue = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getAllowedAnalysisMonthSet = (cropName) => {
  const months = CROP_SEASON_MONTHS[cropName] || CROP_SEASON_MONTHS.Wheat;
  return new Set(months.map(Number));
};

const pad2 = (value) => String(value).padStart(2, '0');

const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

const normalizeSeasonalAnalysisDate = (rawDate, todayDateInput, cropName = 'Wheat') => {
  const today = new Date(`${todayDateInput}T00:00:00`);
  let candidate = new Date(`${rawDate || todayDateInput}T00:00:00`);
  const allowedMonths = getAllowedAnalysisMonthSet(cropName);

  if (Number.isNaN(candidate.getTime())) {
    candidate = today;
  }

  if (candidate > today) {
    candidate = today;
  }

  const month = candidate.getMonth() + 1;
  if (!allowedMonths.has(Number(month))) {
    // Snap to the nearest previous in-season date for the selected crop.
    candidate = today;
    let guard = 0;
    while (!allowedMonths.has(candidate.getMonth() + 1) && guard < 380) {
      candidate.setDate(candidate.getDate() - 1);
      guard += 1;
    }
  }

  return toDateInputValue(candidate);
};

const formatCoordinatePair = (lat, lon) => `${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)}`;

const parseCoordinatePair = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;

  // Supports both "lat, lon" and "lat lon" input formats.
  const parts = raw.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 2) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
};

const normalizeCoordHistory = (history) => {
  if (!Array.isArray(history)) return [];

  const seen = new Set();
  const deduped = [];
  for (const item of history) {
    const lat = Number(item?.lat);
    const lon = Number(item?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    deduped.push({ lat, lon, city: item?.city || '' });
    if (deduped.length >= 3) break;
  }

  return deduped;
};

const getPolygonCentroid = (positions) => {
  if (!positions || positions.length === 0) return null;
  const totals = positions.reduce((acc, [lat, lon]) => {
    acc.lat += lat;
    acc.lon += lon;
    return acc;
  }, { lat: 0, lon: 0 });
  return [totals.lat / positions.length, totals.lon / positions.length];
};

const normalizeLayerToPolygon = (layer) => {
  if (!layer || typeof layer.getLatLngs !== 'function') return [];
  const raw = layer.getLatLngs();
  const ring = Array.isArray(raw[0]) ? raw[0] : raw;
  return ring.map((pt) => [
    parseFloat(pt.lat.toFixed(6)),
    parseFloat(pt.lng.toFixed(6)),
  ]);
};

// ─── internal map sub-components ──────────────────────────────────────────────
function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, {
        animate: true,
        duration: 1.6,
        easeLinearity: 0.25,
      });
    }
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapZoomController({ onZoomEnd }) {
  useMapEvents({
    zoomend(e) {
      onZoomEnd(e.target.getZoom());
    },
  });
  return null;
}

function MapBoundsController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.setMaxBounds(bounds);
      map.options.maxBoundsViscosity = 1.0;
      map.fitBounds(bounds, {
        animate: false,
        padding: [12, 12],
      });
      const boundedMinZoom = Math.max(map.getBoundsZoom(bounds) - 1, 9);
      map.setMinZoom(boundedMinZoom);
      if (map.getZoom() < boundedMinZoom) {
        map.setZoom(boundedMinZoom);
      }
    } else {
      map.setMaxBounds(null);
      map.options.maxBoundsViscosity = 0;
      map.setMinZoom(4);
    }
  }, [bounds, map]);
  return null;
}

// ─── main component ────────────────────────────────────────────────────────────
const SatelliteAnalysis = () => {
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const tr = useCallback((en, ur) => (language === 'ur' ? ur : en), [language]);
  const outOfBoundsWarning = t('locationOutside', 'Location is outside supported districts');
  const mapLang = language === 'ur' ? 'ur' : 'en';

  const [selectedCrop, setSelectedCrop] = useState('Wheat');
  const [selectedCity, setSelectedCity] = useState('Faisalabad');
  const activeCityNames = CROP_CITY_MAP[selectedCrop] || CROP_CITY_MAP.Wheat;
  const activeCityEntries = activeCityNames
    .map((name) => [name, CITIES[name]])
    .filter(([, data]) => Boolean(data));
  const [markerPos,    setMarkerPos]    = useState(null);
  const [coordInput,   setCoordInput]   = useState('');
  const [mapCenter,    setMapCenter]    = useState([CITIES['Faisalabad'].lat, CITIES['Faisalabad'].lon]);
  const [mapZoom,      setMapZoom]      = useState(CITIES['Faisalabad'].zoom);
  const [mapBounds,    setMapBounds]    = useState(CITIES['Faisalabad'].bounds);
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState('');
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [coordWarning, setCoordWarning] = useState('');
  const [mapMode,      setMapMode]      = useState('overview');
  const [analysisDate, setAnalysisDate] = useState(() => toDateInputValue(new Date()));
  const [fieldPolygon, setFieldPolygon] = useState([]);
  const [drawAttentionPulse, setDrawAttentionPulse] = useState(false);
  const [coordHistory, setCoordHistory] = useState(() => {
    try {
      return normalizeCoordHistory(JSON.parse(localStorage.getItem('sat_coord_history') || '[]'));
    } catch {
      return [];
    }
  });
  const fieldLayerRef = useRef(null);
  const loadingSavedLocationRef = useRef(false);
  const originalLoadedLocationRef = useRef(null);
  const drawAttentionTimerRef = useRef(null);
  const analysisInFlightRef = useRef(false);
  const voiceReportPlayerRef = useRef(null);
  const [outcomeSessionId] = useState(() => ensureOutcomeSessionId());
  const [outcomeHistory, setOutcomeHistory] = useState([]);
  const [outcomeTrend, setOutcomeTrend] = useState(null);
  const [outcomeLoading, setOutcomeLoading] = useState(false);
  const [outcomeError, setOutcomeError] = useState('');
  const [currentFieldSignature, setCurrentFieldSignature] = useState('');
  const [selectedHistoryFieldSignature, setSelectedHistoryFieldSignature] = useState('');
  const [selectedHistoryLocationId, setSelectedHistoryLocationId] = useState('');
  const [farmerHistoryFields, setFarmerHistoryFields] = useState([]);
  const [farmerHistoryLoading, setFarmerHistoryLoading] = useState(false);
  const [farmerHistoryError, setFarmerHistoryError] = useState('');
  const [markingOutcomeId, setMarkingOutcomeId] = useState('');
  const [actionNoteDraft, setActionNoteDraft] = useState('');
  const [showOutcomeDetails, setShowOutcomeDetails] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showManualCoordinates, setShowManualCoordinates] = useState(false);
  const showOutcomeHistoryActionPanel = false;
  // New state for economic.tracking
  const [inputCosts, setInputCosts] = useState([]);
  const [miniWeather, setMiniWeather] = useState({ forecast: [], city: '', source: '' });
  const [miniWeatherLoading, setMiniWeatherLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const lastMiniWeatherKeyRef = useRef('');
  const lastMiniWeatherAtRef = useRef(0);
  const miniWeatherInFlightRef = useRef(false);
  const lastAlertKeyRef = useRef('');

  // Farm location management states
  const [savedLocations, setSavedLocations] = useState([]);
  const [selectedLocationId, setSelectedLocationId] = useState(() => {
    try {
      return localStorage.getItem('SAT_SELECTED_LOCATION_ID') || null;
    } catch {
      return null;
    }
  });

  // Persist selectedLocationId to localStorage whenever it changes
  useEffect(() => {
    try {
      if (selectedLocationId) {
        localStorage.setItem('SAT_SELECTED_LOCATION_ID', selectedLocationId);
      } else {
        localStorage.removeItem('SAT_SELECTED_LOCATION_ID');
      }
    } catch {
      // ignore storage errors
    }
  }, [selectedLocationId]);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const today = toDateInputValue(new Date());
    const normalized = normalizeSeasonalAnalysisDate(analysisDate, today, selectedCrop);
    if (normalized !== analysisDate) {
      setAnalysisDate(normalized);
    }
  }, [analysisDate, selectedCrop]);

  useEffect(() => {
    if (activeCityNames.includes(selectedCity)) return;
    const fallbackCityName = activeCityNames[0];
    if (!fallbackCityName) {
      setSelectedCity('');
      return;
    }

    const fallbackCity = CITIES[fallbackCityName];
    setSelectedCity(fallbackCityName);
    if (fallbackCity) {
      setMapCenter([fallbackCity.lat, fallbackCity.lon]);
      setMapZoom(fallbackCity.zoom);
      setMapBounds(fallbackCity.bounds);
      setMapMode('overview');
    }
  }, [activeCityNames, selectedCity]);

  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState('');
  const [showLocationPanel, setShowLocationPanel] = useState(true);
  const [showSaveLocationPrompt, setShowSaveLocationPrompt] = useState(false);
  const [analysisDateWarning, setAnalysisDateWarning] = useState('');
  const [saveLocationName, setSaveLocationName] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [deleteConfirmLocationId, setDeleteConfirmLocationId] = useState(null);
  const [deleteConfirmLocationName, setDeleteConfirmLocationName] = useState('');
  const [pendingUpdateLocationId, setPendingUpdateLocationId] = useState(null);
  const [pendingUpdateData, setPendingUpdateData] = useState(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [historyReportMode, setHistoryReportMode] = useState(false);
  const [historyOverviewOnly, setHistoryOverviewOnly] = useState(false);
  const [reportSavedNotice, setReportSavedNotice] = useState('');
  const [showVoiceReportPanel, setShowVoiceReportPanel] = useState(false);
  const [voiceReportLanguage, setVoiceReportLanguage] = useState(() => {
    if (language === 'ur') return 'ur-PK';
    return 'en-US';
  });
  const [voiceReportPlaying, setVoiceReportPlaying] = useState(false);
  const [voiceReportLoading, setVoiceReportLoading] = useState(false);
  const [translatedVoiceReportText, setTranslatedVoiceReportText] = useState('');
  const [voiceReportTranslating, setVoiceReportTranslating] = useState(false);
  const translationCacheRef = useRef(new Map());
  const lastCostPersistSignatureRef = useRef('');
  const costTrackerStorageKey = `${SAT_COST_TRACKER_KEY}:${selectedLocationId || 'session'}:${outcomeSessionId}`;
  const cropScopedSavedLocations = useMemo(() => {
    const selectedCropKey = String(selectedCrop || '').toLowerCase();
    return (savedLocations || []).filter((loc) => String(loc?.crop || '').toLowerCase() === selectedCropKey);
  }, [savedLocations, selectedCrop]);

  const heatmapAlertLevel = normalizeRiskLevel(result?.field_report?.risk_level || result?.risk_level);
  const showHeatmapAlert = ['High', 'Moderate'].includes(heatmapAlertLevel);
  const heatmapAlertText = heatmapAlertLevel === 'High'
    ? tr('High Alert', 'شدید الرٹ')
    : tr('Moderate Alert', 'درمیانی الرٹ');
  const hasActionableAnalysisReport = Boolean(
    result
    && result.is_field !== false
    && (
      result.field_report
      || result.diagnosis
      || result.stage_checklist
      || (Array.isArray(result.recommendations) && result.recommendations.length > 0)
      || (result.heatmap && result.heatmap.fetched)
    )
  );

  const voiceReportText = useMemo(() => buildFarmerVoiceReport({
    analysisResult: result,
    languageCode: voiceReportLanguage,
  }), [result, voiceReportLanguage]);
  const effectiveVoiceReportText = translatedVoiceReportText || voiceReportText;
  const voiceReportLines = useMemo(
    () => String(effectiveVoiceReportText || '').split('\n').map((line) => line.trim()).filter(Boolean),
    [effectiveVoiceReportText],
  );
  const voiceReportDir = String(voiceReportLanguage || '').toLowerCase().startsWith('ur') ? 'rtl' : 'ltr';
  const vtr = useCallback((en, ur, hi) => {
    const normalized = String(voiceReportLanguage || '').toLowerCase();
    if (normalized.startsWith('ur')) return ur;
    if (normalized.startsWith('hi')) return hi;
    return en;
  }, [voiceReportLanguage]);

  useEffect(() => {
    let cancelled = false;

    const translateReport = async () => {
      const lang = String(voiceReportLanguage || '').toLowerCase();
      if (!showVoiceReportPanel || !voiceReportText) {
        setTranslatedVoiceReportText('');
        setVoiceReportTranslating(false);
        return;
      }

      if (lang.startsWith('en')) {
        setTranslatedVoiceReportText('');
        setVoiceReportTranslating(false);
        return;
      }

      const cacheKey = `${lang}:${voiceReportText}`;
      const cached = translationCacheRef.current.get(cacheKey);
      if (cached) {
        setTranslatedVoiceReportText(cached);
        setVoiceReportTranslating(false);
        return;
      }

      setVoiceReportTranslating(true);
      try {
        const response = await fetch(`${API_BASE}/api/voice/translate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: voiceReportText,
            targetLanguage: voiceReportLanguage,
            sourceLanguage: 'en-US',
          }),
        });

        if (!response.ok) {
          throw new Error('Translation failed');
        }

        const payload = await response.json();
        const translated = String(payload?.text || '').trim();
        if (cancelled) return;
        if (translated) {
          translationCacheRef.current.set(cacheKey, translated);
          setTranslatedVoiceReportText(translated);
        } else {
          setTranslatedVoiceReportText('');
        }
      } catch {
        if (!cancelled) {
          setTranslatedVoiceReportText('');
        }
      } finally {
        if (!cancelled) {
          setVoiceReportTranslating(false);
        }
      }
    };

    translateReport();
    return () => {
      cancelled = true;
    };
  }, [showVoiceReportPanel, voiceReportLanguage, voiceReportText]);

  const stopVoiceReportAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (voiceReportPlayerRef.current) {
      voiceReportPlayerRef.current.pause();
      if (voiceReportPlayerRef.current.src) {
        URL.revokeObjectURL(voiceReportPlayerRef.current.src);
      }
      voiceReportPlayerRef.current = null;
    }
    setVoiceReportPlaying(false);
  }, []);

  const playVoiceReportAudio = useCallback(async () => {
    if (!effectiveVoiceReportText) return;
    stopVoiceReportAudio();
    setVoiceReportLoading(true);

    const playBrowserFallback = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const utterance = new SpeechSynthesisUtterance(effectiveVoiceReportText);
      utterance.lang = voiceReportLanguage;
      utterance.rate = 1;
      utterance.onstart = () => setVoiceReportPlaying(true);
      utterance.onend = () => setVoiceReportPlaying(false);
      utterance.onerror = () => setVoiceReportPlaying(false);
      window.speechSynthesis.speak(utterance);
    };

    try {
      const response = await fetch(`${API_BASE}/api/voice/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: effectiveVoiceReportText,
          language: voiceReportLanguage,
        }),
      });

      if (!response.ok) {
        throw new Error('Voice synthesis failed');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      voiceReportPlayerRef.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (voiceReportPlayerRef.current === audio) {
          voiceReportPlayerRef.current = null;
        }
        setVoiceReportPlaying(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        if (voiceReportPlayerRef.current === audio) {
          voiceReportPlayerRef.current = null;
        }
        setVoiceReportPlaying(false);
        playBrowserFallback();
      };

      await audio.play();
      setVoiceReportPlaying(true);
    } catch {
      playBrowserFallback();
    } finally {
      setVoiceReportLoading(false);
    }
  }, [effectiveVoiceReportText, stopVoiceReportAudio, voiceReportLanguage]);

  useEffect(() => () => stopVoiceReportAudio(), [stopVoiceReportAudio]);

  const resolvedCoords = useMemo(() => {
    if (Array.isArray(markerPos) && markerPos.length === 2) {
      return { lat: markerPos[0], lon: markerPos[1] };
    }

    if (Array.isArray(fieldPolygon) && fieldPolygon.length >= 3) {
      const centroid = getPolygonCentroid(fieldPolygon);
      if (centroid) return { lat: centroid[0], lon: centroid[1] };
    }

    const parsed = parseCoordinatePair(coordInput);
    if (parsed) return { lat: parsed.lat, lon: parsed.lon };

    return null;
  }, [markerPos, fieldPolygon, coordInput]);

  useEffect(() => {
    let isActive = true;

    const fetchMiniWeather = async () => {
      if (!selectedCity && !resolvedCoords) return;
      const keyBase = selectedCity
        ? `city:${selectedCity}`
        : (resolvedCoords ? `coords:${resolvedCoords.lat.toFixed(4)},${resolvedCoords.lon.toFixed(4)}` : '');
      const now = Date.now();
      if (keyBase && keyBase === lastMiniWeatherKeyRef.current && (now - lastMiniWeatherAtRef.current) < 60000) {
        return;
      }
      if (miniWeatherInFlightRef.current) return;
      miniWeatherInFlightRef.current = true;

      setMiniWeatherLoading(true);

      try {
        let response = null;

        if (selectedCity) {
          response = await axios.get(`${API_BASE}/api/weather`, {
            params: { city: selectedCity, days: 1 },
          });
        }

        if (!response && resolvedCoords) {
          response = await axios.get(`${API_BASE}/api/weather`, {
            params: { lat: resolvedCoords.lat, lon: resolvedCoords.lon, days: 1 },
          });
        }

        if (!response?.data?.forecast) {
          throw new Error('Weather data unavailable');
        }

        if (!isActive) return;
        setMiniWeather({
          forecast: Array.isArray(response.data.forecast) ? response.data.forecast : [],
          city: response.data.city || selectedCity || '',
          source: 'backend',
        });
        lastMiniWeatherKeyRef.current = keyBase;
        lastMiniWeatherAtRef.current = Date.now();
      } catch (err) {
        try {
          if (!selectedCity) throw err;
          const fallback = await axios.get('http://localhost:5001/api/weather', {
            params: { city: selectedCity, days: 1 },
          });

          if (!isActive) return;
          setMiniWeather({
            forecast: Array.isArray(fallback.data?.forecast) ? fallback.data.forecast : [],
            city: fallback.data?.city || selectedCity || '',
            source: 'ml-service',
          });
          lastMiniWeatherKeyRef.current = keyBase;
          lastMiniWeatherAtRef.current = Date.now();
        } catch (fallbackErr) {
          if (!isActive) return;
          setMiniWeather({ forecast: [], city: selectedCity || '', source: '' });
        }
      } finally {
        miniWeatherInFlightRef.current = false;
        if (isActive) setMiniWeatherLoading(false);
      }
    };

    fetchMiniWeather();
    return () => {
      isActive = false;
    };
  }, [selectedCity, resolvedCoords?.lat, resolvedCoords?.lon, tr]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const isHistoryReportRequest = params.get('history_report') === '1';
    if (!isHistoryReportRequest) return;

    try {
      const raw = sessionStorage.getItem(SAT_HISTORY_REPORT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(SAT_HISTORY_REPORT_KEY);
      const parsed = JSON.parse(raw);
      if (parsed?.result) {
        const baseResult = parsed.result;
        const sanitizedResult = {
          ...baseResult,
          heatmap: null,
          field: baseResult?.field
            ? {
                ...baseResult.field,
                latitude: null,
                longitude: null,
              }
            : null,
        };
        const resultWithCosts = {
          ...sanitizedResult,
          cost_tracker: Array.isArray(baseResult?.cost_tracker) ? baseResult.cost_tracker : undefined,
        };
        setResult(resultWithCosts);
        setInputCosts(Array.isArray(baseResult?.cost_tracker) ? baseResult.cost_tracker : []);
        if (parsed?.saved_location_id) {
          setSelectedHistoryLocationId(String(parsed.saved_location_id));
        }
        if (parsed?.field_signature) {
          const nextSignature = String(parsed.field_signature);
          setCurrentFieldSignature(nextSignature);
          setSelectedHistoryFieldSignature(nextSignature);
        }
        setActiveResultTab('overview');
        setHistoryReportMode(true);
        setHistoryOverviewOnly(parsed?.viewMode === 'overview-only');
        setShowLocationPanel(false);
        setShowManualCoordinates(false);
        setError('');
        setTimeout(() => {
          document.getElementById('sat-results-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }, 120);
      }
    } catch {
      // ignore history report hydration errors
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const isHistoryReportRequest = params.get('history_report') === '1';
    if (isHistoryReportRequest) return;

    try {
      const raw = sessionStorage.getItem(SAT_LAST_RESULT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.result) {
        setResult(parsed.result);
        setInputCosts(Array.isArray(parsed.result?.cost_tracker) ? parsed.result.cost_tracker : []);
      }
      if (parsed?.activeResultTab) {
        setActiveResultTab(parsed.activeResultTab);
      }
    } catch {
      // ignore restore issues
    }
  }, [location.search]);

  useEffect(() => {
    if (!reportSavedNotice) return undefined;
    const timer = setTimeout(() => setReportSavedNotice(''), 2300);
    return () => clearTimeout(timer);
  }, [reportSavedNotice]);

  useEffect(() => {
    try {
      if (!result) return;
      const resultWithCosts = {
        ...result,
        cost_tracker: Array.isArray(inputCosts) && inputCosts.length > 0 ? inputCosts : undefined,
      };
      sessionStorage.setItem(SAT_LAST_RESULT_KEY, JSON.stringify({
        result: resultWithCosts,
        activeResultTab,
        savedAt: Date.now(),
      }));
    } catch {
      // ignore persistence issues
    }
  }, [result, activeResultTab, inputCosts]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(costTrackerStorageKey);
      const fallbackRaw = sessionStorage.getItem(SAT_COST_TRACKER_FALLBACK_KEY);
      const source = raw || fallbackRaw;
      if (!source) {
        const persistedFromResult = Array.isArray(result?.cost_tracker) ? result.cost_tracker : [];
        setInputCosts(persistedFromResult);
        return;
      }
      const parsed = JSON.parse(source);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setInputCosts(parsed);
      } else {
        const persistedFromResult = Array.isArray(result?.cost_tracker) ? result.cost_tracker : [];
        setInputCosts(persistedFromResult);
      }
    } catch {
      const persistedFromResult = Array.isArray(result?.cost_tracker) ? result.cost_tracker : [];
      setInputCosts(persistedFromResult);
    }
  }, [costTrackerStorageKey, result]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(inputCosts || []);
      sessionStorage.setItem(costTrackerStorageKey, serialized);
      sessionStorage.setItem(SAT_COST_TRACKER_FALLBACK_KEY, serialized);
    } catch {
      // ignore storage failures
    }
  }, [costTrackerStorageKey, inputCosts]);

  // Load saved locations on mount
  useEffect(() => {
    const loadSavedLocations = async () => {
      try {
        setLocationsLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          setLocationsLoading(false);
          setSavedLocations([]); // Empty list if not logged in
          return;
        }

        const response = await axios.get(`${API_BASE}/api/satellite/locations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.data.success) {
          setSavedLocations(response.data.locations || []);
        }
      } catch (error) {
        console.error('Error loading saved locations:', error);
        setLocationsError(tr('Failed to load saved locations', 'محفوظ مقامات لوڈ کرنے میں ناکامی'));
        setSavedLocations([]); // Show empty state on error
      } finally {
        setLocationsLoading(false);
      }
    };

    loadSavedLocations();
  }, [tr]);

  // Keep selected location aligned to active crop view.
  useEffect(() => {
    if (!selectedLocationId) return;
    const selectedLoc = savedLocations.find((loc) => String(loc.id) === String(selectedLocationId));
    if (!selectedLoc) return;

    const selectedCropKey = String(selectedCrop || '').toLowerCase();
    const locationCropKey = String(selectedLoc.crop || '').toLowerCase();
    if (!locationCropKey || locationCropKey === selectedCropKey) return;

    setSelectedLocationId(null);
    originalLoadedLocationRef.current = null;
    setPendingUpdateData(null);
    setPendingUpdateLocationId(null);
  }, [savedLocations, selectedCrop, selectedLocationId]);

  const loadLocationToMap = async (locationId) => {
    try {
      setLocationsLoading(true);
      loadingSavedLocationRef.current = true;
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_BASE}/api/satellite/location/${locationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        const loc = response.data.location;
        
        // Set crop first
        if (loc.crop) {
          const cropObj = CROPS.find(c => c.name.toLowerCase() === loc.crop.toLowerCase());
          if (cropObj) setSelectedCrop(cropObj.name);
        }
        setSelectedLocationId(locationId);
        
        // Set city and sync map bounds
        if (loc.city) {
          setSelectedCity(loc.city);
          const cityData = CITIES[loc.city];
          if (cityData) {
            setMapCenter([cityData.lat, cityData.lon]);
            setMapZoom(cityData.zoom);
            setMapBounds(cityData.bounds);
          }
        }
        
        // Set coordinates and center map on the location
        setMarkerPos([loc.latitude, loc.longitude]);
        setCoordInput(formatCoordinatePair(loc.latitude, loc.longitude));
        setMapCenter([loc.latitude, loc.longitude]);
        setMapZoom(17);
        // store original loaded location for edit-diff comparisons
        const origPolygon = Array.isArray(loc.polygon) ? loc.polygon.map(p => [p.lat, p.lon]) : [];
        originalLoadedLocationRef.current = {
          id: locationId,
          polygon: origPolygon,
          latitude: loc.latitude,
          longitude: loc.longitude,
          city: loc.city || '',
          crop: loc.crop || '',
        };
        console.debug('[Satellite] loaded saved location', locationId, { latitude: loc.latitude, longitude: loc.longitude, polygonLength: origPolygon.length });
        
        // Draw the polygon on the map
        if (loc.polygon && loc.polygon.length >= 3) {
          const polygonArray = loc.polygon.map(p => [p.lat, p.lon]);
          setFieldPolygon(polygonArray);
          
          // Manually add the polygon to the Leaflet map
          setTimeout(() => {
            if (fieldLayerRef.current) {
              // Clear existing shapes
              fieldLayerRef.current.clearLayers();
              
              // Create and add the polygon (match manual-draw blue style)
              const polygon = L.polygon(polygonArray, {
                color: '#3388ff',
                weight: 2,
                opacity: 0.9,
                fillColor: '#3388ff',
                fillOpacity: 0.12
              });
              
              fieldLayerRef.current.addLayer(polygon);
            }
          }, 100);
        }

        // Clear errors
        setError('');
        
        // Scroll map into view so user sees the location loaded
        setTimeout(() => {
          const mapEl = document.querySelector('.sat-map-wrapper');
          if (mapEl) {
            mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    } catch (error) {
      console.error('Error loading location:', error);
      setLocationsError(tr('Failed to load location', 'مقام لوڈ کرنے میں ناکامی'));
    } finally {
      setLocationsLoading(false);
      // keep a short grace window to avoid immediately treating the loaded polygon as an "edit"
      window.setTimeout(() => {
        loadingSavedLocationRef.current = false;
      }, 600);
    }
  };

  const getPendingSavedLocationUpdate = useCallback(() => {
    if (!selectedLocationId) return null;
    const orig = originalLoadedLocationRef.current;
    if (!orig || orig.id !== selectedLocationId) return null;

    const normalizePoly = (poly) => (
      Array.isArray(poly)
        ? poly.map(([lat, lon]) => [Number(lat).toFixed(6), Number(lon).toFixed(6)])
        : []
    );
    const normCurrent = normalizePoly(fieldPolygon || []);
    const normOriginal = normalizePoly(orig.polygon || []);
    const polyChanged = JSON.stringify(normCurrent) !== JSON.stringify(normOriginal);

    const typedPair = parseCoordinatePair(coordInput);
    const markerPair = Array.isArray(markerPos) && markerPos.length === 2
      ? { lat: markerPos[0], lon: markerPos[1] }
      : null;
    const coordSource = markerPair || typedPair;

    const coordChanged = !!coordSource && (
      Number(coordSource.lat).toFixed(6) !== Number(orig.latitude).toFixed(6)
      || Number(coordSource.lon).toFixed(6) !== Number(orig.longitude).toFixed(6)
    );

    const cityChanged = String(selectedCity || '') !== String(orig.city || '');
    const cropChanged = String((selectedCrop || '').toLowerCase()) !== String((orig.crop || '').toLowerCase());

    if (!(polyChanged || coordChanged || cityChanged || cropChanged)) return null;

    const payload = {
      polygon: (Array.isArray(fieldPolygon) && fieldPolygon.length >= 3) ? fieldPolygon : null,
      latitude: coordSource ? coordSource.lat : (fieldPolygon[0] ? fieldPolygon[0][0] : null),
      longitude: coordSource ? coordSource.lon : (fieldPolygon[0] ? fieldPolygon[0][1] : null),
      city: selectedCity || '',
      crop: (selectedCrop || '').toLowerCase(),
    };

    console.debug('[Satellite] pending update detected', selectedLocationId, {
      polyChanged,
      coordChanged,
      cityChanged,
      cropChanged,
      payload,
    });

    return payload;
  }, [selectedLocationId, fieldPolygon, markerPos, coordInput, selectedCity, selectedCrop]);

  // Detect edits to a loaded/saved location and mark pendingUpdateData (don't show modal yet)
  useEffect(() => {
    if (!selectedLocationId) return;
    if (loadingSavedLocationRef.current) return;
    const pending = getPendingSavedLocationUpdate();
    setPendingUpdateData(pending);
  }, [selectedLocationId, fieldPolygon, markerPos, coordInput, selectedCity, selectedCrop, getPendingSavedLocationUpdate]);

  const confirmUpdateSavedLocation = async () => {
    const locationId = pendingUpdateLocationId;
    if (!locationId) return;
    try {
      setUpdatingLocation(true);
      setLocationsError('');
      const token = localStorage.getItem('token');
      const existing = savedLocations.find(s => s.id === locationId) || {};
      const payload = {
        name: existing.name || '',
        latitude: pendingUpdateData?.latitude || existing.latitude,
        longitude: pendingUpdateData?.longitude || existing.longitude,
        polygon: pendingUpdateData?.polygon ? pendingUpdateData.polygon.map(([lat, lon]) => ({ lat, lon })) : existing.polygon,
        city: pendingUpdateData?.city || existing.city || selectedCity || '',
        crop: (pendingUpdateData?.crop || existing.crop || selectedCrop || '').toLowerCase(),
      };

      const resp = await axios.put(`${API_BASE}/api/satellite/location/${locationId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (resp.data?.success && resp.data.location) {
        const updated = resp.data.location;
        setSavedLocations(prev => prev.map(s => (s.id === updated.id ? updated : s)));
        setPendingUpdateLocationId(null);
        setPendingUpdateData(null);
        setSelectedLocationId(updated.id);
        // update the original reference so further checks consider this the baseline
        originalLoadedLocationRef.current = {
          id: updated.id,
          polygon: Array.isArray(updated.polygon) ? updated.polygon.map(p => [p.lat, p.lon]) : [],
          latitude: updated.latitude,
          longitude: updated.longitude,
          city: updated.city || '',
          crop: updated.crop || '',
        };
        // proceed with analysis now that the saved location has been updated
        await handleAnalyze(true);
      } else {
        setLocationsError(tr('Could not update saved location', 'محفوظ مقام اپ ڈیٹ نہیں ہو سکا'));
      }
    } catch (err) {
      setLocationsError(err.response?.data?.error || tr('Server error', 'سرور خرابی'));
    } finally {
      setUpdatingLocation(false);
    }
  };

  const restoreLoadedLocationBaseline = useCallback(() => {
    const orig = originalLoadedLocationRef.current;
    if (!orig) return;

    const basePolygon = Array.isArray(orig.polygon) ? orig.polygon : [];
    setFieldPolygon(basePolygon);
    setMarkerPos([orig.latitude, orig.longitude]);
    setCoordInput(formatCoordinatePair(orig.latitude, orig.longitude));
    if (orig.city) {
      setSelectedCity(orig.city);
      const cityData = CITIES[orig.city];
      if (cityData) {
        setMapBounds(cityData.bounds);
      }
    }
    if (orig.crop) {
      const cropObj = CROPS.find(c => c.name.toLowerCase() === String(orig.crop).toLowerCase());
      if (cropObj) setSelectedCrop(cropObj.name);
    }

    if (fieldLayerRef.current && typeof fieldLayerRef.current.clearLayers === 'function') {
      fieldLayerRef.current.clearLayers();
      if (basePolygon.length >= 3) {
        const polygon = L.polygon(basePolygon, {
          color: '#3388ff',
          weight: 2,
          opacity: 0.9,
          fillColor: '#3388ff',
          fillOpacity: 0.12
        });
        fieldLayerRef.current.addLayer(polygon);
      }
    }
  }, []);

  const cancelUpdateSavedLocation = () => {
    // Revert local unsaved edits if user declines update
    restoreLoadedLocationBaseline();
    setPendingUpdateLocationId(null);
    setPendingUpdateData(null);
  };

  const navigateWithPendingRevert = (path) => {
    if (selectedLocationId && pendingUpdateData) {
      restoreLoadedLocationBaseline();
      setPendingUpdateLocationId(null);
      setPendingUpdateData(null);
    }
    navigate(path);
  };

  const saveLocationAfterAnalysis = async () => {
    try {
      if (!saveLocationName.trim()) {
        setLocationsError(tr('Please enter a location name', 'براہ کرم مقام کا نام درج کریں'));
        return;
      }

      setSavingLocation(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.post(
        `${API_BASE}/api/satellite/location`,
        {
          name: saveLocationName.trim(),
          latitude: markerPos ? markerPos[0] : null,
          longitude: markerPos ? markerPos[1] : null,
          polygon: fieldPolygon.map(([lat, lon]) => ({ lat, lon })),
          city: selectedCity || '',
          crop: selectedCrop.toLowerCase()
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const saved = response.data.location;
        setSavedLocations((prev) => [...prev, saved]);
        // mark this freshly saved location as the active baseline so reruns are treated as saved
        setSelectedLocationId(saved.id);
        setSelectedHistoryLocationId(String(saved.id));
        originalLoadedLocationRef.current = {
          id: saved.id,
          polygon: Array.isArray(saved.polygon) ? saved.polygon.map(p => [p.lat, p.lon]) : [],
          latitude: saved.latitude,
          longitude: saved.longitude,
          city: saved.city || '',
          crop: saved.crop || '',
        };
        setPendingUpdateData(null);
        setPendingUpdateLocationId(null);
        setShowSaveLocationPrompt(false);
        setSaveLocationName('');
        setLocationsError('');

        // Backfill/link the current analysis snapshot to this new saved field id
        // so farmer history (saved-field filtered views) can immediately find it.
        if (result) {
          const fallbackPolygon = Array.isArray(saved?.polygon)
            ? saved.polygon.map((p) => [p.lat, p.lon])
            : [];
          const activePolygon = fieldPolygon.length >= 3
            ? fieldPolygon
            : (fallbackPolygon.length >= 3 ? fallbackPolygon : null);

          const resolvedLat = Number.isFinite(markerPos?.[0])
            ? markerPos[0]
            : (Number.isFinite(Number(saved?.latitude)) ? Number(saved.latitude) : Number(result?.field?.latitude));
          const resolvedLon = Number.isFinite(markerPos?.[1])
            ? markerPos[1]
            : (Number.isFinite(Number(saved?.longitude)) ? Number(saved.longitude) : Number(result?.field?.longitude));

          await saveOutcomeSnapshot({
            analysisResult: {
              ...result,
              cost_tracker: Array.isArray(inputCosts) ? inputCosts : undefined,
            },
            latitude: resolvedLat,
            longitude: resolvedLon,
            activePolygon,
            savedLocationIdOverride: String(saved.id),
          });
        }

        await loadFarmerHistory(String(saved.id));
      } else {
        setLocationsError(response.data.error || tr('Failed to save location', 'مقام محفوظ کرنے میں ناکامی'));
      }
    } catch (error) {
      console.error('Error saving location:', error);
      setLocationsError(error.response?.data?.error || tr('Server error', 'سرور خرابی'));
    } finally {
      setSavingLocation(false);
    }
  };

  const deleteLocation = (locationId) => {
    const location = savedLocations.find(loc => loc.id === locationId);
    if (location) {
      setDeleteConfirmLocationId(locationId);
      setDeleteConfirmLocationName(location.name);
    }
  };

  const confirmDeleteLocation = async () => {
    try {
      const locationId = deleteConfirmLocationId;
      const token = localStorage.getItem('token');
      
      const response = await axios.delete(`${API_BASE}/api/satellite/location/${locationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        const filteredLocations = savedLocations.filter(loc => loc.id !== locationId);
        setSavedLocations(filteredLocations);
        if (selectedLocationId === locationId) {
          setSelectedLocationId(null);
          originalLoadedLocationRef.current = null;
          setPendingUpdateData(null);
          setPendingUpdateLocationId(null);
          // Clear the current analysis report if it's from the deleted location
          setResult(null);
          setActiveResultTab('overview');
          setOutcomeHistory([]);
          setOutcomeTrend(null);
          setCurrentFieldSignature('');
          setSelectedHistoryFieldSignature('');
          setSelectedHistoryLocationId('');
          // Clear sessionStorage keys related to this analysis
          try {
            sessionStorage.removeItem(SAT_HISTORY_REPORT_KEY);
            sessionStorage.removeItem(SAT_LAST_RESULT_KEY);
            sessionStorage.removeItem(costTrackerStorageKey);
          } catch {
            // ignore storage errors
          }
        } else {
          // Refresh farmer history to remove deleted location's outcomes
          setTimeout(() => loadFarmerHistory(), 100);
        }
        setDeleteConfirmLocationId(null);
        setDeleteConfirmLocationName('');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      setLocationsError(error.response?.data?.error || tr('Failed to delete location', 'مقام ڈیلیٹ کرنے میں ناکامی'));
    }
  };

  useEffect(() => {
    localStorage.setItem('sat_coord_history', JSON.stringify(normalizeCoordHistory(coordHistory)));
  }, [coordHistory]);

  useEffect(() => () => {
    if (drawAttentionTimerRef.current) clearTimeout(drawAttentionTimerRef.current);
  }, []);

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setMarkerPos(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const triggerDrawAttention = () => {
    setDrawAttentionPulse(true);
    if (drawAttentionTimerRef.current) clearTimeout(drawAttentionTimerRef.current);
    drawAttentionTimerRef.current = setTimeout(() => {
      setDrawAttentionPulse(false);
    }, 2400);
  };

  const findCityByCoords = (lat, lon) => {
    return activeCityEntries.find(([, city]) => {
      const [[s, w], [n, e]] = city.bounds;
      return lat >= s && lat <= n && lon >= w && lon <= e;
    });
  };

  const syncSelectedCityWithCoords = (lat, lon) => {
    const matched = findCityByCoords(lat, lon);
    if (matched) {
      setSelectedCity(matched[0]);
      setMapBounds(matched[1].bounds);
    } else {
      setSelectedCity('');
      setMapBounds(null);
    }
    return matched;
  };

  const addToHistory = (lat, lon, cityName) => {
    const entry = { lat: parseFloat(parseFloat(lat).toFixed(6)), lon: parseFloat(parseFloat(lon).toFixed(6)), city: cityName || '' };
    setCoordHistory(prev => {
      const filtered = prev.filter(e => !(Math.abs(e.lat - entry.lat) < 0.0005 && Math.abs(e.lon - entry.lon) < 0.0005));
      const next = [entry, ...filtered].slice(0, 3);
      localStorage.setItem('sat_coord_history', JSON.stringify(next));
      return next;
    });
  };

  const clearDrawnBoundary = () => {
    if (fieldLayerRef.current && typeof fieldLayerRef.current.clearLayers === 'function') {
      fieldLayerRef.current.clearLayers();
    }
    setFieldPolygon([]);
  };

  const applyPolygonSelection = (polygon) => {
    if (!polygon || polygon.length < 3) return;
    setFieldPolygon(polygon);
    const centroid = getPolygonCentroid(polygon);
    if (centroid) {
      const [lat, lon] = centroid;
      setMarkerPos([lat, lon]);
      setCoordInput(formatCoordinatePair(lat, lon));
      syncSelectedCityWithCoords(lat, lon);
    }

    const allInBounds = polygon.every(([lat, lon]) => isInAnyCityBounds(lat, lon, activeCityNames));
    if (!allInBounds) {
      setCoordWarning(outOfBoundsWarning);
    } else {
      setCoordWarning('');
    }
    setError('');
  };

  const handleBoundaryCreated = (e) => {
    const { layerType, layer } = e;
    if (layerType !== 'polygon' && layerType !== 'rectangle') return;

    if (fieldLayerRef.current && typeof fieldLayerRef.current.clearLayers === 'function') {
      fieldLayerRef.current.clearLayers();
      fieldLayerRef.current.addLayer(layer);
    }

    const polygon = normalizeLayerToPolygon(layer);
    applyPolygonSelection(polygon);
    setMapMode('imagery');
    setResult(null);
  };

  const handleBoundaryEdited = (e) => {
    let latest = null;
    e.layers.eachLayer((layer) => {
      latest = normalizeLayerToPolygon(layer);
    });
    if (latest && latest.length >= 3) {
      applyPolygonSelection(latest);
      setResult(null);
    }
  };

  const handleBoundaryDeleted = () => {
    setFieldPolygon([]);
    setMarkerPos(null);
    setResult(null);
    setError('');
  };

  const handleDeleteBoundaryNow = useCallback(() => {
    clearDrawnBoundary();
    setMarkerPos(null);
    setResult(null);
    setError('');
  }, []);

  useEffect(() => {
    let cleanup = () => {};

    const attachDeleteHandler = () => {
      const removeBtn = document.querySelector('.leaflet-draw-edit-remove');
      if (!removeBtn) return false;

      const triggerImmediateDelete = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof event.stopImmediatePropagation === 'function') {
          event.stopImmediatePropagation();
        }
        handleDeleteBoundaryNow();
      };

      removeBtn.setAttribute('href', '#');
      removeBtn.removeAttribute('title');
      removeBtn.setAttribute('aria-label', tr('Delete boundary', 'حد حذف کریں'));

      removeBtn.addEventListener('mousedown', triggerImmediateDelete, true);
      removeBtn.addEventListener('click', triggerImmediateDelete, true);
      removeBtn.addEventListener('touchstart', triggerImmediateDelete, { capture: true, passive: false });

      cleanup = () => {
        removeBtn.removeEventListener('mousedown', triggerImmediateDelete, true);
        removeBtn.removeEventListener('click', triggerImmediateDelete, true);
        removeBtn.removeEventListener('touchstart', triggerImmediateDelete, true);
      };
      return true;
    };

    if (!attachDeleteHandler()) {
      const retryTimer = window.setTimeout(attachDeleteHandler, 320);
      return () => {
        window.clearTimeout(retryTimer);
        cleanup();
      };
    }

    return () => cleanup();
  }, [handleDeleteBoundaryNow, mapMode]);

  const handleMapZoomEnd = (zoom) => {
    setMapZoom(zoom);
    if (mapMode === 'overview' && zoom >= 13) {
      setMapMode('imagery');
    } else if (mapMode === 'imagery' && zoom <= 11) {
      setMapMode('overview');
    }
  };

  // ── city selection ─────────────────────────────────────────────────────────
  const handleCitySelect = (cityName) => {
    const city = CITIES[cityName];
    if (!city) return;
    setSelectedCity(cityName);
    setMapCenter([city.lat, city.lon]);
    setMapZoom(city.zoom);
    setMapMode('overview');
    setMarkerPos(null);
    setCoordWarning('');
    setMapBounds(city.bounds);
    setCoordInput('');
    setResult(null);
    clearDrawnBoundary();
  };

  const handleCropSelect = (cropName) => {
    if (!cropName || cropName === selectedCrop) return;

    setSelectedCrop(cropName);

    const selectedLoc = savedLocations.find((loc) => String(loc.id) === String(selectedLocationId));
    if (!selectedLoc) return;

    const nextCropKey = String(cropName || '').toLowerCase();
    const locationCropKey = String(selectedLoc.crop || '').toLowerCase();
    if (locationCropKey && locationCropKey !== nextCropKey) {
      setSelectedLocationId(null);
      originalLoadedLocationRef.current = null;
      setPendingUpdateData(null);
      setPendingUpdateLocationId(null);
    }
  };

  // ── geolocation ────────────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError(tr('Geolocation is not supported by your browser.', 'آپ کا براؤزر لوکیشن سپورٹ نہیں کرتا۔'));
      return;
    }
    setGeoLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCoordInput(formatCoordinatePair(lat, lon));
        setMarkerPos([lat, lon]);
        setMapCenter([lat, lon]);
        setMapZoom(18);
        setMapMode('imagery');
        clearDrawnBoundary();
        const matchedCity = syncSelectedCityWithCoords(lat, lon);
        if (!isInAnyCityBounds(lat, lon, activeCityNames)) {
          setCoordWarning(outOfBoundsWarning);
        } else {
          setCoordWarning('');
        }
        setGeoLoading(false);
      },
      (err) => {
        setError(`${tr('Geolocation error', 'لوکیشن خرابی')}: ${err.message}`);
        setGeoLoading(false);
      },
    );
  };

  // ── coordinate validation ────────────────────────────────────────────────
  const checkCityBounds = (lat, lon) => {
    const inSupportedBounds = isInAnyCityBounds(lat, lon, activeCityNames);
    if (!inSupportedBounds) {
      setCoordWarning(outOfBoundsWarning);
    } else {
      setCoordWarning('');
    }
    return inSupportedBounds;
  };

  // ── manual coordinate input ────────────────────────────────────────────────
  const handleCoordinateChange = (val) => {
    setCoordInput(val);
    const parsed = parseCoordinatePair(val);
    if (parsed) {
      const { lat, lon } = parsed;
      setMarkerPos([lat, lon]);
      checkCityBounds(lat, lon);
      syncSelectedCityWithCoords(lat, lon);
    }
  };

  // ── go to typed coordinates ────────────────────────────────────────────────
  const handleGoToLocation = () => {
    const parsed = parseCoordinatePair(coordInput);
    if (!parsed) {
      setError(tr('Enter coordinates as "latitude, longitude" first (example: 31.418000, 73.079000).', 'پہلے کوآرڈینیٹس "latitude, longitude" کی شکل میں درج کریں (مثال: 31.418000, 73.079000)۔'));
      return;
    }
    const { lat, lon } = parsed;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError(tr('Coordinates out of range. Latitude must be -90 to 90, longitude -180 to 180.', 'کوآرڈینیٹس درست حد میں نہیں۔ Latitude -90 سے 90 اور Longitude -180 سے 180 ہونا چاہیے۔'));
      return;
    }
    setError('');
    setMarkerPos([lat, lon]);
    setMapCenter([lat, lon]);
    setMapZoom(MAP_MAX_ZOOM);
    setMapMode('imagery');
    clearDrawnBoundary();
    const inSupportedBounds = checkCityBounds(lat, lon);
    const matched = syncSelectedCityWithCoords(lat, lon);
    if (!matched && !inSupportedBounds) {
      setCoordWarning(outOfBoundsWarning);
    }
  };

  const handleRecentCoordinatePick = (value) => {
    setCoordInput(value);
    const parsed = parseCoordinatePair(value);
    if (!parsed) return;
    const { lat, lon } = parsed;
    setMarkerPos([lat, lon]);
    setMapCenter([lat, lon]);
    setMapZoom(17);
    setMapMode('imagery');
    checkCityBounds(lat, lon);
    syncSelectedCityWithCoords(lat, lon);
  };

  // ── map click ──────────────────────────────────────────────────────────────
  const handleMapClick = (lat, lon) => {
    setCoordInput(formatCoordinatePair(lat, lon));
    setMarkerPos([lat, lon]);
    setMapCenter([lat, lon]);
    setMapMode('imagery');
    checkCityBounds(lat, lon);
    syncSelectedCityWithCoords(lat, lon);
  };

  // ── analysis request ───────────────────────────────────────────────────────
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const sendSatelliteAlert = useCallback(async ({ analysisResult, coords }) => {
    const riskLevel = normalizeRiskLevel(analysisResult?.field_report?.risk_level || analysisResult?.risk_level);
    if (!['High', 'Moderate'].includes(riskLevel)) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const city = analysisResult?.city || analysisResult?.location?.city || selectedCity || '';
    const sessionId = analysisResult?.session_id || analysisResult?.sessionId || '';
    const fieldSignature = analysisResult?.field_signature || analysisResult?.fieldSignature || '';
    const alertKey = `${riskLevel}:${sessionId}:${fieldSignature}:${analysisResult?.analysis_date || analysisResult?.timestamp || ''}:${city}`;
    if (lastAlertKeyRef.current === alertKey) return;

    const historyKey = 'satellite_alert_history';
    const stored = localStorage.getItem(historyKey);
    const parsed = stored ? JSON.parse(stored) : [];
    if (Array.isArray(parsed) && parsed.includes(alertKey)) {
      lastAlertKeyRef.current = alertKey;
      return;
    }
    const nextHistory = Array.isArray(parsed) ? [alertKey, ...parsed] : [alertKey];
    localStorage.setItem(historyKey, JSON.stringify(nextHistory.slice(0, 50)));
    lastAlertKeyRef.current = alertKey;

    const baseUrl = process.env.REACT_APP_FRONTEND_URL || 'http://localhost:3000';
    const dashboardUrl = `${baseUrl}/dashboard`;
    const reportUrl = `${baseUrl}/satellite?history_report=1`;

    const payload = buildAlertPayloadFromResult({
      result: analysisResult,
      city,
      coords,
      dashboardUrl,
      reportUrl,
    });

    try {
      await axios.post(`${API_BASE}/api/satellite/alerts/email`, { payload }, {
        headers: getAuthHeaders(),
      });
    } catch (alertErr) {
      console.warn('Alert email failed:', alertErr?.response?.data?.error || alertErr.message);
    }
  }, [getAuthHeaders, selectedCity]);

  const resolveActiveSavedLocationId = useCallback(({ latitude, longitude, activePolygon, crop, city }) => {
    if (selectedLocationId) return String(selectedLocationId);
    if (!Array.isArray(savedLocations) || savedLocations.length === 0) return '';

    const normalizedCrop = String(crop || '').toLowerCase();
    const normalizedCity = String(city || '').trim().toLowerCase();

    if (Array.isArray(activePolygon) && activePolygon.length >= 3) {
      const normalizedRequestedPolygon = activePolygon.map(([lat, lon]) => `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`).join('|');
      const polygonMatch = savedLocations.find((loc) => {
        const locPolygon = Array.isArray(loc?.polygon)
          ? loc.polygon.map((p) => `${Number(p?.lat).toFixed(6)},${Number(p?.lon).toFixed(6)}`).join('|')
          : '';
        if (!locPolygon || locPolygon !== normalizedRequestedPolygon) return false;
        const cropMatches = !normalizedCrop || String(loc?.crop || '').toLowerCase() === normalizedCrop;
        const cityMatches = !normalizedCity || String(loc?.city || '').trim().toLowerCase() === normalizedCity;
        return cropMatches && cityMatches;
      });
      if (polygonMatch?.id) return String(polygonMatch.id);
    }

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const nearbyMatch = savedLocations.find((loc) => {
        const lat = Number(loc?.latitude);
        const lon = Number(loc?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        const closeEnough = Math.abs(lat - latitude) <= 0.0002 && Math.abs(lon - longitude) <= 0.0002;
        if (!closeEnough) return false;
        const cropMatches = !normalizedCrop || String(loc?.crop || '').toLowerCase() === normalizedCrop;
        const cityMatches = !normalizedCity || String(loc?.city || '').trim().toLowerCase() === normalizedCity;
        return cropMatches && cityMatches;
      });
      if (nearbyMatch?.id) return String(nearbyMatch.id);
    }

    return '';
  }, [savedLocations, selectedLocationId]);

  const findSavedLocationByGeometry = useCallback(({ latitude, longitude, activePolygon }) => {
    if (!Array.isArray(savedLocations) || savedLocations.length === 0) return null;

    if (Array.isArray(activePolygon) && activePolygon.length >= 3) {
      const normalizedRequestedPolygon = activePolygon
        .map(([lat, lon]) => `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`)
        .join('|');

      const polygonMatch = savedLocations.find((loc) => {
        const locPolygon = Array.isArray(loc?.polygon)
          ? loc.polygon.map((p) => `${Number(p?.lat).toFixed(6)},${Number(p?.lon).toFixed(6)}`).join('|')
          : '';
        return !!locPolygon && locPolygon === normalizedRequestedPolygon;
      });

      if (polygonMatch) return polygonMatch;
    }

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return savedLocations.find((loc) => {
        const lat = Number(loc?.latitude);
        const lon = Number(loc?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        return Math.abs(lat - latitude) <= 0.0002 && Math.abs(lon - longitude) <= 0.0002;
      }) || null;
    }

    return null;
  }, [savedLocations]);

  const getSavedFieldCropMismatch = useCallback(({ latitude, longitude, activePolygon, selectedCropName }) => {
    const matchedLocation = findSavedLocationByGeometry({ latitude, longitude, activePolygon });
    if (!matchedLocation) return null;

    const savedCropKey = String(matchedLocation?.crop || '').toLowerCase();
    const selectedCropKey = String(selectedCropName || '').toLowerCase();
    if (!savedCropKey || !selectedCropKey || savedCropKey === selectedCropKey) return null;

    const savedCropLabel = savedCropKey.charAt(0).toUpperCase() + savedCropKey.slice(1);
    const selectedCropLabel = selectedCropName;

    return {
      matchedLocation,
      savedCropLabel,
      selectedCropLabel,
    };
  }, [findSavedLocationByGeometry]);

  const preAnalysisMismatchWarning = useMemo(() => {
    const activePolygon = fieldPolygon.length >= 3 ? fieldPolygon : null;
    let lat = Number(markerPos?.[0]);
    let lon = Number(markerPos?.[1]);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const typed = parseCoordinatePair(coordInput);
      lat = Number(typed?.lat);
      lon = Number(typed?.lon);
    }

    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && activePolygon) {
      const centroid = getPolygonCentroid(activePolygon);
      if (centroid) {
        lat = centroid[0];
        lon = centroid[1];
      }
    }

    return getSavedFieldCropMismatch({
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      activePolygon,
      selectedCropName: selectedCrop,
    });
  }, [coordInput, fieldPolygon, getSavedFieldCropMismatch, markerPos, selectedCrop]);

  const jumpToMapAndShowSavedNotice = useCallback(() => {
    setReportSavedNotice(tr('Report saved.', 'رپورٹ محفوظ ہو گئی۔'));
    setHistoryReportMode(false);
    setHistoryOverviewOnly(false);
    setShowLocationPanel(true);
    setShowManualCoordinates(false);
    setError('');
    setTimeout(() => {
      const mapEl = document.querySelector('.sat-map-wrapper');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }, [tr]);

  const handleCloseReportView = useCallback(() => {
    try {
      sessionStorage.removeItem(SAT_HISTORY_REPORT_KEY);
      sessionStorage.removeItem(SAT_LAST_RESULT_KEY);
    } catch {
      // ignore storage errors
    }
    setResult(null);
    setInputCosts([]);
    setActiveResultTab('overview');
     setHistoryReportMode(false);
     setHistoryOverviewOnly(false);
     // Remove history_report param from URL to prevent re-hydration on revisit
     window.history.replaceState({}, document.title, window.location.pathname);
     jumpToMapAndShowSavedNotice();
    }, [jumpToMapAndShowSavedNotice]);

  const handleStartNewAnalysisFromReport = useCallback(() => {
    try {
      sessionStorage.removeItem(SAT_HISTORY_REPORT_KEY);
      sessionStorage.removeItem(SAT_LAST_RESULT_KEY);
    } catch {
      // ignore storage errors
    }
    setResult(null);
    setInputCosts([]);
    setActiveResultTab('overview');
    jumpToMapAndShowSavedNotice();
  }, [jumpToMapAndShowSavedNotice]);

  const handleDownloadDetailedReport = () => {
    if (!result) return;

    const reportDate = result?.field?.analysis_date
      || (result?.timestamp ? String(result.timestamp).slice(0, 10) : toDateInputValue(new Date()));
    const cropLabel = String(result?.crop || selectedCrop || 'crop').toUpperCase();
    const cityLabel = result?.city || result?.field?.city || selectedCity || 'Unknown area';
    const riskLabel = result?.field_report?.risk_level || result?.risk_level || 'Unknown';
    const stressProbability = Number(
      result?.metrics?.stress_probability
      ?? result?.field_report?.stress_probability
      ?? result?.heatmap?.summary?.avg_stress_probability
    );
    const expectedLoss = Number(
      result?.field_report?.economic_impact?.expected_loss_pkr_per_acre
      ?? result?.metrics?.expected_loss_pkr_per_acre
      ?? result?.economic_impact?.expected_loss_pkr_per_acre
    );
    const expectedYield = Number(result?.field_report?.estimated_yield?.maunds_per_acre);
    const potentialLossMaunds = Number(result?.field_report?.estimated_yield?.potential_loss_maunds);
    const summary = result?.diagnosis?.urgency || result?.field_report?.status_summary || 'N/A';
    const weatherContext = result?.weather_context || {};
    const weatherSummary = weatherContext?.summary || {};
    const weatherDay = (Array.isArray(result?.weather_data) && result.weather_data[0])
      || (Array.isArray(miniWeather?.forecast) && miniWeather.forecast[0])
      || {};
    const weatherTemperature = Number(
      weatherContext?.temperature_c
      ?? weatherSummary?.avg_temp
      ?? weatherDay?.T2M
    );
    const weatherHumidity = Number(
      weatherContext?.humidity_pct
      ?? weatherSummary?.avg_humidity
      ?? weatherDay?.RH2M
    );
    const weatherRain48 = Number(
      weatherContext?.rain_mm_next_48h
      ?? weatherContext?.rain_next_48h
      ?? weatherSummary?.total_rainfall
      ?? weatherDay?.PRECTOTCORR
    );
    const recommendations = Array.isArray(result?.recommendations) ? result.recommendations : [];
    const stageChecklist = Array.isArray(result?.stage_checklist?.items) ? result.stage_checklist.items : [];
    const fertilizerPlanBuilt = buildFertilizerPlan(result);
    const fertilizerPlan = Array.isArray(fertilizerPlanBuilt?.products) ? fertilizerPlanBuilt.products : [];
    const irrigationPlanBuilt = buildIrrigationSchedule(result);
    const irrigationActions = Array.isArray(irrigationPlanBuilt?.plan)
      ? irrigationPlanBuilt.plan.map((step) => `${step.when}: ${step.action}`)
      : (Array.isArray(result?.farmer_summary?.irrigation?.actions)
        ? result.farmer_summary.irrigation.actions
        : []);
    const trackedCosts = Array.isArray(inputCosts) ? inputCosts : [];

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    const contentWidth = pageWidth - (margin * 2);
    let y = 52;

    const ensureSpace = (needed = 26) => {
      if (y + needed <= pageHeight - 40) return;
      doc.addPage();
      y = 52;
    };

    const writeTitle = (text) => {
      ensureSpace(36);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(text, margin, y);
      y += 24;
    };

    const writeSection = (text) => {
      ensureSpace(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(text, margin, y);
      y += 18;
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    };

    const writeLine = (text) => {
      const safe = String(text || '');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(safe, contentWidth);
      lines.forEach((line) => {
        ensureSpace(16);
        doc.text(line, margin, y);
        y += 14;
      });
    };

    const writeList = (items, fallback) => {
      const list = Array.isArray(items) && items.length > 0 ? items : [fallback];
      list.forEach((item, idx) => writeLine(`${idx + 1}. ${item}`));
    };

    writeTitle('FasalGuard Satellite Analysis - Detailed Report');
    writeLine(`Generated At: ${new Date().toLocaleString('en-PK')}`);
    writeLine(`Analysis Date: ${reportDate}`);
    writeLine(`Crop: ${cropLabel}`);
    writeLine(`City/Area: ${cityLabel}`);

    writeSection('Executive Summary');
    writeLine(`Risk Level: ${riskLabel}`);
    writeLine(`Status Summary: ${summary}`);
    writeLine(`Stress Probability: ${Number.isFinite(stressProbability) ? `${(stressProbability * 100).toFixed(1)}%` : 'N/A'}`);
    writeLine(`Expected Yield: ${Number.isFinite(expectedYield) ? `${expectedYield.toFixed(2)} maunds/acre` : 'N/A'}`);
    writeLine(`Potential Yield Loss: ${Number.isFinite(potentialLossMaunds) ? `${potentialLossMaunds.toFixed(2)} maunds/acre` : 'N/A'}`);
    writeLine(`Expected Economic Loss: ${Number.isFinite(expectedLoss) ? `PKR ${Math.round(expectedLoss).toLocaleString('en-PK')} per acre` : 'N/A'}`);

    writeSection('Weather Context');
    writeLine(`Temperature: ${Number.isFinite(weatherTemperature) ? `${weatherTemperature.toFixed(1)} C` : 'N/A'}`);
    writeLine(`Humidity: ${Number.isFinite(weatherHumidity) ? `${weatherHumidity.toFixed(0)}%` : 'N/A'}`);
    writeLine(`Rainfall Forecast: ${Number.isFinite(weatherRain48) ? `${weatherRain48.toFixed(1)} mm` : 'N/A'}`);

    writeSection('Top Recommendations');
    writeList(
      recommendations.slice(0, 10).map((rec) => {
        const title = rec?.action || rec?.recommendation || rec?.type || 'Recommended action';
        const reason = rec?.reason || rec?.detail || '';
        return `${title}${reason ? ` | Reason: ${reason}` : ''}`;
      }),
      'No recommendation data available.'
    );

    writeSection('Stage Checklist');
    writeList(
      stageChecklist.slice(0, 15).map((item) => `${item?.window ? `[${item.window}] ` : ''}${item?.task || 'Task'}`),
      'No stage checklist available.'
    );

    writeSection('Fertilizer Plan');
    writeList(
      fertilizerPlan.slice(0, 12).map((item) => `${item?.label || item?.name || item?.type || 'Input'}: ${item?.dose || item?.amount || 'as advised'}${item?.cost ? ` | ${item.cost}` : ''}`),
      'No fertilizer plan available.'
    );

    writeSection('Irrigation Actions');
    writeList(irrigationActions.slice(0, 12), 'No irrigation action details available.');

    writeSection('Input Cost Tracker');
    writeList(
      trackedCosts.map((item) => `${item?.item || item?.name || 'Input'}${item?.category ? ` (${item.category})` : ''}: PKR ${Number(item?.amount || item?.cost || 0).toLocaleString('en-PK')}${item?.date ? ` on ${item.date}` : ''}`),
      'No tracked input costs entered.'
    );

    const safeCrop = String(result?.crop || selectedCrop || 'crop').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const safeDate = String(reportDate || toDateInputValue(new Date())).replace(/[^0-9-]+/g, '');
    const fileName = `fasalguard-detailed-report-${safeCrop}-${safeDate}.pdf`;
    doc.save(fileName);

    setReportSavedNotice(tr('Detailed PDF report downloaded.', 'تفصیلی پی ڈی ایف رپورٹ ڈاؤن لوڈ ہو گئی۔'));
  };

  const loadOutcomeHistory = useCallback(async ({ fieldSignature = '', locationId = '', fallbackPayload = null } = {}) => {
    if (!fieldSignature && !locationId && !fallbackPayload) return;

    try {
      setOutcomeLoading(true);
      setOutcomeError('');
      const params = {
        session_id: outcomeSessionId,
        limit: 50,
        lang: language,
        ...(locationId ? { saved_location_id: locationId } : {}),
        ...(fieldSignature ? { field_signature: fieldSignature } : {}),
        ...(!fieldSignature && !locationId && fallbackPayload ? {
          crop: fallbackPayload.crop,
          city: fallbackPayload.city,
          latitude: fallbackPayload.latitude,
          longitude: fallbackPayload.longitude,
        } : {}),
      };

      const response = await axios.get(`${API_BASE}/api/satellite/outcomes/history`, {
        params,
        headers: {
          ...getAuthHeaders(),
          'X-Language': language,
        },
      });

      if (response.data?.success) {
        // Client-side deduplication: keep only the first occurrence of each outcome ID
        const seenIds = new Set();
        const deduplicatedHistory = (response.data.history || []).filter((entry) => {
          if (!entry?.id) return false;
          const idStr = String(entry.id);
          if (seenIds.has(idStr)) return false;
          seenIds.add(idStr);
          return true;
        });
        setOutcomeHistory(deduplicatedHistory);
        setOutcomeTrend(response.data.trend || null);
        if (response.data.saved_location_id) {
          setSelectedHistoryLocationId(response.data.saved_location_id);
        }
        if (response.data.field_signature) {
          setCurrentFieldSignature(response.data.field_signature);
          setSelectedHistoryFieldSignature(response.data.field_signature);
        }
      }
    } catch (historyErr) {
      setOutcomeError(historyErr.response?.data?.error || tr('Outcome history is unavailable right now.', 'اس وقت آؤٹ کم ہسٹری دستیاب نہیں۔'));
    } finally {
      setOutcomeLoading(false);
    }
  }, [getAuthHeaders, language, outcomeSessionId]);

  const loadFarmerHistory = useCallback(async (preferredLocationId = '') => {
    try {
      setFarmerHistoryLoading(true);
      setFarmerHistoryError('');

      const response = await axios.get(`${API_BASE}/api/satellite/outcomes/history`, {
        params: {
          session_id: outcomeSessionId,
          all_fields: true,
          limit: 300,
          lang: language,
        },
        headers: {
          ...getAuthHeaders(),
          'X-Language': language,
        },
      });

      if (!response.data?.success) return;

      const fieldSummaries = Array.isArray(response.data.field_summaries)
        ? response.data.field_summaries
        : [];
      // Deduplicate field summaries by location ID and filter out deleted locations
      const seenLocationIds = new Set();
      const uniqueFieldSummaries = fieldSummaries.filter((summary) => {
        // Only include summaries for locations that still exist in savedLocations
        if (summary.saved_location_id && !savedLocations.some(loc => String(loc.id) === String(summary.saved_location_id))) {
          return false;
        }
        const locId = String(summary.saved_location_id || summary.field_signature || '');
        if (!locId || seenLocationIds.has(locId)) return false;
        seenLocationIds.add(locId);
        return true;
      });
      
      setFarmerHistoryFields(uniqueFieldSummaries);

      if (uniqueFieldSummaries.length === 0) {
        setOutcomeHistory([]);
        setOutcomeTrend(null);
        setCurrentFieldSignature('');
        setSelectedHistoryFieldSignature('');
        setSelectedHistoryLocationId('');
        return;
      }

      // Validate that selected location still exists after farmer history is loaded
      if (selectedLocationId && !savedLocations.some((loc) => String(loc.id) === String(selectedLocationId))) {
        setSelectedLocationId(null);
      }

      const nextLocationId = preferredLocationId
        || selectedHistoryLocationId
        || selectedLocationId
        || uniqueFieldSummaries[0]?.saved_location_id
        || '';

      const selectedExists = uniqueFieldSummaries.some((item) => String(item.saved_location_id || '') === String(nextLocationId));
      const fallbackSummary = uniqueFieldSummaries[0];

      const resolvedSummary = selectedExists
        ? uniqueFieldSummaries.find((item) => String(item.saved_location_id || '') === String(nextLocationId))
        : fallbackSummary;

      if (resolvedSummary) {
        setSelectedHistoryLocationId(String(resolvedSummary.saved_location_id || ''));
        setSelectedHistoryFieldSignature(resolvedSummary.field_signature || '');
        await loadOutcomeHistory({
          fieldSignature: resolvedSummary.field_signature || '',
          locationId: String(resolvedSummary.saved_location_id || ''),
        });
      }
    } catch (historyErr) {
      setFarmerHistoryError(historyErr.response?.data?.error || tr('Farmer history could not be loaded right now.', 'کسان کی ہسٹری اس وقت لوڈ نہیں ہو سکی۔'));
    } finally {
      setFarmerHistoryLoading(false);
    }
  }, [getAuthHeaders, language, loadOutcomeHistory, outcomeSessionId, selectedHistoryLocationId, selectedLocationId, savedLocations, pendingUpdateData]);

  useEffect(() => {
    loadFarmerHistory();
  }, [loadFarmerHistory]);

  const saveOutcomeSnapshot = useCallback(async ({ analysisResult, latitude, longitude, activePolygon, costTrackerOverride, savedLocationIdOverride }) => {
    try {
      const costTrackerPayload = Array.isArray(costTrackerOverride)
        ? costTrackerOverride
        : (Array.isArray(inputCosts) && inputCosts.length > 0 ? inputCosts : undefined);
      const payloadCrop = String(analysisResult?.crop || selectedCrop || 'wheat').toLowerCase();
      const payloadCity = analysisResult?.city || selectedCity || undefined;
      const hasValidCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
      const resolvedLocationId = savedLocationIdOverride || resolveActiveSavedLocationId({
        latitude,
        longitude,
        activePolygon,
        crop: payloadCrop,
        city: payloadCity,
      });
      const payload = {
        session_id: outcomeSessionId,
        crop: payloadCrop,
        city: payloadCity,
        saved_location_id: resolvedLocationId || undefined,
        latitude: hasValidCoords ? latitude : undefined,
        longitude: hasValidCoords ? longitude : undefined,
        analysis_date: analysisDate || undefined,
        field_polygon: activePolygon ? activePolygon.map(([lat, lon]) => ({ lat, lon })) : undefined,
        cost_tracker: costTrackerPayload,
        result: analysisResult,
      };

      const response = await axios.post(`${API_BASE}/api/satellite/outcomes`, payload, {
        headers: getAuthHeaders(),
      });

      const savedSignature = response.data?.outcome?.field_signature;
      const savedLocationId = response.data?.outcome?.saved_location_id || resolvedLocationId || '';
      if (savedSignature) {
        setCurrentFieldSignature(savedSignature);
        setSelectedHistoryFieldSignature(savedSignature);
        if (savedLocationId) setSelectedHistoryLocationId(savedLocationId);
        await loadOutcomeHistory({ fieldSignature: savedSignature, locationId: savedLocationId });
        await loadFarmerHistory(savedLocationId);
      } else {
        await loadOutcomeHistory({ fallbackPayload: payload, locationId: resolvedLocationId || '' });
        await loadFarmerHistory();
      }
    } catch (saveErr) {
      setOutcomeError(saveErr.response?.data?.error || tr('Could not save this analysis for outcome tracking.', 'یہ تجزیہ آؤٹ کم ٹریکنگ کے لیے محفوظ نہیں ہو سکا۔'));
    }
  }, [analysisDate, inputCosts, loadFarmerHistory, loadOutcomeHistory, outcomeSessionId, resolveActiveSavedLocationId, selectedCity, selectedCrop, tr]);

  const persistCostTrackerForCurrentResult = useCallback(async (nextCosts) => {
    if (!result) return;

    const activePolygon = fieldPolygon.length >= 3 ? fieldPolygon : null;
    let latitude = Number(result?.field?.latitude);
    let longitude = Number(result?.field?.longitude);

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && markerPos) {
      latitude = markerPos[0];
      longitude = markerPos[1];
    }

    if ((!Number.isFinite(latitude) || !Number.isFinite(longitude)) && activePolygon) {
      const centroid = getPolygonCentroid(activePolygon);
      if (centroid) {
        latitude = centroid[0];
        longitude = centroid[1];
      }
    }

    const fallbackSavedLocationId = selectedHistoryLocationId || selectedLocationId || '';
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (!fallbackSavedLocationId) return;
      latitude = undefined;
      longitude = undefined;
    }

    await saveOutcomeSnapshot({
      analysisResult: {
        ...result,
        cost_tracker: nextCosts,
      },
      latitude,
      longitude,
      activePolygon,
      costTrackerOverride: nextCosts,
      savedLocationIdOverride: fallbackSavedLocationId,
    });
  }, [fieldPolygon, markerPos, result, saveOutcomeSnapshot, selectedHistoryLocationId, selectedLocationId]);

  useEffect(() => {
    if (!result || historyReportMode) return;
    const nextSignature = JSON.stringify(inputCosts || []);
    if (nextSignature === lastCostPersistSignatureRef.current) return;
    lastCostPersistSignatureRef.current = nextSignature;

    const timer = setTimeout(() => {
      persistCostTrackerForCurrentResult(inputCosts || []);
    }, 250);

    return () => clearTimeout(timer);
  }, [historyReportMode, inputCosts, persistCostTrackerForCurrentResult, result]);

  const handleMarkActionDone = useCallback(async (outcomeId) => {
    if (!outcomeId) return;
    try {
      setMarkingOutcomeId(outcomeId);
      setOutcomeError('');
      await axios.patch(`${API_BASE}/api/satellite/outcomes/${outcomeId}/action`, {
        action_status: 'done',
        action_note: actionNoteDraft,
      }, {
        headers: getAuthHeaders(),
      });
      await loadOutcomeHistory({ fieldSignature: currentFieldSignature, locationId: selectedHistoryLocationId || selectedLocationId || '' });
      await loadFarmerHistory(selectedHistoryLocationId || selectedLocationId || '');
      setActionNoteDraft('');
    } catch (actionErr) {
      setOutcomeError(actionErr.response?.data?.error || tr('Could not update action status.', 'ایکشن اسٹیٹس اپڈیٹ نہیں ہو سکا۔'));
    } finally {
      setMarkingOutcomeId('');
    }
  }, [actionNoteDraft, currentFieldSignature, loadFarmerHistory, loadOutcomeHistory, selectedHistoryLocationId, selectedLocationId]);

  const handleAnalyze = async (skipUpdatePrompt = false) => {
    if (analysisInFlightRef.current) return;
    analysisInFlightRef.current = true;

    try {
    setHistoryReportMode(false);
    setHistoryOverviewOnly(false);
    try {
      sessionStorage.removeItem(SAT_HISTORY_REPORT_KEY);
    } catch {
      // ignore storage errors
    }
    // If this is a saved location, recompute whether edits exist and ask user to update first
    if (!skipUpdatePrompt && selectedLocationId) {
      const pending = getPendingSavedLocationUpdate();
      if (pending) {
        setPendingUpdateData(pending);
        setPendingUpdateLocationId(selectedLocationId);
        return;
      }
    }
    const activePolygon = fieldPolygon.length >= 3 ? fieldPolygon : null;
    if (!activePolygon) {
      triggerDrawAttention();
      setError(tr('Please mark your field first. Tap the draw tool on the map and outline your field boundary.', 'پہلے اپنا کھیت نشان زد کریں۔ نقشے پر ڈرا ٹول استعمال کریں اور کھیت کی حد بنائیں۔'));
      return;
    }

    const parsedPair = parseCoordinatePair(coordInput);
    let parsedLat = parsedPair?.lat;
    let parsedLon = parsedPair?.lon;

    if ((!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) && activePolygon) {
      const centroid = getPolygonCentroid(activePolygon);
      if (centroid) {
        parsedLat = centroid[0];
        parsedLon = centroid[1];
      }
    }

    if (isNaN(parsedLat) || isNaN(parsedLon)) {
      setError(tr('Please provide a valid location (click the map, use geolocation, or type coordinates).', 'براہ کرم درست لوکیشن دیں (نقشے پر کلک کریں، موجودہ لوکیشن لیں یا کوآرڈینیٹس درج کریں)۔'));
      return;
    }

    const inBounds = activePolygon
      ? activePolygon.every(([lat, lon]) => isInAnyCityBounds(lat, lon, activeCityNames))
      : isInAnyCityBounds(parsedLat, parsedLon, activeCityNames);

    if (!inBounds) {
      const supportedDistrictsText = activeCityNames.join(', ');
      setError(tr(
        `This field is outside the currently supported districts for ${selectedCrop}. Please select a field within ${supportedDistrictsText}.`,
        `یہ کھیت ${selectedCrop} کے لیے سپورٹ شدہ اضلاع سے باہر ہے۔ براہ کرم منتخب اضلاع کے اندر کھیت منتخب کریں۔`
      ));
      return;
    }

    const mismatch = getSavedFieldCropMismatch({
      latitude: parsedLat,
      longitude: parsedLon,
      activePolygon,
      selectedCropName: selectedCrop,
    });

    if (mismatch) {
      setShowLocationPanel(true);
      setError(tr(
        `Crop mismatch detected before analysis. This field matches saved location "${mismatch.matchedLocation?.name || 'Saved field'}" with crop ${mismatch.savedCropLabel}, but ${mismatch.selectedCropLabel} is selected. Switch crop or open that saved location first.`,
        `تجزیہ سے پہلے فصل میں عدم مطابقت پائی گئی۔ یہ کھیت محفوظ مقام "${mismatch.matchedLocation?.name || 'محفوظ کھیت'}" سے میل کھاتا ہے جس کی فصل ${mismatch.savedCropLabel} ہے، جبکہ ${mismatch.selectedCropLabel} منتخب ہے۔ پہلے فصل درست کریں یا وہ محفوظ لوکیشن کھولیں۔`
      ));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const analyzeWithDate = async (dateValue) => axios.post(
        `${API_BASE}/api/satellite/analyze?lang=${encodeURIComponent(language)}`,
        {
          lat: parsedLat,
          lon: parsedLon,
          crop: selectedCrop.toLowerCase(),
          city: selectedCity || undefined,
          analysis_date: dateValue || undefined,
          field_polygon: activePolygon ? activePolygon.map(([lat, lon]) => ({ lat, lon })) : undefined,
          lang: language,
        },
        {
          headers: {
            'X-Language': language,
          },
        },
      );

      const requestedDate = analysisDate || todayInput;
      let finalResponse = await analyzeWithDate(requestedDate);
      let responsePayload = finalResponse.data;

      if (responsePayload.success) {
        const cleanResult = stripEmojiDeep(responsePayload);
        const checklistPayload = buildStageChecklist(cleanResult);
        const enrichedResult = {
          ...cleanResult,
          stage_checklist: checklistPayload,
        };
        addToHistory(
          parsedLat,
          parsedLon,
          selectedCity || enrichedResult?.field?.city || ''
        );
        setResult(enrichedResult);
        // Avoid immediate duplicate auto-persist with unchanged cost tracker.
        lastCostPersistSignatureRef.current = JSON.stringify(inputCosts || []);
        setActiveResultTab('overview');
        await saveOutcomeSnapshot({
          analysisResult: enrichedResult,
          latitude: parsedLat,
          longitude: parsedLon,
          activePolygon,
        });

        await sendSatelliteAlert({
          analysisResult: enrichedResult,
          coords: { lat: parsedLat, lon: parsedLon },
        });
        
        // Check if this location is already saved
        const isLocationSaved = selectedLocationId
          && savedLocations.some((loc) => String(loc.id) === String(selectedLocationId));
        
        // Show save location prompt if not already saved
        if (!isLocationSaved && !selectedLocationId && enrichedResult?.is_field !== false) {
          setSaveLocationName('');
          setShowSaveLocationPrompt(true);
        } else {
          setShowSaveLocationPrompt(false);
        }

        // Scroll to results
        setTimeout(() => {
          document.getElementById('sat-results-anchor')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setError(buildFriendlyAnalysisError(responsePayload?.error, tr));
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(buildFriendlyAnalysisError(msg, tr));
    } finally {
      setLoading(false);
    }
    } finally {
      analysisInFlightRef.current = false;
    }
  };

  const handleAnalysisDateChange = (rawDate, todayValue) => {
    const normalized = normalizeSeasonalAnalysisDate(rawDate, todayValue, selectedCrop);
    if (!rawDate) return;

    if (normalized !== rawDate) {
      const warningByCrop = {
        Wheat: 'Wheat off-season: pick Nov-Apr.',
        Cotton: 'Cotton off-season: pick Apr-Nov.',
        Rice: 'Rice off-season: pick Jun-Nov.',
        Maize: 'Maize off-season: pick Mar-Oct.',
        Sugarcane: 'Sugarcane can be analyzed year-round in the configured districts.',
      };
      const urWarningByCrop = {
        Wheat: 'گندم آف سیزن: نومبر تا اپریل منتخب کریں۔',
        Cotton: 'کپاس آف سیزن: اپریل تا نومبر منتخب کریں۔',
        Rice: 'چاول آف سیزن: جون تا نومبر منتخب کریں۔',
        Maize: 'مکئی آف سیزن: مارچ تا اکتوبر منتخب کریں۔',
        Sugarcane: 'گنے کے لیے سال بھر تجزیہ دستیاب ہے (منتخب اضلاع میں)۔',
      };
      setAnalysisDateWarning(tr(
        warningByCrop[selectedCrop] || warningByCrop.Wheat,
        urWarningByCrop[selectedCrop] || urWarningByCrop.Wheat
      ));
      return;
    }

    setAnalysisDateWarning('');
    setAnalysisDate(normalized);
  };

  // ── helper renderers ───────────────────────────────────────────────────────
  const INDEX_PROFILES = {
    ndvi: {
      range: [0.10, 0.85],
      thresholds: [0.24, 0.38, 0.52],
      labels: ['Poor', 'Weak', 'Fair', 'Strong'],
    },
    gndvi: {
      range: [0.05, 0.65],
      thresholds: [0.16, 0.26, 0.36],
      labels: ['Poor', 'Weak', 'Fair', 'Strong'],
    },
    evi: {
      range: [0.05, 0.55],
      thresholds: [0.14, 0.22, 0.32],
      labels: ['Poor', 'Weak', 'Fair', 'Strong'],
    },
    ndwi: {
      range: [-0.35, 0.25],
      thresholds: [-0.14, -0.05, 0.04],
      labels: ['Dry', 'Tense', 'Balanced', 'Wet'],
    },
    ndre: {
      range: [0.06, 0.42],
      thresholds: [0.13, 0.19, 0.25],
      labels: ['Poor', 'Weak', 'Fair', 'Strong'],
    },
    savi: {
      range: [0.12, 0.62],
      thresholds: [0.18, 0.27, 0.36],
      labels: ['Poor', 'Weak', 'Fair', 'Strong'],
    },
  };

  const getIndexVisual = (metricKey, value, min, max) => {
    const profile = INDEX_PROFILES[metricKey] || {
      range: [min ?? -1, max ?? 1],
      thresholds: [0.2, 0.4, 0.6],
      labels: ['Low', 'Watch', 'Fair', 'Good'],
    };
    const [pMin, pMax] = profile.range;
    const clamped = Math.min(pMax, Math.max(pMin, value));
    const pct = Math.round(((clamped - pMin) / Math.max(0.0001, pMax - pMin)) * 100);

    let band = 0;
    if (value >= profile.thresholds[2]) band = 3;
    else if (value >= profile.thresholds[1]) band = 2;
    else if (value >= profile.thresholds[0]) band = 1;

    const colours = ['#dc2626', '#f59e0b', '#84cc16', '#16a34a'];
    return {
      pct,
      colour: colours[band],
      bandLabel: profile.labels[band],
      bandClass: ['critical', 'watch', 'moderate', 'strong'][band],
      minLabel: pMin.toFixed(2),
      maxLabel: pMax.toFixed(2),
    };
  };

  const IndexBar = ({ label, value, metricKey, min = -1, max = 1 }) => {
    const visual = getIndexVisual(metricKey, value, min, max);
    return (
      <div className="sat-index-bar">
        <div className="sat-index-label">
          <span>{label}</span>
          <span style={{ color: visual.colour, fontWeight: 700 }}>{value.toFixed(3)} · {visual.bandLabel}</span>
        </div>
        <div className="sat-bar-track" role="img" aria-label={`${label} is ${value.toFixed(3)} (${visual.bandLabel})`}>
          <div className={`sat-bar-fill ${visual.bandClass}`} style={{ width: `${visual.pct}%`, background: visual.colour }} />
        </div>
        <div className="sat-index-scale">
          <span>{visual.minLabel}</span>
          <span>{visual.maxLabel}</span>
        </div>
      </div>
    );
  };

  // ─── Rich recommendation card ───────────────────────────────────────────────
    // ─── Field health report hero card ──────────────────────────────────────────
    const FieldReportCard = ({ fr }) => {
      const hasCritical = fr.critical_count > 0;
      const rawHealthLabel = String(fr.health_label || '').trim();
      const displayLabel = hasCritical || /needs\s*attention/i.test(rawHealthLabel)
        ? tr('Field Overview', 'فیلڈ جائزہ')
        : (simplifyFarmerText(rawHealthLabel) || tr('Field Overview', 'فیلڈ جائزہ'));
      const rawRisk = hasCritical ? 'Elevated' : (fr.risk_level || 'Low');
      const displayRisk = simplifyFarmerText(rawRisk);
      const potentialLoss = Number(fr.estimated_yield?.potential_loss_maunds || 0);
      const economic = fr?.economic_impact || {};
      const pricePerMaundByCrop = {
        wheat: 3900,
        cotton: 8500,
        maize: 2800,
        rice: 5200,
        sugarcane: 450,
      };
      const cropKey = String(selectedCrop || fr?.crop || 'wheat').toLowerCase();
      const assumedPricePkrPerMaund = pricePerMaundByCrop[cropKey] || 3900;
      const potentialLossMaunds = Number(fr?.estimated_yield?.potential_loss_maunds);

      const expectedLossRaw = Number(economic?.expected_loss_pkr_per_acre);

      const expectedLossPkr = Number.isFinite(expectedLossRaw)
        ? expectedLossRaw
        : (Number.isFinite(potentialLossMaunds) ? potentialLossMaunds * assumedPricePkrPerMaund : null);

      const rangeLowerRaw = Number(economic?.expected_savings_range_pkr_per_acre?.lower);
      const rangeUpperRaw = Number(economic?.expected_savings_range_pkr_per_acre?.upper);
      const rangeLower = Number.isFinite(rangeLowerRaw)
        ? rangeLowerRaw
        : (Number.isFinite(expectedLossPkr) ? Math.max(0, expectedLossPkr * 0.8 - 1200) : null);
      const rangeUpper = Number.isFinite(rangeUpperRaw)
        ? rangeUpperRaw
        : (Number.isFinite(expectedLossPkr) ? Math.max(0, expectedLossPkr * 1.2 + 1200) : null);
      const showZeroLoss = Number.isFinite(expectedLossPkr) && expectedLossPkr <= 0;
      const actionWindow = fr?.quick_actions?.[0]?.timing || tr('Within 24-48 hours', '24-48 گھنٹوں میں');

      const formatPkr = (val) => {
        if (!Number.isFinite(Number(val))) return tr('Unavailable', 'دستیاب نہیں');
        return `PKR ${Math.round(Number(val)).toLocaleString('en-PK')}`;
      };

      return (
        <div className="sat-field-report">
          <div className="sat-field-report-head">
            <div>
              <div className="sat-report-label">{displayLabel}</div>
            </div>
            <div className={`sat-risk-badge risk-${String(displayRisk).toLowerCase()}`}>
              {displayRisk} {tr('Risk', 'خطرہ')}
            </div>
          </div>

          <p className="sat-report-summary-text">
            {simplifyFarmerText(String(fr.status_summary || '')
              .replace(/Critical field stress detected\s*[—-]?\s*immediate irrigation advisory required\.?/gi, '')
              .replace(/Prioritise the immediate actions below\.?/gi, '')
              .trim()) || tr('Focus on priority actions to stabilize field condition.', 'فیلڈ کی حالت بہتر رکھنے کے لیے اہم اقدامات پر توجہ دیں۔')}
          </p>

          <div className="sat-report-highlights">
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('Estimated Yield', 'متوقع پیداوار')}</span>
              <span className="sat-yield-val">{fr.estimated_yield?.maunds_per_acre} maund/acre</span>
            </div>
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('Field vs District', 'کھیت بمقابلہ ضلع')}</span>
              <span className="sat-yield-val">{fr.benchmarking?.district_percentile}th percentile</span>
            </div>
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('Potential Loss', 'متوقع نقصان')}</span>
              <span className="sat-yield-val" style={{ color: potentialLoss > 3 ? '#f59e0b' : '#10b981' }}>
                {Number.isFinite(potentialLoss) ? `${potentialLoss.toFixed(1)} maunds` : tr('Unavailable', 'دستیاب نہیں')}
              </span>
            </div>
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('Before Action (PKR/acre)', 'ایکشن سے پہلے (PKR/acre)')}</span>
              <span className="sat-yield-val" style={{ color: Number.isFinite(expectedLossPkr) && expectedLossPkr > 0 ? '#ef4444' : '#10b981' }}>
                {Number.isFinite(expectedLossPkr)
                  ? (expectedLossPkr > 0 ? `-${formatPkr(expectedLossPkr).replace('PKR ', '')}` : 'PKR 0')
                  : tr('Unavailable', 'دستیاب نہیں')}
              </span>
            </div>
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('After Action (PKR/acre)', 'ایکشن کے بعد (PKR/acre)')}</span>
              <span className="sat-yield-val" style={{ color: '#10b981', fontSize: '0.9rem' }}>
                {showZeroLoss
                  ? 'PKR 0 to PKR 0'
                  : `+${formatPkr(rangeLower).replace('PKR ', '')} to +${formatPkr(rangeUpper).replace('PKR ', '')}`}
              </span>
            </div>
            <div className="sat-report-highlight-card">
              <span className="sat-yield-lbl">{tr('Action Window', 'ایکشن ونڈو')}</span>
              <span className="sat-yield-val" style={{ fontSize: '0.9rem' }}>
                {actionWindow}
              </span>
            </div>
          </div>

        </div>
      );
    };

    // ─── Rich recommendation card ───────────────────────────────────────────────
  const CAT_ICONS = { water: '', nutrients: '', disease: '', structural: '', monitoring: '', management: '' };

  const getFarmerFriendlyWhy = (rec) => {
    const type = String(rec?.type || '').toLowerCase();
    const category = String(rec?.category || '').toLowerCase();

    if (type.includes('irrigation') || category === 'water') {
      return {
        why: 'Your field is showing moisture stress right now, so timely watering can prevent avoidable loss.',
        benefit: 'Acting in the recommended window helps protect yield and keeps crop growth stable.',
        check: 'After irrigation, recheck weak patches in 2-3 days to confirm recovery.',
      };
    }

    if (type.includes('nitrogen') || type.includes('zinc') || type.includes('nutrient') || category === 'nutrients') {
      return {
        why: 'Crop color and growth signals suggest nutrition is not fully meeting plant demand.',
        benefit: 'Correcting nutrients now supports healthier leaves, stronger tillers, and better yield potential.',
        check: 'Look for greener canopy and improved uniformity in the coming week.',
      };
    }

    if (type.includes('disease') || type.includes('pest') || category === 'disease') {
      return {
        why: 'Current field conditions can increase risk of disease or pest spread if not checked early.',
        benefit: 'Early scouting and threshold-based action can avoid larger loss and unnecessary spray cost.',
        check: 'Inspect lower and middle canopy spots first, then decide treatment only if needed.',
      };
    }

    if (type.includes('weed') || category === 'management') {
      return {
        why: 'Competition from weeds or weak field management timing can reduce crop performance.',
        benefit: 'Timely management helps the crop use water and nutrients more efficiently.',
        check: 'Review field patches with weak stand and repeat check after the action window.',
      };
    }

    return {
      why: 'This step is suggested because current field signals show a practical opportunity to reduce stress.',
      benefit: 'Following it on time can protect yield and reduce avoidable cost this season.',
      check: 'Recheck your field after the suggested window and compare patch condition.',
    };
  };

  const farmerFriendlyType = (type, category) => {
    const t = String(type || '').toLowerCase();
    const c = String(category || '').toLowerCase();
    if (t.includes('irrigation') || c === 'water') return tr('Watering Step', 'آبپاشی مرحلہ');
    if (t.includes('nitrogen') || t.includes('urea') || c === 'nutrients') return tr('Fertilizer Step', 'کھاد مرحلہ');
    if (t.includes('zinc') || t.includes('boron') || t.includes('sulfur')) return tr('Micronutrient Step', 'خرد غذائی مرحلہ');
    if (t.includes('disease') || t.includes('pest') || c === 'disease') return tr('Pest/Disease Check', 'کیڑا/بیماری چیک');
    if (t.includes('weed')) return tr('Weed Control Step', 'جڑی بوٹی کنٹرول مرحلہ');
    return tr('Field Action', 'کھیتی اقدام');
  };

  const simplifyUrgency = (value) => {
    const source = String(value || '').trim();
    const raw = source.toLowerCase();

    const dayRangeMatch = source.match(/days?\s*(\d+)\s*[-–to]+\s*(\d+)/i);
    if (dayRangeMatch) {
      const start = Number(dayRangeMatch[1]);
      const end = Number(dayRangeMatch[2]);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        return language === 'ur'
          ? `آج سے ${start}-${end} دن بعد`
          : `After ${start}-${end} days from today`;
      }
    }

    const singleDayMatch = source.match(/(?:after|in)\s*(\d+)\s*days?/i);
    if (singleDayMatch) {
      const days = Number(singleDayMatch[1]);
      if (Number.isFinite(days)) {
        return language === 'ur'
          ? `آج سے ${days} دن بعد`
          : `After ${days} days from today`;
      }
    }

    if (raw.includes('24') || raw.includes('critical')) return tr('Do today', 'آج کریں');
    if (raw.includes('48') || raw.includes('high')) return tr('Do in 1-2 days', '1-2 دن میں کریں');
    if (raw.includes('3') || raw.includes('moderate')) return tr('Do in 3-5 days', '3-5 دن میں کریں');
    return tr('Do this week', 'اس ہفتے کریں');
  };

  const normalizeRelativeWindow = (value) => {
    const source = String(value || '').trim();
    if (!source) return tr('This week', 'اس ہفتے');

    const rangeMatch = source.match(/days?\s*(\d+)\s*[-–to]+\s*(\d+)/i);
    if (rangeMatch) {
      return language === 'ur'
        ? `آج سے ${rangeMatch[1]}-${rangeMatch[2]} دن بعد`
        : `After ${rangeMatch[1]}-${rangeMatch[2]} days from today`;
    }

    const dayMatch = source.match(/days?\s*(\d+)/i);
    if (dayMatch) {
      return language === 'ur'
        ? `آج سے ${dayMatch[1]} دن بعد`
        : `After ${dayMatch[1]} days from today`;
    }

    return source;
  };

  const farmerizeText = (value) => {
    const text = String(value || '');
    return text
      .replace(/Alkaline reaction[^.]*\.?/gi, '')
      .replace(/and\/or low organic carbon[^.]*\.?/gi, '')
      .replace(/NDWI|EVI|GNDVI|NDRE|SAVI/gi, 'field signal')
      .replace(/chlorophyll/gi, 'leaf color')
      .replace(/foliar/gi, 'leaf')
      .replace(/top-dress|topdress/gi, 'top-up fertilizer')
      .replace(/percentile/gi, 'position')
      .replace(/\bdS\/?m\b/gi, 'salinity level')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const shortenText = (text, max = 95) => {
    const raw = String(text || '').trim();
    if (!raw) return '';
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max).trim()}...`;
  };

  // ─── Simple Irrigation Plan (farmer-friendly) ─────────────────────────────
  const buildIrrigationSchedule = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const weather = analysisResult?.weather_context || {};
    const indices = analysisResult?.indices || {};
    const fieldReport = analysisResult?.field_report || {};
    const summaryIrrigation = analysisResult?.farmer_summary?.irrigation || {};

    const clay = Number(soilContext.clay) || 25;
    const ndwi = Number(indices.ndwi) || 0;
    const rain48h = Number(weather.rain_next_48h) || 0;
    const hotDays = Number(weather.hot_days) || 0;
    const growthStage = fieldReport?.growth_stage || 'Stem Elongation';

    let intervalDays = 6;
    if (clay < 18) intervalDays = 4;
    if (clay > 35) intervalDays = 8;

    const mmLowFromModel = Number(summaryIrrigation?.mm_low);
    const mmHighFromModel = Number(summaryIrrigation?.mm_high);

    let baseMm = 28;
    if (Number.isFinite(mmLowFromModel) && Number.isFinite(mmHighFromModel)) {
      baseMm = Math.round((mmLowFromModel + mmHighFromModel) / 2);
    } else if (ndwi < -0.15) {
      baseMm = 36;
    } else if (ndwi < -0.08) {
      baseMm = 32;
    } else if (ndwi > 0.05) {
      baseMm = 20;
    }

    if (hotDays >= 2) baseMm += 3;
    if (rain48h >= 10) baseMm = Math.max(16, baseMm - 8);

    const firstTiming = rain48h >= 12
      ? tr('After 2 days', '2 دن بعد')
      : (summaryIrrigation?.timing_window || tr('Today', 'آج'));
    const firstAction = rain48h >= 12
      ? tr(`Wait for rain, then irrigate ${baseMm} mm`, `بارش کے بعد ${baseMm} ملی میٹر آبپاشی کریں`)
      : tr(`Irrigate ${baseMm} mm`, `${baseMm} ملی میٹر آبپاشی کریں`);

    const plan = [
      {
        dayLabel: tr('Step 1', 'مرحلہ 1'),
        when: firstTiming,
        action: firstAction,
        reason: rain48h >= 12
          ? tr('Heavy rain is expected. Save water and irrigate after rain.', 'زیادہ بارش متوقع ہے۔ پانی بچائیں اور بارش کے بعد آبپاشی کریں۔')
          : tr('Crop needs water now to avoid stress.', 'فصل کو اسٹریس سے بچانے کے لیے ابھی پانی درکار ہے۔'),
      },
      {
        dayLabel: tr('Step 2', 'مرحلہ 2'),
        when: tr(`${intervalDays} days later`, `${intervalDays} دن بعد`),
        action: tr(`Irrigate ${Math.max(18, baseMm - 4)} mm`, `${Math.max(18, baseMm - 4)} ملی میٹر آبپاشی کریں`),
        reason: clay < 18
          ? tr('Your soil drains quickly, so irrigate sooner.', 'آپ کی مٹی جلد خشک ہوتی ہے، اس لیے جلد آبپاشی کریں۔')
          : tr('Second watering keeps moisture stable.', 'دوسری آبپاشی نمی کو متوازن رکھتی ہے۔'),
      },
      {
        dayLabel: tr('Step 3', 'مرحلہ 3'),
        when: tr(`${intervalDays * 2} days later`, `${intervalDays * 2} دن بعد`),
        action: tr(`Irrigate ${Math.max(16, baseMm - 6)} mm if soil is dry`, `اگر مٹی خشک ہو تو ${Math.max(16, baseMm - 6)} ملی میٹر آبپاشی کریں`),
        reason: tr('Check soil by hand. If dry at root depth, irrigate.', 'ہاتھ سے مٹی چیک کریں۔ جڑ کی سطح خشک ہو تو آبپاشی کریں۔'),
      },
    ];

    const soilNote = clay < 18
      ? tr('Sandy soil: use less water each time but irrigate more often.', 'ریتلی مٹی: ہر بار کم پانی دیں مگر وقفہ کم رکھیں۔')
      : clay > 35
        ? tr('Heavy soil: irrigate less often and avoid water standing in field.', 'بھاری مٹی: کم بار آبپاشی کریں اور پانی کھڑا نہ ہونے دیں۔')
        : tr('Loam soil: follow the plan and adjust after rainfall.', 'میراں مٹی: پلان پر عمل کریں اور بارش کے بعد ایڈجسٹ کریں۔');

    return { plan, clay, growthStage, rain48h, soilNote };
  };

  const IrrigationSchedulePanel = ({ analysisResult }) => {
    if (!analysisResult) return null;

    const { plan, clay, growthStage, rain48h, soilNote } = buildIrrigationSchedule(analysisResult);

    return (
      <section className="sat-irrigation-schedule-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Simple Irrigation Plan', 'سادہ آبپاشی پلان')}</h3>
            <div className="sat-irr-subtitle">
              {tr('Easy plan for this field', 'اس کھیت کے لیے آسان پلان')} ({growthStage})
            </div>
          </div>
          <div className="sat-irr-meta">{tr('Clay', 'چکنی مٹی')}: {clay.toFixed(0)}%</div>
        </div>

        <div className="sat-irr-quick-actions">
          {plan.map((item, idx) => (
            <div key={`irr-step-${idx}`} className={`sat-irr-card ${idx === 0 ? 'critical' : ''}`}>
              <div className="sat-irr-day">{item.dayLabel}</div>
              <div className="sat-irr-action">{item.when}</div>
              <div className="sat-irr-amount">{item.action}</div>
              <div className="sat-irr-note">{item.reason}</div>
            </div>
          ))}
        </div>

        <div className="sat-irr-tips">
          <div className="sat-irr-tip-item">
            <strong className="sat-field-note-strong">{tr('Field note:', 'فیلڈ نوٹ:')}</strong> <span className="sat-field-note-strong">{tr('If rain is above 10 mm, skip irrigation that day.', 'اگر بارش 10 ملی میٹر سے زیادہ ہو تو اس دن آبپاشی نہ کریں۔')} {soilNote} {tr('Next 48h rain is about', 'اگلے 48 گھنٹوں میں بارش تقریباً')} {rain48h.toFixed(0)} mm.</span>
          </div>
        </div>
      </section>
    );
  };

  const buildFertilizerTimingGuidance = (analysisResult) => {
    const weather = analysisResult?.weather_context || {};
    const field = analysisResult?.field_report || {};
    const rain48h = Number(weather?.rain_next_48h || 0);
    const humidity = Number(weather?.avg_humidity || 55);
    const wind = Number(weather?.avg_wind_speed || 3);
    const stage = field?.growth_stage || 'Stem Elongation';

    let timingWindow = tr('Apply in late afternoon/evening within 24 hours', '24 گھنٹوں میں شام کے وقت استعمال کریں');
    let caution = tr('Do not apply immediately before rainfall.', 'بارش سے پہلے فوری طور پر کھاد نہ دیں۔');
    let splitPlan = tr('Use split dose: 60% now, 40% after 5-7 days.', 'تقسیم شدہ خوراک دیں: 60% اب، 40% پانچ تا سات دن بعد۔');

    if (rain48h >= 8) {
      timingWindow = tr('Delay fertilizer for 24-48 hours after rain', 'بارش کے بعد 24-48 گھنٹے کھاد مؤخر کریں');
      caution = tr('Nutrient washout risk is high due to expected rainfall.', 'متوقع بارش کی وجہ سے غذائی اجزا بہنے کا خطرہ زیادہ ہے۔');
    } else if (humidity >= 75 && wind <= 2) {
      timingWindow = tr('Apply early morning for better foliar uptake', 'بہتر جذب کے لیے صبح سویرے استعمال کریں');
      caution = tr('Avoid thick spray layers in high humidity.', 'زیادہ نمی میں گاڑھا اسپرے نہ کریں۔');
    } else if (wind >= 6) {
      timingWindow = tr('Apply when wind drops below 4 m/s', 'ہوا 4 m/s سے کم ہونے پر استعمال کریں');
      caution = tr('High wind can cause uneven fertilizer/spray distribution.', 'تیز ہوا سے کھاد یا اسپرے یکساں نہیں لگتا۔');
    }

    if (String(stage).toLowerCase().includes('grain')) {
      splitPlan = tr('Use lighter top-up dose only; avoid heavy nitrogen at grain fill.', 'ہلکی اضافی خوراک دیں؛ دانہ بھرنے کے مرحلے میں زیادہ نائٹروجن سے گریز کریں۔');
    }

    return { timingWindow, caution, splitPlan };
  };

  const buildStageChecklist = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const weather = analysisResult?.weather_context || {};
    const stage = analysisResult?.field_report?.growth_stage || analysisResult?.farmer_summary?.growth_stage || 'Stem Elongation';
    const crop = String(analysisResult?.crop || selectedCrop || 'Wheat');
    const district = soilContext?.district || selectedCity || 'Your district';
    const nPct = Number(soilContext?.nitrogen);
    const pH = Number(soilContext?.ph);
    const clay = Number(soilContext?.clay);
    const rain48h = Number(weather?.rain_next_48h || 0);
    const stageLower = String(stage).toLowerCase();

    const tasks = [];

    if (crop.toLowerCase() === 'cotton') {
      if (stageLower.includes('squar') || stageLower.includes('veget') || stageLower.includes('seed')) {
        tasks.push({ window: 'This week', task: 'Scout cotton twice for whitefly and jassid on underside of top leaves.' });
        tasks.push({ window: 'This week', task: 'Keep rows weed-free to reduce sucking pest shelter before flowering.' });
      } else if (stageLower.includes('flower') || stageLower.includes('boll')) {
        tasks.push({ window: 'Every 2-3 days', task: 'Inspect 20 plants for pink bollworm, whitefly, and jassid in flowering/boll zones.' });
        tasks.push({ window: 'Before spray', task: 'Spray only in low-wind evening windows and avoid application before rain.' });
      } else if (stageLower.includes('matur') || stageLower.includes('pick') || stageLower.includes('open')) {
        tasks.push({ window: 'This week', task: 'Plan clean and timely picking rounds to protect lint quality.' });
        tasks.push({ window: 'After rain/irrigation', task: 'Check late regrowth and avoid extra nitrogen near picking stage.' });
      } else {
        tasks.push({ window: 'This week', task: 'Walk cotton field every 2-3 days and mark weak canopy patches.' });
        tasks.push({ window: 'This week', task: 'Inspect top and middle leaves for early sucking pest pressure.' });
      }
    } else {
      if (stageLower.includes('tiller')) {
        tasks.push({ window: 'This week', task: 'Walk your field 2 times and remove visible weeds early.' });
        tasks.push({ window: 'This week', task: 'Check stem base in weak patches for early pest attack.' });
      } else if (stageLower.includes('head') || stageLower.includes('flower')) {
        tasks.push({ window: 'This week', task: 'Check top leaves 2 times for rust spots (orange/yellow powder).' });
        tasks.push({ window: 'Before spray', task: 'Do not spray if rain or strong wind is expected the same day.' });
      } else if (stageLower.includes('grain')) {
        tasks.push({ window: 'This week', task: 'Keep moisture even and avoid long dry gaps.' });
        tasks.push({ window: 'After wind/rain', task: 'Check leaning plants and support weak patches quickly.' });
      } else {
        tasks.push({ window: 'This week', task: 'Walk the field every 2-3 days and mark weak patches.' });
        tasks.push({ window: 'This week', task: 'Watch for sudden yellowing and uneven growth.' });
      }
    }

    if (Number.isFinite(nPct) && nPct < 0.45) {
      tasks.push({ window: 'At next watering', task: 'Use split urea dose because nitrogen level is low.' });
    }
    if (Number.isFinite(pH) && (pH < 6.0 || pH > 7.8)) {
      tasks.push({ window: 'This week', task: 'Plan a light zinc/boron support dose for better plant uptake.' });
    }
    if (Number.isFinite(clay) && clay < 18) {
      tasks.push({ window: 'At each watering', task: 'Give smaller water amounts more often because soil dries fast.' });
    }
    if (rain48h >= 10) {
      tasks.push({ window: 'Next 2 days', task: 'Wait until rain passes before fertilizer or spray.' });
    }

    return {
      district,
      stage,
      items: tasks.slice(0, 5),
    };
  };

  // ─── District Fertilizer Dosing (kg/acre + PKR) ───────────────────────────
  const buildFertilizerPlan = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const soilModelAnalysis = analysisResult?.soil_analysis?.analysis || {};
    const fieldReport = analysisResult?.field_report || {};

    const district = soilContext?.district || analysisResult?.soil_analysis?.location?.district || selectedCity || 'Your district';
    const stage = fieldReport?.growth_stage || 'Stem Elongation';
    const nPct = Number(soilContext?.nitrogen);
    const pH = Number(soilContext?.ph);
    const limitationText = `${soilContext?.key_limitation || ''} ${(soilModelAnalysis?.limitations || []).join(' ')}`.toLowerCase();
    const phosphorusRisk = limitationText.includes('phosph') || (Number.isFinite(pH) && pH < 6.2);

    const stageDose = {
      Germination: { urea: 10, dap: 18 },
      Tillering: { urea: 24, dap: 16 },
      'Stem Elongation': { urea: 20, dap: 12 },
      'Heading/Flowering': { urea: 12, dap: 6 },
      'Grain Filling': { urea: 8, dap: 0 },
      'Maturity/Post-Harvest': { urea: 0, dap: 0 },
    };

    const base = stageDose[stage] || stageDose['Stem Elongation'];
    let ureaKgAcre = base.urea;
    let dapKgAcre = base.dap;

    if (Number.isFinite(nPct) && nPct < 0.45) ureaKgAcre += 5;
    if (phosphorusRisk) dapKgAcre += 4;

    const zincKgAcre = (Number.isFinite(pH) && (pH > 7.8 || pH < 6.0)) ? 4 : 0;
    const boronKgAcre = (Number.isFinite(nPct) && nPct < 0.40) ? 0.5 : 0;

    const rates = {
      ureaPerKg: 4600 / 50,
      dapPerKg: 12500 / 50,
      zincPerKg: 9000 / 25,
      boronPerKg: 1200,
    };

    const costUrea = Math.round(ureaKgAcre * rates.ureaPerKg);
    const costDAP = Math.round(dapKgAcre * rates.dapPerKg);
    const costZinc = Math.round(zincKgAcre * rates.zincPerKg);
    const costBoron = Math.round(boronKgAcre * rates.boronPerKg);
    const totalCost = costUrea + costDAP + costZinc + costBoron;

    const products = [
      {
        label: 'Urea (N)',
        product: 'FFC Sona Urea / Pak-Arab Urea',
        dose: `${ureaKgAcre} kg/acre`,
        cost: `PKR ${costUrea.toLocaleString('en-PK')}`,
        note: 'Apply in 2 split doses with irrigation.',
      },
      {
        label: 'DAP (P)',
        product: 'Sona DAP / Engro DAP',
        dose: dapKgAcre > 0 ? `${dapKgAcre} kg/acre` : 'Not needed this stage',
        cost: dapKgAcre > 0 ? `PKR ${costDAP.toLocaleString('en-PK')}` : 'PKR 0',
        note: dapKgAcre > 0 ? 'Best at first irrigation or moist soil.' : 'Skip for now.',
      },
    ];

    if (zincKgAcre > 0) {
      products.push({
        label: 'Zinc',
        product: 'Zinc Sulphate 33%',
        dose: `${zincKgAcre} kg/acre`,
        cost: `PKR ${costZinc.toLocaleString('en-PK')}`,
        note: 'Use once in moist soil.',
      });
    }

    if (boronKgAcre > 0) {
      products.push({
        label: 'Boron',
        product: 'Boron Foliar',
        dose: `${boronKgAcre} kg/acre`,
        cost: `PKR ${costBoron.toLocaleString('en-PK')}`,
        note: 'Spray in evening, one light spray.',
      });
    }

    return {
      district,
      stage,
      nPct: Number.isFinite(nPct) ? nPct : null,
      pH: Number.isFinite(pH) ? pH : null,
      products,
      totalCost,
    };
  };

  const FertilizerDosePanel = ({ analysisResult }) => {
    if (!analysisResult?.soil_context && !analysisResult?.soil_analysis) return null;

    const plan = buildFertilizerPlan(analysisResult);
    const timing = buildFertilizerTimingGuidance(analysisResult);

    return (
      <section className="sat-irrigation-schedule-panel sat-fert-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('District Fertilizer Dose', 'ضلع وار کھاد مقدار')}</h3>
            <div className="sat-irr-subtitle">
              {plan.district} • {tr('Growth stage', 'نشوونما مرحلہ')}: {plan.stage}
            </div>
          </div>
          <div className="sat-irr-meta">{tr('Est. cost', 'تخمینی لاگت')}: PKR {plan.totalCost.toLocaleString('en-PK')}/{tr('acre', 'ایکڑ')}</div>
        </div>

        <div className="sat-fert-compact-list">
          {plan.products.map((item, idx) => (
            <div key={`fert-${idx}`} className="sat-fert-row">
              <div className="sat-fert-main">
                <div className="sat-fert-label">{item.label}</div>
                <div className="sat-fert-product">{item.product}</div>
              </div>
              <div className="sat-fert-dose">{item.dose}</div>
              <div className="sat-fert-cost">{item.cost}</div>
            </div>
          ))}
        </div>

        <div className="sat-irr-tips" style={{ marginTop: '0.8rem' }}>
          <div className="sat-irr-tip-item"><strong>{tr('Fertilizer timing:', 'کھاد ٹائمنگ:')}</strong> {timing.timingWindow}</div>
          <div className="sat-irr-tip-item"><strong>{tr('Caution:', 'احتیاط:')}</strong> {timing.caution}</div>
          <div className="sat-irr-tip-item"><strong>{tr('Split plan:', 'تقسیم پلان:')}</strong> {timing.splitPlan}</div>
        </div>

      </section>
    );
  };

  const simplifyFarmerText = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const easyEn = raw
      .replace(/immediately|as soon as possible/gi, 'now')
      .replace(/monitor|scout/gi, 'check')
      .replace(/crop\s+canopy/gi, 'crop leaves')
      .replace(/canopy/gi, 'leaves')
      .replace(/waterlogging/gi, 'standing water')
      .replace(/application/gi, 'use')
      .replace(/nutrient/gi, 'plant food')
      .replace(/mitigate|reduce risk/gi, 'avoid')
      .replace(/prioritize/gi, 'do first')
      .replace(/within\s+24\s*hours/gi, 'today')
      .replace(/within\s+48\s*hours/gi, 'in 2 days')
      .replace(/\s+/g, ' ')
      .trim();

    // Boundary-safe replacements so words don't get mixed (e.g. dبارشage, پانیing).
    const replaceByMap = (text, map) => {
      let output = text;
      map.forEach(([pattern, replacement]) => {
        output = output.replace(pattern, replacement);
      });
      return output;
    };

    const enToUr = [
      [/\bactionable\s+recommendations\b/gi, 'عملی سفارشات'],
      [/\btop\s+recommendations\b/gi, 'اہم سفارشات'],
      [/\bflag\s+leaf\s+aphid\b/gi, 'فلیگ لیف ایفڈ'],
      [/\bleaf\s+rust\b/gi, 'لیف رسٹ'],
      [/\bstripe\s+rust\b/gi, 'اسٹرائپ رسٹ'],
      [/\bpowdery\s+mildew\b/gi, 'پاؤڈری میلڈیو'],
      [/\bweek\b/gi, 'ہفتہ'],
      [/\bin\s*2\s*days\b/gi, '2 دن میں'],
      [/\btoday\b/gi, 'آج'],
      [/\bnow\b/gi, 'ابھی'],
      [/\bdo\s+first\b/gi, 'پہلے کریں'],
      [/\bcheck(?:ing)?\b/gi, 'چیک کریں'],
      [/\bwhat\s+to\s+do\b/gi, 'کیا کریں'],
      [/\bwhen\s+to\s+check\b/gi, 'کب چیک کریں'],
      [/\bcrop\s+leaves\b/gi, 'فصل کے پتے'],
      [/\bstanding\s+water\b/gi, 'کھڑا پانی'],
      [/\bplant\s+food\b/gi, 'کھاد'],
      [/\bwatering\b/gi, 'آبپاشی'],
      [/\bwater\b/gi, 'پانی'],
      [/\bcrop\b/gi, 'فصل'],
      [/\bsoil\b/gi, 'مٹی'],
      [/\bfield\b/gi, 'کھیت'],
      [/\bfertilizer\b/gi, 'کھاد'],
      [/\bpest\b/gi, 'کیڑا'],
      [/\bdisease\b/gi, 'بیماری'],
      [/\bspray\b/gi, 'اسپرے'],
      [/\bwind\b/gi, 'ہوا'],
      [/\brain\b/gi, 'بارش'],
      [/\bdrainage\b/gi, 'نکاسی'],
      [/\buse\b/gi, 'استعمال کریں'],
      [/\bavoid\b/gi, 'سے بچیں'],
      [/\bafter\b/gi, 'بعد'],
      [/\bbefore\b/gi, 'پہلے'],
      [/\bthis\s+week\b/gi, 'اس ہفتے'],
    ];

    const urToEn = [
      [/عملی\s*سفارشات/g, 'actionable recommendations'],
      [/اہم\s*سفارشات/g, 'top recommendations'],
      [/فلیگ\s*لیف\s*ایفڈ/g, 'flag leaf aphid'],
      [/لیف\s*رسٹ/g, 'leaf rust'],
      [/اسٹرائپ\s*رسٹ/g, 'stripe rust'],
      [/پاؤڈری\s*میلڈیو/g, 'powdery mildew'],
      [/ہفتہ/g, 'week'],
      [/2\s*دن\s*میں/g, 'in 2 days'],
      [/آج/g, 'today'],
      [/ابھی/g, 'now'],
      [/پہلے\s*کریں/g, 'do first'],
      [/چیک\s*کریں/g, 'check'],
      [/کیا\s*کریں/g, 'what to do'],
      [/کب\s*چیک\s*کریں/g, 'when to check'],
      [/فصل\s*کے\s*پتے/g, 'crop leaves'],
      [/کھڑا\s*پانی/g, 'standing water'],
      [/آبپاشی/g, 'watering'],
      [/پانی/g, 'water'],
      [/فصل/g, 'crop'],
      [/مٹی/g, 'soil'],
      [/کھیت/g, 'field'],
      [/کھاد/g, 'fertilizer'],
      [/کیڑا/g, 'pest'],
      [/بیماری/g, 'disease'],
      [/اسپرے/g, 'spray'],
      [/ہوا/g, 'wind'],
      [/بارش/g, 'rain'],
      [/نکاسی/g, 'drainage'],
      [/استعمال\s*کریں/g, 'use'],
      [/سے\s*بچیں/g, 'avoid'],
      [/بعد/g, 'after'],
      [/پہلے/g, 'before'],
      [/اس\s*ہفتے/g, 'this week'],
    ];

    const normalized = language === 'ur'
      ? replaceByMap(easyEn, enToUr)
      : replaceByMap(easyEn, urToEn);

    return normalized.replace(/\s+/g, ' ').trim();
  }, [language]);

  const StageChecklistPanel = ({ analysisResult }) => {
    const checklist = analysisResult?.stage_checklist || buildStageChecklist(analysisResult);
    if (!checklist?.items?.length) return null;

    return (
      <section className="sat-irrigation-schedule-panel sat-stage-checklist-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Stage Checklist', 'مرحلہ چیک لسٹ')}</h3>
            <div className="sat-irr-subtitle">
              {checklist.district} • {tr('Current stage', 'موجودہ مرحلہ')}: {checklist.stage || 'Stem Elongation'}
            </div>
          </div>
        </div>

        <div className="sat-task-list">
          <div className="sat-task-list-header">{tr('Action items for this stage', 'اس مرحلے کے ایکشن آئٹمز')}</div>
          {checklist.items.map((item, idx) => (
            <div key={`stage-task-${idx}`} className="sat-task-item">
              <div className="sat-task-header sat-task-header-static">
                <div className="sat-task-timing">{tr('When', 'کب')}: {simplifyFarmerText(normalizeRelativeWindow(item.window))}</div>
                <div className="sat-task-title">{tr('What to do', 'کیا کرنا ہے')}: {simplifyFarmerText(item.task)}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // ─── Micronutrient Builder ─────────────────────────────────────────────────
  const buildMicronutrientPlan = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const weather = analysisResult?.weather_context || {};
    const indices = analysisResult?.indices || {};
    const stage = analysisResult?.field_report?.growth_stage || 'Stem Elongation';

    const pH = Number(soilContext?.ph) || 7.0;
    const ec = Number(soilContext?.ec) || 1.5;
    const clay = Number(soilContext?.clay) || 25;
    const evi = Number(indices?.evi) || 0.3;
    const ndvi = Number(indices?.ndvi) || 0.5;
    const ndwi = Number(indices?.ndwi) || -0.05;

    const micronutrients = [];
    const costRates = { zinc: 360, boron: 24, manganese: 280, iron: 320 };

    // Zinc: acidic soils, low EVI
    if ((pH < 6.2 || pH > 8.2) && evi < 0.28) {
      micronutrients.push({
        name: 'Zinc Sulphate 33%',
        trigger: `pH ${pH.toFixed(2)} + weak vigor (EVI ${evi.toFixed(3)})`,
        dose: clay < 20 ? '3 kg/acre' : '4 kg/acre',
        cost: clay < 20 ? 1080 : 1440,
        timing: 'Next 5 days, moist soil',
        note: 'Fixes leaf yellowing and improves root uptake',
      });
    }

    // Boron: alkaline soils, high EC
    if ((pH > 7.8 || ec > 2.5) && ndvi < 0.55) {
      micronutrients.push({
        name: 'Boron Foliar Spray',
        trigger: `pH ${pH.toFixed(2)} / EC ${ec.toFixed(2)} dS/m + growth lag`,
        dose: '0.5 kg/acre',
        cost: 12,
        timing: 'Evening spray, repeat if needed',
        note: 'Supports flower/seed set and reduces stress under high pH',
      });
    }

    // Manganese: sandy acidic soils
    if (clay < 15 && pH < 6.0 && evi < 0.32) {
      micronutrients.push({
        name: 'Manganese Sulphate',
        trigger: `Low clay (${clay.toFixed(1)}%) + acidic pH (${pH.toFixed(2)}) + weak vigor`,
        dose: '2 kg/acre',
        cost: 560,
        timing: 'With first split urea dose',
        note: 'Quick leaf-color recovery, especially in early season',
      });
    }

    // Iron: high pH, low NDVI
    if (pH > 7.9 && ndvi < 0.45) {
      micronutrients.push({
        name: 'Iron Chelate Spray',
        trigger: `Very high pH (${pH.toFixed(2)}) + weak canopy (NDVI ${ndvi.toFixed(3)})`,
        dose: 'Foliar spray, 1% solution',
        cost: 320,
        timing: 'Two sprays, 7 days apart',
        note: 'Corrects interveinal chlorosis from pH lock-up',
      });
    }

    // Stress-response: high salt + dry
    if (ec > 3.0 && ndwi < -0.1) {
      micronutrients.push({
        name: 'Kaolin Foliar + Biostimulant',
        trigger: `High salinity (EC ${ec.toFixed(2)}) + water stress (NDWI ${ndwi.toFixed(3)})`,
        dose: 'Spray once, 2 liters/acre',
        cost: 450,
        timing: 'Before next heat window, evening application',
        note: 'Protects leaves from salt burn and heat stress',
      });
    }

    if (micronutrients.length === 0) {
      micronutrients.push({
        name: 'Routine Monitoring',
        trigger: 'Soil and satellite signals are balanced',
        dose: 'No urgent micronutrient dose needed now',
        cost: 0,
        timing: 'Recheck after 7 days or after the next irrigation',
        note: 'Keep the current fertilizer plan and monitor leaf color and growth patches',
      });
    }

    return {
      district: soilContext?.district || selectedCity || 'Your district',
      stage,
      items: micronutrients,
      totalCost: micronutrients.reduce((sum, m) => sum + Number(m.cost || 0), 0),
    };
  };

  // ─── ROI Justification ──────────────────────────────────────────────────────
  const buildROIJustification = (analysisResult) => {
    const fr = analysisResult?.field_report || {};
    const economicData = fr?.economic_impact || {};
    const lossData = fr?.estimated_yield || {};
    
    const potentialLossMaunds = Number(lossData?.potential_loss_maunds || 0);
    const pricePerMaundByCrop = {
      wheat: 3900,
      cotton: 8500,
      maize: 2800,
      rice: 5200,
      sugarcane: 450,
    };
    const cropKey = String(selectedCrop || analysisResult?.crop || 'wheat').toLowerCase();
    const pricePerMaund = pricePerMaundByCrop[cropKey] || 3900;
    const expectedLossRaw = Number(economicData?.expected_loss_pkr_per_acre);
    const expectedLossPKR = Number.isFinite(expectedLossRaw)
      ? Math.max(0, expectedLossRaw)
      : Math.max(0, potentialLossMaunds * pricePerMaund);
    
    const baseInterventionCost = 2500; // labor + sprays baseline
    const fertilizerDose = buildFertilizerPlan(analysisResult);
    const microPlan = buildMicronutrientPlan(analysisResult);

    const grossInterventionCost = baseInterventionCost + fertilizerDose.totalCost + microPlan.totalCost;
    const hasLossSignal = expectedLossPKR > 0 || potentialLossMaunds > 0;
    const totalInterventionCost = hasLossSignal ? grossInterventionCost : 0;
    const safetyMargin = expectedLossPKR > 0 ? Math.round(expectedLossPKR * 0.8) : 0;
    const netBenefit = expectedLossPKR - totalInterventionCost;
    
    const recommendations = [
      {
        title: 'Potential Loss If Untreated',
        value: `PKR ${Math.round(expectedLossPKR).toLocaleString('en-PK')}/acre`,
        color: 'critical',
        detail: `${potentialLossMaunds.toFixed(1)} maunds loss × PKR ${pricePerMaund}/maund`,
      },
      {
        title: 'Cost of Intervention',
        value: `PKR ${Math.round(totalInterventionCost).toLocaleString('en-PK')}/acre`,
        color: 'neutral',
        detail: hasLossSignal
          ? 'Labor + fertilizer + micronutrients + labor'
          : 'No immediate intervention recommended when avoidable loss is zero',
      },
      {
        title: 'Net Economic Benefit',
        value: netBenefit > 0
          ? `+ PKR ${Math.round(netBenefit).toLocaleString('en-PK')}/acre`
          : `- PKR ${Math.abs(Math.round(netBenefit)).toLocaleString('en-PK')}/acre`,
        color: netBenefit > 0 ? 'positive' : 'caution',
        detail: !hasLossSignal
          ? 'No economic loss detected; monitor and rescan before spending'
          : (netBenefit > 0
            ? 'Worth intervening if this analysis is correct'
            : 'Marginal benefit; focus on critical issues only'),
      },
    ];

    return {
      district: analysisResult?.soil_context?.district || selectedCity,
      expectedLoss: expectedLossPKR,
      interventionCost: totalInterventionCost,
      netBenefit,
      safetyMargin,
      recommendations,
      actionAlert: !hasLossSignal
        ? 'No intervention needed right now; continue monitoring'
        : netBenefit > safetyMargin
        ? 'Strong case for full intervention'
        : netBenefit > 0
          ? 'Intervention recommended with focus on critical items'
          : 'Focus on highest-impact actions only',
    };
  };

  // ─── Pest / Disease Calendar ────────────────────────────────────────────────
  const buildPestDiseaseCalendar = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const weather = analysisResult?.weather_context || {};
    const weatherSummary = weather?.summary || {};
    const indices = analysisResult?.indices || {};
    const stage = analysisResult?.growth_stage?.name || analysisResult?.field_report?.growth_stage || 'Vegetative Growth';
    const crop = String(analysisResult?.crop || selectedCrop || 'Wheat').replace(/^./, (s) => s.toUpperCase());
    const district = soilContext?.district || selectedCity || 'Your district';

    const humidity = Number(weather?.avg_humidity ?? weatherSummary?.avg_humidity ?? 55);
    const tempMin = Number(weather?.temp_min ?? weatherSummary?.min_temperature ?? 18);
    const tempMax = Number(weather?.temp_max ?? weatherSummary?.max_temperature ?? 34);
    const rain48h = Number(weather?.rain_next_48h ?? weatherSummary?.rain_next_48h ?? 0);
    const evi = Number(indices?.evi || 0.3);
    const stageLower = String(stage).toLowerCase();

    const calendar = [];

    if (String(crop).toLowerCase() === 'cotton') {
      if (stageLower.includes('squar') || stageLower.includes('veget') || stageLower.includes('seed')) {
        calendar.push({
          week: 'After 0-3 days',
          stage: 'Vegetative-Squaring',
          risks: [
            {
              pest: 'Jassid',
              condition: `Warm weather (${tempMin}-${tempMax}°C) with tender top leaves`,
              riskLevel: tempMax >= 32 ? 'high' : 'low',
              action: 'Inspect top 3 leaves from 20 plants. If curling/yellow edges are common, start targeted control in affected blocks.',
            },
            {
              pest: 'Thrips',
              condition: `Hot and dry window with low rain (${rain48h.toFixed(0)} mm next 48h)`,
              riskLevel: rain48h < 4 && tempMax >= 34 ? 'high' : 'low',
              action: 'Check silvering on young leaves; treat hotspots first instead of blanket sprays.',
            },
          ],
        });
      }

      if (stageLower.includes('flower') || stageLower.includes('boll')) {
        calendar.push({
          week: 'After 3-7 days',
          stage: 'Flowering-Boll Formation',
          risks: [
            {
              pest: 'Whitefly',
              condition: `Humidity ${humidity.toFixed(0)}% with dense canopy`,
              riskLevel: humidity >= 65 ? 'high' : 'low',
              action: 'Check underside of middle canopy leaves. If pressure rises across sampling points, apply recommended whitefly control.',
            },
            {
              pest: 'Pink Bollworm',
              condition: 'Square/flower shedding or rosette flowers in flowering blocks',
              riskLevel: 'high',
              action: 'Inspect flowers and green bolls at 5 spots. Remove damaged fruiting bodies and follow threshold-based local control advisory.',
            },
            {
              pest: 'Leaf Spot / Blight',
              condition: `Humid spell and intermittent rain (${rain48h.toFixed(0)} mm)`,
              riskLevel: humidity >= 70 || rain48h >= 6 ? 'high' : 'low',
              action: 'Scout lower and middle canopy for lesions, keep canopy aerated, and avoid late-evening overhead wetting.',
            },
          ],
        });
      }

      if (stageLower.includes('matur') || stageLower.includes('pick') || stageLower.includes('open')) {
        calendar.push({
          week: 'After 7-12 days',
          stage: 'Boll Opening-Picking',
          risks: [
            {
              pest: 'Late Whitefly / Honeydew',
              condition: 'Sticky lint risk near picking stage',
              riskLevel: humidity >= 60 ? 'high' : 'low',
              action: 'Keep picking timely and clean. Manage late whitefly pockets quickly to protect lint quality.',
            },
            {
              pest: 'Boll Rot',
              condition: 'High humidity and prolonged wet canopy',
              riskLevel: humidity >= 75 || rain48h >= 8 ? 'high' : 'low',
              action: 'Improve airflow and drainage, avoid unnecessary late irrigation, and pick wetter sections first.',
            },
          ],
        });
      }

      if (evi < 0.25) {
        calendar.push({
          week: 'After 1-3 days',
          stage: 'Monitoring Alert',
          risks: [
            {
              pest: 'Weak cotton canopy',
              condition: 'Satellite vigor is low and boll retention can decline under stress',
              riskLevel: 'low',
              action: 'Prioritize weak patches for pest scouting and irrigation/nutrition correction before full-field intervention.',
            },
          ],
        });
      }

      return {
        crop,
        district,
        stage,
        humidity,
        tempMinMax: `${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°C`,
        calendar,
      };
    }

    if (String(crop).toLowerCase() === 'rice') {
      if (stageLower.includes('nursery') || stageLower.includes('transplant') || stageLower.includes('tiller')) {
        calendar.push({
          week: 'After 0-3 days',
          stage: 'Nursery-Transplant / Tillering',
          risks: [
            {
              pest: 'Stem Borer',
              condition: `Warm rice window (${tempMin}-${tempMax}°C) with fresh tillers`,
              riskLevel: tempMax >= 30 ? 'high' : 'low',
              action: 'Inspect dead-heart symptoms in 5 spots. If threshold is crossed, apply district-recommended rice stem borer control only in affected blocks.',
            },
            {
              pest: 'Leaf Folder',
              condition: `Humid conditions (${humidity.toFixed(0)}%) with dense young leaves`,
              riskLevel: humidity >= 65 ? 'high' : 'low',
              action: 'Open folded leaves in sampled plants. If active larvae are common, do threshold-based spot treatment first.',
            },
          ],
        });
      }

      if (stageLower.includes('panicle') || stageLower.includes('flower') || stageLower.includes('grain') || stageLower.includes('maturity')) {
        calendar.push({
          week: 'After 3-7 days',
          stage: 'Panicle-Flowering / Grain Filling',
          risks: [
            {
              pest: 'Rice Blast',
              condition: `Humid spell (${humidity.toFixed(0)}%) and wet canopy`,
              riskLevel: humidity >= 70 || rain48h >= 6 ? 'high' : 'low',
              action: 'Scout leaf and neck blast symptoms in representative patches. If spread is visible, apply rice blast control as per local advisory.',
            },
            {
              pest: 'Brown Planthopper',
              condition: `Dense canopy and intermittent moisture (${rain48h.toFixed(0)} mm rain outlook)`,
              riskLevel: humidity >= 65 ? 'high' : 'low',
              action: 'Check hopper presence near plant base at multiple spots. Treat only affected areas and avoid unnecessary blanket spray.',
            },
            {
              pest: 'Bacterial Leaf Blight',
              condition: `Rain splash risk with warm weather (${tempMin}-${tempMax}°C)`,
              riskLevel: rain48h >= 6 ? 'high' : 'low',
              action: 'Inspect elongated leaf streaks, avoid excess nitrogen during active spread, and follow district recommendation if incidence increases.',
            },
          ],
        });
      }

      if (evi < 0.25) {
        calendar.push({
          week: 'After 1-3 days',
          stage: 'Monitoring Alert',
          risks: [
            {
              pest: 'Weak rice canopy',
              condition: 'Satellite signals show weak rice vigor',
              riskLevel: 'low',
              action: 'Mark weak patches and inspect those first for pests, disease, and standing-water imbalance. Treat only affected area to reduce cost.',
            },
          ],
        });
      }

      return {
        crop,
        district,
        stage,
        humidity,
        tempMinMax: `${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°C`,
        calendar,
      };
    }

    if (String(crop).toLowerCase() === 'maize') {
      if (stageLower.includes('germin') || stageLower.includes('veget')) {
        calendar.push({
          week: 'After 0-3 days',
          stage: 'Germination-Vegetative',
          risks: [
            {
              pest: 'Armyworm / Fall Armyworm',
              condition: `Warm weather (${tempMin}-${tempMax}°C) with fresh seedling growth`,
              riskLevel: tempMax >= 28 ? 'high' : 'low',
              action: 'Inspect 10 spots for chewing damage on leaves. If 5% or more plants show damage, spray Spinosad 45% at 300-400 mL/acre in evening.',
            },
            {
              pest: 'Stem Borer',
              condition: `Warm and humid window (${humidity.toFixed(0)}%)`,
              riskLevel: humidity >= 65 && tempMax >= 30 ? 'high' : 'low',
              action: 'Check 5 plants for dead-heart symptoms. If 5% incidence, apply district-recommended stem borer control in affected patches only.',
            },
            {
              pest: 'Shootfly',
              condition: `Hot and dry weather (${tempMin}-${tempMax}°C)`,
              riskLevel: tempMax >= 32 && humidity <= 50 ? 'high' : 'low',
              action: 'Look for white streak and dead-heart in leaf whorls. If > 1% plants affected, spray Carbofuran 3% or Acephate 75SP at 350-400 mL/acre.',
            },
          ],
        });
      }

      if (stageLower.includes('tassel') || stageLower.includes('anthe')) {
        calendar.push({
          week: 'After 3-7 days',
          stage: 'Tasseling-Anthesis',
          risks: [
            {
              pest: 'Fall Armyworm',
              condition: `High temperature spells (${tempMax >= 32 ? 'Yes' : 'No'}) and intermittent rainfall`,
              riskLevel: tempMax >= 32 ? 'high' : 'low',
              action: 'Scout ears and whorl for caterpillar damage. If threshold exceeded (5%-10% affected ears), apply Spinosad 45% 400 mL/acre or Emamectin Benzoate 5% SG 80 g/acre.',
            },
            {
              pest: 'Corn Silk Fly',
              condition: `Humid conditions (${humidity >= 70 ? 'High' : 'Low'}) during silk emergence`,
              riskLevel: humidity >= 70 ? 'medium' : 'low',
              action: 'Inspect silk damage near silk emergence window. If 20%+ ears show clipped silks, apply Imidacloprid 200SL 60-75 mL/acre.',
            },
            {
              pest: 'Corn Plant Bug',
              condition: 'Irregular canopy with exposed ears',
              riskLevel: 'low',
              action: 'Inspect for leaf holes and wilting tips. Only spray if damage becomes extensive and localized.',
            },
          ],
        });
      }

      if (stageLower.includes('grain') || stageLower.includes('milk') || stageLower.includes('floury')) {
        calendar.push({
          week: 'After 7-12 days',
          stage: 'Grain Filling-Maturity',
          risks: [
            {
              pest: 'Grain Borer / Weevil',
              condition: 'Late-season warm and humid days',
              riskLevel: humidity >= 65 ? 'medium' : 'low',
              action: 'Monitor for boring holes in grain. Proper drying (to 12–14% moisture) after harvest is the best control.',
            },
            {
              pest: 'Stalk Rot',
              condition: `High moisture and weak canopy vigor (EVI ${evi.toFixed(2)})`,
              riskLevel: evi < 0.22 && humidity >= 70 ? 'high' : 'low',
              action: 'Inspect lower stalks for soft rot or discoloration. Harvest timely if rot incidence is visible to avoid lodging.',
            },
            {
              pest: 'Charcoal Rot / Fusarium (late-season)',
              condition: `Humid spell with rain (${rain48h > 5 ? 'Likely' : 'Low'})`,
              riskLevel: rain48h >= 6 && humidity >= 75 ? 'high' : 'low',
              action: 'Inspect cob and grain for dark discoloration. Manage residues after harvest and rotate crops to break disease cycle next season.',
            },
          ],
        });
      }

      if (evi < 0.25) {
        calendar.push({
          week: 'After 1-3 days',
          stage: 'Monitoring Alert',
          risks: [
            {
              pest: 'Weak maize canopy',
              condition: 'Satellite signals show reduced maize vigor',
              riskLevel: 'low',
              action: 'Mark weak patches and inspect first for stem borer, moisture stress, and nitrogen deficiency. Prioritize nutrition or irrigation correction.',
            },
          ],
        });
      }

      return {
        crop,
        district,
        stage,
        humidity,
        tempMinMax: `${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°C`,
        calendar,
      };
    }

    if (String(crop).toLowerCase() === 'sugarcane') {
      if (stageLower.includes('tiller') || stageLower.includes('grand') || stageLower.includes('elong')) {
        calendar.push({
          week: 'After 0-3 days',
          stage: 'Tillering-Grand Growth',
          risks: [
            {
              pest: 'Early Shoot Borer',
              condition: `Warm sugarcane growth window (${tempMin}-${tempMax}°C) with fast vegetative growth`,
              riskLevel: tempMax >= 30 ? 'high' : 'low',
              action: 'Inspect dead-heart symptoms in 10 representative spots. If incidence rises above local threshold, do targeted control in affected rows first.',
            },
            {
              pest: 'Pyrilla / Leaf Hopper',
              condition: `Humid canopy (${humidity.toFixed(0)}%) with dense foliage`,
              riskLevel: humidity >= 65 ? 'high' : 'low',
              action: 'Check undersides of leaves in mid-canopy. If hopper colonies become frequent, apply district-recommended IPM with chemistry rotation.',
            },
          ],
        });
      }

      if (stageLower.includes('matur') || stageLower.includes('harvest')) {
        calendar.push({
          week: 'After 3-7 days',
          stage: 'Maturation-Harvest Readiness',
          risks: [
            {
              pest: 'Top Borer / Stalk Borer',
              condition: `Late-season warm-humid spell (${tempMin}-${tempMax}°C, humidity ${humidity.toFixed(0)}%)`,
              riskLevel: humidity >= 65 ? 'high' : 'low',
              action: 'Inspect top internodes and spindle for bore holes and drying tops. Prioritize hotspot blocks for control before harvest operations.',
            },
            {
              pest: 'Red Rot / Smut Hotspots',
              condition: `Moisture stress shifts and intermittent rain (${rain48h.toFixed(0)} mm outlook)`,
              riskLevel: rain48h >= 6 ? 'high' : 'low',
              action: 'Tag suspicious clumps, remove severely affected stools, and avoid moving infected trash across field sections.',
            },
          ],
        });
      }

      if (evi < 0.25) {
        calendar.push({
          week: 'After 1-3 days',
          stage: 'Monitoring Alert',
          risks: [
            {
              pest: 'Weak sugarcane canopy',
              condition: 'Satellite signals show reduced sugarcane vigor',
              riskLevel: 'low',
              action: 'Mark weak cane strips first and inspect for borer pressure, irrigation gaps, and nitrogen deficiency before whole-field intervention.',
            },
          ],
        });
      }

      return {
        crop,
        district,
        stage,
        humidity,
        tempMinMax: `${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°C`,
        calendar,
      };
    }

    // Week 1-2: Germination pests
    if (String(stage).toLowerCase().includes('tiller') || String(stage).toLowerCase().includes('germin')) {
      calendar.push({
        week: 'After 0-3 days',
        stage: 'Seedling/Tiller',
        risks: [
          {
            pest: 'Cutworms, Armyworm',
            condition: 'Early crop stage and fresh chewing damage in patches',
            riskLevel: 'high',
            action: 'Check 10 spots in field. If 1 or more larvae per square meter are found, spray Emamectin Benzoate 80 g/acre in evening with full coverage.',
          },
          {
            pest: 'Bird Damage',
            condition: 'Visible pecking at seedling rows in morning/evening',
            riskLevel: 'low',
            action: 'Use ribbon tape or reflective strips on field edges and monitor for 2 days before any further action.',
          },
        ],
      });
    }

    // Week 3-4: Tiller-stage pests
    if (String(stage).toLowerCase().includes('tiller') || String(stage).toLowerCase().includes('elonga')) {
      calendar.push({
        week: 'After 3-7 days',
        stage: 'Tillering–Early Elongation',
        risks: [
          {
            pest: 'Armyworm',
            condition: `Warm and humid weather (${tempMin}-${tempMax}°C)`,
            riskLevel: humidity >= 65 ? 'high' : 'low',
            action: 'Inspect 10 plants at 5 spots. If damage is above 10% plants or larvae present on multiple spots, spray Emamectin Benzoate 80 g/acre.',
          },
          {
            pest: 'Shoot Fly',
            condition: `Hot and dry weather (${tempMin}-${tempMax}°C)`,
            riskLevel: tempMax >= 28 && humidity <= 55 ? 'high' : 'low',
            action: 'Look for dead-heart and white streak symptoms. If 5% or more tillers are affected, apply recommended stem borer/shoot fly control from local agri office chart.',
          },
          {
            pest: 'Leaf Hopper',
            condition: 'Warm and dry days',
            riskLevel: humidity <= 55 ? 'high' : 'low',
            action: 'Check underside of 20 leaves. If hopper burn starts and insects are common on most plants, spray only affected patches first.',
          },
        ],
      });
    }

    // Week 5-7: Heading / Disease pressure
    if (String(stage).toLowerCase().includes('head') || String(stage).toLowerCase().includes('flower')) {
      calendar.push({
        week: 'After 0-2 days',
        stage: 'Heading–Grain Formation',
        risks: [
          {
            pest: 'Leaf Rust',
            condition: `Cool nights (${tempMin}°C) and high humidity`,
            riskLevel: humidity >= 70 && tempMin <= 14 ? 'high' : 'low',
            action: 'Check 20 plants. If rust pustules appear on 5% or more leaves, spray Propiconazole 200 ml/acre in 100 liters water within 24 hours.',
          },
          {
            pest: 'Stripe Rust',
            condition: `Cool weather and humidity around ${humidity}%`,
            riskLevel: tempMin < 15 && humidity >= 65 ? 'high' : 'low',
            action: tempMin < 15
              ? 'Walk field every 2 days. If stripe pattern is visible on young leaves, spray Tebuconazole 200 ml/acre immediately.'
              : 'Monitor every 3 days. No spray needed unless stripe lesions start spreading.',
          },
          {
            pest: 'Powdery Mildew',
            condition: `Mild temperature (${tempMin}-${tempMax}°C) and high humidity`,
            riskLevel: humidity > 70 ? 'high' : 'low',
            action: humidity > 70
              ? 'Inspect flag leaf zone. If white powder covers 10% leaf area, apply Sulfur or Triazole fungicide as per label.'
              : 'Low pressure now. Recheck after next humidity rise or rain event.',
          },
          {
            pest: 'Flag Leaf Aphid',
            condition: `Warm weather with low rain`,
            riskLevel: rain48h < 5 && tempMax >= 24 ? 'high' : 'low',
            action: 'Count aphids on 20 tillers. If average is 10-12 aphids per tiller, spray Imidacloprid 100 ml/acre; otherwise continue monitoring.',
          },
        ],
      });
    }

    // Week 8-10: Grain-fill pests
    if (String(stage).toLowerCase().includes('grain') || String(stage).toLowerCase().includes('milk')) {
      calendar.push({
        week: 'After 7-12 days',
        stage: 'Grain Filling–Dough',
        risks: [
          {
            pest: 'Grain Pest / Sawfly',
            condition: 'Late-season warm days',
            riskLevel: 'low',
            action: 'Check ear heads and stem cutting signs every 3 days. Avoid broad spray unless visible economic damage appears.',
          },
          {
            pest: 'Pre-Harvest Disease (esp. tan spot)',
            condition: `Late-season rain and humidity (${rain48h > 5 ? 'Possible' : 'Low'})`,
            riskLevel: rain48h > 5 ? 'high' : 'low',
            action: 'If disease reaches upper leaves before hard dough stage, do one protective fungicide spray; skip spray close to harvest window.',
          },
        ],
      });
    }

    // Add general risk summary based on soil/indices
    if (evi < 0.25) {
      calendar.push({
        week: 'After 1-3 days',
        stage: 'Monitoring Alert',
        risks: [
          {
            pest: 'Weak crop canopy',
            condition: 'Satellite signals show weak crop vigor',
            riskLevel: 'low',
            action: 'Mark weak patches and inspect those first for insects or disease. Treat only affected area to reduce cost.',
          },
        ],
      });
    }

    return {
      crop,
      district,
      stage,
      humidity,
      tempMinMax: `${tempMin.toFixed(0)}–${tempMax.toFixed(0)}°C`,
      calendar,
    };
  };

  // ─── Weather Risk (14-day forecast) ──────────────────────────────────────────
  const buildWeatherRisk14Day = (analysisResult) => {
    const weather = analysisResult?.weather_context || {};
    const forecast = weather?.forecast_14_days || [];
    const indices = analysisResult?.indices || {};
    const ndwi = Number(indices?.ndwi || 0);

    const risks = [];
    let frostDaysCount = 0;
    let hailDaysCount = 0;
    let heatDaysCount = 0;
    let waterlogDaysCount = 0;

    const dailyForecast = Array.isArray(forecast) ? forecast : [];

    dailyForecast.forEach((day, idx) => {
      const tempMin = Number(day?.temp_min || 0);
      const tempMax = Number(day?.temp_max || 25);
      const rain = Number(day?.rain || 0);
      const humidity = Number(day?.humidity || 0);

      // Frost risk (temp_min < 0)
      if (tempMin < 0) {
        frostDaysCount++;
        if (frostDaysCount === 1) {
          risks.push({
            type: 'Frost',
            dayNo: idx + 1,
            severity: tempMin < -2 ? 'Critical' : 'Moderate',
            detail: `Frost on day ${idx + 1}: ${tempMin.toFixed(1)}°C min. Critical if crop is in early tiller or boot stage.`,
            action: 'Unknown frost: Irrigation of field the evening before may help. Check weather update daily.',
          });
        }
      }

      // Hail risk (high rain + humidity + cool temp)
      if (rain > 20 && humidity > 80 && tempMax < 20 && idx > 0) {
        hailDaysCount++;
        if (hailDaysCount === 1) {
          risks.push({
            type: 'Hail',
            dayNo: idx + 1,
            severity: 'Unknown',
            detail: `Day ${idx + 1}: Heavy rain + high humidity + cool temps can favor hail. Risk is weather-dependent.`,
            action: 'Check local weather updates. Hail can severely damage crop and spike disease. Prepare drainage.',
          });
        }
      }

      // Heat stress (temp_max > 32 for 2+ days)
      if (tempMax > 32) {
        heatDaysCount++;
        if (heatDaysCount === 1) {
          risks.push({
            type: 'Extreme Heat',
            dayNo: idx + 1,
            severity: tempMax > 36 ? 'Critical' : 'Moderate',
            detail: `Heat window starting day ${idx + 1}: Max ${tempMax.toFixed(1)}°C. High evaporation; irrigation and sprinkling critical.`,
            action: 'Shift irrigation to early morning or night. Speed up operations. Avoid spray applications.',
          });
        }
      }

      // Waterlogging (heavy rain + low-lying fields)
      if (rain > 30 && ndwi > 0.05) {
        waterlogDaysCount++;
        if (waterlogDaysCount === 1) {
          risks.push({
            type: 'Waterlogging',
            dayNo: idx + 1,
            severity: 'Moderate',
            detail: `Day ${idx + 1}: Heavy rain (${rain.toFixed(1)} mm) + field already wet (NDWI ${ndwi.toFixed(3)}). Risk of ponding.`,
            action: 'Clear drains and outlets. Monitor field after rain. Avoid walking. Prepare for emergency drainage if needed.',
          });
        }
      }
    });

    // No major risks? Return summary
    if (risks.length === 0) {
      risks.push({
        type: 'Stable Forecast',
        dayNo: '—',
        severity: 'Low',
        detail: '14-day forecast shows no major frost, hail, heat, or waterlogging windows.',
        action: 'Continue with planned field operations. Monitor for unexpected weather changes.',
      });
    }

    return {
      forecastDays: dailyForecast.length || 14,
      risks,
      summary: `${frostDaysCount} frost days | ${hailDaysCount} hail-risk days | ${heatDaysCount} heat days | ${waterlogDaysCount} waterlog days`,
    };
  };

  // ─── District Benchmark ──────────────────────────────────────────────────────
  const buildDistrictBenchmark = (analysisResult) => {
    const fieldReport = analysisResult?.field_report || {};
    const benchmarking = fieldReport?.benchmarking || analysisResult?.benchmarking || {};
    const soilContext = analysisResult?.soil_context || {};
    const indices = analysisResult?.indices || {};
    const crop = selectedCrop || 'Wheat';
    const district = soilContext?.district || selectedCity || 'Your district';

    const fieldPercentile = Number(benchmarking?.district_percentile || 50);
    const districtAvgYield = benchmarking?.district_avg_yield_maunds || 24;
    const fieldEstimatedYield = fieldReport?.estimated_yield?.maunds_per_acre || 20;
    const yieldGap = fieldEstimatedYield - districtAvgYield;

    const peers = [
      {
        percentile: 10,
        avgYield: districtAvgYield * 0.75,
        description: 'Bottom performers',
        farmCount: 15,
      },
      {
        percentile: 25,
        avgYield: districtAvgYield * 0.85,
        description: 'Below average',
        farmCount: 30,
      },
      {
        percentile: 50,
        avgYield: districtAvgYield,
        description: 'District median',
        farmCount: 35,
      },
      {
        percentile: 75,
        avgYield: districtAvgYield * 1.15,
        description: 'Above average',
        farmCount: 25,
      },
      {
        percentile: 90,
        avgYield: districtAvgYield * 1.35,
        description: 'Top performers',
        farmCount: 10,
      },
    ];

    const performanceFrame = peers.find((p) => fieldPercentile >= (p === peers[0] ? 0 : peers[peers.indexOf(p) - 1].percentile));

    const gapAnalysis = [];
    if (yieldGap > 3) {
      gapAnalysis.push({
        gap: 'Yield Advantage',
        amount: `+${yieldGap.toFixed(1)} maund/acre vs district avg`,
        reason: 'Your management or soil is better than regional average.',
        action: 'Document what works; maintain key practices.',
      });
    } else if (yieldGap < -3) {
      gapAnalysis.push({
        gap: 'Yield Deficit',
        amount: `${yieldGap.toFixed(1)} maund/acre vs district avg`,
        reason: 'Likely due to late irrigation, poor variety, disease, or soil quality gaps.',
        action: 'Prioritize irrigation timing and pest scouting. Benchmark top farmers\' variety choice.',
      });
    } else {
      gapAnalysis.push({
        gap: 'Yield At Median',
        amount: 'Within ±3 maunds of district average',
        reason: 'Field performance is typical for the region.',
        action: 'Focus on optimization. Top-30% farms differ in early scouting & proactive action.',
      });
    }

    // Stress signal comparison
    const avgNDVI = benchmarking?.district_avg_ndvi || 0.50;
    const fieldNDVI = Number(indices?.ndvi || 0.5);
    if (fieldNDVI < avgNDVI - 0.08) {
      gapAnalysis.push({
        gap: 'Lower Vigor Signal',
        amount: `NDVI ${fieldNDVI.toFixed(3)} vs avg ${avgNDVI.toFixed(3)}`,
        reason: 'Field canopy is weaker than typical for this growth stage in the district.',
        action: 'Early intervention (Nitrogen, irrigation) may help close this gap.',
      });
    }

    return {
      crop,
      district,
      fieldPercentile,
      fieldEstimatedYield,
      districtAvgYield,
      performanceFrame,
      gapAnalysis,
      peers,
    };
  };

  // ─── Crop Variety Matcher ───────────────────────────────────────────────────
  const buildCropVarietyMatcher = (analysisResult) => {
    const soilContext = analysisResult?.soil_context || {};
    const weather = analysisResult?.weather_context || {};
    const resultCrop = String(analysisResult?.crop || selectedCrop || 'Wheat').toLowerCase();
    const crop = resultCrop.charAt(0).toUpperCase() + resultCrop.slice(1);
    const district = soilContext?.district || selectedCity || 'Your district';

    const clay = Number(soilContext?.clay || 25);
    const ec = Number(soilContext?.ec || 1.5);
    const pH = Number(soilContext?.ph || 7.0);
    const rainfall = Number(weather?.seasonal_rainfall ?? weather?.summary?.total_rainfall ?? 400);
    const drainingScore = clay < 18 ? 'fast' : clay > 35 ? 'poor' : 'moderate';

    const varieties = [];

    // WHEAT varieties
    if (crop === 'Wheat') {
      // High rainfall zone
      if (rainfall > 500) {
        varieties.push({
          variety: 'Benazir (FD-08)',
          suitability: 'Excellent for this field',
          reason: 'Bred for high rainfall areas. Good disease tolerance (rust, powdery mildew). Maturity: 165 days.',
          bestFor: 'Faisalabad, Multan (high rainfall years)',
          yield: '45-48 maund/acre in optimal conditions',
        });
        varieties.push({
          variety: 'Galaxy',
          suitability: 'Good alternative',
          reason: 'High yielding, modern variety. Better rust resistance.',
          bestFor: 'Layered rainfalls throughout season',
          yield: '42-46 maund/acre',
        });
      }

      // Moderate rainfall / irrigated
      if (rainfall > 350 && rainfall <= 500) {
        varieties.push({
          variety: 'Faisalabad-2008',
          suitability: 'Excellent fit',
          reason: 'Recommended for central Punjab. Balanced irrigation-dependent. Good for clay-loam soils.',
          bestFor: 'Central Punjab with regular irrigation',
          yield: '44-48 maund/acre',
        });
        varieties.push({
          variety: 'Iqbal-2000',
          suitability: 'Proven choice',
          reason: 'Long-standing preference in Faisalabad. Stable yield, known agronomic response.',
          bestFor: 'All irrigated districts',
          yield: '42-46 maund/acre',
        });
      }

      // Low rainfall / flood-risk areas
      if (rainfall <= 350) {
        varieties.push({
          variety: 'Bhakkar-2002',
          suitability: 'Best fit for low water',
          reason: 'Drought-tolerant, early maturing (152 days). Ideal for terminal stress.',
          bestFor: 'Bahawalpur, Multan (low water availability)',
          yield: '36-40 maund/acre',
        });
      }

      // Salinity tolerance
      if (ec > 2.5) {
        varieties.push({
          variety: 'Lasani-2008',
          suitability: 'Salt-tolerant option',
          reason: 'Bred for saline/alkaline soils (pH > 8.0 or EC > 2.0). Maintains yield under stress.',
          bestFor: 'High pH or saline zones',
          yield: '38-42 maund/acre',
        });
      }

      // Heavy soil
      if (clay > 35) {
        varieties.push({
          variety: 'Millat-2011',
          suitability: 'Adapted to heavy soil',
          reason: 'Good waterlogging tolerance. Strong root system. Suitable for clay-heavy fields.',
          bestFor: 'Heavy black soils, low drainage',
          yield: '40-44 maund/acre',
        });
      }

      // Light soil
      if (clay < 15) {
        varieties.push({
          variety: 'AAS-2011',
          suitability: 'Fit for sandy soils',
          reason: 'Early vigorous root system. Handles quick-draining soils well. Efficient water use.',
          bestFor: 'Sandy, low-clay fields',
          yield: '38-42 maund/acre',
        });
      }
    }

    // RICE varieties
    else if (crop === 'Rice') {
      const cityKey = String(district || '').toLowerCase();

      varieties.push({
        variety: 'Super Basmati',
        suitability: 'Reliable baseline for aromatic market',
        reason: 'Widely grown in Punjab rice belts with strong grain quality when water management is stable.',
        bestFor: 'Lahore, Gujrat, Sargodha quality-focused blocks',
        yield: '30-36 maund/acre (paddy equivalent)',
      });

      if (cityKey.includes('faisalabad') || cityKey.includes('multan') || rainfall <= 350) {
        varieties.push({
          variety: 'KSK-133',
          suitability: 'Better for warmer and relatively drier windows',
          reason: 'Stronger adaptation in heat-prone districts and more stable under moderate water stress.',
          bestFor: 'Faisalabad and Multan irrigated rice fields',
          yield: '34-40 maund/acre',
        });
      }

      if (cityKey.includes('lahore') || cityKey.includes('gujrat') || rainfall > 350) {
        varieties.push({
          variety: 'PK-1121 Aromatic',
          suitability: 'Good fit where humidity and grain quality matter',
          reason: 'Performs well in humid monsoon spells with strong quality premiums in aromatic segment.',
          bestFor: 'Lahore and Gujrat humidity-prone pockets',
          yield: '32-38 maund/acre',
        });
      }

      if (ec > 2.0 || clay > 30) {
        varieties.push({
          variety: 'IRRI-6',
          suitability: 'Practical option for heavier or stress-prone soils',
          reason: 'More stable stand where salinity/heavier texture starts reducing delicate aromatic performance.',
          bestFor: 'Medium-heavy or salinity-affected rice fields',
          yield: '36-42 maund/acre',
        });
      }
    }

    // COTTON varieties
    else if (crop === 'Cotton') {
      const cityKey = String(district || '').toLowerCase();

      varieties.push({
        variety: 'CIM-602',
        suitability: 'Reliable baseline',
        reason: 'Widely adapted in Punjab cotton zones with stable boll setting and broad farmer familiarity.',
        bestFor: 'Bahawalpur, Multan, Faisalabad, Sargodha, Lahore',
        yield: '35-42 maund/acre (seed cotton equivalent)',
      });

      if (cityKey.includes('bahawalpur') || cityKey.includes('multan') || rainfall <= 320) {
        varieties.push({
          variety: 'FH-Lalazar',
          suitability: 'Strong for hot/drier belt',
          reason: 'Performs better under high heat windows and comparatively lower seasonal rainfall.',
          bestFor: 'Bahawalpur and Multan dry-heat conditions',
          yield: '34-40 maund/acre',
        });
      }

      if (cityKey.includes('faisalabad') || cityKey.includes('sargodha') || rainfall > 320) {
        varieties.push({
          variety: 'MNH-1020',
          suitability: 'Good fit for irrigated central belt',
          reason: 'Balanced vegetative growth and boll retention in moderately irrigated cotton systems.',
          bestFor: 'Faisalabad and Sargodha irrigated fields',
          yield: '36-43 maund/acre',
        });
      }

      if (cityKey.includes('lahore') || clay > 28) {
        varieties.push({
          variety: 'NIAB-878',
          suitability: 'Suitable where humidity/disease pressure rises',
          reason: 'More stable canopy and practical tolerance under heavier soil or humid monsoon spells.',
          bestFor: 'Lahore-side humid pockets and medium-heavy soils',
          yield: '34-41 maund/acre',
        });
      }

      if (ec > 2.0) {
        varieties.push({
          variety: 'IUB-13',
          suitability: 'Better option in salinity-prone soils',
          reason: 'Maintains relatively stable stand where salt stress starts reducing boll quality.',
          bestFor: 'Salinity-affected cotton fields (EC > 2.0)',
          yield: '31-38 maund/acre',
        });
      }
    }

    // MAIZE varieties (if crop === 'Maize')
    else if (crop === 'Maize') {
      const cityKey = String(district || '').toLowerCase();

      varieties.push({
        variety: 'FAUZAAN',
        suitability: 'Reliable baseline for maize',
        reason: 'High-yielding hybrid, moisture-responsive. Good for irrigated systems with moderate rainfall.',
        bestFor: 'Faisalabad, Sargodha, Lahore',
        yield: '60–65 bags/acre (50kg)',
      });

      if (rainfall > 450 || cityKey.includes('lahore')) {
        varieties.push({
          variety: 'NIFA-Saand',
          suitability: 'Excellent in humid conditions',
          reason: 'High rainfall tolerance, strong root system. Better pest resistance.',
          bestFor: 'Lahore and high-monsoon years',
          yield: '58–66 bags/acre',
        });
      }

      if (rainfall < 380 || cityKey.includes('bahawalpur') || cityKey.includes('multan')) {
        varieties.push({
          variety: 'PRIDE-5088',
          suitability: 'Water-efficient choice',
          reason: 'Drought-tolerant, early maturity (110–120 days). Ideal for limited water.',
          bestFor: 'Bahawalpur, Multan (low-water zones)',
          yield: '50–56 bags/acre',
        });
      }

      if (ec > 1.8) {
        varieties.push({
          variety: 'DHA-12',
          suitability: 'Salt-tolerant option',
          reason: 'Better salinity tolerance while maintaining yield. Adapted to Punjab saline soils.',
          bestFor: 'Salinity-affected maize fields (EC > 1.8)',
          yield: '48–55 bags/acre',
        });
      }

      if (clay > 32) {
        varieties.push({
          variety: 'NK-6622',
          suitability: 'Suited to heavy soils',
          reason: 'Strong root penetration, waterlogging tolerance. Good for clay-heavy soils.',
          bestFor: 'Heavy black soils, restricted drainage',
          yield: '54–62 bags/acre',
        });
      }

      if (clay < 16) {
        varieties.push({
          variety: 'Pioneer-30L32',
          suitability: 'Adapted to sandy soils',
          reason: 'Early vigor, efficient water use. Handles rapidly draining light soils.',
          bestFor: 'Sandy, low-clay fields',
          yield: '52–60 bags/acre',
        });
      }
    }

    // SUGARCANE varieties
    else if (crop === 'Sugarcane') {
      const cityKey = String(district || '').toLowerCase();

      varieties.push({
        variety: 'CPF-246',
        suitability: 'Reliable baseline for Punjab cane belt',
        reason: 'Widely adapted with stable cane tonnage under irrigated management.',
        bestFor: 'Multan, Bahawalpur, Sargodha, Faisalabad, Gujrat',
        yield: '850–1000 maund/acre',
      });

      if (cityKey.includes('bahawalpur') || cityKey.includes('multan') || rainfall <= 300) {
        varieties.push({
          variety: 'HSF-240',
          suitability: 'Stronger in hot and relatively drier belt',
          reason: 'Better adaptation to heat-heavy windows with tighter irrigation discipline.',
          bestFor: 'Bahawalpur and Multan warm-dry blocks',
          yield: '800–930 maund/acre',
        });
      }

      if (cityKey.includes('faisalabad') || cityKey.includes('sargodha') || rainfall > 300) {
        varieties.push({
          variety: 'CPF-237',
          suitability: 'Good fit for central irrigated cane',
          reason: 'Strong ratoon response and stable internode development in canal-irrigated fields.',
          bestFor: 'Faisalabad and Sargodha irrigated fields',
          yield: '880–1020 maund/acre',
        });
      }

      if (cityKey.includes('gujrat') || clay > 30) {
        varieties.push({
          variety: 'CPF-249',
          suitability: 'Suitable in heavier texture fields',
          reason: 'Maintains stand where heavier soils slow drainage and increase humidity stress.',
          bestFor: 'Gujrat and medium-heavy cane soils',
          yield: '820–960 maund/acre',
        });
      }

      if (ec > 2.0) {
        varieties.push({
          variety: 'CP-77-400',
          suitability: 'Practical option for salinity stress',
          reason: 'Relatively better tolerance where salinity starts reducing cane recovery.',
          bestFor: 'Salinity-prone sugarcane fields (EC > 2.0)',
          yield: '760–900 maund/acre',
        });
      }
    }

    return {
      crop,
      district,
      soilProfile: { clay, ec, pH, drainage: drainingScore },
      rainfall,
      varieties: varieties.length > 0 ? varieties : [
        {
          variety: 'Local/Check variety',
          suitability: 'Default recommendation',
          reason: 'No specific variety data in backend. Consult local agro-dealer or extension for district-level suggestion.',
          bestFor: 'Your field conditions',
          yield: 'Varies by variety',
        },
      ],
    };
  };

  // ─── Panel Renderers ──────────────────────────────────────────────────────────

  const MicronutrientPanel = ({ analysisResult }) => {
    if (!analysisResult?.soil_context && !analysisResult?.indices) return null;
    const plan = buildMicronutrientPlan(analysisResult);

    return (
      <section className="sat-irrigation-schedule-panel sat-fert-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Micronutrient Strategy', 'مائیکرو نیوٹرینٹ حکمت عملی')}</h3>
            <div className="sat-irr-subtitle">
              {plan.district} • {plan.stage}
            </div>
          </div>
          <div className="sat-irr-meta">{tr('Est. cost', 'تخمینی لاگت')}: PKR {plan.totalCost.toLocaleString('en-PK')}/{tr('acre', 'ایکڑ')}</div>
        </div>

        <div className="sat-fert-compact-list">
          {plan.items.map((item, idx) => (
            <div key={`micro-${idx}`} className="sat-fert-row">
              <div className="sat-fert-main">
                <div className="sat-fert-label">{item.name}</div>
                <div className="sat-fert-product">{item.trigger}</div>
              </div>
              <div className="sat-fert-dose">{item.dose}</div>
              <div className="sat-fert-cost">PKR {item.cost.toLocaleString('en-PK')}</div>
            </div>
          ))}
        </div>

        <div className="sat-irr-tips">
          <div className="sat-irr-tip-item">
            <strong>{tr('Note', 'نوٹ')}:</strong> {tr('Micronutrients address soil imbalances. Apply based on soil pH, EC, and canopy stress signals.', 'مائیکرو نیوٹرینٹس مٹی کی کمی پوری کرتے ہیں۔ مٹی کے pH، EC اور کینوپی اسٹریس کے مطابق استعمال کریں۔')}
          </div>
        </div>
      </section>
    );
  };

  const ROIPanel = ({ analysisResult }) => {
    if (!analysisResult?.field_report) return null;
    const roi = buildROIJustification(analysisResult);

    return (
      <section className="sat-irrigation-schedule-panel sat-roi-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Economic Analysis', 'معاشی تجزیہ')}</h3>
            <div className="sat-irr-subtitle">{tr('ROI and cost-benefit breakdown', 'آر او آئی اور لاگت-فائدہ خلاصہ')}</div>
          </div>
        </div>

        <div className="sat-irr-quick-actions">
          {roi.recommendations.map((item, idx) => (
            <div key={`roi-${idx}`} className={`sat-irr-card ${item.color}`}>
              <div className="sat-irr-day">{item.title}</div>
              <div className="sat-irr-amount" style={{ fontSize: '1.1em', fontWeight: 600 }}>{item.value}</div>
              <div className="sat-irr-note">{item.detail}</div>
            </div>
          ))}
        </div>

      </section>
    );
  };

  const InputCostTracker = ({ analysisResult }) => {
    const [costDraftFormLocal, setCostDraftFormLocal] = useState({
      item: '',
      amount: '',
      date: toDateInputValue(new Date()),
      notes: '',
    });
    const expectedCosts = analysisResult ? buildFertilizerPlan(analysisResult).totalCost + 
                                         buildMicronutrientPlan(analysisResult).totalCost : 0;
    const actualTotal = inputCosts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const variance = actualTotal - expectedCosts;

    const handleAddCost = () => {
      const amountNum = Number(costDraftFormLocal.amount || 0);
      if (!costDraftFormLocal.item.trim() || !Number.isFinite(amountNum) || amountNum <= 0) return;
      const nextCosts = [...inputCosts, {
        ...costDraftFormLocal,
        amount: amountNum,
        notes: String(costDraftFormLocal.notes || '').trim(),
        id: Date.now(),
      }];
      setInputCosts(nextCosts);
      persistCostTrackerForCurrentResult(nextCosts);
      setCostDraftFormLocal({
        item: '',
        amount: '',
        date: toDateInputValue(new Date()),
        notes: '',
      });
    };

    const handleRemoveCost = (id) => {
      const nextCosts = inputCosts.filter((c) => c.id !== id);
      setInputCosts(nextCosts);
      persistCostTrackerForCurrentResult(nextCosts);
    };

    return (
      <section className="sat-cost-tracker-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Input Cost Tracker', 'ان پٹ لاگت ٹریکر')}</h3>
            <div className="sat-irr-subtitle">{tr('Log your actual spending vs predicted costs', 'اپنی اصل لاگت اور متوقع لاگت کا موازنہ درج کریں')}</div>
          </div>
        </div>

        <div className="sat-tracker-summary">
          <div className="sat-tracker-card">
            <div className="sat-tracker-label">{tr('Expected Cost (Model)', 'متوقع لاگت (ماڈل)')}</div>
            <div className="sat-tracker-value">PKR {expectedCosts.toLocaleString('en-PK')}</div>
          </div>
          <div className="sat-tracker-card">
            <div className="sat-tracker-label">{tr('Actual Spent', 'اصل خرچ')}</div>
            <div className="sat-tracker-value">PKR {actualTotal.toLocaleString('en-PK')}</div>
          </div>
          <div className="sat-tracker-card">
            <div className="sat-tracker-label">{tr('Difference', 'فرق')}</div>
            <div className="sat-tracker-value" style={{ color: variance > 0 ? '#dc2626' : '#10b981' }}>
              {variance > 0 ? '+' : ''}{variance.toLocaleString('en-PK')}
            </div>
          </div>
        </div>

        <div className="sat-cost-input-form">
          <input
            type="text"
            placeholder={tr('Item (e.g., Urea bag, Labour)', 'آئٹم (مثال: یوریا بیگ، مزدوری)')}
            value={costDraftFormLocal.item}
            onChange={(e) => setCostDraftFormLocal((prev) => ({ ...prev, item: e.target.value }))}
            className="sat-input"
          />
          <input
            type="number"
            placeholder={tr('Amount (PKR)', 'رقم (PKR)')}
            value={costDraftFormLocal.amount}
            onChange={(e) => setCostDraftFormLocal((prev) => ({ ...prev, amount: e.target.value }))}
            className="sat-input"
            min="0"
            step="1"
          />
          <input
            type="date"
            value={costDraftFormLocal.date}
            onChange={(e) => setCostDraftFormLocal((prev) => ({ ...prev, date: e.target.value }))}
            className="sat-input"
          />
          <button onClick={handleAddCost} className="sat-action-btn primary">{tr('Add Cost', 'لاگت شامل کریں')}</button>
          <textarea
            placeholder={tr('Notes (optional)', 'نوٹس (اختیاری)')}
            value={costDraftFormLocal.notes}
            onChange={(e) => setCostDraftFormLocal((prev) => ({ ...prev, notes: e.target.value }))}
            className="sat-input sat-cost-notes-input"
            rows={4}
          />
        </div>

        <div className="sat-cost-list">
          <div className="sat-irr-subtitle" style={{ marginBottom: '8px' }}>{tr('Added items', 'شامل کی گئی اشیاء')}</div>
          {inputCosts.length === 0 && (
            <div className="sat-output-sub">{tr('No cost items added yet.', 'ابھی کوئی لاگت آئٹم شامل نہیں کیا گیا۔')}</div>
          )}
          {inputCosts.map((cost) => (
            <div key={cost.id} className="sat-cost-item">
              <div className="sat-cost-details">
                <div className="sat-cost-name">{cost.item}</div>
                <div className="sat-cost-date">
                  {cost.date || tr('Date not set', 'تاریخ مقرر نہیں')}
                </div>
                {cost.notes ? <div className="sat-cost-date">{cost.notes}</div> : null}
              </div>
              <div className="sat-cost-amount">PKR {Number(cost.amount).toLocaleString('en-PK')}</div>
              <button onClick={() => handleRemoveCost(cost.id)} className="sat-cost-remove">x</button>
            </div>
          ))}
        </div>

      </section>
    );
  };

  const buildAlertPayloadFromResult = ({ result, city, coords, dashboardUrl, reportUrl }) => {
    const riskLevel = normalizeRiskLevel(result?.field_report?.risk_level || result?.risk_level);
    const summary = result?.diagnosis?.urgency || result?.field_report?.status_summary || 'Field condition alert detected.';
    const weatherSummary = result?.weather_context?.summary || {};
    const irrigation = result?.farmer_summary?.irrigation || {};
    const bestCrop = result?.soil_analysis?.analysis?.best_crop || result?.crop || 'N/A';
    const confidence = result?.soil_analysis?.analysis?.confidence || result?.prediction?.confidence || 'N/A';
    const yieldImpact = result?.field_report?.estimated_yield?.potential_loss_maunds
      ? `${result.field_report.estimated_yield.potential_loss_maunds} maunds risk`
      : 'N/A';
    const lossRange = result?.field_report?.economic_impact?.expected_savings_range_pkr_per_acre;

    const pestCalendar = buildPestDiseaseCalendar(result);
    const pestWatch = [];
    const seenPests = new Set();
    if (pestCalendar?.calendar?.length) {
      pestCalendar.calendar.forEach((week) => {
        (week.risks || []).forEach((risk) => {
          if (String(risk?.riskLevel || '').toLowerCase() !== 'high') return;
          if (seenPests.has(risk.pest)) return;
          seenPests.add(risk.pest);
          pestWatch.push(`${risk.pest}: ${shortenText(risk.action, 96)}`);
        });
      });
    }

    return {
      severity: riskLevel,
      city: city || 'Unknown City',
      analysisDate: result?.field?.analysis_date || result?.analysis_date || result?.timestamp,
      summary,
      tasks: extractTopTasks(result),
      pestWatch: pestWatch.slice(0, 4),
      weatherMetrics: {
        maxTemp: weatherSummary?.max_temperature ?? weatherSummary?.temp_max ?? 'N/A',
        expectedRain: weatherSummary?.total_rainfall ?? weatherSummary?.rain_next_48h ?? 'N/A',
        dryDays: weatherSummary?.dry_days ?? 'N/A',
        window: 'Next 48h',
      },
      cropDelta: {
        bestCrop,
        confidence,
        yieldImpact,
        reason: result?.soil_context?.key_limitation || 'Based on current field signals',
      },
      irrigation: {
        nextDate: irrigation?.timing_window || 'Next 24-48 hours',
        depth: irrigation?.mm_low && irrigation?.mm_high
          ? `${irrigation.mm_low}-${irrigation.mm_high} mm`
          : 'N/A',
        window: irrigation?.timing_window || 'Next 48 hours',
        note: irrigation?.irrigate_now ? 'Immediate irrigation recommended.' : 'Monitor soil moisture.',
      },
      economic: {
        range: lossRange ? `PKR ${lossRange.lower} to ${lossRange.upper}` : 'N/A',
        lossRisk: result?.field_report?.economic_impact?.expected_loss_pkr_per_acre
          ? `PKR ${result.field_report.economic_impact.expected_loss_pkr_per_acre}`
          : 'N/A',
      },
      ctas: {
        dashboardUrl,
        reportUrl,
      },
      location: coords ? `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` : undefined,
      unsubscribeText: 'You are receiving this alert because you ran a satellite analysis.',
    };
  };

  const getRiskLevel = (riskItems) => {
    const hasHigh = Array.isArray(riskItems) && riskItems.some((r) => String(r?.riskLevel || '').toLowerCase() === 'high');
    if (hasHigh) {
      return { level: 'high', color: '#DC2626', label: tr('High', 'زیادہ') };
    }
    return { level: 'low', color: '#059669', label: tr('Low', 'کم') };
  };

  const PestDiseasePanel = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const calendar = buildPestDiseaseCalendar(analysisResult);

    // Flatten Calendar
    const allRisks = [];
    calendar.calendar.forEach(week => {
      week.risks.forEach(risk => {
        allRisks.push({ ...risk, week: week.week, stage: week.stage });
      });
    });

    const uniquePests = [...new Set(allRisks.map((r) => r.pest))];

    const pestCards = uniquePests.map((pest, idx) => {
      const pestRisks = allRisks.filter((r) => r.pest === pest);
      const riskLevel = getRiskLevel(pestRisks);
      return {
        key: `pest-${idx}`,
        pest: simplifyFarmerText(pest),
        riskLevel,
        whenToCheck: pestRisks.map((risk) => `${risk.week}: ${simplifyFarmerText(risk.condition)}`),
        whatToDo: pestRisks.map((risk) => simplifyFarmerText(risk.action)),
      };
    });

    const sortedRiskCards = [...pestCards].sort((a, b) => {
      const aWeight = a.riskLevel.level === 'high' ? 0 : 1;
      const bWeight = b.riskLevel.level === 'high' ? 0 : 1;
      if (aWeight !== bWeight) return aWeight - bWeight;
      return String(a.pest || '').localeCompare(String(b.pest || ''));
    });

    return (
      <section className="sat-pest-disease-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Pest & Disease Watch', 'کیڑے اور بیماری نگرانی')}</h3>
            <div className="sat-irr-subtitle">
              {calendar.district} • {calendar.crop} • {tr('Humidity', 'نمی')} {calendar.humidity.toFixed(0)}% • {calendar.tempMinMax}
            </div>
          </div>
        </div>

        {sortedRiskCards.length > 0 && (
          <div className="sat-pest-detail-list">
            {sortedRiskCards.map((card) => (
              <div key={`detail-${card.key}`} className={`sat-pest-card risk-${card.riskLevel.level}`}>
                <div className={`sat-pest-card-header risk-${card.riskLevel.level}`}>
                  <div className="sat-pest-name">{card.pest}</div>
                  <div className="sat-pest-risk-badge" style={{ backgroundColor: card.riskLevel.color }}>
                    {card.riskLevel.label} {tr('Risk', 'خطرہ')}
                  </div>
                </div>

                <div className="sat-pest-card-body expanded">
                  <div className="sat-pest-section">
                    <div className="sat-pest-section-label">{tr('When to check', 'کب چیک کریں')}</div>
                    <div className="sat-pest-section-text">
                      {card.whenToCheck.map((line, lineIdx) => <div key={`when-${card.key}-${lineIdx}`}>• {line}</div>)}
                    </div>
                  </div>
                  <div className="sat-pest-divider" />
                  <div className="sat-pest-section">
                    <div className="sat-pest-section-label">{tr('What to do', 'کیا کریں')}</div>
                    <div className="sat-pest-section-text">
                      {card.whatToDo.map((line, lineIdx) => <div key={`do-${card.key}-${lineIdx}`}>• {line}</div>)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedRiskCards.length === 0 && (
          <div className="sat-pest-inline-empty" style={{ marginTop: '10px' }}>
            {tr('No major disease or pest risk detected for now.', 'فی الحال کوئی بڑا کیڑا یا بیماری کا خطرہ سامنے نہیں آیا۔')}
          </div>
        )}
      </section>
    );
  };

  const WeatherRisk14DayPanel = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const riskData = buildWeatherRisk14Day(analysisResult);

    return (
      <section className="sat-weather-risk-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('14-Day Weather Risk', '14 دن کا موسمی خطرہ')}</h3>
            <div className="sat-irr-subtitle">{tr('Frost, hail, heat, waterlogging watch', 'پالا، ژالہ باری، گرمی اور پانی بھراؤ نگرانی')}</div>
          </div>
          <div className="sat-irr-meta">{riskData.summary}</div>
        </div>

        <div className="sat-weather-risk-list">
          {riskData.risks.map((risk, idx) => (
            <div key={`risk-${idx}`} className={`sat-weather-risk-card severity-${risk.severity?.toLowerCase() || 'moderate'}`}>
              <div className="sat-weather-risk-type">{risk.type}</div>
              {risk.dayNo !== '—' && <div className="sat-weather-risk-day">{tr('Day', 'دن')} {risk.dayNo}</div>}
              <div className="sat-weather-risk-detail">{risk.detail}</div>
              <div className="sat-weather-risk-action">→ {risk.action}</div>
            </div>
          ))}
        </div>

        <div className="sat-irr-tips">
          <div className="sat-irr-tip-item">
            <strong>{tr('Check daily', 'روزانہ چیک کریں')}:</strong> {tr('Weather forecasts can change. Recheck your field condition after any major weather event.', 'موسمی پیش گوئی بدل سکتی ہے۔ کسی بھی بڑے موسمی واقعے کے بعد کھیت دوبارہ چیک کریں۔')}
          </div>
        </div>
      </section>
    );
  };

  const DistrictBenchmarkPanel = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const benchmark = buildDistrictBenchmark(analysisResult);

    return (
      <section className="sat-benchmark-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Field vs District Benchmark', 'کھیت بمقابلہ ضلع بینچ مارک')}</h3>
            <div className="sat-irr-subtitle">{benchmark.district} • {benchmark.crop}</div>
          </div>
        </div>

        <div className="sat-benchmark-summary">
          <div className="sat-benchmark-card emphasis">
            <div className="sat-benchmark-label">{tr('Your Field Position', 'آپ کے کھیت کی پوزیشن')}</div>
            <div className="sat-benchmark-value">{benchmark.fieldPercentile}th percentile</div>
            <div className="sat-benchmark-detail">{benchmark.performanceFrame?.description}</div>
          </div>
          <div className="sat-benchmark-card">
            <div className="sat-benchmark-label">{tr('Your Yield', 'آپ کی پیداوار')}</div>
            <div className="sat-benchmark-value">{benchmark.fieldEstimatedYield.toFixed(1)} maund/acre</div>
            <div className="sat-benchmark-detail">{tr('District avg', 'ضلع اوسط')}: {benchmark.districtAvgYield.toFixed(1)}</div>
          </div>
        </div>

        <div className="sat-benchmark-gap-list">
          {benchmark.gapAnalysis.map((gap, idx) => (
            <div key={`gap-${idx}`} className="sat-benchmark-gap-item">
              <div className="sat-benchmark-gap-title">{gap.gap}</div>
              <div className="sat-benchmark-gap-amount">{gap.amount}</div>
              <div className="sat-benchmark-gap-reason">{gap.reason}</div>
              <div className="sat-benchmark-gap-action">→ {gap.action}</div>
            </div>
          ))}
        </div>

        <div className="sat-irr-tips">
          <div className="sat-irr-tip-item">
            <strong>{tr('Benchmark insight', 'بینچ مارک مشاہدہ')}:</strong> {tr('Top 30% farmers in your district typically scout early and act fast on pest/disease detection.', 'آپ کے ضلع کے بہترین 30٪ کسان جلد نگرانی کرتے ہیں اور کیڑے/بیماری پر تیز ایکشن لیتے ہیں۔')}
          </div>
        </div>
      </section>
    );
  };

  const CropVarietyPanel = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const varietyData = buildCropVarietyMatcher(analysisResult);

    return (
      <section className="sat-variety-panel">
        <div className="sat-irr-header">
          <div>
            <h3 className="sat-section-title">{tr('Recommended Crop Varieties', 'سفارش کردہ فصل اقسام')}</h3>
            <div className="sat-irr-subtitle">{tr('Based on your soil, rainfall, and drainage', 'آپ کی مٹی، بارش اور نکاسی کے مطابق')}</div>
          </div>
        </div>

        <div className="sat-variety-soil-profile">
          <span className="sat-variety-badge">Clay: {varietyData.soilProfile.clay.toFixed(0)}%</span>
          <span className="sat-variety-badge">pH: {varietyData.soilProfile.pH.toFixed(2)}</span>
          <span className="sat-variety-badge">EC: {varietyData.soilProfile.ec.toFixed(2)} dS/m</span>
          <span className="sat-variety-badge">Rainfall: {varietyData.rainfall.toFixed(0)} mm</span>
          <span className="sat-variety-badge">{tr('Drainage', 'نکاسی')}: {varietyData.soilProfile.drainage}</span>
        </div>

        <div className="sat-variety-list">
          {varietyData.varieties.map((v, idx) => (
            <div key={`variety-${idx}`} className="sat-variety-card">
              <div className="sat-variety-name">{v.variety}</div>
              <div className="sat-variety-suitability">{v.suitability}</div>
              <div className="sat-variety-details">
                <span className="sat-variety-detail-item">{tr('Best for', 'موزوں')} : {v.bestFor}</span>
                <span className="sat-variety-detail-item">{tr('Yield', 'پیداوار')}: {v.yield}</span>
                <span className="sat-variety-detail-item">{tr('Why', 'وجہ')}: {(v.reason || '').split('.').filter(Boolean)[0] || tr('Suitable for your field conditions', 'آپ کے کھیت کے لیے موزوں')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const buildFallbackFarmerSummary = (analysisResult) => {
    const weather = analysisResult?.weather_context || {};
    const soil = analysisResult?.soil_context || {};
    const indices = analysisResult?.indices || {};
    const field = analysisResult?.field_report || {};
    const cropKey = String(analysisResult?.crop || selectedCrop || 'wheat').toLowerCase();

    const ndwi = Number(indices?.ndwi || 0);
    const rain48h = Number(weather?.rain_next_48h || 0);
    const hotDays = Number(weather?.hot_days || 0);
    const humidity = Number(weather?.avg_humidity || 0);

    const irrigateNow = ndwi < -0.08 && rain48h < 6;
    const mmBand = cropKey === 'cotton'
      ? { low: 18, high: 28 }
      : { low: 22, high: 32 };

    const stageFallback = cropKey === 'cotton'
      ? 'Squaring/Boll Formation'
      : 'Stem Elongation';

    const statusNeedsAttention = irrigateNow || humidity >= 75 || hotDays >= 2;

    return {
      status_color: statusNeedsAttention ? 'amber' : 'green',
      status_label: statusNeedsAttention ? 'Needs Attention' : 'Field Overview',
      irrigation: {
        irrigate_now: irrigateNow,
        mm_low: mmBand.low,
        mm_high: mmBand.high,
        timing_window: irrigateNow ? 'Today evening' : 'Next routine cycle',
      },
      next_check_days: irrigateNow ? 2 : 4,
      growth_stage: field?.growth_stage || stageFallback,
      soil_alert: soil?.key_limitation || 'No immediate soil constraint requiring action.',
      weather_warning: rain48h >= 12
        ? 'Heavy rain likely in 48h; hold sprays and protect drainage.'
        : (hotDays >= 2 ? 'Heat window expected; shift irrigation to early/late hours.' : ''),
    };
  };

  const buildFallbackActionableRecommendations = (analysisResult) => {
    const weather = analysisResult?.weather_context || {};
    const soil = analysisResult?.soil_context || {};
    const indices = analysisResult?.indices || {};
    const field = analysisResult?.field_report || {};
    const cropKey = String(analysisResult?.crop || selectedCrop || 'wheat').toLowerCase();

    const ndwi = Number(indices?.ndwi || 0);
    const evi = Number(indices?.evi || 0);
    const rain48h = Number(weather?.rain_next_48h || 0);
    const humidity = Number(weather?.avg_humidity || 0);
    const hotDays = Number(weather?.hot_days || 0);
    const stage = String(field?.growth_stage || (cropKey === 'cotton' ? 'Squaring' : 'Stem Elongation'));

    const recs = [];

    if (cropKey === 'cotton') {
      recs.push({
        priority: ndwi < -0.08 ? 'high' : 'medium',
        urgency: ndwi < -0.08 ? 'Today' : 'This week',
        category: 'water',
        type: 'Cotton Irrigation Window',
        action: ndwi < -0.08 && rain48h < 6
          ? 'Run light irrigation 18-28 mm in two passes, prioritize lighter patches first.'
          : 'Keep cotton irrigation moderate and schedule by field moisture checks every 2-3 days.',
        reason: `NDWI ${ndwi.toFixed(3)} and 48h rain ${rain48h.toFixed(1)} mm indicate current cotton water need.`,
      });

      recs.push({
        priority: humidity >= 70 ? 'high' : 'medium',
        urgency: humidity >= 70 ? 'Within 48 hours' : 'This week',
        category: 'disease',
        type: 'Cotton Pest & Disease Scouting',
        action: humidity >= 70
          ? 'Scout for whitefly, jassid, and leaf spot in inner canopy; treat only hotspots first.'
          : 'Scout cotton canopy twice this week for sucking pests and early leaf disease signs.',
        reason: `Humidity ${humidity.toFixed(0)}% with stage ${stage} can accelerate cotton pest/disease pressure.`,
      });

      recs.push({
        priority: hotDays >= 2 || evi < 0.25 ? 'high' : 'medium',
        urgency: 'This week',
        category: 'nutrition',
        type: 'Cotton Boll Support Nutrition',
        action: hotDays >= 2
          ? 'Use split nutrition and avoid midday spray; keep potassium and micronutrient support in evening windows.'
          : 'Maintain balanced NPK with foliar micronutrient support at squaring/boll stage.',
        reason: `EVI ${evi.toFixed(3)} and heat days ${hotDays} indicate potential canopy stress during critical cotton stage.`,
      });
    } else {
      recs.push({
        priority: 'medium',
        urgency: 'This week',
        category: 'monitoring',
        type: 'Field Monitoring',
        action: 'Walk field every 2-3 days and act quickly on weak patches.',
        reason: 'Fallback recommendation used because model recommendations are unavailable.',
      });
    }

    return recs;
  };

  const RichRecCard = ({ rec }) => {
    const level = String(rec?.priority || 'medium').toLowerCase();
    const urgencyText = simplifyUrgency(rec?.urgency || 'Follow this week');
    const typeText = farmerFriendlyType(rec?.type || 'Recommendation', rec?.category);
    const actionText = String(rec?.action || rec?.type || 'Follow recommendation').trim();
    const reasonText = String(rec?.reason || rec?.detail || getFarmerFriendlyWhy(rec).why || '').trim();

    const displayAction = simplifyFarmerText(farmerizeText(actionText)
      .replace(/\b\d+\)\s*\d+%\)\s*can reduce[^.]*\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim());
    const actionPoints = displayAction
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const getDueDateText = (urgency) => {
      const today = new Date();
      const raw = String(urgency || '').toLowerCase();
      let daysAhead = 7;
      if (raw.includes('today')) daysAhead = 0;
      else if (raw.includes('1-2') || raw.includes('24') || raw.includes('48')) daysAhead = 2;
      else if (raw.includes('3-5') || raw.includes('3') || raw.includes('5')) daysAhead = 5;
      const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead);
      return due.toLocaleDateString(language === 'ur' ? 'ur-PK' : 'en-GB', { day: '2-digit', month: 'short' });
    };

    const dueByText = getDueDateText(urgencyText);

    const cardClass = level === 'critical' || level === 'high'
      ? 'critical'
      : (level === 'medium' ? 'medium' : 'low');

    return (
      <div className={`sat-irr-card sat-rec-plan-card ${cardClass}`}>
        <div className="sat-irr-day">{typeText}</div>
        <div className="sat-irr-action sat-rec-action-list">
          {actionPoints.length > 1 ? (
            actionPoints.map((point, idx) => (
              <div key={`action-point-${idx}`} className="sat-rec-action-point">→ {point}</div>
            ))
          ) : (
            <div className="sat-rec-action-point">→ {displayAction}</div>
          )}
        </div>
        <div className="sat-rec-plan-meta">
          <span className="sat-rec-plan-urgency">{tr('Due', 'مقررہ')}: {dueByText}</span>
        </div>
      </div>
    );
  };

  const buildFallbackFieldReport = (analysisResult) => {
    const indices = analysisResult?.indices || {};
    const weather = analysisResult?.weather_context || {};
    const cropKey = String(analysisResult?.crop || selectedCrop || 'wheat').toLowerCase();
    const assumedYield = cropKey === 'cotton' ? 34 : 28;
    const ndwi = Number(indices?.ndwi || 0);
    const evi = Number(indices?.evi || 0.3);
    const rain48h = Number(weather?.rain_next_48h || 0);

    const isWatch = ndwi < -0.08 || evi < 0.25;

    return {
      crop: cropKey,
      health_label: isWatch ? 'Needs Attention' : 'Field Overview',
      risk_level: isWatch ? 'Moderate' : 'Low',
      critical_count: isWatch ? 1 : 0,
      status_summary: cropKey === 'cotton'
        ? 'Cotton field overview generated from current satellite and weather context.'
        : 'Field overview generated from current satellite and weather context.',
      growth_stage: cropKey === 'cotton' ? 'Squaring/Boll Formation' : 'Stem Elongation',
      estimated_yield: {
        maunds_per_acre: analysisResult?.field_report?.estimated_yield?.maunds_per_acre || assumedYield,
        potential_loss_maunds: isWatch ? 2.5 : 0.8,
      },
      benchmarking: {
        district_percentile: 50,
      },
      economic_impact: {
        expected_loss_pkr_per_acre: isWatch ? (cropKey === 'cotton' ? 18000 : 9000) : (cropKey === 'cotton' ? 6000 : 3200),
        expected_savings_range_pkr_per_acre: {
          lower: isWatch ? (cropKey === 'cotton' ? 12500 : 7000) : (cropKey === 'cotton' ? 4500 : 2500),
          upper: isWatch ? (cropKey === 'cotton' ? 22000 : 12000) : (cropKey === 'cotton' ? 8500 : 4500),
        },
      },
      quick_actions: [
        {
          timing: rain48h >= 10 ? 'After 24-48 hours (post-rain)' : 'Within 24-48 hours',
        },
      ],
    };
  };

  const OutputSummaryStrip = ({ analysisResult, sortedRecs }) => {
    const primary = analysisResult?.diagnosis?.primary_cause || sortedRecs[0]?.type;
    const days = analysisResult?.diagnosis?.days_to_critical;
    const percentile = analysisResult?.benchmarking?.district_percentile;

    return (
      <div className="sat-output-command">
        <div className="sat-output-card timeline">
          <span className="sat-output-kicker">{tr('Days to Critical', 'حساس ہونے تک دن')}</span>
          <div className="sat-output-value">{days != null ? `${days} ${tr('day', 'دن')}${days === 1 ? '' : 's'}` : tr('Stable', 'مستحکم')}</div>
          <div className="sat-output-sub">{simplifyFarmerText(analysisResult?.diagnosis?.urgency || tr('No immediate escalation', 'کوئی فوری بگڑنے کی حالت نہیں'))}</div>
        </div>
        <div className="sat-output-card focus">
          <span className="sat-output-kicker">{tr('Field vs District', 'فیلڈ بمقابلہ ضلع')}</span>
          <div className="sat-output-value">{percentile != null ? `${percentile}${tr('th', 'واں')}` : '—'}</div>
          <div className="sat-output-sub">{analysisResult?.benchmarking?.interpretation || tr('Benchmark unavailable', 'موازنہ دستیاب نہیں')}</div>
        </div>
        <div className="sat-output-card priority">
          <span className="sat-output-kicker">{tr('Primary Signal', 'بنیادی اشارہ')}</span>
          <div className="sat-output-value sat-output-value-sm">{primary || tr('Routine Monitoring', 'معمول کی نگرانی')}</div>
          <div className="sat-output-sub">{tr('Focus this first before lower-priority improvements.', 'اس پر پہلے توجہ دیں، پھر دوسری ترقیاں کریں۔')}</div>
        </div>
      </div>
    );
  };

  const DecisionEngineStrip = ({ analysisResult }) => {
    const primary = analysisResult?.diagnosis?.primary_cause || 'Not available';
    const percentile = analysisResult?.benchmarking?.district_percentile;
    const urgency = analysisResult?.diagnosis?.urgency || 'Not available';
    const lossMaunds = analysisResult?.field_report?.estimated_yield?.potential_loss_maunds
      ?? analysisResult?.yield_estimate?.potential_loss_if_untreated_maunds;
    const days = analysisResult?.diagnosis?.days_to_critical;

    const rows = [
      {
        label: 'Stress Cause Classification',
        value: primary,
        source: 'Spectral Rule Engine',
      },
      {
        label: 'Field Benchmark vs District',
        value: percentile != null ? `${percentile}th percentile` : 'Not available',
        source: 'District Training Stats',
      },
      {
        label: 'Urgency Tier',
        value: urgency,
        source: 'Rule Engine',
      },
      {
        label: 'Yield Loss Estimate',
        value: lossMaunds != null ? `${lossMaunds} maund/acre risk if untreated` : 'Not available',
        source: 'IRRI-style Formula',
      },
      {
        label: 'Days to Critical Window',
        value: days != null ? `${days} day${days === 1 ? '' : 's'}` : 'Stable',
        source: 'Escalation Window Model',
      },
    ];

    return (
      <section className="sat-engine-strip">
        <div className="sat-engine-strip-title">Decision Engine Outputs</div>
        <div className="sat-engine-grid">
          {rows.map((row) => (
            <div className="sat-engine-card" key={row.label}>
              <div className="sat-engine-label">{row.label}</div>
              <div className="sat-engine-value">{row.value}</div>
              <div className="sat-engine-source">{row.source}</div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  const HighAlertPanel = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const riskLevel = normalizeRiskLevel(analysisResult?.field_report?.risk_level || analysisResult?.risk_level);
    const showPanel = ['High', 'Moderate'].includes(riskLevel);
    if (!showPanel) return null;

    const summary = simplifyFarmerText(
      analysisResult?.diagnosis?.urgency
      || analysisResult?.field_report?.status_summary
      || tr('High-risk field signals detected. Act within the next 48 hours.', 'اہم خطرے کے اشارے ملے ہیں۔ اگلے 48 گھنٹوں میں عمل کریں۔')
    );

    const lossRisk = Number(analysisResult?.field_report?.economic_impact?.expected_loss_pkr_per_acre);
    const lossText = Number.isFinite(lossRisk)
      ? `PKR ${Math.round(lossRisk).toLocaleString('en-PK')}/acre`
      : tr('Not available', 'دستیاب نہیں');
    const daysToCritical = Number(analysisResult?.diagnosis?.days_to_critical);
    const daysText = Number.isFinite(daysToCritical)
      ? `${daysToCritical} ${tr('days', 'دن')}`
      : tr('Stable', 'مستحکم');
    const yieldLoss = Number(analysisResult?.field_report?.estimated_yield?.potential_loss_maunds);
    const yieldText = Number.isFinite(yieldLoss)
      ? `${yieldLoss.toFixed(1)} ${tr('maunds risk', 'من خطرہ')}`
      : tr('Not available', 'دستیاب نہیں');

    const topActions = extractTopTasks(analysisResult).slice(0, 3);
    const shortActions = topActions.map((item) => shortenText(item, 70));
    const indices = analysisResult?.indices || {};
    const weather = analysisResult?.weather_context || {};
    const weatherSummary = weather?.summary || {};
    const rain48h = Number(weather?.rain_next_48h ?? weatherSummary?.rain_next_48h ?? 0);
    const tempMax = Number(weather?.temp_max ?? weatherSummary?.max_temperature ?? 0);
    const ndwi = Number(indices?.ndwi);
    const evi = Number(indices?.evi);

    const riskReasons = [];
    if (Number.isFinite(daysToCritical) && daysToCritical <= 2) {
      riskReasons.push(tr(
        `Critical window in ${daysToCritical} day(s)`,
        `اہم ونڈو ${daysToCritical} دن میں`
      ));
    }
    if (Number.isFinite(ndwi) && ndwi < -0.1) {
      riskReasons.push(tr(
        `NDWI ${ndwi.toFixed(3)} indicates water stress`,
        `این ڈی ڈبلیو آئی ${ndwi.toFixed(3)} پانی کے دباؤ کی نشاندہی کرتا ہے`
      ));
    }
    if (Number.isFinite(evi) && evi < 0.25) {
      riskReasons.push(tr(
        `EVI ${evi.toFixed(3)} shows low canopy vigor`,
        `ای وی آئی ${evi.toFixed(3)} فصل کی کمزور نشوونما دکھاتا ہے`
      ));
    }
    if (Number.isFinite(rain48h) && rain48h < 4) {
      riskReasons.push(tr(
        `Low rain in 48h (${rain48h.toFixed(1)} mm)`,
        `اگلے 48 گھنٹوں میں کم بارش (${rain48h.toFixed(1)} ملی میٹر)`
      ));
    }
    if (Number.isFinite(tempMax) && tempMax >= 34) {
      riskReasons.push(tr(
        `High temperature window (${tempMax.toFixed(1)} C)`,
        `زیادہ درجہ حرارت کی ونڈو (${tempMax.toFixed(1)} سینٹی گریڈ)`
      ));
    }

    const headerText = riskLevel === 'High'
      ? tr('High Alert', 'شدید الرٹ')
      : tr('Moderate Alert', 'درمیانی الرٹ');

    const fallbackRisk = tr(
      `Monitoring ${analysisResult?.city || selectedCity || 'selected field'}: no extreme trigger, follow routine checks`,
      `${analysisResult?.city || selectedCity || 'منتخب فیلڈ'} کی نگرانی جاری رکھیں: کوئی انتہائی ٹرگر نہیں، معمول کے چیک جاری رکھیں`
    );
    const riskTickerItems = riskReasons.length ? riskReasons : [fallbackRisk];
    const riskTickerText = `${tr('High risk now:', 'فی الحال زیادہ خطرہ:')} ${riskTickerItems.join(' • ')}`;

    return (
      <>
        <div className="sat-high-alert-headline">
          {tr('Immediate Field Attention Needed', 'فوری فیلڈ توجہ درکار ہے')}
        </div>
        <div className="sat-high-alert-subheadline">
          <span>{riskTickerText}</span>
        </div>
        <section className={`sat-high-alert-panel ${riskLevel.toLowerCase()}`}>
        <div className="sat-high-alert-header">
          <div>
            <div className="sat-high-alert-title-row">
              <span className="sat-high-alert-radar" aria-hidden="true">
                <span className="sat-high-alert-radar-ring" />
                <span className="sat-high-alert-radar-sweep" />
                <span className="sat-high-alert-radar-dot" />
              </span>
              <div className="sat-high-alert-kicker">{headerText}</div>
            </div>
            <div className="sat-high-alert-title">
              {tr('Immediate field attention needed', 'فوری توجہ درکار ہے')}
            </div>
          </div>
          <div className="sat-high-alert-badges">
            <span className="sat-high-alert-badge urgent">{tr('Urgent', 'فوری')}</span>
          </div>
        </div>

        <div className="sat-high-alert-summary">{summary}</div>

        <div className="sat-high-alert-grid">
          <div className="sat-high-alert-card">
            <div className="sat-high-alert-label">{tr('Expected Loss', 'متوقع نقصان')}</div>
            <div className="sat-high-alert-value">{lossText}</div>
          </div>
          <div className="sat-high-alert-card">
            <div className="sat-high-alert-label">{tr('Critical Window', 'اہم ونڈو')}</div>
            <div className="sat-high-alert-value">{daysText}</div>
          </div>
          <div className="sat-high-alert-card">
            <div className="sat-high-alert-label">{tr('Yield Risk', 'پیداوار خطرہ')}</div>
            <div className="sat-high-alert-value">{yieldText}</div>
          </div>
        </div>

        <div className="sat-high-alert-list">
          <div className="sat-high-alert-list-title">{tr('Top Actions (Next 48h)', 'اہم اقدامات (اگلے 48 گھنٹے)')}</div>
          <ul>
            {shortActions.map((item, idx) => (
              <li key={`alert-action-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="sat-high-alert-pop">
          {tr('Act within 24-48 hours and recheck weak patches.', '24-48 گھنٹوں میں عمل کریں اور کمزور حصے دوبارہ چیک کریں۔')}
        </div>

        <button
          type="button"
          className="sat-high-alert-cta"
          onClick={() => setActiveResultTab('planning')}
        >
          {tr('Open Planning →', 'منصوبہ بندی کھولیں →')}
        </button>
        </section>
      </>
    );
  };

  const FarmerQuickView = ({ analysisResult }) => {
    if (!analysisResult) return null;
    const summary = analysisResult?.farmer_summary || buildFallbackFarmerSummary(analysisResult);

    const statusClass = String(summary.status_color || 'green').toLowerCase();
    const quickViewCity = analysisResult?.city || analysisResult?.location?.city || selectedCity || '';

    return (
      <section className="sat-farmer-quickview">
        <div className="sat-fqv-header">
          <div>
            <div className="sat-fqv-kicker">{tr('Farmer Quick View', 'کسان فوری جائزہ')}</div>
          </div>
          <div className="sat-fqv-alerts">
            <div className={`sat-fqv-status ${statusClass}`}>
              {/needs\s*attention/i.test(String(summary.status_label || '')) ? tr('Field Overview', 'فیلڈ جائزہ') : (summary.status_label || tr('Field Overview', 'فیلڈ جائزہ'))}
            </div>
          </div>
        </div>

        <CompactWeatherInfo
          city={quickViewCity}
          weatherData={{ forecast: miniWeather.forecast, city: miniWeather.city }}
          loadingExternal={miniWeatherLoading}
          variant="prominent"
          title={tr('Today Weather For This Field', 'آج کا موسم اس کھیت کے لیے')}
          subtitle={tr('Live city weather update', 'شہر کے موسم کی تازہ معلومات')}
        />

        <div className="sat-fqv-single-block">
          <div className="sat-fqv-single-row">
            <div className="sat-fqv-label">{tr('Irrigation', 'آبپاشی')}</div>
            <div className="sat-fqv-value">
              {summary?.irrigation?.irrigate_now ? tr('Irrigate now', 'فوری آبپاشی کریں') : tr('No immediate irrigation', 'فوری آبپاشی درکار نہیں')}
            </div>
            {summary?.irrigation?.irrigate_now && (
              <div className="sat-fqv-note">
                {summary.irrigation.mm_low}-{summary.irrigation.mm_high} mm, {summary.irrigation.timing_window}
              </div>
            )}
          </div>

          <div className="sat-fqv-single-row">
            <div className="sat-fqv-label">{tr('Next Check', 'اگلی جانچ')}</div>
            <div className="sat-fqv-value">{summary.next_check_days} {tr('days', 'دن')}</div>
            <div className="sat-fqv-note">{tr('Growth stage', 'نمو کا مرحلہ')}: {summary.growth_stage}</div>
          </div>

          <div className="sat-fqv-single-row">
            <div className="sat-fqv-label">{tr('Soil Alert', 'مٹی کے بارے میں انتباہ')}</div>
            <div className="sat-fqv-note">{summary.soil_alert || tr('No immediate soil constraint requiring action.', 'مٹی میں کوئی فوری مسئلہ نہیں جس میں کارروائی درکار ہو۔')}</div>
          </div>

          {summary.weather_warning && (
            <div className="sat-fqv-single-row">
              <div className="sat-fqv-label">{tr('Weather Alert (48h)', 'موسمی انتباہ (48 گھنٹے)')}</div>
              <div className="sat-fqv-note">{summary.weather_warning}</div>
            </div>
          )}
        </div>

      </section>
    );
  };

  const WeatherImpactStrip = ({ analysisResult }) => {
    const weather = analysisResult?.weather_context;
    const summary = weather?.summary || {};
    const risk = analysisResult?.weather_risk || {};
    const indices = analysisResult?.indices || {};
    const recommendations = analysisResult?.recommendations || [];
    if (!weather) return null;

    const riskScore = Math.round((risk.overall || 0) * 100);
    const riskLabel = riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Moderate' : 'Low';
    const rain48h = Number(weather.rain_next_48h || summary.rain_next_48h || 0);
    const hotDays = Number(weather.hot_days || 0);
    const veryHotDays = Number(weather.very_hot_days || 0);
    const rainyDays = Number(weather.rainy_days || 0);
    const humidity = Number(summary.avg_humidity || 0);
    const maxWind = Number(summary.max_wind_speed || 0);
    const dryPct = Math.round((risk.dryness || 0) * 100);
    const wetPct = Math.round((risk.wetness || 0) * 100);

    const hasMeaningfulImpact = (
      riskScore >= 25
      || rain48h >= 5
      || hotDays >= 1
      || veryHotDays >= 1
      || wetPct >= 20
      || dryPct >= 25
      || maxWind >= 6
      || humidity >= 75
    );

    if (!hasMeaningfulImpact) return null;

    const weatherLinkedRecs = recommendations.filter((rec) => rec?.weather_note || rec?.evidence?.weather);
    const satWeatherInsights = [];

    if (indices.ndwi < -0.1 && rain48h < 5) {
      satWeatherInsights.push({
        title: 'Dry canopy likely to worsen',
        reason: `NDWI ${Number(indices.ndwi).toFixed(3)} is already dry and only ${rain48h.toFixed(1)} mm rain is expected in 48h.`,
        action: 'Prioritize irrigation recommendations and target driest patches first.',
      });
    }
    if (indices.ndwi < -0.1 && rain48h >= 5) {
      satWeatherInsights.push({
        title: 'Deficit may be partly relieved by rain',
        reason: `NDWI ${Number(indices.ndwi).toFixed(3)} is low, but ${rain48h.toFixed(1)} mm rain is forecast soon.`,
        action: 'Delay non-critical irrigation by 1-2 days and reassess soil moisture after rainfall.',
      });
    }
    if (indices.ndwi > 0.08 && (rain48h >= 8 || wetPct >= 30)) {
      satWeatherInsights.push({
        title: 'Waterlogging risk is elevated',
        reason: `NDWI ${Number(indices.ndwi).toFixed(3)} indicates wet canopy and forecast adds more moisture pressure.`,
        action: 'Inspect drainage outlets and clear channels before the next rainfall event.',
      });
    }
    if (indices.evi < 0.25 && (humidity >= 75 || rainyDays >= 2 || rain48h >= 6)) {
      satWeatherInsights.push({
        title: 'Disease pressure likely to compound low vigor',
        reason: `EVI ${Number(indices.evi).toFixed(3)} is weak while humidity/rain conditions favor fungal spread.`,
        action: 'Start focused scouting now and avoid spray applications during windy/rainy windows.',
      });
    }
    if (satWeatherInsights.length === 0) {
      satWeatherInsights.push({
        title: 'Weather impact is currently manageable',
        reason: `Forecast risk is ${riskLabel.toLowerCase()} (${riskScore}%) relative to current satellite stress.`,
        action: 'Follow planned recommendations and re-check after the next satellite update.',
      });
    }

    const weatherFacts = [];
    if (rain48h >= 5 || indices.ndwi < -0.08 || indices.ndwi > 0.08) {
      weatherFacts.push({
        label: 'Rain Next 48h',
        value: `${rain48h.toFixed(1)} mm`,
        note: indices.ndwi < -0.08
          ? (rain48h >= 5 ? 'May partially relieve current moisture deficit' : 'Not enough to fix current dryness')
          : (indices.ndwi > 0.08 ? 'Adds pressure to already wet field zones' : 'Relevant for operation timing'),
      });
    }
    if (hotDays >= 1 || veryHotDays >= 1 || indices.ndwi < -0.08) {
      weatherFacts.push({
        label: 'Heat Stress Window',
        value: `${hotDays} hot / ${veryHotDays} very hot`,
        note: indices.ndwi < -0.08 ? 'Heat can worsen current water stress fast' : 'Important for irrigation and spray timing',
      });
    }
    if (humidity >= 75 || rainyDays >= 2 || indices.evi < 0.25) {
      weatherFacts.push({
        label: 'Disease Weather',
        value: `${humidity.toFixed(0)}% RH`,
        note: indices.evi < 0.25 ? 'Weak canopy under humid conditions raises disease risk' : 'Humidity may support fungal spread',
      });
    }
    if (maxWind >= 5) {
      weatherFacts.push({
        label: 'Wind Constraint',
        value: `${maxWind.toFixed(1)} m/s`,
        note: 'High enough to disrupt spray quality and cause drift',
      });
    }

    const doNow = [];
    const avoid = [];
    const monitor = [];

    if (indices.ndwi < -0.1 && rain48h < 5) doNow.push('Run irrigation on driest patches first; do not wait for forecast rain.');
    if (indices.ndwi < -0.1 && rain48h >= 5) doNow.push('Delay non-critical irrigation 1-2 days and re-check field moisture after rainfall.');
    if (indices.ndwi > 0.08 && (rain48h >= 8 || wetPct >= 30)) doNow.push('Open field drains and inspect low-lying patches before next rain.');
    if (indices.evi < 0.25 && (humidity >= 75 || rainyDays >= 2)) doNow.push('Start disease scouting immediately in dense and shaded canopy zones.');
    if (doNow.length === 0) doNow.push('Follow current recommendation timing; no weather-driven acceleration required.');

    if (maxWind >= 5) avoid.push('Avoid pesticide sprays during high wind windows.');
    if (rain48h >= 6) avoid.push('Avoid fertilizer/spray right before rain unless recommendation explicitly says so.');
    if (veryHotDays >= 1) avoid.push('Avoid midday irrigation to reduce evaporation losses.');
    if (avoid.length === 0) avoid.push('No major weather-related operation restriction currently flagged.');

    if (weatherLinkedRecs.length > 0) monitor.push(`${weatherLinkedRecs.length} recommendation(s) are weather-sensitive; align operations with forecast windows.`);
    monitor.push(`Weekly weather risk: ${riskLabel} (${riskScore}%).`);
    const displayedWeatherFacts = weatherFacts.slice(0, 4);

    return (
      <div className="sat-weather-impact" aria-label="Weather impact for satellite recommendations">
        <div className="sat-weather-impact-panel">
          <div className="sat-weather-impact-header">
            <div>
              <div className="sat-weather-impact-kicker">Weather Brief</div>
              <div className="sat-weather-impact-title">Weather impact on satellite stress</div>
              <div className="sat-weather-impact-summary">
                Weather is only shown here where it changes what the farmer should do with current satellite stress.
              </div>
            </div>
            <div className={`sat-weather-impact-pill risk-${riskLabel.toLowerCase()}`}>{riskLabel}</div>
          </div>

          <div className="sat-weather-impact-metrics">
            {displayedWeatherFacts.map((fact, idx) => (
              <div className="sat-weather-metric-card" key={`weather-fact-${idx}`}>
                <div className="sat-weather-metric-label">{fact.label}</div>
                <div className="sat-weather-metric-value">{fact.value}</div>
                <div className="sat-weather-metric-note">{fact.note}</div>
              </div>
            ))}
          </div>

          <div className="sat-weather-impact-insights">
            <div className="sat-weather-impact-insights-title">Weather-Driven Field Impact</div>
            <div className="sat-weather-impact-insight-list">
              {satWeatherInsights.slice(0, 3).map((insight, idx) => (
                <div className="sat-weather-impact-insight-item" key={`sat-weather-insight-${idx}`}>
                  <div className="sat-weather-impact-insight-head">{insight.title}</div>
                  <div className="sat-weather-impact-insight-reason">{insight.reason}</div>
                  <div className="sat-weather-impact-insight-action">Action: {insight.action}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sat-weather-farmer-plan">
            <div className="sat-weather-plan-col">
              <div className="sat-weather-plan-title">Do Now</div>
              {doNow.slice(0, 3).map((line, idx) => <div key={`do-now-${idx}`} className="sat-weather-plan-item">• {line}</div>)}
            </div>
            <div className="sat-weather-plan-col">
              <div className="sat-weather-plan-title">Avoid</div>
              {avoid.slice(0, 3).map((line, idx) => <div key={`avoid-${idx}`} className="sat-weather-plan-item">• {line}</div>)}
            </div>
            <div className="sat-weather-plan-col">
              <div className="sat-weather-plan-title">Monitor</div>
              {monitor.slice(0, 3).map((line, idx) => <div key={`monitor-${idx}`} className="sat-weather-plan-item">• {line}</div>)}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SoilIntelligencePanel = ({ analysisResult }) => {
    const soilModel = analysisResult?.soil_analysis;
    const soilModelAnalysis = soilModel?.analysis;
    const soilTrend = analysisResult?.soil_trends;
    const soilContext = analysisResult?.soil_context;
    const soilUnavailable = analysisResult?.soil_analysis_unavailable;

    if (!soilModel && !soilTrend && !soilContext && !soilUnavailable) return null;

    const limitations = Array.isArray(soilModelAnalysis?.limitations)
      ? soilModelAnalysis.limitations
      : [];

    const districtLabel = soilModel?.location?.district || soilTrend?.district || soilContext?.district || selectedCity;
    const districtScore = soilModelAnalysis?.overall_score ?? soilTrend?.overall_score ?? soilContext?.score;
    const districtHealthFromScore = (score) => {
      if (!Number.isFinite(score)) return null;
      if (score >= 85) return 'Excellent';
      if (score >= 70) return 'Good';
      if (score >= 55) return 'Fair';
      if (score >= 40) return 'Poor';
      return 'Very Poor';
    };
    const districtHealth = districtHealthFromScore(Number(districtScore))
      || soilModelAnalysis?.soil_health
      || soilContext?.health_class
      || 'Unavailable';
    const indices = analysisResult?.indices || {};
    const soilSatelliteInsights = [];

    if ((soilContext?.ec || 0) > 2.0 && (indices.ndwi || 0) < -0.05) {
      soilSatelliteInsights.push({
        title: 'Salinity + dryness compound stress',
        impact: `EC ${Number(soilContext.ec).toFixed(2)} dS/m and NDWI ${Number(indices.ndwi).toFixed(3)} together suggest harder root water uptake.`,
        action: 'Prefer split irrigations and prioritize salinity management recommendations first.',
      });
    }
    if ((soilContext?.nitrogen || 1) < 0.45 && ((indices.ndre || 1) < 0.19 || (indices.gndvi || 1) < 0.26)) {
      soilSatelliteInsights.push({
        title: 'Nitrogen deficiency is confirmed by canopy signals',
        impact: `District N is low and NDRE/GNDVI (${Number(indices.ndre || 0).toFixed(3)}/${Number(indices.gndvi || 0).toFixed(3)}) indicate weak chlorophyll.`,
        action: 'Execute nitrogen top-dress with weather-safe timing from recommendations.',
      });
    }
    if (((soilContext?.ph || 7) < 6.0 || (soilContext?.ph || 7) > 8.0) && (indices.evi || 1) < 0.25) {
      soilSatelliteInsights.push({
        title: 'pH imbalance may be suppressing vigor',
        impact: `Soil pH ${Number(soilContext.ph).toFixed(2)} is outside optimal band and EVI ${Number(indices.evi).toFixed(3)} is weak.`,
        action: 'Plan soil amendment window and monitor post-amendment vigor trend next cycle.',
      });
    }
    if ((soilContext?.clay || 30) < 18 && (indices.ndwi || 1) < -0.1) {
      soilSatelliteInsights.push({
        title: 'Low clay + low NDWI means rapid moisture loss',
        impact: `Clay ${Number(soilContext.clay).toFixed(1)}% and NDWI ${Number(indices.ndwi).toFixed(3)} indicate poor water holding.`,
        action: 'Use smaller, more frequent irrigations rather than one heavy pass.',
      });
    }
    if (soilSatelliteInsights.length === 0) {
      soilSatelliteInsights.push({
        title: 'Soil and satellite signals are broadly aligned',
        impact: 'No major cross-signal conflict detected between district soil profile and current canopy indices.',
        action: 'Follow priority recommendations and track whether indices improve after interventions.',
      });
    }

    const soilFacts = [];
    if (soilContext?.ec > 2.0 && indices.ndwi < -0.05) {
      soilFacts.push({
        label: 'Salinity',
        value: `${Number(soilContext.ec).toFixed(2)} dS/m`,
        note: 'Relevant now because it can make current dryness look worse in the root zone.',
      });
    }
    if (soilContext?.nitrogen < 0.45 && ((indices.ndre || 1) < 0.19 || (indices.gndvi || 1) < 0.26)) {
      soilFacts.push({
        label: 'Nitrogen',
        value: `${Number(soilContext.nitrogen).toFixed(3)}%`,
        note: 'Relevant now because canopy chlorophyll signals are also weak.',
      });
    }
    if ((soilContext?.ph < 6.0 || soilContext?.ph > 8.0) && (indices.evi || 1) < 0.25) {
      soilFacts.push({
        label: 'Soil pH',
        value: Number(soilContext.ph).toFixed(2),
        note: 'Relevant now because off-range pH may be holding back current vigor.',
      });
    }
    if ((soilContext?.clay || 30) < 18 && (indices.ndwi || 1) < -0.1) {
      soilFacts.push({
        label: 'Clay Content',
        value: `${Number(soilContext.clay).toFixed(1)}%`,
        note: 'Relevant now because low clay means quicker moisture loss in this field.',
      });
    }

    return (
      <div className="sat-soil-suite sat-soil-panel sat-soil-panel-top">
        <div className="sat-soil-suite-header">
          <div>
            <h3 className="sat-section-title">
              Soil Intelligence — {districtLabel}
            </h3>
            <div className="sat-soil-suite-subtitle">
              Soil is only shown here where it explains current satellite stress or changes today’s action.
            </div>
          </div>
        </div>

        <div className="sat-soil-suite-overview compact">
          <div className="sat-soil-suite-card emphasis">
            <div className="sat-soil-suite-kicker">Relevant Soil Risk</div>
            <div className="sat-soil-suite-value">{districtScore != null ? `${Math.round(districtScore)}/100` : '—'}</div>
            <div className="sat-soil-suite-meta">{districtHealth}</div>
          </div>
          <div className="sat-soil-suite-card">
            <div className="sat-soil-suite-kicker">Current Limitation</div>
            <div className="sat-soil-suite-value sat-soil-suite-value-sm">{soilContext?.key_limitation || limitations[0] || 'No major limitation flagged'}</div>
            <div className="sat-soil-suite-meta">{soilContext?.note || soilTrend?.headline || ''}</div>
          </div>
        </div>

        {soilUnavailable?.reason && !soilModel && (
          <div className="sat-soil-suite-note">
            Live soil-model enrichment is unavailable for {soilUnavailable.district}. Showing district soil context and trend data instead.
          </div>
        )}

        {limitations.length > 0 && (
          <div className="sat-soil-flag-list">
            {limitations.slice(0, 2).map((item, idx) => (
              <span key={`soil-limit-${idx}`} className="sat-soil-flag-pill">{item}</span>
            ))}
          </div>
        )}

        {soilFacts.length > 0 && (
          <div className="sat-soil-fact-grid">
            {soilFacts.map((fact, idx) => (
              <div className="sat-soil-fact-card" key={`soil-fact-${idx}`}>
                <div className="sat-soil-fact-label">{fact.label}</div>
                <div className="sat-soil-fact-value">{fact.value}</div>
                <div className="sat-soil-fact-note">{fact.note}</div>
              </div>
            ))}
          </div>
        )}

        <div className="sat-soil-suite-columns">
          <div className="sat-soil-trend-block sat-soil-sat-impact-block">
            <div className="sat-soil-block-title">Soil-Driven Field Impact</div>
            <div className="sat-soil-impact-list">
              {soilSatelliteInsights.slice(0, 3).map((insight, idx) => (
                <div className="sat-soil-impact-item" key={`soil-sat-impact-${idx}`}>
                  <div className="sat-soil-impact-title">{insight.title}</div>
                  <div className="sat-soil-impact-text">{insight.impact}</div>
                  <div className="sat-soil-impact-action">Action: {insight.action}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const heatColor = (stress) => {
    if (stress >= 0.8) return '#dc2626';
    if (stress >= 0.6) return '#f97316';
    if (stress >= 0.4) return '#eab308';
    if (stress >= 0.2) return '#84cc16';
    return '#22c55e';
  };

  const heatmapLegend = result?.heatmap?.legend;
  const heatmapCenter = markerPos || (result?.field ? [result.field.latitude, result.field.longitude] : null);
  const coordSuggestions = normalizeCoordHistory(coordHistory).map((entry) => ({
    value: formatCoordinatePair(entry.lat, entry.lon),
    label: entry.city || 'Recent location',
  }));
  const todayInput = toDateInputValue(new Date());
  const isFieldBoundaryMissing = fieldPolygon.length < 3;
  const hasTypedCoordinates = coordInput.trim().length > 0;
  const hasValidTypedCoordinates = !!parseCoordinatePair(coordInput);
  const showDrawToolbarWarning = hasTypedCoordinates && isFieldBoundaryMissing;
  const boundaryReady = fieldPolygon.length >= 3;
  const fallbackRecommendationList = Array.isArray(result?.recommendations) && result.recommendations.length > 0
    ? []
    : buildFallbackActionableRecommendations(result);
  const visibleRecommendations = (Array.isArray(result?.recommendations) && result.recommendations.length > 0)
    ? result.recommendations
    : fallbackRecommendationList;
  const nonIrrigationRecommendations = visibleRecommendations.filter((rec) => {
    const type = String(rec?.type || '').toLowerCase();
    const category = String(rec?.category || '').toLowerCase();
    return !(category === 'water' || type.includes('irrigation'));
  });
  const sortedRecommendations = [...nonIrrigationRecommendations].sort((a, b) => {
    const rank = { critical: 4, high: 3, medium: 2, low: 1 };
    const ar = rank[(a.priority || '').toLowerCase()] || 0;
    const br = rank[(b.priority || '').toLowerCase()] || 0;
    return br - ar;
  });
  const recommendationsToShow = sortedRecommendations.slice(0, 3);
  const snapshotHealth = result?.field_report?.health_label || result?.farmer_summary?.status_label || 'Unknown';
  const snapshotRisk = result?.field_report?.risk_level || result?.metrics?.risk_level || 'Unknown';
  const snapshotStress = Number(result?.metrics?.stress_probability ?? result?.field_report?.stress_probability);
  const snapshotYield = Number(result?.field_report?.estimated_yield?.maunds_per_acre);
  const snapshotLoss = Number(result?.field_report?.economic_impact?.expected_loss_pkr_per_acre ?? result?.metrics?.expected_loss_pkr_per_acre);
  const compactIndexRows = [
    { key: 'ndvi', label: 'NDVI', value: Number(result?.indices?.ndvi ?? 0), min: 0.10, max: 0.85 },
    { key: 'evi', label: 'EVI', value: Number(result?.indices?.evi ?? 0), min: 0.05, max: 0.55 },
    { key: 'savi', label: 'SAVI', value: Number(result?.indices?.savi ?? 0), min: 0.12, max: 0.62 },
    { key: 'ndwi', label: 'NDWI', value: Number(result?.indices?.ndwi ?? 0), min: -0.35, max: 0.25 },
  ];
  const getCompactIndexVisual = (value) => {
    const numeric = Number.isFinite(value) ? value : 0;
    const abs = Math.min(1, Math.abs(numeric));
    const pct = Math.round(abs * 100);

    if (numeric >= 0.66) {
      return { pct, colour: '#22c55e' };
    }
    if (numeric >= 0.33) {
      return { pct, colour: '#eab308' };
    }
    if (numeric >= 0) {
      return { pct, colour: '#f97316' };
    }
    if (numeric <= -0.66) {
      return { pct, colour: '#b91c1c' };
    }
    if (numeric <= -0.33) {
      return { pct, colour: '#dc2626' };
    }
    return { pct, colour: '#f97316' };
  };

  const latestPendingOutcome = outcomeHistory.find((entry) => entry.action_status !== 'done');

  const formatStressDeltaNarrative = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return tr('Stress trend unavailable', 'اسٹریس ٹرینڈ دستیاب نہیں');
    const pct = `${Math.abs(numeric * 100).toFixed(1)}%`;
    if (numeric < 0) return tr(`Stress reduced by ${pct} (better)`, `${pct} اسٹریس کم ہوا (بہتر)`);
    if (numeric > 0) return tr(`Stress increased by ${pct} (worse)`, `${pct} اسٹریس بڑھا (کمزور)`);
    return tr('Stress unchanged', 'اسٹریس میں تبدیلی نہیں');
  };

  const formatLossDeltaNarrative = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return tr('Loss trend unavailable', 'نقصان ٹرینڈ دستیاب نہیں');
    const amount = `PKR ${Math.round(Math.abs(numeric)).toLocaleString('en-PK')}`;
    if (numeric < 0) return tr(`Expected loss reduced by ${amount} (better)`, `متوقع نقصان ${amount} کم ہوا (بہتر)`);
    if (numeric > 0) return tr(`Expected loss increased by ${amount} (worse)`, `متوقع نقصان ${amount} بڑھا (کمزور)`);
    return tr('Expected loss unchanged', 'متوقع نقصان میں تبدیلی نہیں');
  };

  const getHistoryDateLabel = (entry) => formatShortDate(entry?.analysis_date || entry?.created_at);

  const historyTimeBasisLabel = outcomeTrend?.change?.time_basis === 'analysis_date'
    ? tr('Based on analysis dates', 'تجزیہ تاریخ کی بنیاد پر')
    : tr('Based on save timestamps', 'محفوظ وقت کی بنیاد پر');

  const formatMetric = (val, formatter = 'plain') => {
    const num = Number(val);
    if (!Number.isFinite(num)) return tr('N/A', 'دستیاب نہیں');
    if (formatter === 'percent') return `${(num * 100).toFixed(1)}%`;
    if (formatter === 'pkr') return `PKR ${Math.round(num).toLocaleString('en-PK')}`;
    return String(num);
  };

  const hasHistoryFullReport = (entry) => {
    return !!(
      entry?.full_report
      || entry?.field_report
      || entry?.diagnosis
      || (Array.isArray(entry?.recommendations) && entry.recommendations.length > 0)
      || entry?.stage_checklist
    );
  };

  const handleViewFullHistoryReport = (entry) => {
    if (!hasHistoryFullReport(entry)) return;
    const full = stripEmojiDeep(entry?.full_report || {
      field_report: entry?.field_report || null,
      diagnosis: entry?.diagnosis || null,
      recommendations: entry?.recommendations || [],
      stage_checklist: entry?.stage_checklist || null,
      heatmap: entry?.heatmap || null,
      metrics: entry?.metrics || null,
      field: entry?.location || null,
    });
    const historyCostTracker = Array.isArray(entry?.cost_tracker) ? entry.cost_tracker : [];
    const withChecklist = {
      ...full,
      stage_checklist: full?.stage_checklist || buildStageChecklist(full),
      cost_tracker: Array.isArray(full?.cost_tracker) && full.cost_tracker.length > 0
        ? full.cost_tracker
        : historyCostTracker,
    };
    setResult(withChecklist);
    setInputCosts(withChecklist.cost_tracker || []);
    setActiveResultTab('overview');
    setTimeout(() => {
      document.getElementById('sat-results-anchor')?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
  };

  const renderOutcomeHistoryPanel = () => (
    <section className="sat-outcome-loop">
      <div className="sat-outcome-head">
        <div>
          <div className="sat-report-kicker">{tr('Field History', 'فیلڈ ہسٹری')}</div>
          <h3 className="sat-section-title">{tr('Action Follow-up', 'ایکشن فالو اپ')}</h3>
        </div>
        {outcomeTrend?.change?.trend && (
          <span className={`sat-outcome-trend-pill ${trendPillClass(outcomeTrend.change.trend)}`}>
            {outcomeTrend.change.trend}
          </span>
        )}
      </div>

      <div className="sat-history-selector-wrap">
        <div className="sat-outcome-action-title">{tr('Farmer History Tab', 'کسان ہسٹری ٹیب')}</div>
        <div className="sat-lang-toggle" role="group" aria-label={tr('History language toggle', 'ہسٹری زبان ٹوگل')}>
          <button
            className={`sat-lang-btn ${language === 'ur' ? 'active' : ''}`}
            onClick={() => setLanguage('ur')}
            type="button"
          >
            اردو
          </button>
          <button
            className={`sat-lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => setLanguage('en')}
            type="button"
          >
            {tr('English', 'انگریزی')}
          </button>
        </div>
        {farmerHistoryFields.length > 0 ? (
          <select
            className="sat-input"
            value={selectedHistoryLocationId || farmerHistoryFields[0]?.saved_location_id || farmerHistoryFields[0]?.field_signature || ''}
            onChange={async (e) => {
              const nextLocationId = e.target.value;
              const selectedSummary = farmerHistoryFields.find((field) => String(field.saved_location_id || '') === String(nextLocationId));
              const nextSig = selectedSummary?.field_signature || '';
              setSelectedHistoryLocationId(nextLocationId);
              setSelectedHistoryFieldSignature(nextSig);
              setCurrentFieldSignature(nextSig);
              await loadOutcomeHistory({
                fieldSignature: nextSig,
                locationId: nextLocationId,
              });
            }}
          >
            {farmerHistoryFields.map((field, idx) => (
              <option key={`field-history-${idx}`} value={field.saved_location_id || field.field_signature}>
                {`${(savedLocations.find((loc) => String(loc.id) === String(field.saved_location_id))?.name || 'Saved location')} - ${(field.crop || 'crop').toUpperCase()} - ${field.city || 'Unknown area'} - ${formatShortDate(field.latest_analysis_date || field.latest_saved_at)}`}
              </option>
            ))}
          </select>
        ) : (
          <div className="sat-output-sub">{tr('No saved field history yet. Run analysis once to start farmer history.', 'ابھی کوئی فیلڈ ہسٹری محفوظ نہیں۔ کسان ہسٹری شروع کرنے کے لیے ایک بار تجزیہ چلائیں۔')}</div>
        )}
      </div>

      {latestPendingOutcome && (
        <div className="sat-outcome-action-box">
          <div className="sat-outcome-action-title">{tr('Action completion', 'ایکشن مکمل کریں')}</div>
          <div className="sat-outcome-action-meta">
            {tr('Pending run date', 'زیر التوا رن کی تاریخ')}: {getHistoryDateLabel(latestPendingOutcome)}
          </div>
          <textarea
            className="sat-outcome-note"
            placeholder={tr('Optional note (e.g., irrigated 14 mm, applied urea on north patch)', 'اختیاری نوٹ (مثلاً 14 ملی میٹر آبپاشی، شمالی حصے میں یوریا)')}
            value={actionNoteDraft}
            onChange={(e) => setActionNoteDraft(e.target.value)}
            rows={2}
          />
          <button
            type="button"
            className="sat-action-btn"
            disabled={markingOutcomeId === latestPendingOutcome.id}
            onClick={() => handleMarkActionDone(latestPendingOutcome.id)}
          >
            {markingOutcomeId === latestPendingOutcome.id
              ? tr('Saving...', 'محفوظ ہو رہا ہے...')
              : tr('Mark Action Done', 'ایکشن مکمل نشان زد کریں')}
          </button>
        </div>
      )}

      {!latestPendingOutcome && (
        <div className="sat-output-sub">
          {tr('No pending action for this field. Create a new analysis run to get a new pending action.', 'اس فیلڈ کے لیے کوئی زیرِ التوا ایکشن نہیں۔ نیا تجزیہ رن کریں تاکہ نیا pending ایکشن بنے۔')}
        </div>
      )}

      <div style={{ marginTop: '10px' }}>
        <button
          type="button"
          className="sat-action-btn secondary"
          onClick={() => setShowOutcomeDetails((prev) => !prev)}
        >
          {showOutcomeDetails
            ? tr('Hide History Details', 'ہسٹری تفصیل چھپائیں')
            : tr('Show History Details', 'ہسٹری تفصیل دکھائیں')}
        </button>
      </div>

      {showOutcomeDetails && (
        <>

      {outcomeTrend && (
        <div className="sat-outcome-metrics">
          <div className="sat-outcome-metric-card">
            <div className="sat-yield-lbl">Stress Trend</div>
            <div className="sat-yield-val">
              {formatStressDeltaNarrative(outcomeTrend.change?.stress_probability)}
            </div>
            <div className="sat-output-sub">
              {getHistoryDateLabel(outcomeTrend.baseline)} to {getHistoryDateLabel(outcomeTrend.latest)}
            </div>
          </div>
          <div className="sat-outcome-metric-card">
            <div className="sat-yield-lbl">Expected Loss Trend</div>
            <div className="sat-yield-val">
              {formatLossDeltaNarrative(outcomeTrend.change?.expected_loss_pkr_per_acre)}
            </div>
            <div className="sat-output-sub">Lower expected loss means recovery is happening.</div>
          </div>
          <div className="sat-outcome-metric-card">
            <div className="sat-yield-lbl">Trend Basis</div>
            <div className="sat-yield-val">{outcomeTrend.change?.trend || 'N/A'}</div>
            <div className="sat-output-sub">{historyTimeBasisLabel}</div>
          </div>
        </div>
      )}

      <div className="sat-history-list-wrap">
        <div className="sat-history-list-title">Location history (same day duplicates hidden unless changed)</div>
        {outcomeHistory.length === 0 ? (
          <div className="sat-output-sub">No previous analyses found for this location yet.</div>
        ) : (
          <div className="sat-history-list">
            {outcomeHistory.map((entry) => {
              const heatmap = entry?.heatmap || {};
              const hasRasterHeatmap = heatmap?.fetched && heatmap?.type === 'raster' && heatmap?.tile_url;
              const historyCenter = [
                Number(entry?.location?.latitude || markerPos?.[0] || mapCenter?.[0]),
                Number(entry?.location?.longitude || markerPos?.[1] || mapCenter?.[1]),
              ];
              const historyPolygon = Array.isArray(entry?.field_polygon)
                ? entry.field_polygon
                    .map((pt) => [Number(pt?.lat), Number(pt?.lon)])
                    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
                : [];
              const topRecs = Array.isArray(entry?.recommendations) ? entry.recommendations.slice(0, 3) : [];
              const historyCostTracker = Array.isArray(entry?.cost_tracker) ? entry.cost_tracker : [];
              const totalTrackedCost = historyCostTracker.reduce((sum, item) => {
                const num = Number(item?.amount || item?.cost || 0);
                return sum + (Number.isFinite(num) ? num : 0);
              }, 0);
              const historyCostPreview = historyCostTracker.slice(0, 5);

              return (
                <div className="sat-history-item" key={`history-${entry.id}`}>
                  <div className="sat-history-item-top">
                    <div className="sat-history-item-date">{getHistoryDateLabel(entry)}</div>
                    <div className="sat-history-item-status">
                      {entry.action_status === 'done' ? 'Action Done' : 'Pending'}
                    </div>
                  </div>

                  <div className="sat-history-item-metrics">
                    <span>Stress: {formatMetric(entry?.metrics?.stress_probability, 'percent')}</span>
                    <span>Expected Loss: {formatMetric(entry?.metrics?.expected_loss_pkr_per_acre, 'pkr')}</span>
                    <span>Risk: {entry?.metrics?.risk_level || 'N/A'}</span>
                  </div>

                  {historyCostTracker.length > 0 && (
                    <div className="sat-history-note">
                      {tr('Cost tracker', 'لاگت ٹریکر')}: PKR {Math.round(totalTrackedCost).toLocaleString('en-PK')} ({historyCostTracker.length} {tr('items', 'اشیاء')})
                      <div style={{ marginTop: '6px' }}>
                        {historyCostPreview.map((costItem, idx) => (
                          <div key={`history-cost-${entry.id}-${idx}`}>
                            • {String(costItem?.item || costItem?.name || tr('Item', 'آئٹم'))}
                            {costItem?.category ? ` (${costItem.category})` : ''}: PKR {Number(costItem?.amount || costItem?.cost || 0).toLocaleString('en-PK')}
                            {costItem?.date ? ` • ${costItem.date}` : ''}
                            {costItem?.notes ? ` • ${costItem.notes}` : ''}
                          </div>
                        ))}
                        {historyCostTracker.length > historyCostPreview.length ? (
                          <div>{tr('and more...', 'اور مزید...')}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {entry?.action_note ? (
                    <div className="sat-history-note">Saved note: {entry.action_note}</div>
                  ) : null}

                  {hasHistoryFullReport(entry) && (
                    <button
                      type="button"
                      className="sat-action-btn secondary"
                      onClick={() => handleViewFullHistoryReport(entry)}
                    >
                      View Full Report
                    </button>
                  )}

                  {topRecs.length > 0 && (
                    <div className="sat-history-recs">
                      <div className="sat-history-recs-title">Saved recommendations</div>
                      {topRecs.map((rec, idx) => (
                        <div className="sat-history-rec-item" key={`history-rec-${entry.id}-${idx}`}>
                          {shortenText(farmerizeText(rec?.action || rec?.type || 'Follow recommended field action'), 100)}
                        </div>
                      ))}
                    </div>
                  )}

                  {Array.isArray(entry?.stage_checklist?.items) && entry.stage_checklist.items.length > 0 && (
                    <div className="sat-history-recs">
                      <div className="sat-history-recs-title">Saved stage checklist</div>
                      {entry.stage_checklist.items.slice(0, 3).map((task, idx) => (
                        <div className="sat-history-rec-item" key={`history-check-${entry.id}-${idx}`}>
                          {task?.window ? `${task.window}: ` : ''}{task?.task || 'Check field activity'}
                        </div>
                      ))}
                    </div>
                  )}

                  {hasRasterHeatmap ? (
                    <div className="sat-history-heatmap-wrap">
                      <MapContainer
                        center={historyCenter}
                        zoom={16}
                        attributionControl={false}
                        className="sat-history-heatmap-map"
                        scrollWheelZoom={false}
                        dragging={false}
                        zoomControl={false}
                        doubleClickZoom={false}
                        keyboard={false}
                        touchZoom={false}
                      >
                        <TileLayer
                          attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                          url={heatmap.tile_url}
                          opacity={heatmap.opacity ?? 0.5}
                        />
                        {historyPolygon.length >= 3 && (
                          <Polygon
                            positions={historyPolygon}
                            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.12, weight: 2 }}
                          />
                        )}
                        <Marker position={historyCenter} />
                      </MapContainer>
                    </div>
                  ) : (
                    <div className="sat-output-sub">{tr('Heatmap unavailable for this run.', 'اس رن کے لیے ہیٹ میپ دستیاب نہیں۔')}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(outcomeLoading || farmerHistoryLoading) && <div className="sat-output-sub">{tr('Loading farmer history...', 'کسان کی ہسٹری لوڈ ہو رہی ہے۔۔۔')}</div>}
      {(outcomeError || farmerHistoryError) && <div className="sat-error">{outcomeError || farmerHistoryError}</div>}
        </>
      )}
    </section>
  );

  // ─── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="sat-page sat-theme-light sat-theme-revamp">
      {pageLoading && (
        <div className="sat-loading-overlay sat-loading-satellite" aria-live="polite" aria-busy="true">
          <div className="sat-loading-orbit">
            <div className="sat-loading-orbit-ring" />
            <div className="sat-loading-planet" />
            <div className="sat-loading-sat">
              <span className="sat-loading-sat-core" />
              <span className="sat-loading-sat-panel" />
            </div>
          </div>
          <div className="sat-loading-label">
            {tr('Locking satellite view...', 'سیٹلائٹ ویو تیار ہو رہی ہے...')}
          </div>
        </div>
      )}
      {loading && (
        <div className="sat-loading-overlay sat-analysis-loading" aria-live="polite" aria-busy="true">
          <div className="sat-analysis-orbit">
            <div className="sat-analysis-orbit-ring" />
            <div className="sat-analysis-earth" />
            <div className="sat-analysis-sat">
              <span className="sat-analysis-sat-core" />
              <span className="sat-analysis-sat-panel" />
            </div>
          </div>
          <div className="sat-loading-label">
            {tr('Scanning field from orbit...', 'مدار سے کھیت اسکین ہو رہا ہے...')}
          </div>
        </div>
      )}
      <div className={`sat-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${historyReportMode ? 'no-sidebar' : ''}`}>
        {!historyReportMode && (
        <aside className={`sat-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sat-sidebar-top">
            <button className="sat-logo-btn sat-sidebar-logo" onClick={() => navigateWithPendingRevert('/home')}>
              <span>FASALGUARD</span>
            </button>
            <button
              type="button"
              className="sat-sidebar-collapse-btn"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              aria-label={isSidebarCollapsed ? tr('Open sidebar', 'سائیڈبار کھولیں') : tr('Close sidebar', 'سائیڈبار بند کریں')}
              title={isSidebarCollapsed ? tr('Open sidebar', 'سائیڈبار کھولیں') : tr('Close sidebar', 'سائیڈبار بند کریں')}
            >
              ☰
            </button>
          </div>
          <div className="sat-sidebar-links">
            <button className="sat-nav-btn sat-sidebar-btn" onClick={() => navigateWithPendingRevert('/crop-prediction')}>
              <span className="sat-sidebar-icon" aria-hidden="true">🌾</span>
              {tr('Crop Prediction', 'فصل پیش گوئی')}
            </button>
            <button className="sat-nav-btn sat-sidebar-btn" onClick={() => navigateWithPendingRevert('/soil-analysis')}>
              <span className="sat-sidebar-icon" aria-hidden="true">🧪</span>
              {tr('Soil Analysis', 'مٹی کا تجزیہ')}
            </button>
            <button className="sat-nav-btn sat-sidebar-btn" onClick={() => navigateWithPendingRevert('/past-trends')}>
              <span className="sat-sidebar-icon" aria-hidden="true">📈</span>
              {tr('Past Trends', 'گزشتہ رجحانات')}
            </button>
            <button className="sat-nav-btn sat-sidebar-btn" onClick={() => navigateWithPendingRevert('/satellite-history')}>
              <span className="sat-sidebar-icon" aria-hidden="true">🛰️</span>
              {tr('Your History', 'آپ کی ہسٹری')}
            </button>
          </div>
        </aside>
        )}

        <main className="sat-main">
          {historyReportMode && (
            <div className="sat-history-back-row">
              <button type="button" className="sat-action-btn secondary sat-history-back-btn" onClick={() => navigate('/satellite-history')}>
                ← {tr('Back to History', 'ہسٹری پر واپس')}
              </button>
            </div>
          )}
          {!historyReportMode && reportSavedNotice && (
            <div className="sat-inline-toast" role="status" aria-live="polite">
              {reportSavedNotice}
            </div>
          )}
          <div className="sat-container">

          {reportSavedNotice && (
            <div className="sat-inline-toast" role="status" aria-live="polite">
              {reportSavedNotice}
            </div>
          )}

          {!historyReportMode && (
          <div className="sat-welcome">
            <h1 className="sat-title">{tr('Satellite Field Analysis', 'سیٹلائٹ فیلڈ تجزیہ')}</h1>
            <p className="sat-subtitle">
              {tr('Farmer-first crop stress guidance for Pakistan using Sentinel-2 satellite imagery', 'سینٹینل-2 سیٹلائٹ امیجری کے ذریعے پاکستان کے لیے کسان دوست فصل اسٹریس رہنمائی')}
            </p>
            <div className="sat-workflow-strip" aria-label={tr('Satellite workflow', 'سیٹلائٹ ورک فلو')}>
              <span className={`sat-workflow-chip ${selectedCrop ? 'done' : ''}`}>{tr('1. Crop', '1۔ فصل')}</span>
              <span className={`sat-workflow-chip ${selectedCity ? 'done' : ''}`}>{tr('2. District', '2۔ ضلع')}</span>
              <span className={`sat-workflow-chip ${(markerPos || hasValidTypedCoordinates || boundaryReady) ? 'done' : ''}`}>{tr('3. Locate Field', '3۔ کھیت منتخب کریں')}</span>
              <span className={`sat-workflow-chip ${boundaryReady ? 'done' : ''}`}>{tr('4. Boundary', '4۔ حد')}</span>
              <span className="sat-workflow-chip">{tr('5. Analyze', '5۔ تجزیہ')}</span>
            </div>
            <div className="sat-local-context" role="note" aria-label={tr('Local farming context', 'مقامی زرعی پس منظر')}>
              <div className="sat-local-context-title">{tr('Built for Pakistani growers', 'پاکستانی کاشتکاروں کے لیے تیار')}</div>
              <div className="sat-local-context-grid">
                <div className="sat-local-context-item">
                  <span className="sat-local-context-kicker">{tr('Coverage', 'کوریج')}</span>
                  <span className="sat-local-context-value">{tr('Punjab farm belts (demo zones)', 'پنجاب کے زرعی علاقے (ڈیمو زونز)')}</span>
                </div>
                <div className="sat-local-context-item">
                  <span className="sat-local-context-kicker">{tr('Language', 'زبان')}</span>
                  <span className="sat-local-context-value">{tr('Fully bilingual: Urdu and English', 'مکمل دو لسانی: اردو اور انگریزی')}</span>
                </div>
                <div className="sat-local-context-item">
                  <span className="sat-local-context-kicker">{tr('Practical Use', 'عملی استعمال')}</span>
                  <span className="sat-local-context-value">{tr('Field-wise action timing for irrigation and crop stress', 'آبپاشی اور فصل اسٹریس کے لیے کھیت وار ایکشن ٹائمنگ')}</span>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ── main card ── */}
          {!historyReportMode && (
          <div className="sat-main-card">

            {/* 0 · Farm Location Selection */}
            {!historyReportMode && showLocationPanel && (
              <section className="sat-section sat-locations-section">
                <h3 className="sat-section-title">
                  {tr('My Farm Locations', 'میری فارم کی لوکیشنز')}
                </h3>
                
                {locationsLoading && (
                  <div className="sat-loading-spinner">
                    {tr('Loading locations...', 'لوکیشنز لوڈ ہو رہی ہیں...')}
                  </div>
                )}

                {locationsError && (
                  <div className="sat-error-banner">
                    {locationsError}
                  </div>
                )}

                {!locationsLoading && cropScopedSavedLocations.length > 0 && (
                  <div className="sat-locations-grid">
                    {cropScopedSavedLocations.map((location) => (
                      <div 
                        key={location.id} 
                        className={`sat-location-card ${String(selectedLocationId) === String(location.id) ? 'active' : ''}`}
                      >
                        <button
                          className="sat-location-select-btn"
                          onClick={() => loadLocationToMap(location.id)}
                          type="button"
                        >
                          <div className="sat-location-name">
                            {location.name}
                          </div>
                          {location.city && (
                            <div className="sat-location-meta">
                              {location.city}
                            </div>
                          )}
                          {Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) && (
                            <div className="sat-location-meta">
                              {`${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`}
                            </div>
                          )}
                          {location.crop && (
                            <div className="sat-location-crop">
                              {location.crop.charAt(0).toUpperCase() + location.crop.slice(1)}
                            </div>
                          )}
                        </button>
                        <button
                          className="sat-location-delete-btn"
                          onClick={() => deleteLocation(location.id)}
                          type="button"
                          aria-label={tr('Delete location', 'لوکیشن حذف کریں')}
                          title={tr('Delete location', 'لوکیشن حذف کریں')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!locationsLoading && cropScopedSavedLocations.length === 0 && (
                  <div className="sat-empty-locations-message">
                    {tr(
                      `No saved ${selectedCrop} locations yet. Save one after analysis to reuse it quickly.`,
                      `ابھی ${selectedCrop} کی کوئی محفوظ لوکیشن نہیں۔ تجزیہ کے بعد محفوظ کریں تاکہ دوبارہ فوری استعمال ہو سکے۔`
                    )}
                  </div>
                )}

                <div className="sat-locations-collapse-btn-container">
                  {showLocationPanel && (
                    <button
                      className="sat-collapse-locations-btn"
                      onClick={() => setShowLocationPanel(false)}
                      type="button"
                      title={tr('Collapse panel', 'پینل کو کم کریں')}
                    >
                      ▼
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Show expand button when panel is collapsed */}
            {!historyReportMode && !showLocationPanel && (
              <button
                className="sat-expand-locations-btn"
                onClick={() => setShowLocationPanel(true)}
                type="button"
                title={tr('Expand panel', 'پینل کو بڑھائیں')}
              >
                {tr('Locations', 'لوکیشنز')} ▲
              </button>
            )}

            {/* 1 · Crop selection */}
            {!historyReportMode && (
            <section className="sat-section">
              <h3 className="sat-section-title">
                {tr('Select Crop', 'فصل منتخب کریں')}
              </h3>
              <div className="sat-chip-grid sat-chip-grid-crop">
                {CROPS.map((crop) => (
                  <button
                    key={crop.name}
                    className={`sat-select-chip sat-select-chip-crop ${selectedCrop === crop.name ? 'active' : ''} ${!crop.active ? 'disabled' : ''}`}
                    onClick={() => crop.active && handleCropSelect(crop.name)}
                    disabled={!crop.active}
                    title={!crop.active ? tr('Coming soon', 'جلد آرہا ہے') : ''}
                  >
                    <span className="sat-chip-icon">{crop.icon}</span>
                    <span className="sat-chip-text">{mapLang === 'ur' ? crop.urName : crop.name}</span>
                    {!crop.active && <span className="sat-coming-soon">{tr('Coming Soon', 'جلد آرہا ہے')}</span>}
                  </button>
                ))}
              </div>
            </section>
            )}

            {/* 2 · City selection */}
            {!historyReportMode && (
            <section className="sat-section">
              <h3 className="sat-section-title">
                {tr('Select City / District', 'شہر / ضلع منتخب کریں')}
              </h3>
              <div className="sat-chip-grid sat-chip-grid-city">
                {activeCityEntries.map(([name, data]) => (
                  <button
                    key={name}
                    type="button"
                    className={`sat-select-chip sat-select-chip-city ${selectedCity === name ? 'active' : ''}`}
                    onClick={() => handleCitySelect(name)}
                  >
                    <span className="sat-chip-text sat-chip-text-strong">{mapLang === 'ur' ? data.urName : name}</span>
                    <span className="sat-chip-subtext">{mapLang === 'ur' ? data.urDesc : data.desc}</span>
                  </button>
                ))}
              </div>
            </section>
            )}

            {/* 3 · Location + Map */}
            {!historyReportMode && (
            <section className="sat-section">
              <h3 className="sat-section-title">
                {tr('Set Field Location', 'کھیت کی لوکیشن منتخب کریں')}
              </h3>
              <div className="sat-lang-toggle" role="group" aria-label={tr('Map language toggle', 'نقشہ زبان ٹوگل')}>
                <button
                  className={`sat-lang-btn ${mapLang === 'ur' ? 'active' : ''}`}
                  onClick={() => setLanguage('ur')}
                  type="button"
                >
                  اردو
                </button>
                <button
                  className={`sat-lang-btn ${mapLang === 'en' ? 'active' : ''}`}
                  onClick={() => setLanguage('en')}
                  type="button"
                >
                  {tr('English', 'انگریزی')}
                </button>
              </div>

              <div className="sat-location-layout">
                {/* left: controls */}
                <div className="sat-location-controls">
                  <div className="sat-control-group sat-control-group-primary">
                    <div className="sat-farmer-locate-hint">
                      {tr('Use My Location or tap the map to find your field. Coordinates are optional.', 'اپنی لوکیشن استعمال کریں یا نقشے پر ٹیپ کر کے کھیت منتخب کریں۔ کوآرڈینیٹس اختیاری ہیں۔')}
                    </div>
                    <button
                      className="sat-geo-btn"
                      onClick={handleUseMyLocation}
                      disabled={geoLoading}
                    >
                      {geoLoading ? tr('Locating...', 'لوکیشن لی جا رہی ہے۔۔۔') : tr('Use My Location', 'میری لوکیشن استعمال کریں')}
                    </button>

                    <button
                      className="sat-go-btn"
                      type="button"
                      onClick={() => setShowManualCoordinates((prev) => !prev)}
                      title={tr('Show manual coordinate entry', 'دستی کوآرڈینیٹس انٹری دکھائیں')}
                    >
                      {showManualCoordinates ? tr('Hide Manual Coordinates', 'دستی کوآرڈینیٹس چھپائیں') : tr('Enter Coordinates Manually', 'دستی کوآرڈینیٹس درج کریں')}
                    </button>

                    {showManualCoordinates && (
                      <>
                        <div className="sat-coord-row">
                          <div className="sat-coord-field">
                            <label>{tr('Coordinates (optional)', 'کوآرڈینیٹس (اختیاری)')}</label>
                            <input
                              type="text"
                              inputMode="text"
                              placeholder={tr('e.g. 31.418000, 73.079000', 'مثال: 31.418000, 73.079000')}
                              value={coordInput}
                              list="sat-coord-history"
                              onChange={(e) => handleCoordinateChange(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleGoToLocation()}
                              className="sat-input"
                            />
                            <datalist id="sat-coord-history">
                              {coordSuggestions.map((entry, idx) => (
                                <option
                                  key={`coord-${idx}`}
                                  value={entry.value}
                                  label={entry.label}
                                />
                              ))}
                            </datalist>
                          </div>
                        </div>

                        {coordSuggestions.length > 0 && (
                          <div className="sat-recent-coords">
                            <span className="sat-recent-label">{tr('Recent', 'حالیہ')}</span>
                            <div className="sat-recent-list">
                              {coordSuggestions.map((entry, idx) => (
                                <button
                                  key={`recent-coord-${idx}`}
                                  type="button"
                                  className="sat-recent-chip"
                                  onClick={() => handleRecentCoordinatePick(entry.value)}
                                  title={entry.label}
                                >
                                  {entry.value}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          className="sat-go-btn"
                          onClick={handleGoToLocation}
                          disabled={!hasValidTypedCoordinates}
                          title={tr('Pan map to these coordinates', 'نقشے کو ان کوآرڈینیٹس پر لے جائیں')}
                        >
                          {tr('Go to Location', 'لوکیشن پر جائیں')}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="sat-control-group">
                    <div className="sat-coord-field sat-analysis-date-field">
                      <label>{tr('Analysis Date', 'تجزیہ تاریخ')}</label>
                      <input
                        type="date"
                        value={analysisDate}
                        max={todayInput}
                        onChange={(e) => handleAnalysisDateChange(e.target.value, todayInput)}
                        className="sat-input"
                      />
                      <small className="sat-season-note">
                        {selectedCrop === 'Cotton'
                          ? tr('Season: April-November', 'سیزن: اپریل تا نومبر')
                          : tr('Season: November-April', 'سیزن: نومبر تا اپریل')}
                      </small>
                      {analysisDateWarning && (
                        <small className="sat-season-warning">{analysisDateWarning}</small>
                      )}
                    </div>

                    {coordWarning && (
                      <div className="sat-coord-warning sat-coord-warning-alert">
                        <span className="sat-warning-icon">⚠️</span>
                        <span className="sat-warning-text">{coordWarning}</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* right: map */}
                <div className="sat-map-wrapper">
                  {showDrawToolbarWarning && (
                    <div className={`sat-draw-toolbar-warning ${drawAttentionPulse ? 'pulse' : ''}`} title={tr('Draw field boundary here', 'یہاں کھیت کی حد بنائیں')} aria-hidden="true">
                      !
                    </div>
                  )}
                  {selectedCity && (
                    <div className="sat-city-overlay-name">
                      {mapLang === 'ur' ? CITIES[selectedCity].urName : selectedCity}
                    </div>
                  )}
                  <MapContainer
                    center={mapCenter}
                    zoom={mapZoom}
                    attributionControl={false}
                    minZoom={4}
                    className="sat-map"
                    scrollWheelZoom
                  >
                    {mapMode === 'overview' ? (
                      <>
                        <TileLayer
                          url={mapLang === 'ur'
                            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'}
                          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                        />
                        {mapLang === 'ur' && activeCityEntries.map(([name, city]) => (
                          <Marker
                            key={`label-${name}`}
                            position={[city.lat, city.lon]}
                            icon={buildCityLabelIcon(city.urName, true)}
                            interactive={false}
                          />
                        ))}
                      </>
                    ) : (
                      <>
                        <TileLayer
                          attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        {mapLang === 'en' && (
                          <TileLayer
                            attribution='&copy; OpenStreetMap contributors'
                            url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                            opacity={0.20}
                          />
                        )}
                      </>
                    )}
                    <MapViewController center={mapCenter} zoom={mapZoom} />
                    <MapZoomController onZoomEnd={handleMapZoomEnd} />
                    <MapBoundsController bounds={mapBounds} />
                    <MapClickHandler onLocationSelect={handleMapClick} />
                    <FeatureGroup ref={fieldLayerRef}>
                      <EditControl
                        position="topleft"
                        onCreated={handleBoundaryCreated}
                        onEdited={handleBoundaryEdited}
                        onDeleted={handleBoundaryDeleted}
                        draw={{
                          marker: false,
                          circle: false,
                          circlemarker: false,
                          polyline: false,
                          polygon: false,
                          rectangle: {
                            shapeOptions: {
                              color: '#22c55e',
                              fillColor: '#22c55e',
                              fillOpacity: 0.15,
                              weight: 2,
                            },
                          },
                        }}
                        edit={{
                          edit: false,
                          remove: true,
                        }}
                      />
                    </FeatureGroup>
                    {result?.heatmap?.type !== 'raster' && result?.heatmap?.points?.map((p, idx) => (
                      <CircleMarker
                        key={`heat-${idx}`}
                        center={[p.latitude, p.longitude]}
                        radius={6}
                        pathOptions={{
                          color: heatColor(p.stress_probability),
                          fillColor: heatColor(p.stress_probability),
                          fillOpacity: 0.45,
                          weight: 1,
                        }}
                      />
                    ))}
                    {markerPos && <Marker position={markerPos} />}
                  </MapContainer>
                </div>
              </div>
            </section>
            )}

            {/* ── analyze button ── */}
            {!historyReportMode && (
            <>
            {preAnalysisMismatchWarning && (
              <div className="sat-error" style={{ marginBottom: '10px' }}>
                {tr(
                  `Pre-check: this geometry matches saved location "${preAnalysisMismatchWarning.matchedLocation?.name || 'Saved field'}" (${preAnalysisMismatchWarning.savedCropLabel}), while ${preAnalysisMismatchWarning.selectedCropLabel} is selected.`,
                  `پری چیک: یہ جیومیٹری محفوظ لوکیشن "${preAnalysisMismatchWarning.matchedLocation?.name || 'محفوظ کھیت'}" (${preAnalysisMismatchWarning.savedCropLabel}) سے میل کھاتی ہے، جبکہ ${preAnalysisMismatchWarning.selectedCropLabel} منتخب ہے۔`
                )}
              </div>
            )}
            <button
              className="sat-analyze-btn"
              onClick={() => handleAnalyze()}
              disabled={loading || !!coordWarning || !!preAnalysisMismatchWarning}
              title={tr('Generate analysis', 'تجزیہ تیار کریں')}
            >
              {loading ? (
                <>
                  <span className="sat-spinner" />
                  {tr('Fetching Satellite Data...', 'سیٹلائٹ ڈیٹا لیا جا رہا ہے۔۔۔')}
                </>
              ) : (
                <>
                  {tr('Generate Analysis', 'تجزیہ بنائیں')}
                </>
              )}
            </button>
            </>
            )}

            {/* ── error ── */}
            {error && (
              <div className="sat-error">
                {error}
              </div>
            )}

          </div>
          )}

          {/* ── results ── */}
          <div id="sat-results-anchor" />
          {result && (
            <div className="sat-results">

                {/* Header meta bar */}
                <div className="sat-results-header">
                  <h2 className="sat-results-title">{tr('Field Analysis Report', 'فیلڈ تجزیہ رپورٹ')}</h2>
                  <div className="sat-results-meta">
                    <span className="sat-meta-item">{tr('Crop', 'فصل')}: {result.crop.charAt(0).toUpperCase() + result.crop.slice(1)}</span>
                    <span className="sat-meta-item">{tr('Analysis Date', 'تجزیہ تاریخ')}: {result.field?.analysis_date || new Date(result.timestamp).toISOString().slice(0, 10)}</span>
                    <span className={`sat-data-badge ${result.data_source === 'gee_sentinel2' ? 'real' : 'simulated'}`}>
                      {result.data_source === 'gee_sentinel2' ? tr('Real Sentinel-2', 'حقیقی سینٹینل-2') : tr('Estimated Data', 'تخمینی ڈیٹا')}
                    </span>
                  </div>
                  <div className="sat-report-toolbar">
                    {historyReportMode && (
                      <div className="sat-lang-toggle" role="group" aria-label={tr('Report language toggle', 'رپورٹ زبان ٹوگل')}>
                        <button
                          className={`sat-lang-btn ${language === 'ur' ? 'active' : ''}`}
                          onClick={() => setLanguage('ur')}
                          type="button"
                        >
                          اردو
                        </button>
                        <button
                          className={`sat-lang-btn ${language === 'en' ? 'active' : ''}`}
                          onClick={() => setLanguage('en')}
                          type="button"
                        >
                          {tr('English', 'انگریزی')}
                        </button>
                      </div>
                    )}
                    {hasActionableAnalysisReport && result.is_field !== false && (
                      <button
                        type="button"
                        className="sat-action-btn secondary sat-report-new-analysis-btn"
                        onClick={handleDownloadDetailedReport}
                      >
                        {tr('Download Detailed Report', 'تفصیلی رپورٹ ڈاؤن لوڈ کریں')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="sat-action-btn secondary sat-report-new-analysis-btn"
                      onClick={handleStartNewAnalysisFromReport}
                    >
                      {tr('New Analysis', 'نیا تجزیہ')}
                    </button>
                    <button
                      type="button"
                      className="sat-report-close-btn"
                      onClick={handleCloseReportView}
                      aria-label={tr('Close report', 'رپورٹ بند کریں')}
                      title={tr('Close report', 'رپورٹ بند کریں')}
                    >
                      ✕
                    </button>
                  </div>
                  {historyReportMode && (
                    <div className="sat-history-report-banner">
                      {tr('Viewing saved report from history', 'ہسٹری سے محفوظ رپورٹ دیکھ رہے ہیں')}
                    </div>
                  )}
                  {result.is_field !== false && result.simulated_note && (
                    <div className="sat-simulated-notice">
                      {tr('Live satellite image was not available in this window. This result is an estimated advisory, so please recheck when a fresh image is available.', 'اس وقت کی ونڈو میں لائیو سیٹلائٹ تصویر دستیاب نہیں تھی۔ یہ تخمینی مشورہ ہے، نئی تصویر آنے پر دوبارہ چیک کریں۔')}
                    </div>
                  )}
                  {result.is_field !== false && result.fallback_note && (
                    <div className="sat-simulated-notice sat-fallback-notice">
                      {result.fallback_note}
                    </div>
                  )}
                </div>

                {!historyOverviewOnly && (
                <div className="sat-results-tabs" role="tablist" aria-label={tr('Result view tabs', 'نتائج کے ٹیبز')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeResultTab === 'overview'}
                    className={`sat-results-tab ${activeResultTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('overview')}
                  >
                    {tr('Overview', 'جائزہ')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeResultTab === 'water-nutrients'}
                    className={`sat-results-tab ${activeResultTab === 'water-nutrients' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('water-nutrients')}
                  >
                    {tr('Water & Nutrients', 'پانی اور غذائی اجزا')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeResultTab === 'planning'}
                    className={`sat-results-tab ${activeResultTab === 'planning' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('planning')}
                  >
                    {tr('Planning', 'منصوبہ بندی')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeResultTab === 'economics'}
                    className={`sat-results-tab ${activeResultTab === 'economics' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('economics')}
                  >
                    {tr('Economics', 'معاشی تجزیہ')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeResultTab === 'varieties'}
                    className={`sat-results-tab ${activeResultTab === 'varieties' ? 'active' : ''}`}
                    onClick={() => setActiveResultTab('varieties')}
                  >
                    {tr('Varieties & Performance', 'اقسام اور کارکردگی')}
                  </button>
                </div>
                )}

                {hasActionableAnalysisReport && (
                <div className="sat-voice-report-cta">
                  <div>
                    <div className="sat-voice-report-title">
                      {tr('Need a simple farmer explanation?', 'کیا آسان کسان وضاحت چاہیے؟')}
                    </div>
                    <div className="sat-voice-report-subtitle">
                      {tr('Open an easy full-report summary and listen in English or Urdu.', 'آسان مکمل رپورٹ خلاصہ کھولیں اور اسے انگریزی یا اردو میں سنیں۔')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sat-action-btn sat-voice-report-open-btn"
                    onClick={() => setShowVoiceReportPanel(true)}
                  >
                    {tr('Understand Report', 'رپورٹ آسان الفاظ میں')}
                  </button>
                </div>
                )}

                {/* ── Non-field / post-harvest result ── */}
                {result.is_field === false && (
                  result.status === 'post_harvest' ? (
                    <div className="sat-non-field-card">
                      <span className="sat-non-field-icon">{tr('Info', 'معلومات')}</span>
                      <div className="sat-non-field-text">
                        <h3>
                          {String(result?.crop || selectedCrop).toLowerCase() === 'cotton'
                            ? tr('Cotton season is currently over', 'کپاس کا سیزن فی الحال ختم ہے')
                            : tr('Wheat season is currently over', 'گندم کا سیزن فی الحال ختم ہے')}
                        </h3>
                        <p>
                          {String(result?.crop || selectedCrop).toLowerCase() === 'cotton'
                            ? tr('There is no active cotton crop in this month, so stress analysis is not available right now.', 'اس مہینے فعال کپاس کی فصل موجود نہیں، اس لیے اسٹریس تجزیہ دستیاب نہیں ہے۔')
                            : tr('There is no active wheat crop in this month, so stress analysis is not available right now.', 'اس مہینے فعال گندم کی فصل موجود نہیں، اس لیے اسٹریس تجزیہ دستیاب نہیں ہے۔')}
                        </p>
                        <p className="sat-non-field-help">
                          {String(result?.crop || selectedCrop).toLowerCase() === 'cotton'
                            ? tr('For cotton stress and action advice, run analysis during the active season (April to November).', 'کپاس اسٹریس اور ایکشن مشورے کے لیے فعال سیزن (اپریل تا نومبر) میں تجزیہ کریں۔')
                            : tr('For wheat stress and action advice, run analysis during the active season (November to April).', 'گندم اسٹریس اور ایکشن مشورے کے لیے فعال سیزن (نومبر تا اپریل) میں تجزیہ کریں۔')}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="sat-non-field-card">
                      <span className="sat-non-field-icon">{tr('Alert', 'انتباہ')}</span>
                      <div className="sat-non-field-text">
                        <h3>{tr('This selected spot is not a crop field', 'منتخب جگہ زرعی کھیت نہیں ہے')}</h3>
                        <p>{tr('Detected area type', 'شناخت شدہ جگہ')}: <strong>{result.land_classification?.land_type || tr('Non-farm area', 'غیر زرعی علاقہ')}</strong>.</p>
                        <p className="sat-non-field-help">{tr('Please move to an actual farm plot and draw the field boundary to get crop stress and recommendation results.', 'براہ کرم حقیقی زرعی پلاٹ پر جائیں اور کھیت کی حد بنائیں تاکہ فصل اسٹریس اور سفارشات حاصل ہوں۔')}</p>
                      </div>
                    </div>
                  )
                )}

                {/* ── Field results ── */}
                {result.is_field !== false && (
                  <>
                    {activeResultTab === 'overview' && (
                      <section className="sat-overview-panel">
                        {result?.is_field !== false && result?.heatmap?.fetched && result?.heatmap?.type === 'raster' && result?.heatmap?.tile_url && (
                          <section className="sat-heatmap-panel">
                            <h3 className="sat-section-title">
                              {tr('Field Heatmap', 'فیلڈ ہیٹ میپ')}
                            </h3>
                            <div className={`sat-heatmap-map-wrapper${showHeatmapAlert ? ` sat-heatmap-alert ${heatmapAlertLevel.toLowerCase()}` : ''}`}>
                              {showHeatmapAlert && (
                                <div className={`sat-heatmap-alert-ring ${heatmapAlertLevel.toLowerCase()}`} />
                              )}
                              {showHeatmapAlert && (
                                <div className={`sat-map-alert-badge ${heatmapAlertLevel.toLowerCase()}`}>
                                  <span className="sat-map-alert-dot" />
                                  {heatmapAlertText}
                                </div>
                              )}
                              <MapContainer
                                center={heatmapCenter || mapCenter}
                                zoom={17}
                                attributionControl={false}
                                className="sat-heatmap-map"
                                scrollWheelZoom={false}
                                dragging={false}
                                zoomControl={false}
                                doubleClickZoom={false}
                                keyboard={false}
                                touchZoom={false}
                              >
                                <TileLayer
                                  attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
                                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                />
                                <TileLayer
                                  url={result.heatmap.tile_url}
                                  opacity={result.heatmap.opacity ?? 0.50}
                                />
                                {fieldPolygon.length >= 3 && (
                                  <Polygon
                                    positions={fieldPolygon}
                                    pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.12, weight: 2 }}
                                  />
                                )}
                              </MapContainer>
                              {heatmapLegend && (
                                <div className="sat-heat-legend sat-heat-legend-panel">
                                  <div className="sat-heat-legend-title">{heatmapLegend.label}</div>
                                  <div
                                    className="sat-heat-legend-bar"
                                    style={{
                                      background: `linear-gradient(90deg, ${heatmapLegend.palette.join(', ')})`,
                                    }}
                                  />
                                  <div className="sat-heat-legend-scale">
                                    <span>{heatmapLegend.min}</span>
                                    <span>{heatmapLegend.max}</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {result?.indices && (
                              <div className="sat-compact-indices-box" aria-label={tr('Compact index summary', 'مختصر انڈیکس خلاصہ')}>
                                {compactIndexRows.map((metric) => {
                                  const visual = getCompactIndexVisual(metric.value);
                                  return (
                                    <div className="sat-compact-index-row" key={`compact-${metric.key}`}>
                                      <div className="sat-compact-index-top">
                                        <span className="sat-compact-index-label">{metric.label}</span>
                                        <span className="sat-compact-index-value">{metric.value.toFixed(3)}</span>
                                      </div>
                                      <div className="sat-compact-index-track" role="img" aria-label={`${metric.label} is ${metric.value.toFixed(3)}`}>
                                        <div
                                          className="sat-compact-index-fill"
                                          style={{ width: `${visual.pct}%`, background: visual.colour }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        )}
                        <HighAlertPanel analysisResult={result} />
                        <FarmerQuickView analysisResult={result} />

                        {historyReportMode && historyOverviewOnly && (
                        <div style={{ marginTop: '16px', textAlign: 'center' }}>
                          <button 
                            type="button" 
                            className="sat-action-btn primary"
                            onClick={() => {
                              setHistoryOverviewOnly(false);
                              setActiveResultTab('planning');
                            }}
                          >
                            {tr('View Full Report', 'مکمل رپورٹ دیکھیں')}
                          </button>
                        </div>
                        )}
                      </section>
                    )}

                    {activeResultTab === 'water-nutrients' && (
                      <>
                        <IrrigationSchedulePanel analysisResult={result} />
                        <FertilizerDosePanel analysisResult={result} />
                        <MicronutrientPanel analysisResult={result} />
                      </>
                    )}

                    {activeResultTab === 'planning' && (
                      <>
                        <FieldReportCard fr={result.field_report || buildFallbackFieldReport(result)} />

                        {recommendationsToShow.length > 0 && (
                          <div className="sat-recommendations sat-recommendations-readable">
                            <h3 className="sat-section-title">
                              {tr('Actionable Recommendations', 'عملی سفارشات')}
                            </h3>
                            <div className="sat-rec-group-title">{tr('Top Recommendations', 'اہم سفارشات')}</div>
                            <div className="sat-irr-quick-actions sat-rec-plan-grid">
                              {recommendationsToShow.map((rec, i) => (
                                <RichRecCard key={`planning-rec-${i}`} rec={rec} />
                              ))}
                            </div>
                          </div>
                        )}

                        <StageChecklistPanel analysisResult={result} />
                        <PestDiseasePanel analysisResult={result} />
                      </>
                    )}

                    {activeResultTab === 'economics' && (
                      <>
                        <ROIPanel analysisResult={result} />
                        <InputCostTracker analysisResult={result} />
                      </>
                    )}

                    {activeResultTab === 'varieties' && (
                      <>
                        <CropVarietyPanel analysisResult={result} />
                      </>
                    )}

                  </>
                )}

                {!historyReportMode && showOutcomeHistoryActionPanel && renderOutcomeHistoryPanel()}

            </div>
          )}

          {/* Delete Location Confirmation Modal */}
          {showVoiceReportPanel && result && hasActionableAnalysisReport && (
            <div className="sat-modal-overlay" onClick={() => { stopVoiceReportAudio(); setShowVoiceReportPanel(false); }}>
              <div className="sat-modal-card sat-voice-report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="sat-modal-header">
                  <h3 className="sat-modal-title">
                    {tr('Satellite Report in Easy Words', 'سیٹلائٹ رپورٹ آسان الفاظ میں')}
                  </h3>
                  <button
                    className="sat-modal-close-btn"
                    onClick={() => { stopVoiceReportAudio(); setShowVoiceReportPanel(false); }}
                    type="button"
                    aria-label={tr('Close', 'بند کریں')}
                  >
                    ✕
                  </button>
                </div>
                <div className="sat-modal-body sat-voice-report-body">
                  <div className="sat-voice-report-hero">
                    <div className="sat-voice-report-hero-title">
                      {vtr('Satellite Report in Easy Words', 'سیٹلائٹ رپورٹ آسان الفاظ میں', 'सैटेलाइट रिपोर्ट आसान शब्दों में')}
                    </div>
                    <div className="sat-voice-report-hero-subtitle">
                      {vtr(
                        'Farmer-friendly summary with clear next actions.',
                        'کسان دوست خلاصہ، واضح اگلے اقدامات کے ساتھ۔',
                        'किसान के लिए आसान सार, स्पष्ट अगले कदमों के साथ।',
                      )}
                    </div>
                  </div>

                  <div className="sat-voice-report-language-row" role="group" aria-label={tr('Voice language', 'آواز کی زبان')}>
                    {VOICE_REPORT_LANGUAGES.map((langOption) => (
                      <button
                        key={langOption.id}
                        type="button"
                        className={`sat-lang-btn ${voiceReportLanguage === langOption.id ? 'active' : ''}`}
                        onClick={() => setVoiceReportLanguage(langOption.id)}
                      >
                        {langOption.label}
                      </button>
                    ))}
                  </div>

                  {voiceReportTranslating && (
                    <div className="sat-voice-report-subtitle">
                      {vtr('Translating report...', 'رپورٹ ترجمہ ہو رہی ہے...', 'रिपोर्ट का अनुवाद हो रहा है...')}
                    </div>
                  )}

                  <div className="sat-voice-report-text" dir={voiceReportDir}>
                    {voiceReportLines.map((line, idx) => (
                      <p key={`voice-line-${idx}`} className={`sat-voice-report-line ${idx === 0 ? 'lead' : ''}`}>
                        {line}
                      </p>
                    ))}
                  </div>

                  <div className="sat-voice-report-controls">
                    <button
                      type="button"
                      className="sat-action-btn"
                      onClick={playVoiceReportAudio}
                      disabled={voiceReportLoading || voiceReportTranslating || !effectiveVoiceReportText}
                    >
                      {voiceReportLoading
                        ? tr('Preparing audio...', 'آڈیو تیار ہو رہی ہے...')
                        : tr('Read Full Report Aloud', 'مکمل رپورٹ سنائیں')}
                    </button>
                    <button
                      type="button"
                      className="sat-action-btn secondary"
                      onClick={stopVoiceReportAudio}
                      disabled={!voiceReportPlaying}
                    >
                      {tr('Stop Audio', 'آڈیو روکیں')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {deleteConfirmLocationId && (
            <div className="sat-modal-overlay" onClick={() => setDeleteConfirmLocationId(null)}>
              <div className="sat-modal-card sat-delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="sat-modal-header">
                  <h3 className="sat-modal-title">
                    {tr('Delete Location?', 'لوکیشن ڈیلیٹ کریں؟')}
                  </h3>
                  <button
                    className="sat-modal-close-btn"
                    onClick={() => setDeleteConfirmLocationId(null)}
                    type="button"
                    aria-label={tr('Close', 'بند کریں')}
                  >
                    ✕
                  </button>
                </div>
                <div className="sat-modal-body">
                  <p className="sat-modal-text">
                    {tr(`Are you sure you want to delete "${deleteConfirmLocationName}"?`, `کیا آپ کو یقین ہے کہ آپ "${deleteConfirmLocationName}" کو ڈیلیٹ کرنا چاہتے ہیں؟`)}
                  </p>
                  <p className="sat-modal-text sat-text-muted">
                    {tr('This action cannot be undone.', 'یہ کارروائی واپس نہیں کی جا سکتی۔')}
                  </p>
                </div>
                <div className="sat-modal-footer">
                  <button
                    className="sat-btn-cancel"
                    onClick={() => setDeleteConfirmLocationId(null)}
                    type="button"
                  >
                    {tr('Cancel', 'منسوخ کریں')}
                  </button>
                  <button
                    className="sat-btn-delete"
                    onClick={confirmDeleteLocation}
                    type="button"
                  >
                    {tr('Delete', 'ڈیلیٹ کریں')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Save Location Prompt Modal */}
          {showSaveLocationPrompt && (
            <div className="sat-modal-overlay" onClick={() => setShowSaveLocationPrompt(false)}>
              <div className="sat-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="sat-modal-header">
                  <h3 className="sat-modal-title">
                    {tr('Save This Farm Location', 'اس کھیت کی لوکیشن محفوظ کریں')}
                  </h3>
                  <button
                    className="sat-modal-close-btn"
                    onClick={() => setShowSaveLocationPrompt(false)}
                    type="button"
                    aria-label={tr('Close', 'بند کریں')}
                  >
                    ✕
                  </button>
                </div>
                <div className="sat-modal-body">
                  <p className="sat-modal-text">
                    {tr('Give this farm location a name so you can quickly run analysis again in the future.', 'اس کھیت کو نام دیں تاکہ آپ آگے چل کر جلدی سے تجزیہ چلا سکیں۔')}
                  </p>
                  <input
                    type="text"
                    className="sat-location-name-input"
                    placeholder={tr('e.g., North Field, 5 acres', 'مثال: شمالی کھیت، 5 ایکڑ')}
                    value={saveLocationName}
                    onChange={(e) => setSaveLocationName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        saveLocationAfterAnalysis();
                      }
                    }}
                  />
                  {locationsError && (
                    <div className="sat-error-banner">
                      {locationsError}
                    </div>
                  )}
                </div>
                <div className="sat-modal-footer">
                  <button
                    className="sat-btn-cancel"
                    onClick={() => setShowSaveLocationPrompt(false)}
                    type="button"
                  >
                    {tr('Skip', 'چھوڑیں')}
                  </button>
                  <button
                    className="sat-btn-save"
                    onClick={saveLocationAfterAnalysis}
                    disabled={savingLocation || !saveLocationName.trim()}
                    type="button"
                  >
                    {savingLocation ? tr('Saving...', 'محفوظ ہو رہا ہے...') : tr('Save Location', 'لوکیشن محفوظ کریں')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Update Saved Location Confirmation Modal */}
          {pendingUpdateLocationId && (
            <div className="sat-modal-overlay" onClick={cancelUpdateSavedLocation}>
              <div className="sat-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="sat-modal-header">
                  <h3 className="sat-modal-title">
                    {tr('Update this saved location?', 'کیا آپ اس محفوظ مقام کو اپ ڈیٹ کرنا چاہتے ہیں؟')}
                  </h3>
                  <button
                    className="sat-modal-close-btn"
                    onClick={cancelUpdateSavedLocation}
                    type="button"
                    aria-label={tr('Close', 'بند کریں')}
                  >
                    ✕
                  </button>
                </div>
                <div className="sat-modal-body">
                  <p className="sat-modal-text">
                    {tr('You edited the boundary or coordinates for a saved farm. Would you like to update the saved location with these changes?', 'آپ نے محفوظ کھیت کی حد یا کوآرڈینیٹس میں تبدیلی کی ہے۔ کیا آپ ان تبدیلیوں کے ساتھ محفوظ مقام اپ ڈیٹ کرنا چاہتے ہیں؟')}
                  </p>
                  <p className="sat-modal-text sat-text-muted">
                    {tr('This will overwrite the existing saved location.', 'یہ موجودہ محفوظ مقام کو اوور رائٹ کرے گا۔')}
                  </p>
                  {locationsError && (
                    <div className="sat-error-banner">
                      {locationsError}
                    </div>
                  )}
                </div>
                <div className="sat-modal-footer">
                  <button
                    className="sat-btn-cancel"
                    onClick={cancelUpdateSavedLocation}
                    type="button"
                    disabled={updatingLocation}
                  >
                    {tr('Cancel', 'منسوخ کریں')}
                  </button>
                  <button
                    className="sat-btn-save"
                    onClick={confirmUpdateSavedLocation}
                    type="button"
                    disabled={updatingLocation}
                  >
                    {updatingLocation ? tr('Updating...', 'اپ ڈیٹ ہو رہا ہے...') : tr('Update saved location', 'محفوظ مقام اپ ڈیٹ کریں')}
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>
        </main>
      </div>
    </div>
  );
};

export default SatelliteAnalysis;

