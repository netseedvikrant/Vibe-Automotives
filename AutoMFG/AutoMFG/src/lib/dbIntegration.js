import { supabase, isSupabaseConfigured, writeAuditLog, createNotification } from './supabase';
import toast from 'react-hot-toast';

// ── PART TO BOM MAPPING (FALLBACK) ──
export const PART_BOM_MAPPING = {
  'BMW-M4-DOOR-LH': [
    { material_name: 'Tire', part_code: 'TYR-100', qty_per_product: 4 },
    { material_name: 'Battery Pack', part_code: 'BAT-200', qty_per_product: 1 },
    { material_name: 'Front Seat', part_code: 'SET-101', qty_per_product: 2 },
  ],
  'BMW-3-CHASSIS': [
    { material_name: 'SUV Tire', part_code: 'TYR-200', qty_per_product: 4 },
    { material_name: 'Engine Assembly', part_code: 'ENG-100', qty_per_product: 1 },
  ],
  'BMW-5-ENGINE-MOUNT': [
    { material_name: 'Starter Battery', part_code: 'BAT-210', qty_per_product: 1 },
    { material_name: 'Door Panel', part_code: 'DRP-500', qty_per_product: 4 },
  ],
  'BMW-7-DASH-PANEL': [
    { material_name: 'Performance Tire', part_code: 'PTY-110', qty_per_product: 4 },
    { material_name: 'Turbo Engine', part_code: 'TEG-220', qty_per_product: 1 },
  ],
  'BMW-M3-EXHAUST': [
    { material_name: 'Standard Tire', part_code: 'STY-100', qty_per_product: 4 },
    { material_name: 'Small Engine', part_code: 'SME-100', qty_per_product: 1 },
  ]
};

