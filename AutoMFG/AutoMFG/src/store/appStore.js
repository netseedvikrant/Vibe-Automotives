// ============================================
// AutoMFG — App Data Store (Zustand)
// ============================================
import { create } from 'zustand';

// ---- Mock Data Generators ----
const generateWOs = () => [];

const generateTools = () => [
  { id: 'TL-001', name: 'Torque Wrench 80Nm', type: 'Hand Tool', location: 'Station 1A', calibrationDate: '2026-04-15', nextCalibration: '2026-07-15', cycleCount: 4250, maxCycles: 5000, status: 'Active' },
  { id: 'TL-002', name: 'CMM Probe Stylus', type: 'Measurement', location: 'Quality Lab', calibrationDate: '2026-05-01', nextCalibration: '2026-05-22', cycleCount: 12000, maxCycles: 15000, status: 'Warning' },
  { id: 'TL-003', name: 'Pneumatic Drill 18V', type: 'Power Tool', location: 'Station 3B', calibrationDate: '2026-03-10', nextCalibration: '2026-06-10', cycleCount: 8900, maxCycles: 10000, status: 'Critical' },
  { id: 'TL-004', name: 'Digital Caliper 150mm', type: 'Measurement', location: 'Line 2 QC', calibrationDate: '2026-05-10', nextCalibration: '2026-08-10', cycleCount: 3200, maxCycles: 20000, status: 'Active' },
  { id: 'TL-005', name: 'Laser Alignment Kit', type: 'Alignment', location: 'Line 1 Start', calibrationDate: '2026-04-28', nextCalibration: '2026-05-28', cycleCount: 680, maxCycles: 2000, status: 'Warning' },
  { id: 'TL-006', name: 'Hydraulic Press 50T', type: 'Machine', location: 'Press Shop', calibrationDate: '2026-02-15', nextCalibration: '2026-05-19', cycleCount: 22000, maxCycles: 25000, status: 'Critical' },
];

const generateDefects = () => [
  { id: 'DEF-001', part: 'BMW-M4-DOOR-LH', operation: '010 - Welding', defectType: 'Surface Scratch', qty: 2, disposition: 'Rework', status: 'In Progress', shift: 'A', date: '2026-05-17' },
  { id: 'DEF-002', part: 'BMW-3-CHASSIS', operation: '020 - Forming', defectType: 'Dimensional OOT', qty: 1, disposition: 'Scrap', status: 'Approved', shift: 'A', date: '2026-05-17' },
  { id: 'DEF-003', part: 'BMW-5-ENGINE-MOUNT', operation: '010 - Casting', defectType: 'Porosity', qty: 3, disposition: 'UAI', status: 'Pending Approval', shift: 'B', date: '2026-05-16' },
  { id: 'DEF-004', part: 'BMW-7-DASH-PANEL', operation: '030 - Paint', defectType: 'Color Deviation', qty: 1, disposition: 'Rework', status: 'Complete', shift: 'A', date: '2026-05-16' },
  { id: 'DEF-005', part: 'BMW-M3-EXHAUST', operation: '040 - Fitting', defectType: 'Weld Crack', qty: 2, disposition: 'Scrap', status: 'Pending', shift: 'C', date: '2026-05-15' },
];

const generateMachines = () => [
  { id: 'MCH-001', name: 'Welding Robot A1', line: 'Line 1', status: 'Running', oee: 91, lastBreakdown: '2026-05-10', mttr: 42, mtbf: 480 },
  { id: 'MCH-002', name: 'Press Machine P1', line: 'Line 1', status: 'Breakdown', oee: 73, lastBreakdown: '2026-05-17', mttr: 68, mtbf: 320 },
  { id: 'MCH-003', name: 'CMM Renishaw', line: 'QC Lab', status: 'Running', oee: 95, lastBreakdown: '2026-04-28', mttr: 15, mtbf: 720 },
  { id: 'MCH-004', name: 'CNC Lathe L3', line: 'Line 2', status: 'Maintenance', oee: 82, lastBreakdown: '2026-05-15', mttr: 55, mtbf: 380 },
  { id: 'MCH-005', name: 'Assembly Robot R2', line: 'Line 3', status: 'Running', oee: 88, lastBreakdown: '2026-05-05', mttr: 30, mtbf: 560 },
];

