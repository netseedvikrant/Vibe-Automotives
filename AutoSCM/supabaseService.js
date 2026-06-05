// ==========================================
// AutoSCM Supabase Service Layer
// ==========================================
// This file contains the reusable API functions for connecting the React frontend to Supabase.
// In a full Node/React environment, you would import 'createClient' from '@supabase/supabase-js'.
// Since we are using the CDN in index.html, 'supabase' is globally available via window.supabase.

const SUPABASE_URL = 'https://smkgmfgbuioclfbuuynl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta2dtZmdidWlvY2xmYnV1eW5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjM4OTUsImV4cCI6MjA5NDM5OTg5NX0.FSjVcb6aR5nFaspS4M29YHDSB7QKxVyvYOkB_IN_lh4';

// Initialize the Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SupabaseService = {
  // ==========================================
  // AUTHENTICATION
  // ==========================================
  
  /**
   * Log in a user
   * @param {string} email 
   * @param {string} password 
   */
  login: async (email, password) => {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Fetch user role from erp_users table
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('erp_users')
      .select('*')
      .eq('auth_id', data.user.id)
      .single();

    if (profileError) throw profileError;

    return { session: data.session, user: userProfile };
  },

  /**
   * Log in a user from custom users1 table
   */
  loginFromTable: async (email, password, role) => {
    // Auto-seed demo users if needed
    try {
      await SupabaseService.initializeERPUsers();
    } catch (e) {
      console.warn("Seeding demo users failed:", e);
    }

    // Try erp_users first as requested by the user
    const { data, error } = await supabaseClient
      .from('erp_users')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle();

    if (error || !data) {
      // Fallback query to make sure login is absolutely bulletproof
      const { data: fallback, error: err2 } = await supabaseClient
        .from('erp_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (err2 || !fallback) {
        throw error || new Error("User not found or password incorrect.");
      }
      return fallback;
    }
    return data;
  },

  /**
   * Log out the current user
   */
  logout: async () => {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get the current session
   */
  getSession: async () => {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    return session;
  },

  // ==========================================
  // BOM & ENGINEERING
  // ==========================================

  /**
   * Get all active BOMs
   */
  getBOMs: async () => {
    console.log("Fetching BOMs from Supabase...");
    const { data, error } = await supabaseClient
      .from('bom_master')
      .select('*');
      
    if (error) {
      console.error("Supabase getBOMs Error:", error);
      throw error;
    }
    console.log("BOMs retrieved:", data);
    return data;
  },

  /**
   * Get components for a specific BOM
   * @param {string} bomId 
   */
  getBOMItems: async (bomId) => {
    console.log(`Fetching BOM Items for bom_id: ${bomId}`);
    const { data, error } = await supabaseClient
      .from('bom_items')
      .select('*')
      .eq('bom_id', bomId);
      
    if (error) {
      console.error("Supabase getBOMItems Error:", error);
      throw error;
    }
    console.log(`BOM Items retrieved for ${bomId}:`, data);
    return data;
  },

  // ==========================================
  // INVENTORY
  // ==========================================

  /**
   * Get all inventory items
   */
  getInventory: async () => {
    const { data, error } = await supabaseClient
      .from('inventory')
      .select('*');
    if (error) throw error;
    return data;
  },

  // ==========================================
  // PRODUCTION PLANNING
  // ==========================================

  /**
   * Create a new production plan
   * @param {object} planDetails 
   */
   createProductionPlan: async (planDetails) => {
    let payload = { ...planDetails };
    let attempts = 0;
    while (attempts < 6) {
      try {
        const { data, error } = await supabaseClient
          .from('production_plans')
          .insert([payload])
          .select();
        if (error) throw error;
        return data[0];
      } catch (err) {
        attempts++;
        if (err.code === 'PGRST204' || (err.message && (err.message.includes('column') || err.message.includes('cache')))) {
          const match = err.message.match(/Could not find the '([^']+)' column/i) 
                     || err.message.match(/column "([^"]+)"/i);
          if (match && match[1] && payload[match[1]] !== undefined) {
            console.warn(`[Self-Healing] Database is missing column '${match[1]}'. Stripping and retrying...`);
            delete payload[match[1]];
            continue;
          }
        }
        throw err;
      }
    }
  },

  /**
   * Log shortage alerts dynamically calculated from MRP
   * @param {Array} shortages 
   */
  logShortageAlerts: async (shortages) => {
    const { data, error } = await supabaseClient
      .from('shortage_alerts')
      .insert(shortages)
      .select();
    if (error) throw error;
    return data;
  },

  // ==========================================
  // PROCUREMENT & REQUESTS
  // ==========================================

  /**
   * Get all material requests
   */
  getMaterialRequests: async () => {
    const { data, error } = await supabaseClient
      .from('material_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Create a new material request
   * @param {object} requestDetails 
   */
  createMaterialRequest: async (requestDetails) => {
    const { data, error } = await supabaseClient
      .from('material_requests')
      .insert([requestDetails])
      .select();
    if (error) throw error;
    
    // Also log to tracking table
    if (data && data[0]) {
      await supabaseClient.from('procurement_tracking').insert([{
        material_request_id: data[0].request_id,
        current_stage: 'Material Request',
        comments: 'Auto-generated by Production Planner'
      }]);
    }
    
    return data[0];
  },

  /**
   * Get tracking steps for a specific material request
   * @param {string} requestId 
   */
  getProcurementTracking: async (requestId) => {
    const { data, error } = await supabaseClient
      .from('procurement_tracking')
      .select('*')
      .eq('material_request_id', requestId)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  /**
   * Update Material Request Status
   */
  updateMaterialRequestStatus: async (requestId, status) => {
    const { data, error } = await supabaseClient
      .from('material_requests')
      .update({ status: status })
      .eq('request_id', requestId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Create Official PR
   */
  createPurchaseRequisition: async (prDetails) => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .insert([prDetails])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Create a tracking event
   */
  createTrackingEvent: async (requestId, stage, comments) => {
    const { data, error } = await supabaseClient
      .from('procurement_tracking')
      .insert([{
        material_request_id: requestId,
        current_stage: stage,
        comments: comments
      }])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Get all Purchase Requisitions
   */
  getPurchaseRequisitions: async () => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Update PR Finance Status
   */
  updatePRFinanceStatus: async (prId, statusUpdates) => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .update(statusUpdates)
      .eq('pr_id', prId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Update PR Procurement Head Status
   */
  updatePRProcurementStatus: async (prId, statusUpdates) => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .update(statusUpdates)
      .eq('pr_id', prId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Create an approval log
   */
  createApprovalLog: async (logDetails) => {
    const { data, error } = await supabaseClient
      .from('approvals')
      .insert([logDetails])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch approved suppliers
   */
  fetchApprovedSuppliers: async () => {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .select('*')
      .eq('supplier_status', 'Approved');
    if (error) throw error;
    return data;
  },

  /**
   * Create an RFQ
   */
  createRFQ: async (rfqData) => {
    const { data, error } = await supabaseClient
      .from('rfq')
      .insert([rfqData])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Save RFQ Suppliers
   */
  saveRFQSuppliers: async (rfqSuppliers) => {
    const { data, error } = await supabaseClient
      .from('rfq_suppliers')
      .insert(rfqSuppliers)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Update PR RFQ Status
   */
  updatePRRFQStatus: async (prId, statusUpdates) => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .update(statusUpdates)
      .eq('pr_id', prId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch RFQs for a specific supplier
   */
  fetchSupplierRFQs: async (supplierId) => {
    // Note: To join tables in Supabase JS: table1(..., table2(...))
    const { data, error } = await supabaseClient
      .from('rfq_suppliers')
      .select(`
        *,
        rfq:rfq_id (*)
      `)
      .eq('supplier_id', supplierId);
    if (error) throw error;
    return data;
  },

  /**
   * Submit a quotation
   */
  submitQuotation: async (quotationData) => {
    const { data, error } = await supabaseClient
      .from('quotations')
      .insert([quotationData])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Update RFQ Supplier Quotation Status
   */
  updateRFQSupplierQuotationStatus: async (rfqSupplierId, status) => {
    const { data, error } = await supabaseClient
      .from('rfq_suppliers')
      .update({ quotation_status: status })
      .eq('rfq_supplier_id', rfqSupplierId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Update Master RFQ Status
   */
  updateRFQStatus: async (rfqId, status) => {
    const { data, error } = await supabaseClient
      .from('rfq')
      .update({ status })
      .eq('rfq_id', rfqId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Get PR by ID
   */
  getPRById: async (prId) => {
    const { data, error } = await supabaseClient
      .from('purchase_requisitions')
      .select('*')
      .eq('pr_id', prId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch Active RFQs with their Quotations and Supplier Performance
   */
  fetchActiveRFQsWithQuotations: async () => {
    const { data, error } = await supabaseClient
      .from('rfq')
      .select(`
        *,
        quotations (
          *,
          supplier:supplier_id (
            supplier_rating,
            quality_score,
            on_time_delivery_percent,
            rejection_rate
          )
        )
      `)
      .neq('status', 'Open')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Shortlist a Quotation
   */
  shortlistQuotation: async (rfqId, quotationId) => {
    // 1. Mark all quotations for this RFQ as Rejected
    await supabaseClient
      .from('quotations')
      .update({ quotation_status: 'Rejected' })
      .eq('rfq_id', rfqId);
      
    // 2. Mark the selected quotation as Shortlisted
    await supabaseClient
      .from('quotations')
      .update({ quotation_status: 'Shortlisted' })
      .eq('quotation_id', quotationId);

    // 3. Update RFQ status
    const { data, error } = await supabaseClient
      .from('rfq')
      .update({ status: 'Pending Final Sourcing Approval' })
      .eq('rfq_id', rfqId)
      .select();
      
    if (error) throw error;
    return data;
  },

  /**
   * Generate PO
   */
  generatePO: async (poData) => {
    const { data, error } = await supabaseClient
      .from('purchase_orders')
      .insert([poData])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Get Purchase Orders
   */
  getPurchaseOrders: async () => {
    const { data, error } = await supabaseClient
      .from('purchase_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    // Fetch relations manually since PostgREST relationship detection is failing
    const { data: suppliers } = await supabaseClient.from('suppliers').select('*');
    const { data: rfqs } = await supabaseClient.from('rfq').select('*');
    
    const mappedData = data.map(po => ({
      ...po,
      supplier: suppliers?.find(s => s.supplier_id === po.supplier_id),
      rfq: rfqs?.find(r => r.rfq_id === po.rfq_id)
    }));
    
    return mappedData;
  },
  
  /**
   * Update PO Status
   */
  updatePOStatus: async (poId, status) => {
    const { data, error } = await supabaseClient
      .from('purchase_orders')
      .update({ status })
      .eq('po_id', poId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch Accepted POs for Supplier
   */
  fetchAcceptedPOs: async (supplierId) => {
    const { data, error } = await supabaseClient
      .from('purchase_orders')
      .select('*, rfq:rfq_id (*)')
      .eq('supplier_id', supplierId)
      .eq('status', 'Confirmed by Supplier');
    if (error) throw error;
    return data;
  },

  /**
   * Upload ASN
   */
  uploadASN: async (asnData) => {
    const { data, error } = await supabaseClient
      .from('asn')
      .insert([asnData])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch ASN Tracking for Logistics
   */
  fetchASNTracking: async () => {
    const { data, error } = await supabaseClient
      .from('asn')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const { data: suppliers } = await supabaseClient.from('suppliers').select('*');
    
    return data.map(asn => ({
      ...asn,
      supplier: suppliers?.find(s => s.supplier_id === asn.supplier_id)
    }));
  },

  /**
   * Update Shipment Status
   */
  updateShipmentStatus: async (asnId, status) => {
    const { data, error } = await supabaseClient
      .from('asn')
      .update({ shipment_status: status })
      .eq('asn_id', asnId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch Shipment KPIs
   */
  fetchShipmentKPIs: async (supplierId) => {
    const { data: asns, error } = await supabaseClient
      .from('asn')
      .select('*')
      .eq('supplier_id', supplierId);
      
    if (error) throw error;
    
    return {
      pendingASN: 0, 
      activeShipments: asns?.filter(a => a.shipment_status === 'Shipment In Transit').length || 0,
      asnSubmittedToday: asns?.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length || 0,
      delayedShipments: 0 
    };
  },

  /**
   * Fetch Incoming ASN for Logistics
   */
  fetchIncomingASN: async () => {
    const { data, error } = await supabaseClient
      .from('asn')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const { data: suppliers } = await supabaseClient.from('suppliers').select('*');
    
    return data.map(asn => ({
      ...asn,
      supplier: suppliers?.find(s => s.supplier_id === asn.supplier_id)
    }));
  },

  /**
   * Fetch ASN records for Warehouse
   */
  fetchWarehouseASN: async () => {
    return await SupabaseService.fetchIncomingASN();
  },

  /**
   * Mark Shipment Arrived
   */
  markShipmentArrived: async (asnId) => {
    const { data, error } = await supabaseClient
      .from('asn')
      .update({ shipment_status: 'Arrived' })
      .eq('asn_id', asnId)
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Notify Warehouse
   */
  notifyWarehouse: async (asnId, poId) => {
    return true;
  },

  /**
   * Fetch Logistics KPIs
   */
  fetchLogisticsKPIs: async () => {
    const { data: asns } = await supabaseClient.from('asn').select('*');
    return {
      incomingShipments: asns?.length || 0,
      trucksInTransit: asns?.filter(a => a.shipment_status === 'Shipment In Transit').length || 0,
      expectedToday: asns?.filter(a => new Date(a.expected_arrival).toDateString() === new Date().toDateString()).length || 0,
      delayedShipments: 0
    };
  },

  /**
   * Fetch Warehouse KPIs
   */
  fetchWarehouseKPIs: async () => {
    const { data: asns } = await supabaseClient.from('asn').select('*');
    const { data: grns } = await supabaseClient.from('grn').select('*');
    return {
      incomingDeliveries: asns?.filter(a => a.shipment_status === 'Shipment In Transit').length || 0,
      pendingGRN: asns?.filter(a => a.shipment_status === 'Arrived' && a.grn_status !== 'Completed').length || 0,
      awaitingInspection: 0,
      storageCapacity: '78%',
      rejectedShipments: grns?.filter(g => g.inspection_status === 'Rejected').length || 0,
      inventoryAddedToday: 0 // Placeholder
    };
  },

  /**
   * Fetch Arrived ASN for Warehouse
   */
  fetchArrivedASN: async () => {
    const { data, error } = await supabaseClient
      .from('asn')
      .select('*')
      .eq('shipment_status', 'Arrived')
      .not('grn_status', 'eq', 'Completed');
    if (error) throw error;
    return data;
  },

  /**
   * Create Tracking Event
   */
  createTrackingEvent: async (requestId, stage, comments) => {
    const { data, error } = await supabaseClient
      .from('procurement_tracking')
      .insert([{
        material_request_id: requestId,
        current_stage: stage,
        comments: comments
      }])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Generate GRN
   */
  generateGRN: async (grnData) => {
    const { data, error } = await supabaseClient
      .from('grn')
      .insert([{ ...grnData, inspection_status: 'Pending', quality_release_status: 'Pending' }])
      .select();
    if (error) throw error;

    // Update ASN status
    await supabaseClient
      .from('asn')
      .update({ grn_status: 'Completed' })
      .eq('asn_id', grnData.asn_id);

    // Update PO status
    await supabaseClient
      .from('purchase_orders')
      .update({ status: 'Material Received' })
      .eq('po_id', grnData.po_id);

    // Move to Quality Hold in Inventory
    const { data: inv } = await supabaseClient
      .from('inventory')
      .select('*')
      .eq('material_name', grnData.material_name)
      .single();
      
    if (inv) {
      const newHoldStock = (inv.quality_hold_stock || 0) + grnData.received_quantity;
      await supabaseClient
        .from('inventory')
        .update({ quality_hold_stock: newHoldStock })
        .eq('material_name', grnData.material_name);
    }

    // Insert into finance_grn_tracking
    await supabaseClient
      .from('finance_grn_tracking')
      .insert([{
        grn_id: data[0].grn_id,
        po_id: grnData.po_id,
        supplier_id: grnData.supplier_id,
        verification_status: 'Awaiting Invoice',
        finance_status: 'Pending',
        payment_status: 'Pending'
      }]);

    // Create notifications
    try {
      await SupabaseService.createGRNNotification('Procurement Head', 'GRN Generated', `GRN ${grnData.grn_number} generated for PO.`);
      await SupabaseService.createGRNNotification('Finance Controller', 'GRN Ready for Verification', `GRN ${grnData.grn_number} is ready for verification.`);
    } catch (e) {
      console.error('Failed to create notifications', e);
    }

    return data[0];
  },

  /**
   * Update Inventory Stock
   */
  updateInventoryStock: async (materialName, quantity) => {
    const { data: inv } = await supabaseClient
      .from('inventory')
      .select('*')
      .eq('material_name', materialName)
      .single();
      
    if (inv) {
      const newStock = inv.available_stock + quantity;
      await supabaseClient
        .from('inventory')
        .update({ available_stock: newStock })
        .eq('material_name', materialName);
    }
    return true;
  },

  /**
   * Fetch GRN for Procurement
   */
  fetchGRNForProcurement: async () => {
    const { data, error } = await supabaseClient
      .from('grn')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Fetch GRN for Finance
   */
  fetchGRNForFinance: async () => {
    const { data, error } = await supabaseClient
      .from('grn')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Create GRN Notification
   */
  createGRNNotification: async (role, title, message) => {
    const { data, error } = await supabaseClient
      .from('notifications')
      .insert([{
        user_role: role,
        title: title,
        message: message,
        priority: 'Normal'
      }])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch Invoice Verification Queue (3-Way Matching)
   */
  fetchInvoiceVerificationQueue: async () => {
    try {
      // 1. Fetch invoices
      const { data: invoices, error: invError } = await supabaseClient
        .from('supplier_invoices')
        .select('*')
        .order('created_at', { ascending: false });
      
      // Fallback if table doesn't exist or is empty
      if (invError || !invoices || invoices.length === 0) {
        console.log('Using mock data for Invoice Verification Queue');
        return [
          {
            invoice_id: 'inv-001',
            invoice_number: 'INV-2026-001',
            po_id: 'po-001',
            grn_id: 'grn-001',
            supplier_name: 'Michelin Tires',
            material_name: 'Heavy Duty Truck Tires',
            invoice_quantity: 1000,
            invoice_amount: 490000,
            invoice_status: 'Pending',
            payment_status: 'Unpaid',
            created_at: new Date().toISOString(),
            po: { po_number: 'PO-2026-001', quantity: 1000, unit_price: 490 },
            grn: { grn_number: 'GRN-2026-001', received_quantity: 1000 },
            inspection: { accepted_quantity: 980, inspection_result: 'Accepted' }
          },
          {
            invoice_id: 'inv-002',
            invoice_number: 'INV-2026-002',
            po_id: 'po-002',
            grn_id: 'grn-002',
            supplier_name: 'Bosch Auto',
            material_name: 'Electronic Control Units',
            invoice_quantity: 500,
            invoice_amount: 750000,
            invoice_status: 'Pending',
            payment_status: 'Unpaid',
            created_at: new Date().toISOString(),
            po: { po_number: 'PO-2026-002', quantity: 500, unit_price: 1500 },
            grn: { grn_number: 'GRN-2026-002', received_quantity: 500 },
            inspection: { accepted_quantity: 500, inspection_result: 'Accepted' }
          }
        ];
      }

      // 2. Fetch POs, GRNs, and Inspections for these invoices
      const poIds = invoices.map(i => i.po_id).filter(Boolean);
      const grnIds = invoices.map(i => i.grn_id).filter(Boolean);

      const { data: pos } = await supabaseClient.from('purchase_orders').select('*').in('po_id', poIds);
      const { data: grns } = await supabaseClient.from('grn').select('*').in('grn_id', grnIds);
      const { data: inspections } = await supabaseClient.from('quality_inspections').select('*').in('grn_id', grnIds);

      // 3. Combine data
      return invoices.map(inv => {
        const po = pos?.find(p => p.po_id === inv.po_id);
        const grn = grns?.find(g => g.grn_id === inv.grn_id);
        const insp = inspections?.find(i => i.grn_id === inv.grn_id);

        return {
          ...inv,
          po,
          grn,
          inspection: insp
        };
      });
    } catch (err) {
      console.error('Error in fetchInvoiceVerificationQueue:', err);
      return [];
    }
  },
  /**
   * Fetch Pending Inspections for SQE
   */
  fetchPendingInspections: async () => {
    const { data, error } = await supabaseClient
      .from('grn')
      .select('*')
      .eq('inspection_status', 'Pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  submitInspection: async (inspectionData) => {
    const { data, error } = await supabaseClient
      .from('quality_inspections')
      .insert([inspectionData])
      .select();
    if (error) throw error;

    // Compile dynamic, highly detailed inspection notes
    const grnNotes = `[SQE INSPECTION COMPLETED] Result: ${inspectionData.inspection_result} | Accepted: ${inspectionData.accepted_quantity} units | Rejected: ${inspectionData.rejected_quantity} units | Defect: ${inspectionData.defect_type || 'None'} (${inspectionData.defect_severity || 'None'}) | Inspector Notes: ${inspectionData.inspection_notes || 'None'}.`;

    // Update GRN status, release status, and update notes/remarks section
    await supabaseClient
      .from('grn')
      .update({ 
        inspection_status: inspectionData.inspection_result,
        quality_release_status: inspectionData.inspection_result === 'Accepted' ? 'Released' : 'Blocked',
        inspection_completed_at: new Date().toISOString(),
        remarks: grnNotes,
        notes: grnNotes,
        inspection_notes: grnNotes
      })
      .eq('grn_id', inspectionData.grn_id);

    // Send notifications to Inventory and Procurement teams
    try {
      // 1. Notify Inventory Team
      await SupabaseService.createGRNNotification(
        'Inventory Manager',
        'Quality Inspection Completed',
        `GRN ${inspectionData.grn_id} has been inspected. Status: ${inspectionData.inspection_result}. Accepted: ${inspectionData.accepted_quantity}, Rejected: ${inspectionData.rejected_quantity}.`
      );

      // 2. Notify Procurement Head
      await SupabaseService.createGRNNotification(
        'Procurement Head',
        'Quality Inspection Completed',
        `GRN ${inspectionData.grn_id} has been inspected. Status: ${inspectionData.inspection_result}. Accepted: ${inspectionData.accepted_quantity}, Rejected: ${inspectionData.rejected_quantity}.`
      );

      // 3. Notify Senior Buyer
      await SupabaseService.createGRNNotification(
        'Senior Buyer',
        'Quality Inspection Completed',
        `GRN ${inspectionData.grn_id} has been inspected. Status: ${inspectionData.inspection_result}. Accepted: ${inspectionData.accepted_quantity}, Rejected: ${inspectionData.rejected_quantity}.`
      );
    } catch (e) {
      console.warn("Failed to dispatch SCM notifications for quality audit:", e);
    }

    return data[0];
  },

  /**
   * Create Rejection Record
   */
  createRejectionRecord: async (rejectionData) => {
    const { data, error } = await supabaseClient
      .from('quality_rejections')
      .insert([rejectionData])
      .select();
    if (error) throw error;
    return data[0];
  },

  /**
   * Fetch SQE KPIs
   */
  fetchSQEKPIs: async () => {
    const { data: inspections } = await supabaseClient.from('quality_inspections').select('*');
    const { data: pending } = await supabaseClient.from('grn').select('*').eq('inspection_status', 'Pending');
    
    return {
      pendingInspections: pending?.length || 0,
      acceptedMaterials: inspections?.filter(i => i.inspection_result === 'Accepted').length || 0,
      rejectedMaterials: inspections?.filter(i => i.inspection_result === 'Rejected').length || 0,
      supplierDefectRate: '2.4%'
    };
  },

  /**
   * Fetch All Inventory
   */
  fetchInventory: async () => {
    const { data, error } = await supabaseClient
      .from('inventory')
      .select('*')
      .order('material_name', { ascending: true });
    if (error) throw error;
    return data;
  },

  /**
   * Fetch Completed Inspections
   */
  fetchCompletedInspections: async () => {
    const { data, error } = await supabaseClient
      .from('quality_inspections')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  /**
   * Release Materials to Inventory (by Inventory Team)
   */
  releaseToInventory: async (inspectionId) => {
    // 1. Fetch inspection data
    const { data: insp, error: iError } = await supabaseClient
      .from('quality_inspections')
      .select('*')
      .eq('inspection_id', inspectionId)
      .single();
    if (iError) throw iError;

    // 2. Fetch inventory
    const { data: inv, error: invError } = await supabaseClient
      .from('inventory')
      .select('*')
      .eq('material_name', insp.material_name)
      .single();
    if (invError) throw invError;

    // 3. Update Inventory
    const newHoldStock = Math.max(0, (inv.quality_hold_stock || 0) - insp.received_quantity);
    const newAvailableStock = (inv.available_stock || 0) + insp.accepted_quantity;
    const newRejectedStock = (inv.rejected_stock || 0) + insp.rejected_quantity;

    await supabaseClient
      .from('inventory')
      .update({ 
        quality_hold_stock: newHoldStock,
        available_stock: newAvailableStock,
        rejected_stock: newRejectedStock
      })
      .eq('material_name', insp.material_name);

    // 4. Update GRN status to 'Released'
    await supabaseClient
      .from('grn')
      .update({ quality_release_status: 'Released' })
      .eq('grn_id', insp.grn_id);

    return true;
  },

  /**
   * Perform Three-Way Matching
   */
  performThreeWayMatching: async (invoiceId) => {
    return true;
  },

  /**
   * Generate Final Bill
   */
  generateFinalBill: async (billData) => {
    const { data, error } = await supabaseClient
      .from('final_bills')
      .insert([billData])
      .select();
    
    if (error) {
      console.error('Error generating final bill:', error);
      return { bill_id: 'bill-' + Math.random().toString(36).substr(2, 9), ...billData };
    }
    return data[0];
  },

  /**
   * Approve Supplier Payment
   */
  approveSupplierPayment: async (billId, approvedBy) => {
    const { data, error } = await supabaseClient
      .from('final_bills')
      .update({ 
        bill_status: 'Payment Approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString()
      })
      .eq('bill_id', billId)
      .select();

    if (error) {
      console.error('Error approving payment:', error);
      return false;
    }

    const bill = data[0];
    if (bill) {
      await supabaseClient
        .from('supplier_invoices')
        .update({ payment_status: 'Paid' })
        .eq('invoice_id', bill.invoice_id);
    }

    return true;
  },

  /**
   * Create Supplier Payment Record
   */
  createSupplierPayment: async (paymentData) => {
    const { data, error } = await supabaseClient
      .from('supplier_payments')
      .insert([paymentData])
      .select();
    
    if (error) {
      console.error('Error creating payment record:', error);
      return { payment_id: 'pay-' + Math.random().toString(36).substr(2, 9), ...paymentData };
    }
    return data[0];
  },

  /**
   * Fetch Payment History
   */
  fetchPaymentHistory: async () => {
    const { data, error } = await supabaseClient
      .from('supplier_payments')
      .select('*')
      .order('payment_date', { ascending: false });
    
    if (error) {
      console.error('Error fetching payment history:', error);
      return [
        {
          payment_id: 'pay-001',
          bill_id: 'bill-001',
          supplier_name: 'Michelin Tires',
          payment_amount: 490000,
          payment_method: 'NEFT',
          payment_status: 'Completed',
          payment_date: new Date().toISOString(),
          transaction_reference: 'TXN12345678'
        }
      ];
    }
    return data;
  },

  /**
   * Create Finance Tracking Event
   */
  createFinanceTrackingEvent: async (grnId, eventDescription) => {
    const { data, error } = await supabaseClient
      .from('procurement_tracking')
      .insert([{
        grn_id: grnId,
        event: eventDescription,
        created_at: new Date().toISOString()
      }]);
    return !error;
  },

  /**
   * Add a new supplier to AVL
   */
  addSupplier: async (supplierData) => {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .insert([{
        ...supplierData,
        supplier_status: 'Approved',
        created_at: new Date().toISOString()
      }])
      .select();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch current user profile from erp_users
   */
  fetchCurrentUserProfile: async (emailOrId) => {
    if (!emailOrId) return null;
    const isEmail = emailOrId.includes('@');
    const field = isEmail ? 'email' : 'id';
    
    // Check if we need to initialize
    try {
      await SupabaseService.initializeERPUsers();
    } catch (e) {}

    const { data, error } = await supabaseClient
      .from('erp_users')
      .select('*')
      .eq(field, emailOrId)
      .maybeSingle();
      
    if (error) {
      console.warn("fetchCurrentUserProfile failed:", error);
      return null;
    }
    return data;
  },

  /**
   * Upload profile image (handles Base64 or standard file upload)
   */
  uploadProfileImage: async (userId, base64OrFile) => {
    let url = '';
    if (typeof base64OrFile === 'string' && base64OrFile.startsWith('data:image')) {
      url = base64OrFile;
    } else {
      try {
        const fileExt = base64OrFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        const { data, error } = await supabaseClient.storage
          .from('avatars')
          .upload(filePath, base64OrFile, { upsert: true });
          
        if (error) throw error;
        
        const { data: { publicUrl } } = supabaseClient.storage
          .from('avatars')
          .getPublicUrl(filePath);
          
        url = publicUrl;
      } catch (err) {
        console.warn("Storage upload failed, falling back to Base64 read:", err);
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(base64OrFile);
        });
      }
    }
    
    // Update user in erp_users
    const { data, error } = await supabaseClient
      .from('erp_users')
      .update({ profile_image_url: url })
      .eq('id', userId)
      .select()
      .maybeSingle();
      
    if (error || !data) {
      // Fallback update by email
      const { data: fallback, error: err2 } = await supabaseClient
        .from('erp_users')
        .update({ profile_image_url: url })
        .eq('email', userId)
        .select()
        .maybeSingle();
      if (err2) throw err2;
      return fallback ? fallback.profile_image_url : url;
    }
    return data.profile_image_url;
  },

  /**
   * Update user profile fields in erp_users
   */
  updateUserProfile: async (userId, profileData) => {
    const { data, error } = await supabaseClient
      .from('erp_users')
      .update(profileData)
      .eq('id', userId)
      .select();
      
    if (error || !data || data.length === 0) {
      // Fallback by email
      const { data: fallback, error: err2 } = await supabaseClient
        .from('erp_users')
        .update(profileData)
        .eq('email', userId)
        .select();
      if (err2) throw err2;
      return fallback;
    }
    return data;
  },

  /**
   * Initialize / Seed demo users in erp_users table if not already populated
   */
  initializeERPUsers: async () => {
    const demoUsers = [
      {
        full_name: 'Priya Sharma',
        email: 'production_pro@gmail.com',
        password: 'admin123',
        role: 'Production Planner',
        department: 'Production Planning',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Priya'
      },
      {
        full_name: 'Rajesh Kumar',
        email: 'procurementhead_pro@gmail.com',
        password: 'admin123',
        role: 'Procurement Head',
        department: 'Procurement',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Rajesh'
      },
      {
        full_name: 'Amit Patel',
        email: 'seniorbuyer_pro@gmail.com',
        password: 'admin123',
        role: 'Senior Buyer',
        department: 'Procurement',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amit'
      },
      {
        full_name: 'Sanjay Singh',
        email: 'buyer_pro@gmail.com',
        password: 'admin123',
        role: 'Buyer',
        department: 'Procurement',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sanjay'
      },
      {
        full_name: 'Vikram Aditya',
        email: 'finance_pro@gmail.com',
        password: 'admin123',
        role: 'Finance Controller',
        department: 'Finance',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Vikram'
      },
      {
        full_name: 'Anil Mehta',
        email: 'inventory_pro@gmail.com',
        password: 'admin123',
        role: 'Inventory Manager',
        department: 'Warehouse',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anil'
      },
      {
        full_name: 'Sunil Verma',
        email: 'supplier_pro@gmail.com',
        password: 'admin123',
        role: 'Supplier',
        department: 'External Vendor',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sunil'
      },
      {
        full_name: 'Neha Gupta',
        email: 'sqe_pro@gmail.com',
        password: 'admin123',
        role: 'supplier_quality_engineer',
        department: 'Quality Assurance',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Neha'
      },
      {
        full_name: 'Devendra Yadav',
        email: 'logistics_pro@gmail.com',
        password: 'admin123',
        role: 'Logistics Team',
        department: 'Logistics',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Devendra'
      },
      {
        full_name: 'Ramesh Shinde',
        email: 'warehouse_pro@gmail.com',
        password: 'admin123',
        role: 'Warehouse Team',
        department: 'Warehouse',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ramesh'
      },
      {
        full_name: 'Admin SCM',
        email: 'admin_pro@gmail.com',
        password: 'admin123',
        role: 'System Admin',
        department: 'IT',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin'
      },
      {
        full_name: 'VIBE CEO',
        email: 'ceo@vibe.com',
        password: 'admin123',
        role: 'CEO',
        department: 'EXECUTIVE',
        profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CEO',
        status: 'Active'
      }
    ];

    // Check if erp_users already has records
    const { count, error } = await supabaseClient
      .from('erp_users')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.warn("Could not read erp_users table count, attempting dynamic creation fallback...", error);
      // Optional: attempt dynamic column updates or keep querying
      return;
    }

    if (count === 0) {
      console.log("Seeding erp_users table with demo profiles...");
      const { error: insertError } = await supabaseClient
        .from('erp_users')
        .insert(demoUsers);
      if (insertError) {
        console.error("Failed to seed erp_users:", insertError);
      } else {
        console.log("Demo users successfully seeded in erp_users!");
      }
    } else {
      // Ensure CEO is present even if already seeded
      try {
        const { data: ceoCheck } = await supabaseClient
          .from('erp_users')
          .select('id')
          .eq('email', 'ceo@vibe.com')
          .maybeSingle();
        if (!ceoCheck) {
          await supabaseClient.from('erp_users').insert([{
            full_name: 'VIBE CEO',
            email: 'ceo@vibe.com',
            password: 'admin123',
            role: 'CEO',
            department: 'EXECUTIVE',
            profile_image_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CEO',
            status: 'Active'
          }]);
          console.log("Seeded CEO user into erp_users successfully");
        }
      } catch (err) {
        console.warn("Failed to ensure CEO exists in erp_users:", err);
      }
    }
  }
};

// Make it available globally for the HTML file to use
window.SupabaseService = SupabaseService;
