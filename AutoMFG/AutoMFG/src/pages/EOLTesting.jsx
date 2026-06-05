// AutoMFG — EOL Testing (Flow 6) — FIXED
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Search, CheckCircle2, XCircle, FileText, RefreshCw, TestTube } from 'lucide-react';
import { supabase, isSupabaseConfigured, writeAuditLog } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const safeUUID = (id) =>
  id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

const TEST_ITEMS = [
  { key: 'engine', label: 'Engine Performance', unit: 'kW', target: 300 },
  { key: 'brakes', label: 'Brake Effectiveness', unit: '%', target: 95 },
  { key: 'lights', label: 'Lighting Systems', unit: 'lux', target: 1200 },
  { key: 'dimensions', label: 'Dimensional Check', unit: 'mm δ', target: 0.5 },
  { key: 'electronics', label: 'Electronics / ECU', unit: 'ERR', target: 0 },
  { key: 'water_test', label: 'Water Ingress Test', unit: 'mL/h', target: 0 },
];

const vinSchema = z.object({ vin: z.string().min(5, 'Enter valid VIN') });
const testSchema = z.object(Object.fromEntries(TEST_ITEMS.map((t) => [t.key, z.coerce.number().min(0)])));

const pdfStyles = StyleSheet.create({
  page: { backgroundColor: '#fff', padding: 40, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, borderBottom: '2px solid #1c69d4', paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1c69d4', letterSpacing: 2 },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#333', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #eee' },
  row: { flexDirection: 'row', paddingVertical: 5, borderBottom: '1px solid #f0f0f0' },
  label: { flex: 2, fontSize: 10, color: '#555' },
  value: { flex: 1, fontSize: 10, color: '#111', fontWeight: 'bold' },
  result: { flex: 1, fontSize: 10, fontWeight: 'bold' },
  footer: { marginTop: 30, borderTop: '1px solid #ddd', paddingTop: 16 },
  certNo: { fontSize: 14, fontWeight: 'bold', color: '#1c69d4' },
  pass: { color: '#1cd46a' }, fail: { color: '#d4261c' },
  badge: { fontSize: 14, fontWeight: 'bold', marginTop: 12 },
});

function EOLCertPDF({ data }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View><Text style={pdfStyles.title}>AutoMFG</Text><Text style={pdfStyles.subtitle}>End-of-Line Test Certificate</Text></View>
          <View><Text style={{ fontSize: 10, color: '#999', textAlign: 'right' }}>{new Date().toLocaleDateString('en-GB')}</Text><Text style={[pdfStyles.certNo, { textAlign: 'right' }]}>{data.certNo}</Text></View>
        </View>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Vehicle Information</Text>
          {[['VIN', data.vin], ['Model', data.model], ['Variant', data.variant], ['Plant', data.plant], ['Inspector', data.inspector], ['Test Date', data.date], ['Run #', String(data.runNo)]].map(([l, v]) => (
            <View key={l} style={pdfStyles.row}><Text style={pdfStyles.label}>{l}</Text><Text style={pdfStyles.value}>{v}</Text></View>
          ))}
        </View>
        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>Test Results</Text>
          {data.results.map((r, i) => (
            <View key={i} style={pdfStyles.row}>
              <Text style={pdfStyles.label}>{r.label}</Text>
              <Text style={pdfStyles.value}>{r.measured} {r.unit}</Text>
              <Text style={[pdfStyles.result, r.passed ? pdfStyles.pass : pdfStyles.fail]}>{r.passed ? 'PASS' : 'FAIL'}</Text>
            </View>
          ))}
        </View>
        <View style={pdfStyles.footer}>
          <Text style={[pdfStyles.badge, data.overall === 'pass' ? pdfStyles.pass : pdfStyles.fail]}>OVERALL RESULT: {(data.overall || '').toUpperCase()}</Text>
          <Text style={{ fontSize: 9, color: '#999', marginTop: 16 }}>System-generated — no physical signature required.</Text>
        </View>
      </Page>
    </Document>
  );
}

