// ============================================================
// Auth.gs — Authentication & Session Management
// ============================================================

const Auth = (() => {

  function hashPwd(password) {
    const raw = CFG.SALT + password;
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
    return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
  }

  function login(email, password) {
    if (!email || !password) return { error: 'MISSING_CREDENTIALS' };

    const users = _rows('USERS');
    const user  = users.find(u => u.email === email && u.is_active);
    if (!user) return { error: 'INVALID_CREDENTIALS' };

    if (user.password_hash !== hashPwd(password)) return { error: 'INVALID_CREDENTIALS' };

    // Create session
    const token   = _uid();
    const expires = new Date(Date.now() + CFG.SESSION_TTL_H * 3600 * 1000).toISOString();
    _append('SESSIONS', { token, user_id: user.user_id, expires_at: expires, created_at: _now() });

    // Update last_login
    _updateRow('USERS', 'user_id', user.user_id, { last_login: _now() });

    return {
      ok:      true,
      token,
      expires,
      user: {
        user_id:      user.user_id,
        email:        user.email,
        display_name: user.display_name,
        role:         user.role,
        department:   user.department
      }
    };
  }

  function validate(token) {
    if (!token) return null;
    const sessions = _rows('SESSIONS');
    const sess     = sessions.find(s => s.token === token);
    if (!sess) return null;
    if (new Date(sess.expires_at) < new Date()) return null;

    const users = _rows('USERS');
    const user  = users.find(u => u.user_id === sess.user_id && u.is_active);
    if (!user) return null;
    return { user_id: user.user_id, email: user.email, role: user.role, display_name: user.display_name };
  }

  function canWrite(sess) { return ['admin', 'officer'].includes(sess.role); }
  function isAdmin(sess)  { return sess.role === 'admin'; }

  return { login, validate, hashPwd, canWrite, isAdmin };
})();

const Audit = {
  log(action, entityType, entityId, actorId, payload) {
    try {
      _append('AUDIT_LOG', {
        log_id:      _uid(),
        action,
        entity_type: entityType,
        entity_id:   String(entityId),
        actor_id:    actorId || 'system',
        payload:     JSON.stringify(payload || {}),
        timestamp:   _now()
      });
    } catch (e) { /* non-blocking */ }
  }
};
