import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './FarmerHistoryPage.css';
import { useLanguage } from './context/LanguageContext';
import CompactWeatherInfo from './components/CompactWeatherInfo';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';
const SAT_OUTCOME_SESSION_KEY = 'sat_outcome_session_id';
const SAT_HISTORY_REPORT_KEY = 'sat_history_full_report_v1';

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

const buildHistoryReportPayload = (entry) => {
  if (entry?.full_report && typeof entry.full_report === 'object') {
    return entry.full_report;
  }
  return {
    crop: entry?.crop || null,
    field_report: entry?.field_report || null,
    diagnosis: entry?.diagnosis || null,
    recommendations: Array.isArray(entry?.recommendations) ? entry.recommendations : [],
    stage_checklist: entry?.stage_checklist || null,
    cost_tracker: Array.isArray(entry?.cost_tracker) ? entry.cost_tracker : [],
    heatmap: entry?.heatmap || null,
    metrics: entry?.metrics || null,
    field: entry?.location || null,
  };
};

const getHistoryOverview = (entry) => {
  const report = buildHistoryReportPayload(entry);
  const overview = report?.field_report?.status_summary
    || report?.farmer_summary?.summary
    || report?.diagnosis?.primary_concern
    || report?.diagnosis?.immediate_action
    || '';
  const clean = String(overview || '').trim();
  return clean || 'Overview unavailable for this run.';
};

