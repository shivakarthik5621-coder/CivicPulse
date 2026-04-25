import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, PieChart, Loader, MapPin } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RPieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { getPublicAnalytics } from '../services/api';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#60a5fa'];
const CATEGORY_COLORS = { pothole: '#f87171', garbage_dump: '#34d399' };
const CATEGORY_LABELS = { pothole: 'Pothole', garbage_dump: 'Garbage Dump' };

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const result = await getPublicAnalytics();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <BarChart3 size={48} style={{ marginBottom: 16 }} />
        <p>Unable to load analytics. Please try again later.</p>
      </div>
    );
  }

  const categoryData = Object.entries(data.categories || {}).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] || key, value, fill: CATEGORY_COLORS[key] || '#818cf8'
  }));

  const statusData = [
    { name: 'Pending', value: data.pending || 0, fill: '#fbbf24' },
    { name: 'In Progress', value: data.in_progress || 0, fill: '#c084fc' },
    { name: 'Resolved', value: data.resolved || 0, fill: '#34d399' },
  ].filter(d => d.value > 0);

  const civicHealth = data.civic_health || [];

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
            Public <span style={{ color: 'var(--primary-light)' }}>Analytics</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Real-time civic health data across Indian cities</p>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 32
        }}>
          <StatCard label="Total Issues" value={data.total} color="var(--primary-light)" />
          <StatCard label="Resolved" value={data.resolved} color="var(--secondary-light)" />
          <StatCard label="Pending" value={data.pending} color="var(--accent-light)" />
          <StatCard label="Avg Resolution" value={`${data.avg_resolution_days} days`} color="var(--danger-light)" />
        </div>

        {/* Charts Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 20, marginBottom: 32
        }}>
          {/* Category Bar Chart */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="var(--primary-light)" /> Issues by Category
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryData}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Pie Chart */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieChart size={18} color="var(--secondary-light)" /> Status Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RPieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                  paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9' }} />
              </RPieChart>
            </ResponsiveContainer>
          </div>
        </div>


      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="glass-card" style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const thStyle = {
  textAlign: 'left', padding: '12px 16px', fontSize: '0.8rem',
  fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const tdStyle = {
  padding: '14px 16px', fontSize: '0.9rem', color: 'var(--text-primary)'
};