const generateBreakdowns = () => [
  { id: 'BRK-001', machineId: 'MCH-002', machine: 'Press Machine P1', description: 'Hydraulic pressure loss — ram not returning', severity: 'P1', status: 'Open', assignedTo: 'Maintenance Tech', reportedAt: '2026-05-17T18:20:00', acknowledged: false, repairLog: [] },
  { id: 'BRK-002', machineId: 'MCH-004', machine: 'CNC Lathe L3', description: 'Tool change cycle failure — spindle jam', severity: 'P2', status: 'In Repair', assignedTo: 'Maintenance Tech', reportedAt: '2026-05-17T14:10:00', acknowledged: true, repairLog: [{ time: '14:35', action: 'Inspected spindle — chip lodged', parts: 'Coolant jet nozzle' }] },
  { id: 'BRK-003', machineId: 'MCH-001', machine: 'Welding Robot A1', description: 'Wire feed error E-401', severity: 'P3', status: 'Resolved', assignedTo: 'Maintenance Tech', reportedAt: '2026-05-16T09:00:00', acknowledged: true, repairLog: [{ time: '09:25', action: 'Replaced wire spool and liner', parts: 'Wire spool, feed liner' }] },
];

const generatePlans = () => [
  { id: 'PP-2026-001', date: '2026-05-18', part: 'BMW-M4-DOOR-LH', vinRange: 'WBS...001–100', line: 'Line 1', plannedQty: 100, materialStatus: 'Available', capacityUtil: 85, status: 'Approved' },
  { id: 'PP-2026-002', date: '2026-05-18', part: 'BMW-3-CHASSIS', vinRange: 'WBS...201–260', line: 'Line 2', plannedQty: 60, materialStatus: 'Partial', capacityUtil: 72, status: 'Pending Approval' },
  { id: 'PP-2026-003', date: '2026-05-19', part: 'BMW-5-ENGINE-MOUNT', vinRange: 'WBS...301–345', line: 'Line 3', plannedQty: 45, materialStatus: 'Available', capacityUtil: 90, status: 'Draft' },
  { id: 'PP-2026-004', date: '2026-05-19', part: 'BMW-7-DASH-PANEL', vinRange: 'WBS...401–500', line: 'Line 4', plannedQty: 100, materialStatus: 'Available', capacityUtil: 78, status: 'Frozen' },
];

const generateShiftHandovers = () => [
  {
    id: 'SH-2026-001', shiftId: 'A-20260517', date: '2026-05-17', shift: 'A', outgoingSupervisor: 'John Carter', incomingSupervisor: 'Sara Lee',
    plannedOutput: 250, actualOutput: 238, scrapCount: 5, downtime: 22, safetyEvents: 0, openIssues: ['MCH-002 under repair', 'Material shortage Line 3'],
    status: 'Pending Sign-off',
  },
  {
    id: 'SH-2026-002', shiftId: 'C-20260516', date: '2026-05-16', shift: 'C', outgoingSupervisor: 'Mark Evans', incomingSupervisor: 'John Carter',
    plannedOutput: 240, actualOutput: 241, scrapCount: 2, downtime: 10, safetyEvents: 1, openIssues: ['Safety near-miss at Station 4 - investigated'],
    status: 'Signed Off',
  },
];

const generateEOLTests = () => [
  { id: 'EOL-001', vin: 'WBS3R9C57FK001', model: 'BMW M4', variant: 'Competition', date: '2026-05-17', engineTest: 'PASS', brakesTest: 'PASS', lightsTest: 'PASS', dimensionsTest: 'PASS', electronicsTest: 'FAIL', waterTest: 'PASS', overallResult: 'FAIL', retestDone: false },
  { id: 'EOL-002', vin: 'WBS3R9C57FK002', model: 'BMW 3 Series', variant: '320d', date: '2026-05-17', engineTest: 'PASS', brakesTest: 'PASS', lightsTest: 'PASS', dimensionsTest: 'PASS', electronicsTest: 'PASS', waterTest: 'PASS', overallResult: 'PASS', retestDone: false },
  { id: 'EOL-003', vin: 'WBS3R9C57FK003', model: 'BMW 5 Series', variant: '530i', date: '2026-05-16', engineTest: 'FAIL', brakesTest: 'PASS', lightsTest: 'PASS', dimensionsTest: 'FAIL', electronicsTest: 'PASS', waterTest: 'PASS', overallResult: 'FAIL', retestDone: true },
];

const getResolvedAndonIdsFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem('automfg_resolved_andon_ids')) || [];
  } catch {
    return [];
  }
};

