// ============================================
// AutoMFG — App Data Store (Zustand)
// ============================================
import { create } from 'zustand';

// ---- Mock Data Generators ----
const generateWOs = () => [
  { id: 'WO-2024-0001', parent: 'ORD-001', part: 'BMW-M4-DOOR-LH', vin: 'WBS3R9C57FK999001', plant: 'Plant A', line: 'Line 1', operation: '010', workCenter: 'WC-DOOR-01', stdTime: 24, actualTime: 26, materialConsumed: 42, producedQty: 85, scrapQty: 2, status: 'In Progress', created: '2026-05-17' },
  { id: 'WO-2024-0002', parent: 'ORD-001', part: 'BMW-M4-DOOR-RH', vin: 'WBS3R9C57FK999002', plant: 'Plant A', line: 'Line 1', operation: '020', workCenter: 'WC-DOOR-02', stdTime: 24, actualTime: 23, materialConsumed: 40, producedQty: 90, scrapQty: 1, status: 'Completed', created: '2026-05-17' },
  { id: 'WO-2024-0003', parent: 'ORD-002', part: 'BMW-3-CHASSIS', vin: 'WBS3R9C57FK999010', plant: 'Plant A', line: 'Line 2', operation: '010', workCenter: 'WC-CHASSIS-01', stdTime: 48, actualTime: 45, materialConsumed: 120, producedQty: 60, scrapQty: 0, status: 'Released', created: '2026-05-16' },
  { id: 'WO-2024-0004', parent: 'ORD-002', part: 'BMW-5-ENGINE-MOUNT', vin: 'WBS3R9C57FK999020', plant: 'Plant B', line: 'Line 3', operation: '010', workCenter: 'WC-ENGINE-01', stdTime: 32, actualTime: 38, materialConsumed: 75, producedQty: 45, scrapQty: 3, status: 'In Progress', created: '2026-05-17' },
  { id: 'WO-2024-0005', parent: 'ORD-003', part: 'BMW-7-DASH-PANEL', vin: 'WBS3R9C57FK999030', plant: 'Plant B', line: 'Line 4', operation: '030', workCenter: 'WC-INTERIOR-01', stdTime: 18, actualTime: 18, materialConsumed: 30, producedQty: 100, scrapQty: 0, status: 'Closed', created: '2026-05-15' },
  { id: 'WO-2024-0006', parent: 'ORD-003', part: 'BMW-M3-EXHAUST', vin: 'WBS3R9C57FK999040', plant: 'Plant A', line: 'Line 1', operation: '040', workCenter: 'WC-EXHAUST-01', stdTime: 20, actualTime: null, materialConsumed: 0, producedQty: 0, scrapQty: 0, status: 'Created', created: '2026-05-17' },
];

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

  raiseAndon: (alert) => set((s) => ({
    andonAlerts: [{ id: `AND-${Date.now()}`, ...alert, status: 'Open' }, ...s.andonAlerts],
  })),

  resolveAndon: (id) => {
    saveResolvedAndonIdToStorage(id);
    set((s) => ({
      andonAlerts: s.andonAlerts.map((a) => a.id === id ? { ...a, status: 'Resolved' } : a),
    }));
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
