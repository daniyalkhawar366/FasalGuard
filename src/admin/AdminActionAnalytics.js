import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminActionAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/action-completion?weeks=12`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('Action analytics fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <AdminOpsLayout
      title="Query Resolution Graph"
      subtitle="Pending vs resolved queries by week and by day."
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
        title="Query momentum"
        text="Track the pace at which user queries are resolved so SLA risk stays low and follow-ups stay timely."
        highlights={["Weekly resolution", "Daily backlog", "Support load", "Resolution graph"]}
      />

      <div className="ops-grid ops-grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card" style={{ minHeight: 420 }}>
          <h3>Weekly Query Status</h3>
          {loading ? (
            <div className="ops-empty">Loading chart...</div>
          ) : data?.by_week?.length ? (
            <div style={{ height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_week}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pending" fill="#f4c430" name="Pending" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="done" fill="#1f7a4d" name="Resolved" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ops-empty">No query status data available.</div>
          )}
        </div>
        <div className="ops-card" style={{ minHeight: 420 }}>
          <h3>Daily Query Status</h3>
          {loading ? (
            <div className="ops-empty">Loading chart...</div>
          ) : data?.by_day?.length ? (
            <div style={{ height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.by_day}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="pending" fill="#f4c430" name="Pending" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="done" fill="#1f7a4d" name="Resolved" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ops-empty">No daily query data available.</div>
          )}
        </div>
      </div>
    </AdminOpsLayout>
  );
};

export default AdminActionAnalytics;