const saveResolvedAndonIdToStorage = (id) => {
  try {
    const resolvedIds = getResolvedAndonIdsFromStorage();
    if (!resolvedIds.includes(id)) {
      resolvedIds.push(id);
      localStorage.setItem('automfg_resolved_andon_ids', JSON.stringify(resolvedIds));
    }
  } catch (err) {
    console.warn('Failed to save resolved andon id to storage:', err);
  }
};

const generateAndonAlerts = () => {
  const resolvedIds = getResolvedAndonIdsFromStorage();
  const alerts = [
    { id: 'AND-001', line: 'Line 1', station: 'Station 3', type: 'machine_issue', description: 'Welding robot E-fault', severity: 'high', time: '18:15', status: 'Open' },
    { id: 'AND-002', line: 'Line 3', station: 'Station 1', type: 'part_shortage', description: 'Door seal gaskets depleted', severity: 'medium', time: '17:50', status: 'Acknowledged' },
  ];
  return alerts.map((a) => resolvedIds.includes(a.id) ? { ...a, status: 'Resolved' } : a);
};

const generateQualityGates = () => [
  { id: 'QG-001', part: 'BMW-M4-DOOR-LH', characteristic: 'Gap Flush LH Fender', nominalValue: 3.5, usl: 4.5, lsl: 2.5, measuredValue: 3.8, result: 'OK', inspector: 'Quality Inspector', date: '2026-05-17' },
  { id: 'QG-002', part: 'BMW-M4-DOOR-LH', characteristic: 'Door Alignment X-axis', nominalValue: 0.0, usl: 1.0, lsl: -1.0, measuredValue: 1.3, result: 'NOK', inspector: 'Quality Inspector', date: '2026-05-17' },
  { id: 'QG-003', part: 'BMW-3-CHASSIS', characteristic: 'Weld Tensile Strength', nominalValue: 420, usl: 450, lsl: 390, measuredValue: 425, result: 'OK', inspector: 'Quality Inspector', date: '2026-05-17' },
];

