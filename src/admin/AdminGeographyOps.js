import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import AdminOpsLayout from './AdminOpsLayout';
import OpsInsightCard from './OpsInsightCard';

const AdminGeographyOps = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/admin/ops/geography?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await res.json();
      setData(payload.success ? payload : null);
    } catch (error) {
      console.error('Geography ops fetch error:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const riskByCity = data?.risk_distribution || [];
  const riskByCityGrouped = riskByCity.reduce((acc, item) => {
    if (!acc[item.city]) acc[item.city] = { city: item.city };
    const key = item.risk_level || 'Unknown';
    acc[item.city][key] = item.count;
    return acc;
  }, {});

  const riskSeries = Object.values(riskByCityGrouped);
  const riskKeys = [...new Set(riskByCity.map((item) => item.risk_level || 'Unknown'))];

  return (
    <AdminOpsLayout
      title="Geography Operations View"
      subtitle="City-wise risk distribution and unresolved queries by city."
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
        title="Regional focus"
        text="Surface hotspots by city and align field resources to areas with unresolved farmer queries."
        highlights={["City risk density", "Support demand", "Outreach routing"]}
      />

      <div className="ops-grid ops-grid-2" style={{ marginTop: '1.5rem' }}>
        <div className="ops-card" style={{ minHeight: 420 }}>
          <h3>City-wise Risk Distribution</h3>
          {loading ? (
            <div className="ops-empty">Loading chart...</div>
          ) : riskSeries.length ? (
            <div style={{ height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="city" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {riskKeys.map((risk, idx) => (
                    <Bar
                      key={risk}
                      dataKey={risk}
                      stackId="risk"
                      fill={idx % 2 === 0 ? '#f4c430' : '#1f7a4d'}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ops-empty">No risk distribution data available.</div>
          )}
        </div>

        <div className="ops-card" style={{ minHeight: 420 }}>
          <h3>Unresolved Queries by City</h3>
          {loading ? (
            <div className="ops-empty">Loading chart...</div>
          ) : data?.unresolved_queries_by_city?.length ? (
            <div style={{ height: 330 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.unresolved_queries_by_city}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="city" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="pending" fill="#d9a300" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="ops-empty">No unresolved query data available.</div>
          )}
        </div>
      </div>
    </AdminOpsLayout>
  );
};

export default AdminGeographyOps;