export default function EOLTesting() {
  const { user } = useAuthStore();
  const { addEOLTest } = useAppStore();
  const [phase, setPhase] = useState('scan');
  const [scannedVIN, setScannedVIN] = useState(null);
  const [vinMeta, setVinMeta] = useState({ model: '—', variant: '—' });
  const [certData, setCertData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentTests, setRecentTests] = useState([]);

  const fetchRecentTests = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      let data = null;
      let error = null;

      try {
        const res = await supabase
          .from('eol_test_runs')
          .select('*, vin_units(part_number, part_master(model, variant))')
          .order('tested_at', { ascending: false })
          .limit(20);
        data = res.data;
        error = res.error;
      } catch (e) {
        error = e;
      }

      if (error) {
        console.warn('[EOL] Joint fetch failed, using fallback flat fetch...', error.message);
        const { data: flatData, error: flatError } = await supabase
          .from('eol_test_runs')
          .select('*')
          .order('tested_at', { ascending: false })
          .limit(20);
        
        if (flatError) throw flatError;
        
        if (flatData && flatData.length > 0) {
          const vins = [...new Set(flatData.map(t => t.vin).filter(Boolean))];
          
          // Fetch vin_units
          const { data: vinUnits } = await supabase
            .from('vin_units')
            .select('*')
            .in('vin', vins);
          
          const vinMap = vinUnits ? Object.fromEntries(vinUnits.map(v => [v.vin, v])) : {};
          const partNumbers = [...new Set((vinUnits || []).map(v => v.part_number).filter(Boolean))];
          
          // Fetch parts
          const { data: parts } = await supabase
            .from('part_master')
            .select('*')
            .in('part_number', partNumbers);
          
          const partMap = parts ? Object.fromEntries(parts.map(p => [p.part_number, p])) : {};
          
          data = flatData.map(t => {
            const vinUnit = vinMap[t.vin] || {};
            const part = partMap[vinUnit.part_number] || {};
            return {
              ...t,
              vin_units: {
                ...vinUnit,
                part_master: part
              }
            };
          });
        } else {
          data = [];
        }
      }

      if (data) setRecentTests(data.map((t) => ({
        id: t.eol_run_id,
        vin: t.vin,
        model: t.vin_units?.part_master?.model || '—',
        variant: t.vin_units?.part_master?.variant || '—',
        date: t.tested_at?.slice(0, 10) || '—',
        overallResult: (t.overall_result || 'unknown').toUpperCase(),
      })));
    } catch (err) { console.warn('[EOL] fetch failed:', err.message); }
  };

  useEffect(() => { fetchRecentTests(); }, []);

  const vinForm = useForm({ resolver: zodResolver(vinSchema) });
  const testForm = useForm({ resolver: zodResolver(testSchema) });

  const handleVINScan = async (data) => {
    setLoading(true);
    if (isSupabaseConfigured()) {
      let vinRow = null;
      let error = null;

      try {
        const res = await supabase
          .from('vin_units')
          .select('*, part_master(model, variant)')
          .eq('vin', data.vin)
          .maybeSingle();
        vinRow = res.data;
        error = res.error;
      } catch (err) {
        error = err;
      }

      if (error || !vinRow) {
        // Fallback separate queries if join fails
        console.warn('[EOLTesting] Join query failed, trying fallback separate queries...');
        const { data: vinDirect, error: directErr } = await supabase
          .from('vin_units')
          .select('*')
          .eq('vin', data.vin)
          .maybeSingle();
        
        if (!directErr && vinDirect) {
          vinRow = vinDirect;
          error = null;
          if (vinDirect.part_number) {
            const { data: partRow } = await supabase
              .from('part_master')
              .select('model, variant')
              .eq('part_number', vinDirect.part_number)
              .maybeSingle();
            if (partRow) {
              vinRow.part_master = partRow;
            }
          }
        } else {
          error = directErr || new Error('VIN not found');
        }
      }

      if (error || !vinRow) {
        toast.error('VIN not found in system. Ensure it is registered in vin_units.');
        setLoading(false);
        return;
      }
      setVinMeta({ model: vinRow.part_master?.model || '—', variant: vinRow.part_master?.variant || '—' });
    } else {
      setVinMeta({ model: 'BMW M4', variant: 'Competition' });
    }
    setScannedVIN(data.vin);
    setPhase('test');
    setLoading(false);
    toast.success(`VIN ${data.vin} confirmed — proceed to testing`);
  };

  const handleRunTests = async (data) => {
    const results = TEST_ITEMS.map((item) => {
      const measured = Number(data[item.key]);
      const passed = (item.key === 'electronics' || item.key === 'water_test')
        ? measured === 0
        : item.key === 'dimensions' ? measured <= item.target : measured >= item.target;
      return { key: item.key, label: item.label, measured, unit: item.unit, target: item.target, passed };
    });
    const overall = results.every((r) => r.passed) ? 'pass' : 'fail';
    const runNo = 1;
    const certNo = `EOL-${scannedVIN}-${runNo}`;

    try {
      if (isSupabaseConfigured()) {
        const { data: run, error: runErr } = await supabase.from('eol_test_runs').insert({
          vin: scannedVIN,
          run_no: runNo,
          overall_result: overall,
          tested_by: safeUUID(user?.id),  // ✅ FIXED: safeUUID guard
          tested_at: new Date().toISOString(),
        }).select().single();
        if (runErr) throw runErr;

        if (run) {
          const { error: resErr } = await supabase.from('eol_test_results').insert(
            results.map((r) => ({ eol_run_id: run.eol_run_id, test_item: r.key, measured_value: String(r.measured), result: r.passed ? 'pass' : 'fail' }))
          );
          if (resErr) throw resErr;
          if (overall === 'pass') {
            await supabase.from('eol_certificates').insert({ eol_certificate_no: certNo, eol_run_id: run.eol_run_id, certificate_link: certNo, issued_at: new Date().toISOString() });
            await supabase.from('vin_units').update({ current_status: 'released' }).eq('vin', scannedVIN);
          }
        }
        writeAuditLog(safeUUID(user?.id), 'eol_test_runs', 'insert', { vin: scannedVIN, overall_result: overall });
      }

      const cd = { certNo, vin: scannedVIN, model: vinMeta.model, variant: vinMeta.variant, plant: user?.plant || 'Plant A', inspector: user?.name || 'Inspector', date: new Date().toLocaleDateString('en-GB'), runNo, results, overall };
      setCertData(cd);
      setPhase('result');
      addEOLTest({ id: `EOL-${Date.now()}`, vin: scannedVIN, model: vinMeta.model, variant: vinMeta.variant, date: new Date().toISOString().slice(0, 10), overallResult: overall.toUpperCase() });
      fetchRecentTests();
      if (overall === 'pass') toast.success(`EOL PASS — Certificate ${certNo} generated`);
      else toast.error(`EOL FAIL — ${results.filter((r) => !r.passed).length} test(s) failed`);
    } catch (err) { toast.error('Failed to save test results: ' + err.message); }
  };

  const resetFlow = () => { setPhase('scan'); setScannedVIN(null); setVinMeta({ model: '—', variant: '—' }); setCertData(null); vinForm.reset(); testForm.reset(); };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block"><h1 className="page-title">EOL Testing</h1><div className="page-subtitle">End-of-Line Vehicle Testing & Certificate Generation</div></div>
        <div className="page-actions">{phase !== 'scan' && <button className="btn btn-outline" onClick={resetFlow}><RefreshCw size={14} /> New Test</button>}</div>
      </div>

      {/* Phase stepper */}
      <div style={{ display: 'flex', marginBottom: 24 }}>
        {[{ id: 'scan', label: '1. VIN Scan' }, { id: 'test', label: '2. Enter Results' }, { id: 'result', label: '3. Certificate' }].map((p, i) => {
          const order = ['scan', 'test', 'result'];
          const isActive = phase === p.id;
          const isDone = order.indexOf(p.id) < order.indexOf(phase);
          return (
            <div key={p.id} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: isActive ? 'var(--bmw-blue-subtle)' : isDone ? 'var(--green-dim)' : 'var(--bg-surface)', border: `1px solid ${isActive ? 'var(--bmw-blue)' : isDone ? 'var(--green)' : 'var(--border)'}`, flex: 1 }}>
                <div style={{ width: 20, height: 20, background: isActive ? 'var(--bmw-blue)' : isDone ? 'var(--green)' : 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700, color: 'white' }}>{i + 1}</div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', color: isActive ? 'var(--bmw-blue)' : isDone ? 'var(--green)' : 'var(--muted-text)' }}>{p.label}</span>
              </div>
              {i < 2 && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
            </div>
          );
        })}
      </div>

      {/* PHASE 1 */}
      {phase === 'scan' && (
        <div className="card" style={{ maxWidth: 500, margin: '0 auto' }}>
          <div className="card-header"><span className="card-title">VIN Confirmation</span></div>
          <form onSubmit={vinForm.handleSubmit(handleVINScan)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Scan or Enter VIN</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-text)' }} />
                <input className="form-input" style={{ paddingLeft: 36, fontSize: 16, letterSpacing: '0.1em' }} placeholder="WBS3R9C57FK001" {...vinForm.register('vin')} autoFocus />
              </div>
              {vinForm.formState.errors.vin && <span style={{ color: 'var(--red)', fontSize: 11 }}>{vinForm.formState.errors.vin.message}</span>}
            </div>
            <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 9, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted-text)', marginBottom: 8 }}>Demo VINs</div>
              {['WBS3R9C57FK001', 'WBS3R9C57FK002', 'WBS3R9C57FK003'].map((v) => (
                <button key={v} type="button" className="btn btn-sm btn-outline" style={{ marginRight: 6, marginBottom: 4 }} onClick={() => vinForm.setValue('vin', v)}>{v}</button>
              ))}
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>{loading ? 'Verifying...' : 'Confirm VIN & Proceed'}</button>
          </form>
        </div>
      )}

      {/* PHASE 2 */}
      {phase === 'test' && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">EOL Test Entry — {scannedVIN}</span>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)', marginTop: 2 }}>Model: {vinMeta.model} · Variant: {vinMeta.variant}</div>
            </div>
            <span className="badge badge-blue">IN PROGRESS</span>
          </div>
          <form onSubmit={testForm.handleSubmit(handleRunTests)}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
              {TEST_ITEMS.map((item) => (
                <div key={item.key} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{item.label}</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)' }}>Target: {item.target} {item.unit}</div>
                    </div>
                    <TestTube size={16} color="var(--muted-text)" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Measured ({item.unit})</label>
                    <input className="form-input" type="number" step="0.01" placeholder={String(item.target)} {...testForm.register(item.key)} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" type="button" onClick={() => setPhase('scan')}>Back</button>
              <button className="btn btn-primary" type="submit">Submit Test Results</button>
            </div>
          </form>
        </div>
      )}

      {/* PHASE 3 */}
      {phase === 'result' && certData && (
        <div>
          <div className="card mb-16">
            <div className="card-header">
              <div>
                <span className="modal-title">Results — {certData.vin}</span>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 10, color: 'var(--muted-text)', marginTop: 2 }}>{certData.model} {certData.variant} · {certData.certNo}</div>
              </div>
              <span className={`badge ${certData.overall === 'pass' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 14 }}>{certData.overall === 'pass' ? '✓ PASS' : '✗ FAIL'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {certData.results.map((r) => (
                <div key={r.key} style={{ background: 'var(--bg-elevated)', border: `1px solid ${r.passed ? 'var(--green)' : 'var(--red)'}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 600, color: 'var(--white)' }}>{r.label}</div>
                    <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{r.measured} {r.unit} / target {r.target}</div>
                  </div>
                  {r.passed ? <CheckCircle2 size={20} color="var(--green)" /> : <XCircle size={20} color="var(--red)" />}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">EOL Certificate</span></div>
            {certData.overall === 'pass' ? (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1, padding: 20, background: 'var(--green-dim)', border: '1px solid var(--green)' }}>
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>{certData.certNo}</div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>Vehicle released for delivery — all {certData.results.length} tests passed</div>
                </div>
                <PDFDownloadLink document={<EOLCertPDF data={certData} />} fileName={`${certData.certNo}.pdf`}>
                  {({ loading: l }) => <button className="btn btn-primary"><FileText size={14} /> {l ? 'Generating...' : 'Download PDF'}</button>}
                </PDFDownloadLink>
              </div>
            ) : (
              <div style={{ padding: 20, background: 'var(--red-dim)', border: '1px solid var(--red)' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>FAIL — Rework Required</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>{certData.results.filter((r) => !r.passed).map((r) => r.label).join(', ')}</div>
                <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={resetFlow}>Start Re-test</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header"><span className="card-title">Recent EOL Tests</span><button className="icon-btn" onClick={fetchRecentTests}><RefreshCw size={14} /></button></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>VIN</th><th>Model</th><th>Variant</th><th>Date</th><th>Result</th></tr></thead>
            <tbody>
              {recentTests.length === 0
                ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--muted-text)' }}>No tests recorded</td></tr>
                : recentTests.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 12 }}>{t.vin}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{t.model}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-secondary)' }}>{t.variant}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>{t.date}</td>
                    <td><span className={`badge ${t.overallResult === 'PASS' ? 'badge-green' : 'badge-red'}`}>{t.overallResult}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
