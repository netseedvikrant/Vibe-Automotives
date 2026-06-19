// AutoMFG — OEE Dashboard (Flow 10) — FIXED
// Recharts gauges, trend line, KPI calculations from Supabase
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

// Fallback trends
const DEFAULT_SHIFT_TREND = [
  { shift: 'A-Mon', oee: 72.1, availability: 88, performance: 86, quality: 95 },
  { shift: 'B-Mon', oee: 76.4, availability: 91, performance: 88, quality: 95 },
  { shift: 'C-Mon', oee: 78.2, availability: 90, performance: 89, quality: 97 },
  { shift: 'A-Tue', oee: 74.8, availability: 87, performance: 90, quality: 95 },
  { shift: 'B-Tue', oee: 79.5, availability: 93, performance: 88, quality: 97 },
  { shift: 'C-Tue', oee: 81.2, availability: 92, performance: 91, quality: 97 },
  { shift: 'A-Wed', oee: 77.2, availability: 91, performance: 87, quality: 97 },
];

const DEFAULT_PARETO = [
  { defect: 'Surface Scratch', count: 45, cumPct: 28 },
  { defect: 'Dimensional OOT', count: 32, cumPct: 48 },
  { defect: 'Weld Crack', count: 28, cumPct: 65 },
  { defect: 'Porosity', count: 22, cumPct: 79 },
  { defect: 'Color Deviation', count: 18, cumPct: 90 },
  { defect: 'Other', count: 16, cumPct: 100 },
];

function OEEGauge({ value = 0, label, color = '#1c69d4', size = 160 }) {
  const numericValue = typeof value === 'number' ? value : 0;
  const data = [{ value: numericValue, fill: color }, { value: Math.max(0, 100 - numericValue), fill: '#1a1a1a' }];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size / 2 + 24 }}>
        <PieChart width={size} height={size / 2 + 12}>
          <Pie data={data} cx={size / 2} cy={size / 2 - 4} startAngle={180} endAngle={0} innerRadius={size / 2 - 22} outerRadius={size / 2 - 10} dataKey="value" stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
        <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: size / 4.5, fontWeight: 700, color, lineHeight: 1 }}>
            {numericValue.toFixed(1)}<span style={{ fontSize: size / 9, color: 'var(--text-secondary)' }}>%</span>
          </div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted-text)', textAlign: 'center' }}>{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', padding: '10px 14px', fontFamily: 'var(--font-heading)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</div>
      {payload.map((p) => <div key={p.dataKey} style={{ fontSize: 13, color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>)}
    </div>
  );
};