// ── 1. WORK ORDER RELEASE FLOW ──
export async function releaseWorkOrderWithMaterials(woNumber, forceShortage = false) {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    // A. Load work order details
    const { data: wo, error: woErr } = await supabase
      .from('work_orders')
      .select('*')
      .eq('wo_number', woNumber)
      .single();

    if (woErr || !wo) throw new Error('Work order not found: ' + woErr?.message);

    const part = wo.part_number || 'BMW-M4-DOOR-LH';
    const plannedQty = wo.planned_qty || 10;

    // B. Determine required materials
    let requiredMaterials = PART_BOM_MAPPING[part] || PART_BOM_MAPPING['BMW-M4-DOOR-LH'];

    // C. Check inventory availability
    const shortages = [];
    const inventoryItems = [];

    for (const mat of requiredMaterials) {
      const neededQty = mat.qty_per_product * plannedQty;
      const { data: inv } = await supabase
        .from('inventory')
        .select('*')
        .eq('part_code', mat.part_code)
        .maybeSingle();

      const available = inv ? inv.available_stock : 0;

      if (available < neededQty) {
        shortages.push({
          material_name: mat.material_name,
          part_code: mat.part_code,
          required: neededQty,
          available,
          shortage: neededQty - available
        });
      }
      inventoryItems.push({ mat, neededQty, currentStock: available, invId: inv?.inventory_id });
    }

    // D. Handle shortages
    if (shortages.length > 0 && !forceShortage) {
      // Trigger alerts and replenishment requests
      for (const sh of shortages) {
        await createMaterialShortageAlert(sh.material_name, sh.required, sh.available);
        await createReplenishmentTrigger(sh.part_code, sh.shortage, 'WO_SHORTAGE', woNumber);
        await createPurchaseRequisitionFromShortage(sh.part_code, sh.shortage);
      }
      return { success: false, shortage: true, details: shortages };
    }

    // E. Deduct from inventory & Issue materials
    for (const item of inventoryItems) {
      const deduction = Math.min(item.currentStock, item.neededQty);
      if (deduction > 0) {
        await deductInventory(item.mat.part_code, deduction, 'WO_ISSUE', woNumber);
      }

      // Insert record to material_issues
      await supabase.from('material_issues').insert({
        wo_number: woNumber,
        part_number: item.mat.part_code,
        issued_qty: deduction,
        issued_at: new Date().toISOString()
      });
    }

    // F. Update WO status to released
    const { error: updateErr } = await supabase
      .from('work_orders')
      .update({
        status: 'released',
        released_at: new Date().toISOString()
      })
      .eq('wo_number', woNumber);

    if (updateErr) throw updateErr;

    // G. Create SCM handoff
    await createSCMHandoff('WAREHOUSE_ISSUE_REQUEST', {
      wo_number: woNumber,
      part_number: part,
      materials: requiredMaterials.map(m => ({ part_code: m.part_code, quantity: m.qty_per_product * plannedQty }))
    });

    await writeAuditLog(null, 'work_orders', 'release', { wo_number: woNumber });
    await createNotification(null, 'production_planner', 'WORK_ORDER', woNumber, `Work Order ${woNumber} released to production.`);

    return { success: true };
  } catch (err) {
    console.error('Error releasing work order:', err);
    toast.error('Release failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ── 2. LOG ACTUAL CONSUMPTION ──
export async function logActualConsumption(woNumber, partCode, qty) {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    // A. Log consumption to material_consumption_logs (or audit_log as fallback)
    const logData = {
      work_order_id: woNumber,
      part_code: partCode,
      quantity: qty,
      created_at: new Date().toISOString()
    };

    const { error: logErr } = await supabase
      .from('material_consumption_logs')
      .insert(logData);

    if (logErr) {
      console.warn('material_consumption_logs table missing, logging to audit log');
      await writeAuditLog(null, 'material_consumption', 'log_actual', logData);
    }

    // B. Create inventory transaction log
    await createInventoryTransaction(partCode, qty, 'ACTUAL_CONSUMPTION', woNumber);

    // C. Perform replenishment check (compare with safety stock)
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('part_code', partCode)
      .maybeSingle();

    if (inv && inv.available_stock <= inv.safety_stock) {
      await createReplenishmentTrigger(partCode, inv.safety_stock * 2, 'LOW_STOCK_ALERT', 'INVENTORY');
      await createPurchaseRequisitionFromShortage(partCode, inv.safety_stock * 2);
    }

    return { success: true };
  } catch (err) {
    console.error('Error logging consumption:', err);
    return { success: false, error: err.message };
  }
}

// ── 3. DEDUCT INVENTORY ──
export async function deductInventory(partCode, qty, reason, referenceId) {
  if (!isSupabaseConfigured()) return;

  try {
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('part_code', partCode)
      .maybeSingle();

    if (!inv) return;

    const previousQty = inv.available_stock || 0;
    const newQty = Math.max(0, previousQty - qty);

    await supabase
      .from('inventory')
      .update({
        available_stock: newQty,
        updated_at: new Date().toISOString()
      })
      .eq('part_code', partCode);

    await createInventoryTransaction(partCode, qty, reason, referenceId, previousQty, newQty);
  } catch (err) {
    console.error('Error deducting inventory:', err);
  }
}

// ── 4. CREATE INVENTORY TRANSACTION ──
export async function createInventoryTransaction(partCode, qty, type, referenceId, prev = 0, next = 0) {
  const txData = {
    part_code: partCode,
    transaction_type: type,
    quantity: qty,
    previous_qty: prev,
    new_qty: next,
    reference_type: 'WORK_ORDER',
    reference_id: referenceId,
    created_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('inventory_transactions')
      .insert(txData);

    if (error) throw error;
  } catch (err) {
    // Fallback to audit log
    await writeAuditLog(null, 'inventory_transaction', type, txData);
  }
}

// ── 5. CREATE MATERIAL SHORTAGE ALERT ──
export async function createMaterialShortageAlert(materialName, requiredQty, availableQty) {
  const alertData = {
    material_name: materialName,
    required_quantity: requiredQty,
    available_quantity: availableQty,
    shortage_quantity: Math.max(0, requiredQty - availableQty),
    severity: 'Critical',
    status: 'Active',
    created_at: new Date().toISOString()
  };

  try {
    await supabase.from('shortage_alerts').insert(alertData);
    await createNotification(null, 'production_manager', 'SHORTAGE', materialName, `Critical shortage for ${materialName}.`);
  } catch (err) {
    await writeAuditLog(null, 'shortage_alert', 'create', alertData);
  }
}

// ── 6. CREATE REPLENISHMENT TRIGGER ──
export async function createReplenishmentTrigger(partCode, shortageQty, sourceType, sourceId) {
  const triggerData = {
    part_code: partCode,
    source_type: sourceType,
    source_id: sourceId,
    shortage_qty: shortageQty,
    trigger_reason: 'Material shortage detected during production execution',
    priority: 'High',
    status: 'Pending',
    created_at: new Date().toISOString()
  };

  try {
    await supabase.from('replenishment_triggers').insert(triggerData);
  } catch (err) {
    await writeAuditLog(null, 'replenishment_trigger', 'create', triggerData);
  }
}

// ── 7. CREATE PURCHASE REQUISITION FROM SHORTAGE ──
export async function createPurchaseRequisitionFromShortage(partCode, requiredQty) {
  try {
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('part_code', partCode)
      .maybeSingle();

    const matName = inv ? inv.material_name : partCode;

    const prData = {
      material_name: matName,
      part_code: partCode,
      quantity: requiredQty,
      estimated_cost: 150.00 * requiredQty,
      procurement_type: 'Spare Parts',
      supplier_category: 'Automotive Parts',
      priority: 'High',
      status: 'Draft',
      department: 'Production',
      created_at: new Date().toISOString()
    };

    await supabase.from('purchase_requisitions').insert(prData);
  } catch (err) {
    console.error('Failed to create PR:', err);
  }
}

// ── 8. CREATE SCRAP CERTIFICATE & LOGS ──
export async function createScrapCertificate(defectId, vin, materials, cost, isSupplierDefect = false, supplierId = null) {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    // A. Create scrap certificate
    const { data: cert, error: certErr } = await supabase
      .from('scrap_certificates')
      .insert({
        defect_id: defectId,
        cost_impact: cost,
        issued_by: null,
        issued_at: new Date().toISOString()
      })
      .select()
      .single();

    if (certErr) throw certErr;

    // B. Deduct scrap materials from inventory
    if (materials && Array.isArray(materials)) {
      for (const m of materials) {
        await deductInventory(m.part_code, m.quantity || 1, 'SCRAP', defectId);
        await createReplenishmentTrigger(m.part_code, m.quantity || 1, 'SCRAP_REPLACEMENT', defectId);
      }
    }

    // C. Handle supplier NCR if applicable
    if (isSupplierDefect && supplierId) {
      await createSupplierNCR(defectId, supplierId, materials?.[0]?.part_code || 'BMW-M4-DOOR-LH', vin);
    }

    // D. Send SCM Handoff
    await createSCMHandoff('SCRAP_CERTIFICATE', {
      certificate_id: cert?.certificate_id,
      defect_id: defectId,
      cost_impact: cost,
      materials,
      is_supplier_defect: isSupplierDefect,
      supplier_id: supplierId
    });

    return { success: true };
  } catch (err) {
    console.error('Scrap certificate error:', err);
    return { success: false, error: err.message };
  }
}