export const useAppStore = create((set, get) => ({
  // Data
  workOrders: generateWOs(),
  tools: generateTools(),
  defects: generateDefects(),
  machines: generateMachines(),
  breakdowns: generateBreakdowns(),
  productionPlans: generatePlans(),
  shiftHandovers: generateShiftHandovers(),
  eolTests: generateEOLTests(),
  andonAlerts: generateAndonAlerts(),
  qualityGates: generateQualityGates(),

  // UI State
  sidebarCollapsed: false,
  selectedPlant: 'Plant A',
  currentShift: 'A',
  toasts: [],
  isOnline: true,

  // OEE Metrics (live simulation)
  oeeMetrics: {
    availability: 91.2,
    performance: 87.5,
    quality: 96.8,
    oee: 77.2,
    fpy: 94.1,
    scheduleAdherence: 88.4,
    andonResponseTime: 8.2,
    eolFirstPass: 91.5,
  },

  // Actions
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPlant: (plant) => set({ selectedPlant: plant }),
  setShift: (shift) => set({ currentShift: shift }),
  setOnline: (isOnline) => set({ isOnline }),

  addToast: (toast) => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  // Work Orders
  updateWOStatus: (id, status) => set((s) => ({
    workOrders: s.workOrders.map((wo) => wo.id === id ? { ...wo, status } : wo),
  })),

  addWorkOrder: (wo) => set((s) => ({ workOrders: [wo, ...s.workOrders] })),

  // Production Plans
  updatePlanStatus: (id, status) => set((s) => ({
    productionPlans: s.productionPlans.map((p) => p.id === id ? { ...p, status } : p),
  })),

  addProductionPlan: (plan) => set((s) => ({ productionPlans: [plan, ...s.productionPlans] })),

  // Andon
  setAndonAlerts: (alerts) => set({ andonAlerts: alerts }),

  fetchAndons: async () => {
    const { supabase, isSupabaseConfigured, getAndonTableName, mapAndonFromDb } = await import('../lib/supabase');
    if (!isSupabaseConfigured()) return;
    try {
      const tableName = await getAndonTableName();
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) throw error;
      if (data) {
        const formatted = data.map((item) => {
          const mapped = mapAndonFromDb(item, tableName);
          const resolvedIds = getResolvedAndonIdsFromStorage();
          const isResolved = mapped.status === 'resolved' || resolvedIds.includes(mapped.id);
          if (isResolved) {
            mapped.status = 'Resolved';
          } else if (mapped.status === 'acknowledged') {
            mapped.status = 'Acknowledged';
          } else {
            mapped.status = 'Open';
          }
          return mapped;
        });
        set({ andonAlerts: formatted });
      }
    } catch (err) {
      console.warn('[appStore] fetchAndons failed:', err.message);
    }
  },

  raiseAndon: async (alert) => {
    const { supabase, isSupabaseConfigured, getAndonTableName, mapAndonToDb, mapAndonFromDb, insertDynamic, updateDynamic } = await import('../lib/supabase');
    
    // Check if it's already an active database alert (uuid length 36)
    const isDbAlert = alert.id && alert.id.length === 36 && !alert.id.startsWith('AND-');
    
    if (isSupabaseConfigured() && navigator.onLine && !isDbAlert) {
      try {
        const tableName = await getAndonTableName();
        const payload = mapAndonToDb(alert, tableName);
        const { data, error } = await insertDynamic(tableName, payload);
        if (error) {
          console.warn('[appStore] Failed to insert andon alert into Supabase:', error.message);
          throw error;
        } else if (data) {
          const mapped = mapAndonFromDb(data, tableName);
          mapped.status = 'Open';
          set((s) => {
            const exists = s.andonAlerts.some(a => a.id === mapped.id);
            if (exists) return {};
            return { andonAlerts: [mapped, ...s.andonAlerts] };
          });
        }
      } catch (err) {
        console.warn('[appStore] Exception in raiseAndon Supabase insert:', err);
        // Fallback to offline / local store
        const newAlert = {
          id: alert.id || `AND-${Date.now()}`,
          line: alert.line || 'Line 1',
          station: alert.station || 'Unknown',
          type: alert.type || alert.issue_type || 'machine_issue',
          issue_type: alert.type || alert.issue_type || 'machine_issue',
          description: alert.description || 'Andon alert raised',
          severity: alert.severity || 'medium',
          time: alert.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          status: 'Open',
          plant: alert.plant || 'Plant A',
          shift: alert.shift || 'Shift A',
        };
        set((s) => {
          const exists = s.andonAlerts.some(a => a.id === newAlert.id);
          if (exists) return {};
          return { andonAlerts: [newAlert, ...s.andonAlerts] };
        });
      }
    } else {
      // Offline fallback or already a DB-synced alert
      const newAlert = {
        id: alert.id || `AND-${Date.now()}`,
        line: alert.line || 'Line 1',
        station: alert.station || 'Unknown',
        type: alert.type || alert.issue_type || 'machine_issue',
        issue_type: alert.type || alert.issue_type || 'machine_issue',
        description: alert.description || 'Andon alert raised',
        severity: alert.severity || 'medium',
        time: alert.time || new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        status: alert.status === 'Resolved' || alert.status === 'resolved' ? 'Resolved' : 'Open',
        plant: alert.plant || 'Plant A',
        shift: alert.shift || 'Shift A',
      };
      set((s) => {
        const exists = s.andonAlerts.some(a => a.id === newAlert.id);
        if (exists) return {};
        return { andonAlerts: [newAlert, ...s.andonAlerts] };
      });
    }
  },

  resolveAndon: async (id) => {
    saveResolvedAndonIdToStorage(id);
    set((s) => ({
      andonAlerts: s.andonAlerts.map((a) => a.id === id ? { ...a, status: 'Resolved' } : a),
    }));

    const { supabase, isSupabaseConfigured, getAndonTableName, updateDynamic } = await import('../lib/supabase');
    if (isSupabaseConfigured()) {
      try {
        const tableName = await getAndonTableName();
        const idCol = tableName === 'andon_alerts' ? 'id' : 'andon_id';
        await updateDynamic(tableName, { status: 'resolved', resolved_at: new Date().toISOString() }, { [idCol]: id });
      } catch (err) {
        console.warn('[appStore] Failed to update andon status in Supabase:', err.message);
      }
    }
  },

  // Breakdowns
  addBreakdown: (bk) => set((s) => ({ breakdowns: [bk, ...s.breakdowns] })),

  updateBreakdown: (id, updates) => set((s) => ({
    breakdowns: s.breakdowns.map((b) => b.id === id ? { ...b, ...updates } : b),
  })),

  // Defects
  addDefect: (defect) => set((s) => ({ defects: [defect, ...s.defects] })),

  // EOL
  addEOLTest: (test) => set((s) => ({ eolTests: [test, ...s.eolTests] })),

  // Shift Handovers
  addShiftHandover: (sh) => set((s) => ({ shiftHandovers: [sh, ...s.shiftHandovers] })),
}));
