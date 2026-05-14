import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminAlertEffectiveness = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/alert-effectiveness?days=90`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('Alert effectiveness fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary = data?.summary || {};

  return (
    <AdminOpsLayout
      title="Alert Effectiveness"
      subtitle="Before/after stress_probability changes after actions are marked done."
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
        title="Measure impact"
        text="Comparing stress scores before and after action completion shows whether interventions reduce crop stress."
        highlights={["Stress delta", "Intervention effect", "Fields for recheck"]}
      />

      <div className="ops-grid ops-grid-3" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <p className="ops-muted">Average change</p>
          <h2>{loading ? '...' : (summary.avg_change != null ? summary.avg_change : 'N/A')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Improved</p>
          <h2>{loading ? '...' : (summary.improved ?? 0)}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Worsened</p>
          <h2>{loading ? '...' : (summary.worsened ?? 0)}</h2>
        </div>
      </div>

      <div className="ops-card" style={{ marginTop: '1.5rem' }}>
        <h3>Stress Change Samples</h3>
        {loading ? (
          <div className="ops-empty">Loading samples...</div>
        ) : data?.samples?.length ? (
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.samples.slice(0, 20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="city" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="change" fill="#d9a300" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="ops-empty">No completed-action comparisons yet.</div>
        )}
      </div>

      {data?.samples?.length ? (
        <div className="ops-card" style={{ marginTop: '1.5rem' }}>
          <h3>Recent Samples</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Crop</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Change</th>
                  <th>Done At</th>
                </tr>
              </thead>
              <tbody>
                {data.samples.slice(0, 12).map((item, idx) => (
                  <tr key={`${item.city}-${idx}`}>
                    <td>{item.city}</td>
                    <td>{item.crop}</td>
                    <td>{item.before}</td>
                    <td>{item.after}</td>
                    <td>{item.change}</td>
                    <td>{item.action_done_at ? new Date(item.action_done_at).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </AdminOpsLayout>
  );
};

export default AdminAlertEffectiveness;