// ── 9. CREATE SUPPLIER NCR ──
export async function createSupplierNCR(defectId, supplierId, partCode, vin) {
  const ncrData = {
    supplier_id: supplierId,
    part_code: partCode,
    defect_id: defectId,
    vin,
    ncr_type: 'Material Defect',
    severity: 'Major',
    description: 'Supplier material defect caused scrap or rework during assembly operations.',
    status: 'Open',
    created_at: new Date().toISOString()
  };

  try {
    await supabase.from('supplier_ncrs').insert(ncrData);
    await createSCMHandoff('SUPPLIER_NCR', ncrData);

    // Update supplier scorecard inputs (decrement quality score)
    const { data: sup } = await supabase
      .from('suppliers')
      .select('*')
      .eq('supplier_id', supplierId)
      .single();

    if (sup) {
      const newScore = Math.max(0, (sup.quality_score || 100) - 5);
      await supabase
        .from('suppliers')
        .update({ quality_score: newScore })
        .eq('supplier_id', supplierId);
    }
  } catch (err) {
    await writeAuditLog(null, 'supplier_ncr', 'create', ncrData);
  }
}

// ── 10. CREATE EOL CERTIFICATE & FG RELEASE ──
export async function createEOLCertificate(vin, testRunId, overallResult) {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    if (overallResult === 'PASS') {
      // A. Create EOL Certificate
      await supabase.from('eol_certificates').insert({
        vin,
        certificate_link: `https://smkgmfgbuioclfbuuynl.supabase.co/storage/v1/object/public/certificates/${vin}.pdf`,
        issued_at: new Date().toISOString()
      });

      // B. Update VIN Unit status to released
      await supabase
        .from('vin_units')
        .update({ current_status: 'released' })
        .eq('vin', vin);

      // C. Create Finished Goods Release & Logistics Release
      await createFinishedGoodsRelease(vin);
      await createLogisticsRelease(vin);

      // D. Send SCM Handoff
      await createSCMHandoff('FINISHED_GOODS_RELEASE', { vin });
    } else {
      // Route back to rework
      await supabase
        .from('vin_units')
        .update({ current_status: 'rework_pending' })
        .eq('vin', vin);
    }
    return { success: true };
  } catch (err) {
    console.error('EOL Release error:', err);
    return { success: false, error: err.message };
  }
}

