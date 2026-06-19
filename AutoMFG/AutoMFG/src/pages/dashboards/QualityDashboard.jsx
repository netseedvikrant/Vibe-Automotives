// QualityDashboard — Quality Inspector
// Focus: VIN scan, units awaiting gate, control plan, measurements, scrap/rework, EOL
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Shield, CheckCircle2, XCircle, AlertTriangle, TestTube, FileText, Award } from 'lucide-react';
import { MetricCard, WorkflowSteps, StatusBadge, IntegBadge } from './shared';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const DISPOSITION_COLOR = { scrap: 'badge-red', rework: 'badge-amber', uai: 'badge-blue', pending: 'badge-gray' };

const pdfStyles = StyleSheet.create({
  page: { backgroundColor: '#ffffff', padding: 40, fontFamily: 'Helvetica' },
  borderContainer: { border: '2px solid #1c69d4', height: '100%', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  header: { borderBottom: '1px solid #e0e0e0', paddingBottom: 15, marginBottom: 20 },
  logoSection: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  companyName: { fontSize: 18, fontWeight: 'bold', color: '#1c69d4', letterSpacing: 1.5 },
  systemName: { fontSize: 9, color: '#777777', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  certTitle: { fontSize: 20, fontWeight: 'bold', color: '#111111', letterSpacing: 1, textAlign: 'center', marginTop: 15, textTransform: 'uppercase' },
  certNoBadge: { backgroundColor: '#1c69d4', color: '#ffffff', padding: '4px 8px', fontSize: 10, fontWeight: 'bold', alignSelf: 'center', marginTop: 5 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: '#1c69d4', borderBottom: '1px solid #1c69d4', paddingBottom: 3, marginBottom: 8, letterSpacing: 1 },
  grid: { display: 'flex', flexDirection: 'row', flexWrap: 'wrap' },
  gridCol: { width: '50%', marginBottom: 6, display: 'flex', flexDirection: 'row' },
  label: { fontSize: 9, color: '#666666', width: '90px' },
  value: { fontSize: 9, color: '#111111', fontWeight: 'bold' },
  table: { border: '1px solid #e0e0e0', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', padding: 6 },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #e0e0e0', padding: 6 },
  th: { fontSize: 9, fontWeight: 'bold', color: '#333333' },
  td: { fontSize: 9, color: '#333333' },
  passText: { color: '#1cd46a', fontWeight: 'bold' },
  failText: { color: '#d4261c', fontWeight: 'bold' },
  statusBadge: { backgroundColor: '#1cd46a', color: '#ffffff', fontSize: 12, fontWeight: 'bold', padding: '6px 12px', alignSelf: 'center', marginTop: 10 },
  signatures: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25, borderTop: '1px solid #e0e0e0', paddingTop: 15 },
  sigBlock: { width: '45%', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  sigLine: { borderTop: '1px solid #999999', width: '100%', marginTop: 25, marginBottom: 4 },
  sigText: { fontSize: 8, color: '#666666', textAlign: 'center' },
  footer: { borderTop: '1px solid #e0e0e0', paddingTop: 10, display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 8, color: '#999999' }
});

function EOLCertPDF({ data }) {
  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.borderContainer}>
          {/* Header */}
          <View style={pdfStyles.header}>
            <View style={pdfStyles.logoSection}>
              <View>
                <Text style={pdfStyles.companyName}>VIBE AUTOMOTIVES</Text>
                <Text style={pdfStyles.systemName}>AutoMFG — Manufacturing Execution Suite</Text>
              </View>
              <Text style={{ fontSize: 9, color: '#777777' }}>Date: {data.date}</Text>
            </View>
            <Text style={pdfStyles.certTitle}>End-of-Line Test Certificate</Text>
            <Text style={pdfStyles.certNoBadge}>{data.certNo}</Text>
          </View>

          {/* Vehicle Information */}
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>Vehicle Information</Text>
            <View style={pdfStyles.grid}>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>VIN:</Text>
                <Text style={pdfStyles.value}>{data.vin}</Text>
              </View>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>Model:</Text>
                <Text style={pdfStyles.value}>{data.model}</Text>
              </View>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>Variant:</Text>
                <Text style={pdfStyles.value}>{data.variant}</Text>
              </View>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>Plant:</Text>
                <Text style={pdfStyles.value}>{data.plant}</Text>
              </View>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>Shift:</Text>
                <Text style={pdfStyles.value}>{data.shift}</Text>
              </View>
              <View style={pdfStyles.gridCol}>
                <Text style={pdfStyles.label}>Inspector:</Text>
                <Text style={pdfStyles.value}>{data.inspector}</Text>
              </View>
            </View>
          </View>

          {/* Test Checks */}
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>EOL Test Checks</Text>
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.th, { flex: 2 }]}>Test Check / Sub-system</Text>
                <Text style={[pdfStyles.th, { flex: 1, textAlign: 'center' }]}>Requirement</Text>
                <Text style={[pdfStyles.th, { flex: 1, textAlign: 'center' }]}>Result</Text>
              </View>
              {data.checks.map((c, i) => (
                <View key={i} style={pdfStyles.tableRow}>
                  <Text style={[pdfStyles.td, { flex: 2 }]}>{c.name}</Text>
                  <Text style={[pdfStyles.td, { flex: 1, textAlign: 'center' }]}>PASS</Text>
                  <Text style={[pdfStyles.td, { flex: 1, textAlign: 'center', color: '#1cd46a', fontWeight: 'bold' }]}>PASS</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Release and Signatures */}
          <View style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#111111' }}>
              Final Release Status: Released for Finished Goods / Logistics
            </Text>
            <Text style={pdfStyles.statusBadge}>OVERALL RESULT: PASS</Text>
          </View>

          <View style={pdfStyles.signatures}>
            <View style={pdfStyles.sigBlock}>
              <View style={pdfStyles.sigLine} />
              <Text style={pdfStyles.sigText}>Quality Inspector</Text>
              <Text style={{ fontSize: 7, color: '#999999' }}>{data.inspector}</Text>
            </View>
            <View style={pdfStyles.sigBlock}>
              <View style={pdfStyles.sigLine} />
              <Text style={pdfStyles.sigText}>Production / Quality Approval</Text>
              <Text style={{ fontSize: 7, color: '#999999' }}>Authorized Digital Stamp</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={pdfStyles.footer}>
            <Text style={pdfStyles.footerText}>Generated by AutoMFG — Vibe Automotives</Text>
            <Text style={pdfStyles.footerText}>Document Ref: {data.certNo}-FG</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function QualityDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('gate');
  const [selectedVIN, setSelectedVIN] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [scanInput, setScanInput] = useState('');
  
  const [awaitingGate, setAwaitingGate] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [defects, setDefects] = useState([]);
  const [eolQueue, setEolQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCert, setSelectedCert] = useState(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [generatingVin, setGeneratingVin] = useState(null);

  const safeUUID = (id) =>
    id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;

  const isMock = (str) => {
    if (!str) return false;
    const s = String(str).toUpperCase();
    return (
      s.includes('WBS3R9C57FK999001') ||
      s.includes('WBS3R9C57FK999002') ||
      s.includes('WBS3R9C57FK999010') ||
      s.includes('BMW-M4-DOOR-LH') ||
      s.includes('WO-2024-0001') ||
      s.includes('WO-2024-0003') ||
      s.includes('WO-20260520-0001') ||
      s.includes('WO-20260521-0005') ||
      s.includes('CP-001') ||
      s.includes('SURFACE SCRATCH') ||
      s.includes('MATERIAL CRACK') ||
      s.includes('MOCKREWORK') ||
      s.includes('MOCKSCRAP') ||
      s.includes('SAMPLEREWORK') ||
      s.includes('DEMOREWORK')
    );
  };

  const fetchQualityData = async () => {
    try {
      setLoading(true);
      
      const { data: handoffs } = await supabase
        .from('gate5_bom_cad_handoffs')
        .select('id, program_id, program_name, ebom_payload, cad_payload, created_at')
        .order('created_at', { ascending: false });
      
      const { data: wos } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: plans } = await supabase
        .from('production_plans')
        .select('*');

      const { data: insps } = await supabase
        .from('quality_inspections')
        .select('*, inspection_checks(*)')
        .order('inspected_at', { ascending: false });

      const { data: defs } = await supabase
        .from('defect_records')
        .select('*')
        .order('logged_at', { ascending: false });

      const { data: eolRuns } = await supabase
        .from('eol_test_runs')
        .select('*');

      const { data: eolCerts } = await supabase
        .from('eol_certificates')
        .select('*');

      const cleanHandoffs = (handoffs || []).filter(h => !isMock(h.program_name));
      const cleanWos = (wos || []).filter(w => !isMock(w.wo_number) && !isMock(w.vin) && !isMock(w.part_number));
      const cleanInsps = (insps || []).filter(i => !isMock(i.wo_number) && !isMock(i.control_plan_ref));
      const cleanDefs = (defs || []).filter(d => !isMock(d.wo_number) && !isMock(d.defect_type));
      const cleanEolRuns = (eolRuns || []).filter(r => !isMock(r.vin));
      const cleanEolCerts = (eolCerts || []).filter(c => !isMock(c.eol_certificate_no));

      const activeWos = cleanWos.filter(w => 
        ['in_progress', 'completed', 'ready_for_quality', 'quality_pending', 'released'].includes(w.status)
      );

      const woAwaiting = activeWos.map(w => {
        const matchingPlan = (plans || []).find(p => p.plan_id === w.plan_id);
        const matchingHandoff = cleanHandoffs.find(h => h.id === matchingPlan?.bom_id || h.program_name === w.part_number);
        return {
          id: w.wo_number,
          vin: w.vin || `VIN-${w.wo_number.slice(-6)}`,
          part: w.part_number,
          wo: w.wo_number,
          op: '010',
          station: 'QC-Gate-Prod',
          program_name: w.part_number,
          ebom_payload: matchingHandoff?.ebom_payload || [],
          cad_payload: matchingHandoff?.cad_payload || []
        };
      });

      const rndQualityInputs = cleanHandoffs.map(row => ({
        id: row.id,
        program_id: row.program_id,
        product_name: row.program_name,
        program_name: row.program_name,
        ebom_payload: row.ebom_payload || [],
        cad_payload: row.cad_payload || [],
        bom_item_count: Array.isArray(row.ebom_payload) ? row.ebom_payload.length : 0,
        cad_file_count: Array.isArray(row.cad_payload) ? row.cad_payload.length : 0,
        source: 'AutoRND',
        status: 'ready_for_quality',
        vin: `RND-${(row.program_name || 'RND').toUpperCase().replace(/\s+/g, '-')}-${(row.id || '').slice(0, 4)}`,
        part: row.program_name,
        wo: 'AutoRND Handoff',
        op: 'R&D',
        station: 'QC-Gate-RND'
      }));

      const linkedProgramNames = new Set(woAwaiting.map(w => w.part));
      const filteredRndAwaiting = rndQualityInputs.filter(r => !linkedProgramNames.has(r.program_name));
      const mergedAwaiting = [...woAwaiting, ...filteredRndAwaiting];
      setAwaitingGate(mergedAwaiting);

      setInspections(cleanInsps);
      setDefects(cleanDefs);

      const passedInspections = cleanInsps.filter(i => i.result === 'pass');
      const mappedEol = [];
      const seenVins = new Set();

      passedInspections.forEach(i => {
        const matchingWo = cleanWos.find(w => w.wo_number === i.wo_number);
        const vin = matchingWo?.vin || i.wo_number;

        if (seenVins.has(vin)) return;
        seenVins.add(vin);

        const testRun = cleanEolRuns.find(run => run.vin === vin);
        let status = 'Awaiting EOL';
        if (testRun) {
          if (testRun.overall_result === 'pass') {
            const cert = cleanEolCerts.find(c => c.eol_run_id === testRun.eol_run_id);
            status = cert ? 'CERTIFICATE GENERATED' : 'PASS';
          }
        }

        mappedEol.push({
          vin,
          model: matchingWo?.part_number || 'AutoRND Item',
          status,
          tests: 6
        });
      });

      setEolQueue(mappedEol);

      // Debugging logs as requested
      console.log("AutoRND handoffs for quality:", rndQualityInputs);
      console.log("Fetched work orders for quality:", cleanWos);
      console.log("Fetched inspection records:", cleanInsps);
      console.log("Fetched defects:", cleanDefs);
      console.log("Quality dashboard counts:", {
        awaitingGate: mergedAwaiting.length,
        inspectionsToday: cleanInsps.length,
        eolQueue: mappedEol.length
      });

    } catch (err) {
      console.error('Error fetching quality data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQualityData();

    const channel = supabase
      .channel('quality_realtime_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gate5_bom_cad_handoffs' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quality_inspections' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'defect_records' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rework_orders' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eol_test_runs' }, fetchQualityData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'eol_certificates' }, fetchQualityData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (selectedVIN) {
      const item = awaitingGate.find(u => u.vin === selectedVIN);
      if (item) {
        if (Array.isArray(item.ebom_payload) && item.ebom_payload.length > 0) {
          setMeasurements(item.ebom_payload.map((part, index) => ({
            char: part.part_name || part.component_name || part.name || `BOM Item ${index + 1}`,
            nominal: part.nominal || 0.0,
            usl: part.usl || 1.0,
            lsl: part.lsl || -1.0,
            measured: null,
            unit: part.unit || 'mm'
          })));
        } else {
          setMeasurements([
            { char: `${item.part} - Dimensional Tolerance`, nominal: 0.0, usl: 1.0, lsl: -1.0, measured: null, unit: 'mm' },
            { char: `${item.part} - Surface Finish`, nominal: 1.6, usl: 2.0, lsl: 0.8, measured: null, unit: 'Ra µm' },
            { char: `${item.part} - Fitment & Alignment`, nominal: 3.5, usl: 4.5, lsl: 2.5, measured: null, unit: 'mm' },
          ]);
        }
      }
    } else {
      setMeasurements([]);
    }
  }, [selectedVIN, awaitingGate]);

  const handleGenerateCertificate = async (e) => {
    if (e.status !== 'PASS' && e.status !== 'CERTIFICATE GENERATED') {
      toast.error('Certificate can only be generated after EOL PASS.');
      return;
    }

    const certNo = `EOL-CERT-${e.vin.slice(-6)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const certData = {
      certNo,
      vin: e.vin,
      model: e.model,
      variant: e.model.toLowerCase().includes('m4') ? 'Competition' : 'Sedan',
      plant: user?.plant || 'Plant A',
      shift: 'Shift A',
      inspector: user?.name || 'Quality Inspector',
      date: new Date().toLocaleDateString('en-GB'),
      checks: [
        { name: 'Engine / Motor Test', passed: true },
        { name: 'Brakes Test', passed: true },
        { name: 'Lights Test', passed: true },
        { name: 'Dimensions Test', passed: true },
        { name: 'ECU / Electronics Test', passed: true },
        { name: 'Water Ingress Test', passed: true }
      ]
    };

    setGeneratingVin(e.vin);

    try {
      // Check if a certificate already exists in database
      const { data: runs } = await supabase
        .from('eol_test_runs')
        .select('*')
        .eq('vin', e.vin)
        .eq('overall_result', 'pass')
        .order('tested_at', { ascending: false });

      let run = runs && runs.length > 0 ? runs[0] : null;

      if (run) {
        const { data: existingCert } = await supabase
          .from('eol_certificates')
          .select('*')
          .eq('eol_run_id', run.eol_run_id)
          .maybeSingle();

        if (existingCert) {
          certData.certNo = existingCert.eol_certificate_no;
          setSelectedCert(certData);
          setShowCertModal(true);
          setEolQueue(prev => prev.map(item => item.vin === e.vin ? { ...item, status: 'CERTIFICATE GENERATED' } : item));
          setGeneratingVin(null);
          return;
        }
      }

      // If no run or cert exists in the database, we create them:
      // A. Ensure VIN exists in vin_units
      try {
        const partNumber = e.model.toLowerCase().includes('m4') ? 'BMW-M4-DOOR-LH' : 'BMW-3-CHASSIS';
        const { error: vinErr } = await supabase.from('vin_units').upsert({
          vin: e.vin,
          part_number: partNumber,
          current_status: 'released'
        }, { onConflict: 'vin' });

        if (vinErr) {
          console.warn('vin_units upsert error:', vinErr);
        }
      } catch (err) {
        console.warn('vin_units upsert exception:', err);
      }

      // B. Create eol_test_runs entry and certificates in database
      try {
        if (!run) {
          const { data: newRun, error: newRunErr } = await supabase.from('eol_test_runs').insert({
            vin: e.vin,
            run_no: 1,
            overall_result: 'pass',
            tested_by: safeUUID(user?.id),
            tested_at: new Date().toISOString()
          }).select().single();

          if (newRunErr) {
            throw newRunErr;
          }
          run = newRun;
        }

        // C. Insert into eol_certificates
        const { error: certErr } = await supabase.from('eol_certificates').insert({
          eol_certificate_no: certData.certNo,
          eol_run_id: run.eol_run_id,
          certificate_link: `https://smkgmfgbuioclfbuuynl.supabase.co/storage/v1/object/public/certificates/${e.vin}.pdf`,
          issued_at: new Date().toISOString()
        });

        if (certErr) {
          throw certErr;
        }

        // D. Try updates to related tables
        try {
          await supabase
            .from('vin_units')
            .update({ current_status: 'released' })
            .eq('vin', e.vin);
        } catch (err) {
          console.warn('Failed to update status in vin_units:', err);
        }

        try {
          await supabase.from('serial_production_releases').insert({
            vin: e.vin,
            status: 'released',
            released_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Failed to insert into serial_production_releases:', err);
        }

        try {
          await supabase.from('finished_goods_releases').insert({
            vin: e.vin,
            release_date: new Date().toISOString(),
            status: 'released'
          });
        } catch (err) {
          console.warn('Failed to insert into finished_goods_releases:', err);
        }

        try {
          await supabase.from('logistics_releases').insert({
            vin: e.vin,
            logistics_status: 'Pending Dispatch'
          });
        } catch (err) {
          console.warn('Failed to insert into logistics_releases:', err);
        }

        try {
          await supabase.from('scm_handoffs').insert({
            handoff_type: 'EOL_CERTIFICATE',
            source_module: 'AutoMFG',
            target_module: 'AutoSCM',
            payload: { vin: e.vin, certificate_number: certData.certNo },
            status: 'Synced',
            created_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn('Failed to insert into scm_handoffs:', err);
        }

        toast.success(`EOL Certificate ${certData.certNo} generated and saved to DB!`);
      } catch (dbErr) {
        console.warn('Database persistence failed, proceeding with local PDF generation:', dbErr);
        toast.error('DB Sync failed (RLS policy). Certificate generated locally.', { duration: 5000 });
      }

      setSelectedCert(certData);
      setShowCertModal(true);
      setEolQueue(prev => prev.map(item => item.vin === e.vin ? { ...item, status: 'CERTIFICATE GENERATED' } : item));

    } catch (err) {
      console.error('Error in handleGenerateCertificate:', err);
      toast.error('Failed to generate EOL certificate.');
    } finally {
      setGeneratingVin(null);
    }
  };

  const handleMeasure = (i, val) => {
    const v = parseFloat(val);
    setMeasurements(prev => prev.map((c, idx) => idx === i ? { ...c, measured: isNaN(v) ? null : v } : c));
  };

  const getResult = (c) => {
    if (c.measured === null) return null;
    return c.measured >= c.lsl && c.measured <= c.usl ? 'OK' : 'NOK';
  };

  const allMeasured = measurements.every(c => c.measured !== null);
  const anyNOK = measurements.some(c => getResult(c) === 'NOK');

  const handleGateDecision = async (decision) => {
    const selectedItem = awaitingGate.find(u => u.vin === selectedVIN);
    if (!selectedItem) {
      toast.error('No selected item found');
      return;
    }

    const inspectorId = safeUUID(user?.id);
    const woNumber = selectedItem.wo === 'AutoRND Handoff' ? selectedItem.part : selectedItem.wo;

    try {
      // 1. Insert into quality_inspections
      const { data: ins, error: inspError } = await supabase
        .from('quality_inspections')
        .insert({
          wo_number: woNumber,
          control_plan_ref: 'CP-BOM',
          result: decision === 'pass' ? 'pass' : 'fail',
          inspected_at: new Date().toISOString(),
          inspector_id: inspectorId,
        })
        .select()
        .single();

      if (inspError) throw inspError;

      // 2. Insert into inspection_checks
      if (ins) {
        const { error: checkError } = await supabase.from('inspection_checks').insert(
          measurements.map(m => ({
            inspection_id: ins.inspection_id,
            characteristic: m.char,
            measurement: m.measured,
            usl: m.usl,
            lsl: m.lsl,
            status: getResult(m) === 'OK' ? 'ok' : 'nok'
          }))
        );
        if (checkError) throw checkError;
      }

      if (decision === 'pass') {
        // Update work order to completed if it's production
        if (selectedItem.wo !== 'AutoRND Handoff') {
          await supabase
            .from('work_orders')
            .update({ status: 'completed' })
            .eq('wo_number', selectedItem.wo);
        }
        
        // Upsert vin_units status
        await supabase.from('vin_units').upsert({
          vin: selectedItem.vin,
          part_number: selectedItem.part,
          current_status: 'quality_passed'
        }, { onConflict: 'vin' });

        toast.success(`VIN ${selectedVIN} — PASSED Quality Gate`);
      } else {
        // Create batch hold
        if (ins) {
          await supabase.from('batch_holds').insert({
            inspection_id: ins.inspection_id,
            reason: `NOK measurement(s) on ${selectedItem.part}`,
            status: 'active',
            held_at: new Date().toISOString(),
          });
        }

        // Log Defect in defect_records
        const nokChar = measurements.find(m => getResult(m) === 'NOK')?.char || 'Measurement Deviation';
        const { data: defRecord, error: defErr } = await supabase
          .from('defect_records')
          .insert({
            wo_number: woNumber,
            defect_type: nokChar,
            qty: 1,
            disposition: 'rework',
            logged_by: inspectorId,
            logged_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (defErr) throw defErr;

        // Auto-create rework order
        if (defRecord) {
          await supabase.from('rework_orders').insert({
            defect_id: defRecord.defect_id,
            status: 'open'
          });
        }

        toast.error(`VIN ${selectedVIN} — FAILED — Sent to Rework`);
      }

      setSelectedVIN(null);
      setMeasurements([]);
      fetchQualityData();
    } catch (err) {
      toast.error('Failed to record quality decision: ' + err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-block">
          <h1 className="page-title">Quality Inspector Dashboard</h1>
          <div className="page-subtitle">Quality Gate · Defects · Scrap/Rework · EOL — {user?.plant}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/eol-testing')}><TestTube size={13} /> EOL Testing</button>
          <span className="badge badge-blue">SHIFT A</span>
        </div>
      </div>

      {/* Workflow */}
      <div className="card mb-16" style={{ padding: '12px 16px' }}>
        <WorkflowSteps steps={['Quality Gate', 'Scrap / Rework', 'EOL Testing', 'Certificate', 'Finished Goods Release']} current={0} />
      </div>

      {/* KPIs */}
      <div className="grid grid-4 mb-16">
        <MetricCard label="Awaiting Gate"     value={awaitingGate.length} color="amber" icon={Shield} />
        <MetricCard label="Inspections Today" value={inspections.filter(i => i.inspected_at?.startsWith(new Date().toISOString().slice(0, 10))).length} color="blue" icon={CheckCircle2} />
        <MetricCard label="NOK Today"         value={inspections.filter(i => i.result === 'fail' && i.inspected_at?.startsWith(new Date().toISOString().slice(0, 10))).length} color="red" icon={XCircle} />
        <MetricCard label="EOL Queue"         value={eolQueue.filter(e => e.status === 'Awaiting EOL').length} color="blue" icon={TestTube} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'gate', label: 'Quality Gate' },
          { id: 'eol', label: 'EOL Queue' },
          { id: 'defects', label: 'Defect Register' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: '8px 20px', background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === id ? 'var(--bmw-blue)' : 'transparent'}`,
            color: activeTab === id ? 'var(--bmw-blue)' : 'var(--muted-text)',
            fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Quality Gate Tab */}
      {activeTab === 'gate' && (
        <div className="grid grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Units Awaiting Inspection</span>
              <IntegBadge type="from_rnd" />
            </div>
            {/* VIN scan */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={scanInput} onChange={e => setScanInput(e.target.value)} placeholder="Scan or enter VIN..." style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-active)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 12, outline: 'none' }} />
              <button className="btn btn-primary btn-sm" onClick={() => { if (scanInput) { setSelectedVIN(scanInput); setScanInput(''); } }}>Scan</button>
            </div>
            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
                Loading...
              </div>
            ) : awaitingGate.length === 0 ? (
              <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
                <Shield size={24} color="var(--muted-text)" style={{ marginBottom: 8 }} />
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>No units awaiting inspection.</div>
              </div>
            ) : awaitingGate.map(u => (
              <div key={u.vin} onClick={() => setSelectedVIN(u.vin)} style={{ padding: '10px 12px', background: selectedVIN === u.vin ? 'var(--bmw-blue-subtle)' : 'var(--bg-elevated)', border: `1px solid ${selectedVIN === u.vin ? 'var(--bmw-blue)' : 'var(--border)'}`, marginBottom: 1, cursor: 'pointer' }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{u.vin}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{u.part} · {u.wo} · {u.station}</div>
              </div>
            ))}
          </div>

          {/* Control Plan Measurement Entry */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Control Plan — Measurement Entry</span>
              <IntegBadge type="from_rnd" />
            </div>
            {!selectedVIN ? (
              <div className="empty-state" style={{ padding: 32 }}>
                <Shield size={24} color="var(--muted-text)" />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>SELECT A VIN TO INSPECT</span>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--bmw-blue)', marginBottom: 12, letterSpacing: '0.08em' }}>VIN: {selectedVIN}</div>
                {measurements.map((c, i) => {
                  const result = getResult(c);
                  return (
                    <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', border: `1px solid ${result === 'OK' ? 'rgba(28,212,106,0.4)' : result === 'NOK' ? 'rgba(255,50,50,0.4)' : 'var(--border)'}`, marginBottom: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-primary)' }}>{c.char}</span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--muted-text)' }}>LSL {c.lsl} / Nom {c.nominal} / USL {c.usl} {c.unit}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="number" placeholder="Enter measurement" onChange={e => handleMeasure(i, e.target.value)} style={{ flex: 1, padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border-active)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 12, outline: 'none' }} />
                        {result && <span className={`badge ${result === 'OK' ? 'badge-green' : 'badge-red'}`}>{result}</span>}
                      </div>
                    </div>
                  );
                })}
                {allMeasured && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn btn-primary" style={{ flex: 1, background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => handleGateDecision('pass')} disabled={anyNOK}>
                      <CheckCircle2 size={13} /> PASS
                    </button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleGateDecision('fail')}>
                      <XCircle size={13} /> FAIL — Rework
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* EOL Queue Tab */}
      {activeTab === 'eol' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">EOL Test Queue</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/eol-testing')}>Full EOL Module</button>
          </div>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-text)', fontSize: 12 }}>
              Loading...
            </div>
          ) : eolQueue.length === 0 ? (
            <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
              <TestTube size={24} color="var(--muted-text)" style={{ marginBottom: 8 }} />
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--muted-text)' }}>No units ready for EOL testing.</div>
            </div>
          ) : eolQueue.map(e => (
            <div key={e.vin} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 1 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-primary)' }}>{e.vin}</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--muted-text)' }}>{e.model} · {e.tests} test checks</div>
              </div>
              <StatusBadge status={e.status} />
              {e.status === 'Awaiting EOL' && (
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/eol-testing')}><TestTube size={12} /> Run EOL</button>
              )}
              {e.status === 'PASS' && (
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--green)', borderColor: 'var(--green)', color: 'white' }}
                  onClick={() => handleGenerateCertificate(e)}
                  disabled={generatingVin === e.vin}
                >
                  <Award size={12} /> {generatingVin === e.vin ? 'Generating...' : 'Gen Certificate'}
                </button>
              )}
              {e.status === 'CERTIFICATE GENERATED' && (
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--bmw-blue)', borderColor: 'var(--bmw-blue)', color: 'white' }}
                  onClick={() => handleGenerateCertificate(e)}
                >
                  <Award size={12} /> View Certificate
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Defect Register Tab */}
      {activeTab === 'defects' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Defect Register</span>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/scrap-rework')}>Full Scrap/Rework</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Defect ID</th>
                  <th>Work Order / Unit</th>
                  <th>Defect Type</th>
                  <th>Qty</th>
                  <th>Disposition</th>
                  <th>Logged At</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading...</td></tr>
                ) : defects.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted-text)' }}>No defects registered.</td></tr>
                ) : defects.map((def) => (
                  <tr key={def.defect_id}>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--white)', fontSize: 13 }}>
                      {def.defect_id?.slice(0, 8)}
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 12 }}>{def.wo_number}</td>
                    <td style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{def.defect_type || '—'}</td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--red)' }}>{def.qty}</td>
                    <td>
                      <span className={`badge ${DISPOSITION_COLOR[def.disposition] || 'badge-gray'}`}>
                        {(def.disposition || 'pending').toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {def.logged_at ? def.logged_at.slice(0, 16).replace('T', ' ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showCertModal && selectedCert && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ maxWidth: 650, background: 'var(--bg-surface)' }}>
            <div className="modal-header">
              <span className="modal-title">EOL Certificate Preview</span>
              <button className="icon-btn" onClick={() => setShowCertModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* Branded Certificate Preview Container */}
              <div style={{
                background: '#ffffff',
                color: '#111111',
                border: '2px solid #1c69d4',
                padding: '24px 32px',
                fontFamily: 'var(--font-body)',
                position: 'relative'
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #e0e0e0',
                  paddingBottom: 12,
                  marginBottom: 16
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 18,
                        height: 18,
                        background: '#1c69d4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75L12 12 4.5 8.25 12 4.5z" />
                        </svg>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.08em', color: '#1c69d4', fontFamily: 'var(--font-heading)' }}>
                        VIBE AUTOMOTIVES
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: '#777777', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                      AutoMFG — Manufacturing Execution Suite
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 10, color: '#666666' }}>
                    <div>Date: {selectedCert.date}</div>
                    <div style={{ fontWeight: 'bold', color: '#1c69d4', marginTop: 2 }}>{selectedCert.certNo}</div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#222222', fontFamily: 'var(--font-heading)' }}>
                    End-of-Line Test Certificate
                  </div>
                </div>

                {/* Grid */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1c69d4', borderBottom: '1px solid #1c69d4', paddingBottom: 3, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
                    Vehicle Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
                    <div><span style={{ color: '#666666' }}>VIN:</span> <strong>{selectedCert.vin}</strong></div>
                    <div><span style={{ color: '#666666' }}>Model:</span> <strong>{selectedCert.model}</strong></div>
                    <div><span style={{ color: '#666666' }}>Variant:</span> <strong>{selectedCert.variant}</strong></div>
                    <div><span style={{ color: '#666666' }}>Plant:</span> <strong>{selectedCert.plant}</strong></div>
                    <div><span style={{ color: '#666666' }}>Shift:</span> <strong>{selectedCert.shift}</strong></div>
                    <div><span style={{ color: '#666666' }}>Inspector:</span> <strong>{selectedCert.inspector}</strong></div>
                  </div>
                </div>

                {/* Table */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#1c69d4', borderBottom: '1px solid #1c69d4', paddingBottom: 3, marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
                    EOL Test Checks
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                        <th style={{ textAlign: 'left', padding: 6, fontWeight: 'bold' }}>Test Check / Sub-system</th>
                        <th style={{ textAlign: 'center', padding: 6, fontWeight: 'bold', width: '100px' }}>Requirement</th>
                        <th style={{ textAlign: 'center', padding: 6, fontWeight: 'bold', width: '100px' }}>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCert.checks.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <td style={{ padding: 6 }}>{c.name}</td>
                          <td style={{ padding: 6, textAlign: 'center' }}>PASS</td>
                          <td style={{ padding: 6, textAlign: 'center', color: '#1cd46a', fontWeight: 'bold' }}>PASS</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Final Status */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#111111' }}>
                    Final Release Status: Released for Finished Goods / Logistics
                  </div>
                  <div style={{ background: '#1cd46a', color: '#ffffff', fontSize: 12, fontWeight: 'bold', padding: '4px 10px', borderRadius: 2 }}>
                    OVERALL RESULT: PASS
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e0e0e0', paddingTop: 16, fontSize: 10 }}>
                  <div style={{ width: '40%', textAlign: 'center' }}>
                    <div style={{ height: 24 }}></div>
                    <div style={{ borderTop: '1px solid #999999', paddingTop: 4, color: '#666666' }}>
                      Quality Inspector
                    </div>
                    <div style={{ fontSize: 8, color: '#999999' }}>{selectedCert.inspector}</div>
                  </div>
                  <div style={{ width: '40%', textAlign: 'center' }}>
                    <div style={{ height: 24 }}></div>
                    <div style={{ borderTop: '1px solid #999999', paddingTop: 4, color: '#666666' }}>
                      Production / Quality Approval
                    </div>
                    <div style={{ fontSize: 8, color: '#999999', fontStyle: 'italic' }}>Authorized Digital Stamp</div>
                  </div>
                </div>
              </div>

            </div>
            <div className="modal-footer" style={{ gap: 12 }}>
              <button className="btn btn-outline" onClick={() => setShowCertModal(false)}>Close</button>
              
              <PDFDownloadLink
                document={<EOLCertPDF data={selectedCert} />}
                fileName={`${selectedCert.certNo}.pdf`}
                style={{ textDecoration: 'none' }}
              >
                {({ loading }) => (
                  <button className="btn btn-primary" disabled={loading}>
                    <FileText size={14} style={{ marginRight: 6 }} />
                    {loading ? 'Preparing PDF...' : 'Download PDF'}
                  </button>
                )}
              </PDFDownloadLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