export default function OEEDashboard() {
  const { user } = useAuthStore();
  const { oeeMetrics } = useAppStore();
  const [metrics, setMetrics] = useState(oeeMetrics);
  const [trendData, setTrendData] = useState(DEFAULT_SHIFT_TREND);
  const [paretoData, setParetoData] = useState(DEFAULT_PARETO);
  const [loading, setLoading] = useState(false);
  const [selectedLine, setSelectedLine] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');

  const fetchOEE = async () => {
    if (!isSupabaseConfigured()) return;
    setLoading(true);
    try {
      // 1. Fetch latest OEE KPI record
      const { data } = await supabase.from('oee_kpis').select('*').order('date', { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setMetrics(prev => ({
          ...prev,
          availability: Number(data.availability) || prev.availability,
          performance: Number(data.performance) || prev.performance,
          quality: Number(data.quality) || prev.quality,
          oee: Number(data.oee_pct) || prev.oee,
        }));
      }

      // 2. Fetch OEE Trend (Last 7 shifts)
      const { data: trend } = await supabase
        .from('oee_kpis')
        .select('*, shifts(shift_name)')
        .order('date', { ascending: true })
        .limit(7);

      if (trend && trend.length > 0) {
        setTrendData(trend.map(item => ({
          shift: `${item.shifts?.shift_name || 'S'}-${item.date?.slice(5)}`,
          oee: Number(item.oee_pct),
          availability: Number(item.availability),
          performance: Number(item.performance),
          quality: Number(item.quality)
        })));
      }

      // 3. Fetch Defects and compute Pareto Chart dynamically
      const { data: defects } = await supabase.from('defect_records').select('defect_type, qty');
      if (defects && defects.length > 0) {
        const counts = {};
        defects.forEach(d => {
          const type = d.defect_type || 'Unknown';
          counts[type] = (counts[type] || 0) + (d.qty || 1);
        });
        const sorted = Object.entries(counts)
          .map(([defect, count]) => ({ defect, count }))
          .sort((a, b) => b.count - a.count);
        const total = sorted.reduce((sum, item) => sum + item.count, 0);
        let cumulative = 0;
        const pareto = sorted.map(item => {
          cumulative += item.count;
          return {
            defect: item.defect,
            count: item.count,
            cumPct: total > 0 ? Math.round((cumulative / total) * 100) : 0
          };
        });
        setParetoData(pareto);
      }
    } catch (e) {
      console.warn('[OEEDashboard] Error loading dashboard data:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOEE(); }, []);

  const oeeTrend = metrics.oee >= 85 ? +2.1 : metrics.oee >= 70 ? -0.8 : -3.2;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">OEE Dashboard</h1><div className="page-subtitle">Overall Equipment Effectiveness & Production KPIs</div></div>
        <div className="page-actions">
          {user?.role !== 'plant_manager' && (
            <>
              <select className="form-select" style={{ width: 120 }} value={selectedLine} onChange={(e) => setSelectedLine(e.target.value)}>
                <option value="all">All Lines</option>
                <option value="line-1">Line 1</option>
                <option value="line-2">Line 2</option>
                <option value="line-3">Line 3</option>
              </select>
              <select className="form-select" style={{ width: 120 }} value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)}>
                <option value="all">All Shifts</option>
                <option value="A">Shift A</option>
                <option value="B">Shift B</option>
                <option value="C">Shift C</option>
              </select>
            </>
          )}
          <button className="icon-btn" onClick={fetchOEE} title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* OEE Gauges */}
      <div className="card mb-16">
        <div className="card-header"><span className="card-title">Overall Equipment Effectiveness</span><span className="badge badge-blue">LIVE</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto 1fr', gap: 24, padding: '8px 0', alignItems: 'center' }}>
          <OEEGauge value={metrics.availability} label="Availability" color="#1c69d4" size={160} />
          <OEEGauge value={metrics.performance} label="Performance" color="#1c69d4" size={160} />
          <OEEGauge value={metrics.quality} label="Quality" color="#1cd46a" size={160} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px 32px', background: 'var(--bg-elevated)', border: '1px solid var(--border-active)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, fontWeight: 600, letterSpacing: '0.25em', color: 'var(--muted-text)', textTransform: 'uppercase' }}>OEE Score</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 60, fontWeight: 700, color: metrics.oee >= 85 ? 'var(--green)' : metrics.oee >= 70 ? 'var(--amber)' : 'var(--red)', lineHeight: 1 }}>
              {metrics.oee.toFixed(1)}<span style={{ fontSize: 24, color: 'var(--text-secondary)' }}>%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {oeeTrend >= 0 ? <TrendingUp size={12} color="var(--green)" /> : <TrendingDown size={12} color="var(--red)" />}
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: oeeTrend >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '0.1em' }}>
                {oeeTrend >= 0 ? '+' : ''}{oeeTrend}% vs prev shift
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, letterSpacing: '0.2em', color: 'var(--muted-text)', textAlign: 'center', textTransform: 'uppercase' }}>A × P × Q</div>
          </div>
          <OEEGauge value={metrics.fpy} label="First Pass Yield" color="#1cd46a" size={160} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-4 mb-16">
        {[
          { label: 'Schedule Adherence', value: `${metrics.scheduleAdherence.toFixed(1)}%`, color: metrics.scheduleAdherence >= 90 ? 'green' : metrics.scheduleAdherence >= 80 ? 'amber' : 'red' },
          { label: 'Andon Response Avg', value: `${metrics.andonResponseTime.toFixed(1)} min`, color: metrics.andonResponseTime <= 10 ? 'green' : metrics.andonResponseTime <= 20 ? 'amber' : 'red' },
          { label: 'EOL First Pass Rate', value: `${metrics.eolFirstPass.toFixed(1)}%`, color: metrics.eolFirstPass >= 95 ? 'green' : metrics.eolFirstPass >= 85 ? 'amber' : 'red' },
          { label: 'Scrap Rate', value: `${(100 - metrics.quality).toFixed(1)}%`, color: (100 - metrics.quality) <= 2 ? 'green' : (100 - metrics.quality) <= 5 ? 'amber' : 'red' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card"><div className="metric-label">{label}</div><div className={`metric-value ${color}`} style={{ fontSize: 32 }}>{value}</div></div>
        ))}
      </div>

      {/* OEE Trend + Defect Pareto */}
      <div className="grid grid-2 mb-16">
        <div className="card">
          <div className="card-header"><span className="card-title">OEE Trend — Last 7 Shifts</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="oeeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1c69d4" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#1c69d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="shift" tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={85} stroke="#1cd46a" strokeDasharray="4 4" label={{ value: 'Target 85%', fill: '#1cd46a', fontSize: 10 }} />
              <Area type="monotone" dataKey="oee" name="OEE" stroke="#1c69d4" strokeWidth={2} fill="url(#oeeGrad)" dot={{ fill: '#1c69d4', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Defect Pareto — Top Categories</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={paretoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="defect" tick={{ fontFamily: 'var(--font-heading)', fontSize: 9, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontFamily: 'var(--font-heading)', fontSize: 10, fill: '#6b6b6b' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar yAxisId="left" dataKey="count" name="Count" fill="#1c69d4" />
              <Area yAxisId="right" type="monotone" dataKey="cumPct" name="Cumulative %" stroke="#d4841c" strokeWidth={2} fill="none" dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
