import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminUserActivity = () => {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/users/${userId}/activity`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('User activity fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId]);

  const user = data?.user;

  return (
    <AdminOpsLayout
      title="User Activity"
      subtitle={user ? `${user.name} • ${user.email}` : 'Loading user activity'}
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
        title="User timeline"
        text="Track each farmer's activity to prioritize support and verify adoption of recommendations."
        highlights={["Satellite history", "Crop predictions", "Soil logs"]}
      />

      <div className="ops-grid ops-grid-3" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <p className="ops-muted">Last login</p>
          <h2>{loading ? '...' : (user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'No data')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Account status</p>
          <h2>{loading ? '...' : (user?.accountStatus || 'Unknown')}</h2>
        </div>
        <div className="ops-card">
          <p className="ops-muted">Crop predictions</p>
          <h2>{loading ? '...' : (data?.predictions?.length ?? 0)}</h2>
        </div>
          <div className="ops-card">
            <p className="ops-muted">Satellite runs</p>
            <h2>{loading ? '...' : (data?.satellite_runs?.length ?? 0)}</h2>
          </div>
          <div className="ops-card">
            <p className="ops-muted">Soil analyses</p>
            <h2>{loading ? '...' : (data?.soil_analyses?.length ?? 0)}</h2>
          </div>
      </div>

      <div className="ops-card" style={{ marginTop: '1.5rem' }}>
        <h3>Recent Satellite Runs</h3>
        {loading ? (
          <div className="ops-empty">Loading satellite runs...</div>
        ) : data?.satellite_runs?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>City</th>
                  <th>Crop</th>
                  <th>Risk</th>
                  <th>Days to Critical</th>
                </tr>
              </thead>
              <tbody>
                {data.satellite_runs.map((run) => (
                  <tr key={run._id || `${run.city}-${run.createdAt}`}>
                    <td>{run.createdAt ? new Date(run.createdAt).toLocaleString() : 'N/A'}</td>
                    <td>{run.city || 'Unknown'}</td>
                    <td>{run.crop || 'unknown'}</td>
                    <td>{run.metrics?.risk_level || 'Unknown'}</td>
                    <td>{run.metrics?.days_to_critical ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ops-empty">No satellite runs found.</div>
        )}
      </div>

      <div className="ops-grid ops-grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card">
          <h3>Crop Predictions</h3>
          {loading ? (
            <div className="ops-empty">Loading predictions...</div>
          ) : data?.predictions?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Crop</th>
                    <th>City</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.predictions.map((pred) => (
                    <tr key={pred._id || pred.timestamp}>
                      <td>{pred.timestamp ? new Date(pred.timestamp).toLocaleString() : 'N/A'}</td>
                      <td>{pred.crop || 'unknown'}</td>
                      <td>{pred.location?.city || 'Unknown'}</td>
                      <td>{pred.prediction?.confidence != null ? `${Math.round(pred.prediction.confidence * 100)}%` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ops-empty">No predictions found.</div>
          )}
        </div>
      </div>

      <div className="ops-card" style={{ marginTop: '1.5rem' }}>
        <h3>Soil Analysis History</h3>
        {loading ? (
          <div className="ops-empty">Loading soil analyses...</div>
        ) : data?.soil_analyses?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>District</th>
                  <th>Crop</th>
                </tr>
              </thead>
              <tbody>
                {data.soil_analyses.map((item) => (
                  <tr key={item._id || item.createdAt}>
                    <td>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</td>
                    <td>{item.analysis_type || 'district'}</td>
                    <td>{item.district || 'Unknown'}</td>
                    <td>{item.crop || 'Not set'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ops-empty">No soil analysis history yet.</div>
        )}
      </div>
    </AdminOpsLayout>
  );
};

export default AdminUserActivity;
