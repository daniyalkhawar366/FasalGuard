import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminSlaTracker = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/sla?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('SLA fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary = data?.totals || {};

  return (
    <AdminOpsLayout
      title="SLA and Response Tracker"
      subtitle="Pending aging, first response time, and resolution rate."
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
        title="Why this matters"
        text="Fast first responses reduce churn and help farmers trust your recommendations in the critical window."
        highlights={["Backlog aging (minutes)", "First-response time", "Resolution rate health"]}
      />

      <div className="ops-grid ops-grid-3" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <p className="ops-muted">Pending older than 10m</p>
          <h2>{loading ? '...' : (data?.pending_older_than_10m ?? 'N/A')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Avg first-response time</p>
          <h2>{loading ? '...' : (data?.avg_first_response_hours != null ? `${data.avg_first_response_hours} hrs` : 'N/A')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Resolved rate</p>
          <h2>{loading ? '...' : (data?.resolved_rate != null ? `${data.resolved_rate}%` : 'N/A')}</h2>
        </div>
      </div>

      <div className="ops-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>First Response Trend</h3>
            <p className="ops-muted">Daily average response time</p>
          </div>
          <span className="ops-badge">Total {summary.total ?? 0}</span>
        </div>
        <div style={{ height: 360, marginTop: '1rem' }}>
          {data?.daily_response?.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily_response}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="avg_hours" stroke="#d9a300" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="ops-empty">No response-time data yet.</div>
          )}
        </div>
      </div>
    </AdminOpsLayout>
  );
};

export default AdminSlaTracker;
