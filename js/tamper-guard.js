/* ── Planwork Tamper Guard ───────────────────────────────────────────────────
 * Discourages casual DevTools inspection and localStorage tampering.
 *
 * NOTE: This is a deterrent layer only — NOT a hard security boundary.
 * Real authorization is enforced server-side in Google Apps Script.
 * A determined attacker with JS knowledge can bypass this.
 *
 * Disabled via: ตั้งค่าระบบ → ทั่วไป → โหมดนักพัฒนา (Admin only)
 * Toggle stores localStorage key "plan_devmode" = "1"
 * ──────────────────────────────────────────────────────────────────────────*/
(function () {
  'use strict';

  // Skip entirely if Admin has enabled Developer Mode
  if (localStorage.getItem('plan_devmode') === '1') {
    console.info('[DevMode] Tamper Guard disabled — Developer Mode is ON');
    return;
  }

  // ── Block right-click context menu ────────────────────────────────────────
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // ── Block DevTools keyboard shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = (e.key || '').toUpperCase();

    // F12
    if (e.key === 'F12') { e.preventDefault(); return; }

    // Ctrl/Cmd + Shift + I / J / C  (Windows/Mac DevTools, Inspector, Console)
    if (ctrl && shift && ['I', 'J', 'C'].includes(key)) { e.preventDefault(); return; }

    // Cmd + Option + I / J / C  (Mac alternative)
    if (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(key)) { e.preventDefault(); return; }

    // Ctrl/Cmd + U  (View Source)
    if (ctrl && key === 'U') { e.preventDefault(); return; }

    // Ctrl + Shift + Delete  (Clear browser history — includes localStorage)
    if (ctrl && shift && key === 'DELETE') { e.preventDefault(); return; }
  });

  // ── Detect DevTools via window size heuristic ─────────────────────────────
  // DevTools panel subtracts from innerWidth/innerHeight when docked
  var _devToolsOpen = false;
  var _THRESHOLD    = 160; // px

  setInterval(function () {
    var wDiff = window.outerWidth  - window.innerWidth;
    var hDiff = window.outerHeight - window.innerHeight;
    var isOpen = wDiff > _THRESHOLD || hDiff > _THRESHOLD;

    if (isOpen && !_devToolsOpen) {
      _devToolsOpen = true;
      console.clear();
      console.warn(
        '%c⚠️  ระบบงานแผนและงบประมาณ · วิทยาลัยการอาชีพแม่สะเรียง',
        'color:#dc2626;font-size:18px;font-weight:bold;line-height:2'
      );
      console.warn(
        '%cหน้านี้สำหรับบุคลากรที่ได้รับอนุญาตเท่านั้น\n' +
        'การเข้าถึงหรือแก้ไขข้อมูลโดยไม่ได้รับอนุญาตถือเป็นความผิดทางกฎหมาย\n' +
        'ข้อมูลการเข้าถึงทั้งหมดถูกบันทึกไว้ในระบบ',
        'color:#7c3aed;font-size:13px;line-height:1.8'
      );
      console.info(
        '%c🔒 สิทธิ์ผู้ใช้ถูกยืนยันโดย server ทุก request — การแก้ไข localStorage จะถูกตรวจจับ',
        'color:#059669;font-size:11px'
      );
    }

    if (!isOpen) _devToolsOpen = false;
  }, 1000);

  // ── Protect against localStorage.setItem override ─────────────────────────
  // Detect if someone tries to override the session role by intercepting writes
  // to plan_user — redirect immediately if plan_user changes while logged in
  var _origSetItem = localStorage.setItem.bind(localStorage);
  var _watching    = false;

  // Start watching after a short delay (to allow initial page load)
  setTimeout(function () {
    _watching = true;
  }, 2000);

  try {
    Object.defineProperty(window.localStorage.__proto__, 'setItem', {
      configurable: true,
      writable:     true,
      value: function (key, value) {
        if (_watching && key === 'plan_user') {
          // Allow only if Security says the new value produces a valid signature
          // (i.e., the write is from the app itself after re-login)
          var existingToken = localStorage.getItem('plan_token');
          var existingSig   = localStorage.getItem('plan_sig');
          if (existingToken && existingSig) {
            // If there is already a signed session, block external overwrites
            // The only valid path to change plan_user is through Security.sign()
            // which writes plan_sig simultaneously — a pure plan_user write is suspicious
            setTimeout(function () {
              if (typeof Security !== 'undefined' && !Security.verify()) {
                Security.clear();
                localStorage.removeItem('plan_token');
                localStorage.removeItem('plan_user');
                window.location.href = 'signin.html?tampered=1';
              }
            }, 50);
          }
        }
        return _origSetItem.call(this, key, value);
      }
    });
  } catch (e) {
    // Some browsers restrict prototype overrides — fail silently
  }

})();
