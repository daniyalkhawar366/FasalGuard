import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pickCurrentWeather = (data) => {
  const first = Array.isArray(data?.forecast) && data.forecast.length > 0 ? data.forecast[0] : null;
  if (first) {
    return {
      temp: toNumber(first.T2M ?? first.temperature ?? first.temp),
      humidity: toNumber(first.RH2M ?? first.humidity),
      rain: toNumber(first.PRECTOTCORR ?? first.rainfall ?? first.precipitation),
      wind: toNumber(first.WS2M ?? first.windSpeed ?? first.wind),
      desc: String(first.weatherDescription || first.description || '').trim(),
    };
  }

  const current = data?.currentWeather || data?.weather_data?.currentWeather || null;
  if (!current) return null;

  return {
    temp: toNumber(current.T2M ?? current.temperature ?? current.temp),
    humidity: toNumber(current.RH2M ?? current.humidity),
    rain: toNumber(current.PRECTOTCORR ?? current.rainfall ?? current.precipitation),
    wind: toNumber(current.WS2M ?? current.windSpeed ?? current.wind),
    desc: String(current.weatherDescription || current.description || '').trim(),
  };
};

export default function CompactWeatherInfo({ city = '', title, subtitle, variant = 'compact', weatherData = null, loadingExternal = false }) {
  const { language } = useLanguage();
  const tr = (en, ur) => (language === 'ur' ? ur : en);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const normalizedCity = String(city || '').trim();
  const hasExternalWeather = weatherData !== null;
  const displayCity = String((weatherData && weatherData.city) || normalizedCity).trim();
  const isProminent = variant === 'prominent';
  const isLoading = hasExternalWeather ? loadingExternal : loading;

  useEffect(() => {
    if (!hasExternalWeather) return;
    setWeather(pickCurrentWeather(weatherData));
  }, [hasExternalWeather, weatherData]);

  useEffect(() => {
    if (hasExternalWeather) {
      setLoading(false);
      return;
    }

    if (!normalizedCity) {
      setWeather(null);
      return;
    }

    let isMounted = true;
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(normalizedCity)}&days=3`);
        const data = await response.json();
        if (!isMounted) return;
        setWeather(pickCurrentWeather(data));
      } catch {
        if (isMounted) setWeather(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [hasExternalWeather, normalizedCity]);

  const weatherSummary = useMemo(() => {
    if (!weather) return null;
    return {
      temp: weather.temp != null ? `${Math.round(weather.temp)}C` : '--',
      humidity: weather.humidity != null ? `${Math.round(weather.humidity)}%` : '--',
      rain: weather.rain != null ? `${weather.rain.toFixed(1)} mm` : '--',
      wind: weather.wind != null ? `${weather.wind.toFixed(1)} m/s` : '--',
      desc: weather.desc || tr('No description', 'تفصیل دستیاب نہیں'),
    };
  }, [weather, language]);

  const sectionStyle = {
    border: isProminent ? '1px solid #b9d8c5' : '1px solid #d8e6dc',
    background: '#ffffff',
    borderRadius: isProminent ? '14px' : '10px',
    padding: isProminent ? '14px 16px' : '10px 12px',
    marginBottom: isProminent ? '14px' : '12px',
    color: '#1f3d2d',
    boxShadow: isProminent ? '0 8px 24px rgba(30, 90, 58, 0.12)' : 'none',
  };

  const titleStyle = {
    fontSize: isProminent ? '1rem' : '0.86rem',
    fontWeight: 800,
  };

  const subtitleStyle = {
    fontSize: isProminent ? '0.84rem' : '0.78rem',
    color: '#557260',
  };

  const metricTileStyle = {
    background: '#ffffff',
    border: isProminent ? '1px solid #cfe3d5' : '1px solid #dde8e0',
    borderRadius: isProminent ? '10px' : '8px',
    padding: isProminent ? '10px' : '7px',
  };

  const metricLabelStyle = {
    fontSize: isProminent ? '0.78rem' : '0.72rem',
    color: '#5d7567',
  };

  const metricValueStyle = {
    fontSize: isProminent ? '1rem' : '0.88rem',
    fontWeight: 700,
  };

  return (
    <section
      style={sectionStyle}
      aria-label={tr('Current weather summary', 'موجودہ موسم کا خلاصہ')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <div>
          <div style={titleStyle}>{title || tr('Current Weather', 'موجودہ موسم')}</div>
          <div style={subtitleStyle}>{subtitle || displayCity || tr('Selected city', 'منتخب شہر')}</div>
        </div>
        <div style={subtitleStyle}>{displayCity || tr('City unavailable', 'شہر دستیاب نہیں')}</div>
      </div>

      {isLoading && <div style={{ fontSize: isProminent ? '0.9rem' : '0.8rem', marginTop: '8px' }}>{tr('Loading weather...', 'موسم لوڈ ہو رہا ہے...')}</div>}

      {!isLoading && !weatherSummary && (
        <div style={{ fontSize: isProminent ? '0.9rem' : '0.8rem', marginTop: '8px' }}>{tr('Weather data unavailable.', 'موسم کا ڈیٹا دستیاب نہیں۔')}</div>
      )}

      {!isLoading && weatherSummary && (
        <>
          <div
            style={{
              marginTop: '8px',
              display: 'grid',
              gridTemplateColumns: isProminent
                ? 'repeat(auto-fit, minmax(118px, 1fr))'
                : 'repeat(auto-fit, minmax(92px, 1fr))',
              gap: isProminent ? '10px' : '8px',
            }}
          >
            <div style={metricTileStyle}>
              <div style={metricLabelStyle}>{tr('Temp', 'درجہ حرارت')}</div>
              <div style={metricValueStyle}>{weatherSummary.temp}</div>
            </div>
            <div style={metricTileStyle}>
              <div style={metricLabelStyle}>{tr('Humidity', 'نمی')}</div>
              <div style={metricValueStyle}>{weatherSummary.humidity}</div>
            </div>
            <div style={metricTileStyle}>
              <div style={metricLabelStyle}>{tr('Rain', 'بارش')}</div>
              <div style={metricValueStyle}>{weatherSummary.rain}</div>
            </div>
            <div style={metricTileStyle}>
              <div style={metricLabelStyle}>{tr('Wind', 'ہوا')}</div>
              <div style={metricValueStyle}>{weatherSummary.wind}</div>
            </div>
          </div>
          <div style={{ marginTop: isProminent ? '9px' : '7px', fontSize: isProminent ? '0.88rem' : '0.78rem', color: '#4f6759' }}>{weatherSummary.desc}</div>
        </>
      )}
    </section>
  );
}