const FarmerHistoryPage = () => {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const tr = useCallback((en, ur) => (language === 'ur' ? ur : en), [language]);
  const [outcomeSessionId] = useState(() => ensureOutcomeSessionId());
  const [savedLocations, setSavedLocations] = useState([]);
  const [fields, setFields] = useState([]);
  const [selectedFieldSignature, setSelectedFieldSignature] = useState('');
  const [selectedFieldIndex, setSelectedFieldIndex] = useState(0);
  const [history, setHistory] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const getSavedLocationName = useCallback((savedLocationId) => {
    if (!savedLocationId) return '';
    const matched = savedLocations.find((loc) => String(loc?.id) === String(savedLocationId));
    return matched?.name || '';
  }, [savedLocations]);

  const getFieldDisplayName = useCallback((field, index) => {
    const savedName = getSavedLocationName(field?.saved_location_id);
    if (savedName) return savedName;
    const areaName = field?.city ? `Near ${field.city}` : 'Your Area';
    return `Field ${index + 1} - ${areaName}`;
  }, [getSavedLocationName]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const loadFieldHistory = useCallback(async ({ fieldSignature = '', savedLocationId = '' } = {}) => {
    if (!fieldSignature && !savedLocationId) {
      setHistory([]);
      return;
    }

    try {
      setLoadingHistory(true);
      setError('');
      const response = await axios.get(`${API_BASE}/api/satellite/outcomes/history`, {
        params: {
          session_id: outcomeSessionId,
          ...(savedLocationId ? { saved_location_id: savedLocationId } : {}),
          ...(!savedLocationId && fieldSignature ? { field_signature: fieldSignature } : {}),
          limit: 120,
        },
        headers: getAuthHeaders(),
      });

      if (response.data?.success) {
        const seenIds = new Set();
        const deduped = (Array.isArray(response.data.history) ? response.data.history : []).filter((entry) => {
          const id = String(entry?.id || '');
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });
        setHistory(deduped);
      }
    } catch (historyErr) {
      setError(historyErr.response?.data?.error || 'Could not load selected field history.');
    } finally {
      setLoadingHistory(false);
    }
  }, [getAuthHeaders, outcomeSessionId]);

  const loadFields = useCallback(async () => {
    try {
      setLoadingFields(true);
      setError('');

      const response = await axios.get(`${API_BASE}/api/satellite/outcomes/history`, {
        params: {
          session_id: outcomeSessionId,
          all_fields: true,
          limit: 300,
        },
        headers: getAuthHeaders(),
      });

      if (!response.data?.success) return;

      const fieldSummaries = Array.isArray(response.data.field_summaries)
        ? response.data.field_summaries
        : [];

      const savedLocationIdSet = new Set(savedLocations.map((loc) => String(loc?.id || '')));
      const seenFieldKeys = new Set();
      const onlySavedFieldSummaries = fieldSummaries.filter((summary) => {
        const savedLocationId = String(summary?.saved_location_id || '');
        if (!savedLocationId || !savedLocationIdSet.has(savedLocationId)) return false;
        if (seenFieldKeys.has(savedLocationId)) return false;
        seenFieldKeys.add(savedLocationId);
        return true;
      });

      const sorted = [...onlySavedFieldSummaries].sort((a, b) => {
        const aTime = new Date(a.latest_saved_at || 0).getTime();
        const bTime = new Date(b.latest_saved_at || 0).getTime();
        return bTime - aTime;
      });

      setFields(sorted);
      setSelectedFieldIndex(0);

      if (sorted.length > 0) {
        const firstField = sorted[0];
        setSelectedFieldSignature(firstField.field_signature);
      } else {
        setSelectedFieldSignature('');
        setHistory([]);
      }
    } catch (fieldsErr) {
      setError(fieldsErr.response?.data?.error || tr('Farmer history is unavailable right now.', 'کسان کی تاریخ ابھی دستیاب نہیں ہے۔'));
    } finally {
      setLoadingFields(false);
    }
  }, [getAuthHeaders, outcomeSessionId, savedLocations]);

  const loadSavedLocations = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/satellite/locations`, {
        headers: getAuthHeaders(),
      });
      if (response.data?.success) {
        setSavedLocations(Array.isArray(response.data.locations) ? response.data.locations : []);
      }
    } catch {
      setSavedLocations([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    loadSavedLocations();
  }, [loadSavedLocations]);

  useEffect(() => {
    if (savedLocations.length > 0) {
      loadFields();
    }
  }, [savedLocations, loadFields]);

  useEffect(() => {
    if (selectedFieldSignature) {
      const selectedField = fields.find((f) => f.field_signature === selectedFieldSignature);
      if (selectedField) {
        loadFieldHistory({
          fieldSignature: selectedFieldSignature,
          savedLocationId: String(selectedField.saved_location_id || ''),
        });
      }
    }
  }, [selectedFieldSignature, fields, loadFieldHistory]);

  const openFullReportInAnalysis = useCallback((entry) => {
    const reportPayload = buildHistoryReportPayload(entry);
    const currentSelectedField = fields.find((field) => field.field_signature === selectedFieldSignature) || null;
    try {
      sessionStorage.setItem(SAT_HISTORY_REPORT_KEY, JSON.stringify({
        result: reportPayload,
        activeResultTab: 'planning',
        source: 'farmer-history',
        saved_location_id: entry?.saved_location_id || currentSelectedField?.saved_location_id || '',
        field_signature: entry?.field_signature || selectedFieldSignature || '',
        savedAt: Date.now(),
      }));
    } catch {
      // no-op if storage is unavailable
    }
    navigate('/satellite-analysis?history_report=1');
  }, [fields, navigate, selectedFieldSignature]);

  const selectedField = useMemo(
    () => fields.find((field) => field.field_signature === selectedFieldSignature) || null,
    [fields, selectedFieldSignature],
  );

  const latestAnalysis = useMemo(
    () => (Array.isArray(history) && history.length > 0 ? history[0] : null),
    [history],
  );

  const historyForField = useMemo(
    () => (Array.isArray(history) ? history : []),
    [history],
  );

  const overviewWeatherCity = useMemo(() => {
    return (
      selectedField?.city
      || latestAnalysis?.city
      || latestAnalysis?.location?.city
      || latestAnalysis?.full_report?.city
      || ''
    );
  }, [latestAnalysis, selectedField]);

  const getReportOverviewDetails = useCallback((entry) => {
    const report = buildHistoryReportPayload(entry);
    const fieldReport = report?.field_report || {};
    const diagnosis = report?.diagnosis || {};
    const metrics = report?.metrics || entry?.metrics || {};

    const stressProbability = Number(metrics?.stress_probability ?? fieldReport?.stress_probability);
    const expectedLoss = Number(
      fieldReport?.economic_impact?.expected_loss_pkr_per_acre
      ?? metrics?.expected_loss_pkr_per_acre,
    );

    return {
      report,
      healthLabel: fieldReport?.health_label || report?.farmer_summary?.status_label || 'Unknown',
      riskLevel: fieldReport?.risk_level || metrics?.risk_level || 'Unknown',
      growthStage: fieldReport?.growth_stage || report?.farmer_summary?.growth_stage || 'N/A',
      summary:
        fieldReport?.status_summary
        || report?.farmer_summary?.summary
        || diagnosis?.primary_concern
        || '',
      immediateAction: diagnosis?.immediate_action || '',
      stressText: Number.isFinite(stressProbability) ? `${(stressProbability * 100).toFixed(1)}%` : 'N/A',
      lossText: Number.isFinite(expectedLoss) ? `PKR ${Math.round(expectedLoss).toLocaleString('en-PK')}` : 'N/A',
      topRecommendations: Array.isArray(report?.recommendations)
        ? report.recommendations.slice(0, 2).map((rec) => rec?.action || rec?.title || '').filter(Boolean)
        : [],
    };
  }, []);

  return (
    <div className="farmer-history-page">
      <header className="farmer-history-header">
        <button type="button" className="farmer-history-arrow-btn" onClick={() => navigate('/satellite-analysis')} aria-label={tr('Go back to analysis', 'تجزیہ پر واپس جائیں')} title={tr('Back', 'واپس')}>
          ←
        </button>
        <div>
          <h1>{tr('Your History', 'آپ کی ہسٹری')}</h1>
          <div className="farmer-history-lang-toggle" role="group" aria-label={tr('History language toggle', 'ہسٹری زبان ٹوگل')}>
            <button
              type="button"
              className={`farmer-history-lang-btn ${language === 'ur' ? 'active' : ''}`}
              onClick={() => setLanguage('ur')}
            >
              اردو
            </button>
            <button
              type="button"
              className={`farmer-history-lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              {tr('English', 'انگریزی')}
            </button>
          </div>
        </div>
      </header>

      <div className="farmer-history-layout">
        <aside className="farmer-history-fields-panel">
          <div className="farmer-history-panel-title">{tr('Your Saved Fields', 'آپ کے محفوظ کھیت')}</div>
          <div className="farmer-history-panel-subtitle">{tr('Tap a field to view past analyses in simple steps', 'ماضی کے تجزیات دیکھنے کے لیے ایک کھیت پر ٹیپ کریں')}</div>

          {loadingFields && <div className="farmer-history-muted">{tr('Loading fields...', 'کھیت لوڈ ہو رہے ہیں...')}</div>}
          {!loadingFields && fields.length === 0 && (
            <div className="farmer-history-muted">{tr('No saved field history yet. Run a satellite analysis first.', 'ابھی کوئی محفوظ کھیت کی ہسٹری نہیں۔ پہلے سیٹلائٹ تجزیہ چلائیں۔')}</div>
          )}

          <div className="farmer-history-field-list">
            {fields.map((field, idx) => {
              const isActive = field.field_signature === selectedFieldSignature;
              const fieldName = getFieldDisplayName(field, idx);

              return (
                <button
                  key={`history-field-${idx}`}
                  type="button"
                  className={`farmer-history-field-tab ${isActive ? 'active' : ''}`}
                  onClick={async () => {
                    setSelectedFieldSignature(field.field_signature);
                    setSelectedFieldIndex(idx);
                    await loadFieldHistory({
                      fieldSignature: field.field_signature,
                      savedLocationId: String(field.saved_location_id || ''),
                    });
                  }}
                >
                  <div className="farmer-history-field-line"><strong>{fieldName}</strong></div>
                  <div className="farmer-history-field-line">{tr('Crop', 'فصل')}: {(field.crop || 'crop').toUpperCase()}</div>
                  <div className="farmer-history-field-line">{tr('Saved analyses', 'محفوظ تجزیات')}: {field.total_runs || 0}</div>
                  <div className="farmer-history-field-line">{tr('Last updated', 'آخری اپڈیٹ')}: {formatShortDate(field.latest_analysis_date || field.latest_saved_at)}</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="farmer-history-details-panel">
          <div className="farmer-history-panel-title">{tr('Overview', 'جائزہ')}</div>
          {selectedField ? (
            <div className="farmer-history-selected-meta">
              <span>{getFieldDisplayName(selectedField, selectedFieldIndex)}</span>
              <span>{(selectedField.crop || 'crop').toUpperCase()}</span>
              <span>{selectedField.city || tr('Your area', 'آپ کا علاقہ')}</span>
              <span>{selectedField.total_runs || 0} {tr('runs', 'رنز')}</span>
            </div>
          ) : null}

          <CompactWeatherInfo
            city={overviewWeatherCity}
            title={tr('City Weather Snapshot', 'شہر کے موسم کا خلاصہ')}
            subtitle={tr('Live backend weather', 'لائیو بیک اینڈ موسم')}
          />

          {loadingHistory && <div className="farmer-history-muted">{tr('Loading selected field history...', 'منتخب کھیت کی ہسٹری لوڈ ہو رہی ہے...')}</div>}

          {!loadingHistory && !latestAnalysis && (
            <div className="farmer-history-muted">{tr('No analyses found for selected field.', 'منتخب کھیت کے لیے کوئی تجزیات نہیں ملے۔')}</div>
          )}

          {historyForField.length > 0 && (
            <div className="farmer-history-entry-list">
              {historyForField.map((entry) => {
                const overview = getReportOverviewDetails(entry);
                return (
                  <article className="farmer-history-entry" key={`history-entry-${entry.id}`}>
                    <div className="farmer-history-entry-top">
                      <div>
                        <div className="farmer-history-entry-date">{formatShortDate(entry?.analysis_date || entry?.created_at)}</div>
                        <div className="farmer-history-entry-location">{selectedField?.city || 'Your field area'}</div>
                      </div>
                    </div>

                    <div className="farmer-history-entry-metrics">
                      <span>{tr('Health', 'صحت')}: {overview.healthLabel}</span>
                      <span>{tr('Risk', 'خطرہ')}: {overview.riskLevel}</span>
                      <span>{tr('Stress', 'تناؤ')}: {overview.stressText}</span>
                      <span>{tr('Loss', 'نقصان')}: {overview.lossText}</span>
                      <span>{tr('Stage', 'مرحلہ')}: {overview.growthStage}</span>
                    </div>

                    <div className="farmer-history-entry-overview">
                      <div className="farmer-history-overview-title">حالت کا خلاصہ</div>
                      {overview.summary || getHistoryOverview(entry)}
                      {overview.immediateAction && (
                        <div className="farmer-history-overview-action">
                          فوری ایکشن: {overview.immediateAction}
                        </div>
                      )}
                      {Array.isArray(entry?.cost_tracker) && entry.cost_tracker.length > 0 && (
                        <div className="farmer-history-overview-action">
                          درج کیے گئے اخراجات: روپے {Math.round(entry.cost_tracker.reduce((sum, item) => {
                            const amount = Number(item?.amount || item?.cost || 0);
                            return sum + (Number.isFinite(amount) ? amount : 0);
                          }, 0)).toLocaleString('en-PK')} ({entry.cost_tracker.length} اشیاء)
                          <div style={{ marginTop: '6px' }}>
                            {entry.cost_tracker.slice(0, 5).map((costItem, idx) => (
                              <div key={`fh-cost-${entry.id}-${idx}`}>
                                • {String(costItem?.item || costItem?.name || 'Item')}
                                {costItem?.category ? ` (${costItem.category})` : ''}: PKR {Number(costItem?.amount || costItem?.cost || 0).toLocaleString('en-PK')}
                                {costItem?.date ? ` • ${costItem.date}` : ''}
                                {costItem?.notes ? ` • ${costItem.notes}` : ''}
                              </div>
                            ))}
                            {entry.cost_tracker.length > 5 ? <div>اور مزید...</div> : null}
                          </div>
                        </div>
                      )}
                    </div>

                    {overview.topRecommendations.length > 0 && (
                      <div className="farmer-history-entry-recs">
                        <div className="farmer-history-entry-recs-title">{tr('Top Recommendations', 'اہم سفارشات')}</div>
                        {overview.topRecommendations.map((rec, idx) => (
                          <div className="farmer-history-entry-rec-item" key={`rec-${entry.id}-${idx}`}>
                            <div className="farmer-history-entry-rec-action">{rec}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="farmer-history-entry-actions">
                      <button
                        type="button"
                        className="farmer-history-heatmap-toggle"
                        onClick={() => openFullReportInAnalysis(entry)}
                      >
                        {tr('View full report', 'مکمل رپورٹ دیکھیں')}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {error && <div className="farmer-history-error">{error}</div>}
    </div>
  );
};

export default FarmerHistoryPage;
