// ============================================================
// Projects.gs — Project Registry, History, Execution Rounds
// ============================================================

const Projects = (() => {

  // ── List / Get ────────────────────────────────────────────
  function list(ctx) {
    let rows = _rows('PROJECTS').filter(p => p.is_active !== false && p.is_active !== 'FALSE');
    if (ctx.fiscal_year) rows = rows.filter(p => String(p.fiscal_year) === String(ctx.fiscal_year));
    if (ctx.division_code) rows = rows.filter(p => p.division_code === ctx.division_code);
    if (ctx.status) rows = rows.filter(p => p.status === ctx.status);
    if (ctx.q) {
      const q = ctx.q.toLowerCase();
      rows = rows.filter(p => p.project_name.toLowerCase().includes(q) || String(p.project_no).includes(q));
    }
    // Attach round count
    const rounds = _rows('EXECUTION_ROUNDS');
    rows.forEach(p => {
      p.round_count = rounds.filter(r => r.project_id === p.project_id).length;
    });
    return { ok: true, data: rows };
  }

  function get(ctx) {
    const rows = _rows('PROJECTS');
    const p    = rows.find(r => r.project_id === ctx.project_id || String(r.project_no) === String(ctx.project_no));
    if (!p) return { error: 'NOT_FOUND' };
    p.history = _rows('PROJECT_HISTORY').filter(h => h.project_id === p.project_id);
    p.rounds  = _getRoundsForProject(p.project_id);
    return { ok: true, data: p };
  }

  // ── Create ────────────────────────────────────────────────
  function create(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };

    // Duplicate project_no check
    const existing = _rows('PROJECTS');
    if (existing.find(p => String(p.project_no) === String(ctx.project_no) && p.is_active !== false)) {
      return { error: 'DUPLICATE_PROJECT_NO', project_no: ctx.project_no };
    }

    const id = _uid();
    const now = _now();
    const project = {
      project_id:         id,
      project_no:         ctx.project_no || '',
      project_name:       ctx.project_name || '',
      responsible_person: ctx.responsible_person || '',
      division_code:      ctx.division_code || '',
      department:         ctx.department || '',
      budget_category_code: ctx.budget_category_code || '',
      budget_type:        ctx.budget_type || '',
      total_budget:       Number(ctx.total_budget) || 0,
      budget_planned:     Number(ctx.budget_planned) || 0,
      budget_actual:      0,
      budget_remaining:   Number(ctx.total_budget) || 0,
      b_learning_free:    Number(ctx.b_learning_free) || 0,
      b_subsidy:          Number(ctx.b_subsidy) || 0,
      b_nonformal:        Number(ctx.b_nonformal) || 0,
      b_other:            Number(ctx.b_other) || 0,
      b_central:          Number(ctx.b_central) || 0,
      status:             ctx.status || 'draft',
      is_supplementary:   ctx.is_supplementary === 'true' || ctx.is_supplementary === true,
      parent_project_id:  ctx.parent_project_id || '',
      memo_ref_no:        ctx.memo_ref_no || '',
      approval_date:      ctx.approval_date || '',
      exec_start_date:    ctx.exec_start_date || '',
      exec_end_date:      ctx.exec_end_date || '',
      cancel_reason:      '',
      merged_into_id:     '',
      audit_step1:        false,
      audit_step2:        false,
      audit_step3:        false,
      fiscal_year:        ctx.fiscal_year || CFG.FISCAL_YEAR,
      note:               ctx.note || '',
      is_active:          true,
      created_at:         now,
      updated_at:         now,
      created_by:         ctx.sess.user_id
    };
    _append('PROJECTS', project);
    return { ok: true, data: project };
  }

  // ── Update + History ──────────────────────────────────────
  function update(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };

    const rows = _rows('PROJECTS');
    const old  = rows.find(r => r.project_id === ctx.project_id);
    if (!old) return { error: 'NOT_FOUND' };

    const updatable = ['project_name','responsible_person','division_code','department',
      'budget_category_code','budget_type','total_budget','budget_planned',
      'b_learning_free','b_subsidy','b_nonformal','b_other','b_central',
      'status','is_supplementary','parent_project_id','memo_ref_no',
      'approval_date','exec_start_date','exec_end_date',
      'audit_step1','audit_step2','audit_step3','note'];

    const changes = [];
    const updates = { updated_at: _now() };

    updatable.forEach(f => {
      if (ctx[f] !== undefined && String(ctx[f]) !== String(old[f])) {
        changes.push({ field: f, old: old[f], new: ctx[f] });
        updates[f] = ctx[f];
      }
    });

    // Recalculate remaining if budget changed
    if (updates.total_budget !== undefined) {
      updates.budget_remaining = Number(updates.total_budget) - Number(old.budget_actual || 0);
    }

    _updateRow('PROJECTS', 'project_id', ctx.project_id, updates);

    // Record history for each changed field
    changes.forEach(c => {
      _append('PROJECT_HISTORY', {
        history_id:    _uid(),
        project_id:    ctx.project_id,
        changed_field: c.field,
        old_value:     String(c.old),
        new_value:     String(c.new),
        changed_by:    ctx.sess.user_id,
        changed_at:    _now(),
        note:          ctx.change_note || ''
      });
    });

    return { ok: true, changes };
  }

  // ── Cancel ────────────────────────────────────────────────
  function cancel(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };

    const validReasons = ['not_allocated', 'not_executed', 'merged'];
    if (!validReasons.includes(ctx.cancel_reason)) return { error: 'INVALID_CANCEL_REASON' };

    if (ctx.cancel_reason === 'merged' && !ctx.merged_into_id) {
      return { error: 'MERGED_TARGET_REQUIRED' };
    }

    _updateRow('PROJECTS', 'project_id', ctx.project_id, {
      status:         'cancelled',
      cancel_reason:  ctx.cancel_reason,
      merged_into_id: ctx.merged_into_id || '',
      is_active:      false,
      updated_at:     _now()
    });

    _append('PROJECT_CANCELLATIONS', {
      cancel_id:      _uid(),
      project_id:     ctx.project_id,
      cancel_reason:  ctx.cancel_reason,
      merged_into_id: ctx.merged_into_id || '',
      cancelled_by:   ctx.sess.user_id,
      cancelled_at:   _now(),
      doc_ref_no:     ctx.doc_ref_no || '',
      note:           ctx.note || ''
    });

    return { ok: true };
  }

  // ── History ───────────────────────────────────────────────
  function history(ctx) {
    const rows = _rows('PROJECT_HISTORY').filter(h => h.project_id === ctx.project_id);
    return { ok: true, data: rows };
  }

  // ── Execution Rounds ──────────────────────────────────────
  function getRounds(ctx) {
    const rounds = _getRoundsForProject(ctx.project_id);
    return { ok: true, data: rounds };
  }

  function _getRoundsForProject(projectId) {
    return _rows('EXECUTION_ROUNDS')
      .filter(r => r.project_id === projectId)
      .sort((a, b) => a.round_no - b.round_no);
  }

  function addRound(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };

    const projects = _rows('PROJECTS');
    const project  = projects.find(p => p.project_id === ctx.project_id);
    if (!project) return { error: 'PROJECT_NOT_FOUND' };

    const existing = _getRoundsForProject(ctx.project_id);
    const roundNo  = existing.length + 1;

    // Calculate running totals
    const prevCumulative = existing.reduce((sum, r) => sum + Number(r.budget_used || 0), 0);
    const thisUsed       = Number(ctx.budget_used) || 0;
    const cumulative     = prevCumulative + thisUsed;
    const remaining      = Number(project.total_budget) - cumulative;

    const round = {
      round_id:             _uid(),
      project_id:           ctx.project_id,
      round_no:             roundNo,
      exec_start_date:      ctx.exec_start_date || '',
      exec_end_date:        ctx.exec_end_date || '',
      budget_used:          thisUsed,
      budget_cumulative:    cumulative,
      budget_remaining:     remaining,
      procurement_batch_no: ctx.procurement_batch_no || '',
      finance_disburse_no:  ctx.finance_disburse_no || '',
      round_status:         ctx.round_status || 'active',
      remark:               ctx.remark || '',
      created_by:           ctx.sess.user_id,
      created_at:           _now()
    };
    _append('EXECUTION_ROUNDS', round);

    // Update project actual amount
    _updateRow('PROJECTS', 'project_id', ctx.project_id, {
      budget_actual:    cumulative,
      budget_remaining: remaining,
      updated_at:       _now()
    });

    return { ok: true, data: round, overspend: remaining < 0 };
  }

  function updateRound(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };
    _updateRow('EXECUTION_ROUNDS', 'round_id', ctx.round_id, {
      exec_start_date:      ctx.exec_start_date,
      exec_end_date:        ctx.exec_end_date,
      budget_used:          Number(ctx.budget_used),
      procurement_batch_no: ctx.procurement_batch_no,
      finance_disburse_no:  ctx.finance_disburse_no,
      round_status:         ctx.round_status,
      remark:               ctx.remark
    });
    return _recalcRounds(ctx.project_id, ctx.sess);
  }

  function deleteRound(ctx) {
    if (!Auth.canWrite(ctx.sess)) return { error: 'FORBIDDEN' };
    const sh   = _sheet('EXECUTION_ROUNDS');
    const vals = sh.getDataRange().getValues();
    const hdr  = vals[0];
    const kIdx = hdr.indexOf('round_id');
    for (let i = vals.length - 1; i >= 1; i--) {
      if (vals[i][kIdx] === ctx.round_id) { sh.deleteRow(i + 1); break; }
    }
    return _recalcRounds(ctx.project_id, ctx.sess);
  }

  function _recalcRounds(projectId, sess) {
    const projects = _rows('PROJECTS');
    const project  = projects.find(p => p.project_id === projectId);
    if (!project) return { error: 'PROJECT_NOT_FOUND' };

    const rounds = _getRoundsForProject(projectId);
    let cumulative = 0;
    rounds.forEach((r, idx) => {
      cumulative += Number(r.budget_used || 0);
      const rem = Number(project.total_budget) - cumulative;
      _updateRow('EXECUTION_ROUNDS', 'round_id', r.round_id, {
        round_no:          idx + 1,
        budget_cumulative: cumulative,
        budget_remaining:  rem
      });
    });
    _updateRow('PROJECTS', 'project_id', projectId, {
      budget_actual:    cumulative,
      budget_remaining: Number(project.total_budget) - cumulative,
      updated_at:       _now()
    });
    return { ok: true, rounds: _getRoundsForProject(projectId) };
  }

  return { list, get, create, update, cancel, history, getRounds, addRound, updateRound, deleteRound };
})();
