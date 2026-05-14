import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminHighRiskQueue = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/high-risk`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setQueue(payload.success ? payload.queue || [] : []);
    } catch (error) {
      console.error('High risk fetch error:', error);
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  return (
    <AdminOpsLayout
      title="High-Risk Farmer Queue"
      subtitle="Users with high risk level or critical window <= 3 days."
      topLeftAction={(
        <button className="admin-ops-button" onClick={() => navigate('/admin')} type="button">
          Back to Dashboard
        </button>
      )}
      topRightAction={(
        <button className="admin-ops-button admin-ops-accent" onClick={fetchQueue} type="button">
          Refresh
        </button>
      )}
    >
      <OpsInsightCard
        title="Decision focus"
        text="This queue surfaces the most urgent farmer cases so outreach and action plans happen before yield drops."
        highlights={["High risk or <= 3 days", "One-click activity", "Priority ordering"]}
      />

      <div className="ops-card" style={{ marginTop: '1.5rem' }}>
        {loading ? (
          <div className="ops-empty">Loading queue...</div>
        ) : queue.length === 0 ? (
          <div className="ops-empty">No high-risk users found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>City</th>
                  <th>Crop</th>
                  <th>Risk</th>
                  <th>Days to Critical</th>
                  <th>Stress</th>
                  <th>Action Status</th>
                  <th>CTA</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((entry) => (
                  <tr key={entry.user_id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{entry.user?.name || 'Unknown'}</div>
                      <div className="ops-muted" style={{ fontSize: '0.8rem' }}>{entry.user?.email || 'No email'}</div>
                    </td>
                    <td>{entry.city || 'Unknown'}</td>
                    <td>{entry.crop || 'unknown'}</td>
                    <td><span className="ops-badge">{entry.risk_level || 'Unknown'}</span></td>
                    <td>{entry.days_to_critical ?? 'N/A'}</td>
                    <td>{entry.stress_probability != null ? Number(entry.stress_probability).toFixed(2) : 'N/A'}</td>
                    <td>{entry.action_status === 'done' ? 'Action completed' : 'Action needed'}</td>
                    <td>
                      <button
                        className="admin-ops-button"
                        type="button"
                        onClick={() => navigate(`/admin/user-activity/${entry.user_id}`)}
                      >
                        View Activity
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminOpsLayout>
  );
};

export default AdminHighRiskQueue;
