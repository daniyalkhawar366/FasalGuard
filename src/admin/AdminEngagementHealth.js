import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const HEATMAP_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AdminEngagementHealth = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/engagement?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('Engagement fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const usage = data?.usage_split || {};
  const pieData = [
    { name: 'Crop Prediction', value: usage.crop_predictions || 0 },
    { name: 'Satellite', value: usage.satellite_runs || 0 },
    { name: 'Soil Analysis', value: usage.soil_analyses || 0 }
  ];

  const maxHeat = data?.last_login_heatmap
    ? Math.max(...data.last_login_heatmap.flat())
    : 0;

  return (
    <AdminOpsLayout
      title="User Engagement Health"
      subtitle="Login intensity, inactivity, and feature usage split."
      topLeftAction={(
        <button className="admin-ops-button" onClick={() => navigate('/admin')} type="button">
          Back to Dashboard
        </button>
      )}
      topRightAction={(
        <button className="admin-ops-button admin-ops-accent" onClick={fetchData} type="button">
          Refresh
        </button>
      )}
    >
      <OpsInsightCard
        title="Usage signals"
        text="Engagement signals show which tools farmers rely on and where to re-activate inactive users."
        highlights={["Inactive users", "Tool adoption", "Outreach timing"]}
      />

      <div className="ops-grid ops-grid-3" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <p className="ops-muted">Inactive > 14 days</p>
          <h2>{loading ? '...' : (data?.inactive_over_14d ?? 'N/A')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Crop predictions (30d)</p>
          <h2>{loading ? '...' : (usage.crop_predictions ?? 0)}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Satellite runs (30d)</p>
          <h2>{loading ? '...' : (usage.satellite_runs ?? 0)}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Soil analyses (30d)</p>
          <h2>{loading ? '...' : (usage.soil_analyses ?? 0)}</h2>
        </div>
      </div>

      <div className="ops-grid ops-grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <h3>Last Login Heatmap</h3>
          {loading ? (
            <div className="ops-empty">Loading heatmap...</div>
          ) : data?.last_login_heatmap ? (
            <div>
              {data.last_login_heatmap.map((row, dayIdx) => (
                <div key={HEATMAP_DAYS[dayIdx]} style={{ marginBottom: '0.6rem' }}>
                  <div className="ops-muted" style={{ fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                    {HEATMAP_DAYS[dayIdx]}
                  </div>
                  <div className="ops-heatmap">
                    {row.map((val, idx) => {
                      const intensity = maxHeat > 0 ? val / maxHeat : 0;
                      const color = `rgba(244, 196, 48, ${0.2 + intensity * 0.7})`;
                      return (
                        <div
                          key={`${dayIdx}-${idx}`}
                          className="ops-heatmap-cell"
                          title={`${val} logins @ ${idx}:00`}
                          style={{ background: color }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ops-empty">No login data available.</div>
          )}
        </div>

        <div className="ops-card">
          <h3>Feature Usage Split</h3>
          {loading ? (
            <div className="ops-empty">Loading usage split...</div>
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={110}>
                    <Cell fill="#f4c430" />
                    <Cell fill="#1f7a4d" />
                    <Cell fill="#ff8f5e" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {!usage.soil_tracked && (
                <p className="ops-muted" style={{ marginTop: '0.5rem' }}>
                  Soil analysis activity is not tracked yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminOpsLayout>
  );
};

export default AdminEngagementHealth;