export async function createFinishedGoodsRelease(vin) {
  const releaseData = { vin, release_date: new Date().toISOString(), status: 'Released' };
  try {
    await supabase.from('finished_goods_releases').insert(releaseData);
  } catch (err) {
    await writeAuditLog(null, 'finished_goods_release', 'create', releaseData);
  }
}

export async function createLogisticsRelease(vin) {
  const releaseData = { vin, transport_status: 'Pending Dispatch', created_at: new Date().toISOString() };
  try {
    await supabase.from('logistics_releases').insert(releaseData);
  } catch (err) {
    await writeAuditLog(null, 'logistics_release', 'create', releaseData);
  }
}

// ── 11. CREATE SCM HANDOFF ──
export async function createSCMHandoff(type, payload) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  const handoffData = {
    id,
    handoff_type: type,
    source_module: 'AutoMFG',
    target_module: 'AutoSCM',
    payload,
    status: 'Synced',
    created_at: new Date().toISOString(),
    synced_at: new Date().toISOString()
  };

  // Save to local storage first (reliable cache/fallback)
  try {
    const local = JSON.parse(localStorage.getItem('mfg_scm_handoffs')) || [];
    local.unshift(handoffData);
    localStorage.setItem('mfg_scm_handoffs', JSON.stringify(local.slice(0, 50)));
    // Dispath custom event to notify components
    window.dispatchEvent(new Event('mfg_scm_handoffs_updated'));
  } catch (e) {
    console.warn('Failed to save SCM handoff to local storage', e);
  }

  try {
    await supabase.from('scm_handoffs').insert(handoffData);
  } catch (err) {
    await writeAuditLog(null, 'scm_handoff', 'create', handoffData);
  }
}

// ── 12. FREEZE PRODUCTION PLAN ──
export async function freezeProductionPlan(planId) {
  try {
    // 1. Update plan status to 'frozen'
    const { error: planErr } = await supabase
      .from('production_plans')
      .update({ status: 'frozen' })
      .eq('plan_id', planId);

    if (planErr) throw planErr;

    // 2. Fetch the plan details to get part number & quantity
    const { data: plan, error: getErr } = await supabase
      .from('production_plans')
      .select('*')
      .eq('plan_id', planId)
      .single();

    if (getErr) throw getErr;

    // 3. Trigger SCM handoff
    await createSCMHandoff('FROZEN_PLAN', {
      plan_id: plan.plan_id,
      plan_code: plan.plan_code || `PLAN-${plan.plan_id.slice(0, 8)}`,
      part_number: plan.part_number,
      planned_qty: plan.planned_qty,
      start_date: plan.start_date,
      end_date: plan.end_date,
      frozen_at: new Date().toISOString()
    });

    // 4. Generate dynamic Work Orders
    const woNumber = `WO-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
    await supabase.from('work_orders').insert({
      wo_number: woNumber,
      plan_id: planId,
      part_number: plan.part_number,
      line_id: plan.line_id,
      planned_qty: plan.planned_qty,
      status: 'created',
      created_at: new Date().toISOString()
    });

    return { success: true };
  } catch (err) {
    console.error('Error freezing plan:', err);
    return { success: false, error: err.message };
  }
}

// ── 13. EOL & FINISHED GOODS RELEASE FLOW ──
export async function releaseFinishedGoodToLogistics(vin) {
  try {
    // 1. Update VIN status to 'released'
    const { error: vinErr } = await supabase
      .from('vin_units')
      .update({ current_status: 'released' })
      .eq('vin', vin);

    if (vinErr) throw vinErr;

    // 2. Trigger SCM handoff
    await createSCMHandoff('FINISHED_GOOD_RELEASE', {
      vin,
      release_date: new Date().toISOString(),
      logistics_status: 'Pending Dispatch',
      shipping_request: 'Sent'
    });

    return { success: true };
  } catch (err) {
    console.error('Error releasing finished good:', err);
    return { success: false, error: err.message };
  }
}
