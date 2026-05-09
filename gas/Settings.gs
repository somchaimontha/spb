// ============================================================
// Settings.gs — Dynamic Settings & User Management
// ============================================================

const Settings = (() => {

  function getAll(ctx) {
    const rows = _rows('SETTINGS');
    // Group by category
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = {};
      try { grouped[r.category][r.key] = { ...JSON.parse(r.value), label: r.label, key: r.key }; }
      catch { grouped[r.category][r.key] = { value: r.value, label: r.label, key: r.key }; }
    });
    return { ok: true, data: grouped, raw: rows };
  }

  function update(ctx) {
    if (!Auth.isAdmin(ctx.sess)) return { error: 'FORBIDDEN' };

    const rows = _rows('SETTINGS');
    const existing = rows.find(r => r.key === ctx.key);
    const val = typeof ctx.value === 'object' ? JSON.stringify(ctx.value) : String(ctx.value);

    if (existing) {
      _updateRow('SETTINGS', 'key', ctx.key, {
        value:      val,
        label:      ctx.label || existing.label,
        updated_by: ctx.sess.user_id,
        updated_at: _now()
      });
    } else {
      _append('SETTINGS', {
        key:        ctx.key,
        value:      val,
        category:   ctx.category || 'general',
        label:      ctx.label || ctx.key,
        updated_by: ctx.sess.user_id,
        updated_at: _now()
      });
    }
    return { ok: true };
  }

  function getUsers(ctx) {
    if (!Auth.isAdmin(ctx.sess)) return { error: 'FORBIDDEN' };
    const rows = _rows('USERS').map(u => ({
      user_id:      u.user_id,
      email:        u.email,
      display_name: u.display_name,
      role:         u.role,
      department:   u.department,
      is_active:    u.is_active,
      last_login:   u.last_login
    }));
    return { ok: true, data: rows };
  }

  function createUser(ctx) {
    if (!Auth.isAdmin(ctx.sess)) return { error: 'FORBIDDEN' };
    const users = _rows('USERS');
    if (users.find(u => u.email === ctx.email)) return { error: 'EMAIL_EXISTS' };
    _append('USERS', {
      user_id:       _uid(),
      email:         ctx.email,
      display_name:  ctx.display_name || '',
      password_hash: Auth.hashPwd(ctx.password || 'ChangeMe1234'),
      role:          ctx.role || 'viewer',
      department:    ctx.department || '',
      is_active:     true,
      last_login:    '',
      created_at:    _now()
    });
    return { ok: true };
  }

  function updateUser(ctx) {
    if (!Auth.isAdmin(ctx.sess)) return { error: 'FORBIDDEN' };
    const updates = {};
    if (ctx.display_name !== undefined) updates.display_name = ctx.display_name;
    if (ctx.role !== undefined)         updates.role = ctx.role;
    if (ctx.department !== undefined)   updates.department = ctx.department;
    if (ctx.is_active !== undefined)    updates.is_active = ctx.is_active;
    if (ctx.password)                   updates.password_hash = Auth.hashPwd(ctx.password);
    _updateRow('USERS', 'user_id', ctx.user_id, updates);
    return { ok: true };
  }

  return { getAll, update, getUsers, createUser, updateUser };
})();
