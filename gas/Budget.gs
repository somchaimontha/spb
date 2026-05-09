// ============================================================
// Budget.gs — Budget Modules: Estimates, Allocation, Received,
//             Distribution, Disbursements, Dashboard KPIs
// ============================================================

const Budget = (() => {

  // ── Budget Source Columns (shared) ───────────────────────
  const B_COLS = ['b_pvch','b_pvs','b_short','b_subsidy','b_book','b_uniform',
                  'b_activity','b_equipment','b_tools','b_project','b_extra',
                  'b_revenue','b_deposit'];

  // Friendly mapping: column → แหล่งเงิน
  const B_LABELS = {
    b_pvch:      'ปวช.',          b_pvs:      'ปวส.',
    b_short:     'ระยะสั้น',      b_subsidy:  'อุดหนุน/จัดการเรียน',
    b_book:      'หนังสือเรียน', b_uniform:  'เครื่องแต่งกาย',
    b_activity:  'กิจกรรม',      b_equipment:'อุปกรณ์',
    b_tools:     'เครื่องมือ',   b_project:  'โครงการ/ส่วนกลาง',
    b_extra:     'เงินต่อ',       b_revenue:  'รายได้ บกศ.',
    b_deposit:   'รับฝาก บกศ.'
  };

  function _sumBudget(row) {
    return B_COLS.reduce((s, c) => s + (Number(row[c]) || 0), 0);
  }

  // ── Dashboard KPIs ────────────────────────────────────────
  function getDashboardKPIs(ctx) {
    const fy       = ctx.fiscal_year || CFG.FISCAL_YEAR;
    const projects = _rows('PROJECTS').filter(p => String(p.fiscal_year) === String(fy));
    const dist     = _rows('BUDGET_DISTRIBUTION').filter(d => String(d.fiscal_year) === String(fy));
    const recv     = _rows('BUDGET_RECEIVED').filter(r => String(r.fiscal_year) === String(fy));
    const disb     = _rows('DISBURSEMENTS').filter(d => String(d.fiscal_year) === String(fy));

    const totalBudget   = projects.reduce((s, p) => s + Number(p.total_budget || 0), 0);
    const totalActual   = projects.reduce((s, p) => s + Number(p.budget_actual || 0), 0);
    const totalReceived = recv.reduce((s, r) => s + Number(r.total_recv || 0), 0);
    const totalDist     = dist.reduce((s, d) => s + Number(d.alloc_total || 0), 0);
    const pendingDisb   = disb.filter(d => d.status === 'pending').length;

    // Overspend projects
    const overspend = projects.filter(p => Number(p.budget_actual) > Number(p.total_budget));
    // Alerts
    const alerts = [];
    if (overspend.length) alerts.push({ type: 'danger', msg: `${overspend.length} โครงการเกินงบประมาณ` });
    if (pendingDisb)      alerts.push({ type: 'warning', msg: `${pendingDisb} รายการรออนุมัติ` });

    // By division
    const byDiv = {};
    projects.forEach(p => {
      const d = p.division_code || 'other';
      if (!byDiv[d]) byDiv[d] = { total: 0, actual: 0, count: 0 };
      byDiv[d].total  += Number(p.total_budget || 0);
      byDiv[d].actual += Number(p.budget_actual || 0);
      byDiv[d].count  += 1;
    });

    // By budget source
    const bySource = { learning_free: 0, nonformal: 0, other: 0, central: 0 };
    projects.forEach(p => {
      bySource.learning_free += Number(p.b_learning_free || 0) + Number(p.b_subsidy || 0);
      bySource.nonformal     += Number(p.b_nonformal || 0);
      bySource.other         += Number(p.b_other || 0);
      bySource.central       += Number(p.b_central || 0);
    });

    return {
      ok: true, fiscal_year: fy,
      summary: {
        total_budget:   totalBudget,
        total_actual:   totalActual,
        total_remaining:totalBudget - totalActual,
        total_received: totalReceived,
        total_allocated:totalDist,
        used_pct:       totalBudget > 0 ? Math.round(totalActual / totalBudget * 100) : 0,
        project_count:  projects.length,
        pending_disburse: pendingDisb,
        overspend_count: overspend.length
      },
      by_division: byDiv,
      by_source:   bySource,
      alerts
    };
  }

  // ── ประมาณการรายจ่าย ──────────────────────────────────────
  function getEstimates(ctx) {
    const rows = _rows('BUDGET_ESTIMATES').filter(r => String(r.fiscal_year) === String(ctx.fiscal_year || CFG.FISCAL_YEAR));
    return { ok: true, data: rows };
  }

  // ── รายการจัดสรร ─────────────────────────────────────────
  function getAllocations(ctx) {
    const rows = _rows('BUDGET_ALLOCATIONS').filter(r => String(r.fiscal_year) === String(ctx.fiscal_year || CFG.FISCAL_YEAR));
    // Compute used from disbursements
    const disb = _rows('DISBURSEMENTS').filter(d => String(d.fiscal_year) === String(ctx.fiscal_year || CFG.FISCAL_YEAR));
    rows.forEach(r => {
      const used = disb.filter(d => d.item_code === r.item_code).reduce((s, d) => s + Number(d.amount_total || 0), 0);
      r.actual_used = used;
      r.remaining   = Number(r.total_alloc || 0) - used;
      r.used_pct    = r.total_alloc > 0 ? Math.round(used / r.total_alloc * 100) : 0;
    });
    return { ok: true, data: rows };
  }

  // ── งปม.เข้า ─────────────────────────────────────────────
  function getReceived(ctx) {
    const rows = _rows('BUDGET_RECEIVED').filter(r => String(r.fiscal_year) === String(ctx.fiscal_year || CFG.FISCAL_YEAR));
    const total = { total_recv: 0 };
    B_COLS.forEach(c => { total[c] = rows.reduce((s, r) => s + Number(r[c] || 0), 0); });
    total.total_recv = rows.reduce((s, r) => s + Number(r.total_recv || 0), 0);
    return { ok: true, data: rows, totals: total };
  }

  // ── จัดสรร งปม. ──────────────────────────────────────────
  function getDistribution(ctx) {
    const fy   = ctx.fiscal_year || CFG.FISCAL_YEAR;
    const rows = _rows('BUDGET_DISTRIBUTION').filter(r => String(r.fiscal_year) === String(fy));
    const recv = _rows('BUDGET_RECEIVED').filter(r => String(r.fiscal_year) === String(fy));
    const disb = _rows('DISBURSEMENTS').filter(d => String(d.fiscal_year) === String(fy));

    const totalReceived = recv.reduce((s, r) => s + Number(r.total_recv || 0), 0);

    rows.forEach(r => {
      const used = disb.filter(d => d.item_code === r.item_code).reduce((s, d) => s + Number(d.amount_total || 0), 0);
      r.actual_used = used;
      r.remaining   = Number(r.alloc_total || 0) - used;
      r.used_pct    = r.alloc_total > 0 ? Math.round(used / Number(r.alloc_total) * 100) : 0;
    });

    const totalAlloc = rows.reduce((s, r) => s + Number(r.alloc_total || 0), 0);
    const totalUsed  = rows.reduce((s, r) => s + Number(r.actual_used || 0), 0);

    return {
      ok: true, data: rows,
      summary: {
        total_received: totalReceived,
        total_allocated: totalAlloc,
        total_used:      totalUsed,
        total_remaining: totalAlloc - totalUsed,
        used_pct:        totalAlloc > 0 ? Math.round(totalUsed / totalAlloc * 100) : 0
      }
    };
  }

  // ── Disbursements ─────────────────────────────────────────
  function getDisbursements(ctx) {
    let rows = _rows('DISBURSEMENTS');
    if (ctx.fiscal_year)  rows = rows.filter(d => String(d.fiscal_year) === String(ctx.fiscal_year));
    if (ctx.item_code)    rows = rows.filter(d => d.item_code === ctx.item_code);
    if (ctx.project_ref)  rows = rows.filter(d => d.project_ref === ctx.project_ref);
    if (ctx.status)       rows = rows.filter(d => d.status === ctx.status);
    return { ok: true, data: rows };
  }

  function createDisbursement(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };

    const fy      = ctx.fiscal_year || CFG.FISCAL_YEAR;
    const existing = _rows('DISBURSEMENTS').filter(d => d.item_code === ctx.item_code && String(d.fiscal_year) === String(fy));
    const seq     = String(existing.length + 1).padStart(3, '0');
    const bCols   = {};
    B_COLS.forEach(c => { bCols[c] = Number(ctx[c]) || 0; });
    const total   = _sumBudget(bCols);

    const disburse = {
      disburse_id:  _uid(),
      item_code:    ctx.item_code || '',
      fiscal_year:  fy,
      disburse_seq: seq,
      disburse_date:ctx.disburse_date || _now().substring(0, 10),
      payee_name:   ctx.payee_name || '',
      requesting_unit: ctx.requesting_unit || '',
      ...bCols,
      amount_total: total,
      project_ref:  ctx.project_ref || '',
      round_id:     ctx.round_id || '',
      doc_ref_no:   ctx.doc_ref_no || '',
      drive_file_ids: ctx.drive_file_ids || '',
      status:       ctx.status || 'pending',
      remark:       ctx.remark || '',
      created_by:   ctx.sess.user_id,
      created_at:   _now()
    };
    _append('DISBURSEMENTS', disburse);
    return { ok: true, data: disburse };
  }

  function updateDisbursement(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };
    _updateRow('DISBURSEMENTS', 'disburse_id', ctx.disburse_id, { status: ctx.status, remark: ctx.remark });
    return { ok: true };
  }

  function approveDisbursement(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };
    _updateRow('DISBURSEMENTS', 'disburse_id', ctx.disburse_id, {
      status: ctx.approved ? 'approved' : 'rejected',
      remark: ctx.remark || ''
    });
    return { ok: true };
  }

  // ── Export / Report ───────────────────────────────────────
  function exportReport(ctx) {
    const fy       = ctx.fiscal_year || CFG.FISCAL_YEAR;
    const projects = _rows('PROJECTS').filter(p => String(p.fiscal_year) === String(fy));
    const disb     = _rows('DISBURSEMENTS').filter(d => String(d.fiscal_year) === String(fy));

    const csv = [
      ['รหัส','ชื่อโครงการ','ฝ่าย','งบรวม','แผน','จริง','คงเหลือ','สถานะ'].join(','),
      ...projects.map(p => [
        p.project_no, `"${p.project_name}"`, `"${p.department}"`,
        p.total_budget, p.budget_planned, p.budget_actual, p.budget_remaining, p.status
      ].join(','))
    ].join('\n');

    return { ok: true, csv, rows: projects.length };
  }

  return { getDashboardKPIs, getEstimates, getAllocations, getReceived, getDistribution,
           getDisbursements, createDisbursement, updateDisbursement, approveDisbursement, exportReport };
})();
