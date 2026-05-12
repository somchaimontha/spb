/* ── Session Integrity Guard ────────────────────────────────────────────────
 * Binds session token + role + user_id + email into a tamper-detect signature.
 * If any field is changed in localStorage after login, enforce() will detect
 * the mismatch and force a logout.
 *
 * NOTE: This is client-side only — real authorization is always enforced
 * server-side in Google Apps Script (Code.gs). This guard deters casual
 * tampering via browser DevTools / Application tab edits.
 *
 * API:
 *   Security.sign(token, user)  — call right after login success
 *   Security.enforce(redirect?) — call at top of every protected page
 *   Security.clear()            — call on logout
 * ─────────────────────────────────────────────────────────────────────────*/
const Security = (() => {
  'use strict';

  const KEY_SIG   = 'plan_sig';
  const KEY_TOKEN = 'plan_token';
  const KEY_USER  = 'plan_user';
  const KEY_TS    = 'plan_sig_ts';

  // FNV-1a 32-bit hash — deterministic, fast, enough for tamper detection
  function _fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36);
  }

  function _computeSig(token, user) {
    if (!token || !user) return '';
    // Bind all security-sensitive fields together
    const str = [token, user.user_id || '', user.role || '', user.email || ''].join('||');
    return _fnv1a(str);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Call immediately after a successful login to lock in the session binding. */
  function sign(token, user) {
    const sig = _computeSig(token, user);
    if (!sig) return;
    localStorage.setItem(KEY_SIG,  sig);
    localStorage.setItem(KEY_TS,   String(Date.now()));
  }

  /** Remove signature on logout so the next login starts fresh. */
  function clear() {
    localStorage.removeItem(KEY_SIG);
    localStorage.removeItem(KEY_TS);
  }

  /**
   * Verify that plan_token + plan_user match the stored signature.
   * Returns true if intact, false if tampered or missing.
   */
  function verify() {
    const token   = localStorage.getItem(KEY_TOKEN);
    const userRaw = localStorage.getItem(KEY_USER);
    const stored  = localStorage.getItem(KEY_SIG);

    // If not logged in at all, nothing to verify
    if (!token && !userRaw) return true;

    // If logged in but signature is missing → treat as tampered
    if (!token || !userRaw || !stored) return false;

    try {
      const user     = JSON.parse(userRaw);
      const expected = _computeSig(token, user);
      return expected === stored;
    } catch {
      return false;
    }
  }

  /**
   * Enforce session integrity on protected pages.
   * Call this BEFORE reading plan_user from localStorage.
   * Redirects to signin + clears all session data if tampered.
   * Returns true if safe to proceed, false (+ redirect) if tampered.
   */
  function enforce(redirectTo = 'signin.html') {
    if (verify()) return true;

    // Tamper detected — wipe session
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    localStorage.removeItem(KEY_SIG);
    localStorage.removeItem(KEY_TS);

    window.location.href = redirectTo + '?tampered=1';
    return false;
  }

  /** Exposed for settings page diagnostics only — do not use in production UI */
  function _debug() {
    const token   = localStorage.getItem(KEY_TOKEN) || '(none)';
    const userRaw = localStorage.getItem(KEY_USER)  || 'null';
    const stored  = localStorage.getItem(KEY_SIG)   || '(none)';
    let user;
    try { user = JSON.parse(userRaw); } catch { user = null; }
    const computed = _computeSig(token, user);
    return { token: token.slice(0, 12) + '…', stored, computed, match: stored === computed };
  }

  return { sign, clear, verify, enforce, _debug };
})();
