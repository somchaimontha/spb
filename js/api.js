/**
 * api.js — Frontend API Client
 * ระบบงานแผนและงบประมาณ · วก.แม่สะเรียง
 *
 * ใช้งาน:
 *   - ถ้ามี GAS_URL → ส่ง request ไปยัง Google Apps Script
 *   - ถ้าไม่มี → ใช้ MockDB (localStorage) + seed จาก _parsed.json
 */

const API = (() => {
  'use strict';

  // ── Config ────────────────────────────────────────────────
  // ตั้งค่า GAS_URL หลัง Deploy Apps Script
  const GAS_URL = window.__GAS_URL__ || null;
  const FISCAL_YEAR = 2569;

  // ── Session ───────────────────────────────────────────────
  let _token = localStorage.getItem('plan_token') || null;
  let _user  = JSON.parse(localStorage.getItem('plan_user') || 'null');

  function getToken() { return _token; }
  function getUser()  { return _user; }
  function isLoggedIn() { return !!_token && !!_user; }

  function _saveSession(token, user) {
    _token = token; _user = user;
    localStorage.setItem('plan_token', token);
    localStorage.setItem('plan_user', JSON.stringify(user));
    // Sign the session so Security.enforce() can detect role tampering
    if (typeof Security !== 'undefined') Security.sign(token, user);
  }

  function logout() {
    _token = null; _user = null;
    localStorage.removeItem('plan_token');
    localStorage.removeItem('plan_user');
    if (typeof Security !== 'undefined') Security.clear();
  }

  // ── HTTP helper ──────────────────────────────────────────
  // ใช้ GET เท่านั้น — GAS Web App รองรับ CORS สำหรับ GET สมบูรณ์
  // POST triggers CORS preflight ซึ่ง GAS ไม่รองรับจาก external origin
  async function _call(action, params = {}) {
    if (!GAS_URL) return Mock[action] ? Mock[action](params) : { error: 'MOCK_NOT_FOUND', action };

    const sp = new URLSearchParams({ action, token: _token || '' });
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        sp.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    });

    try {
      const resp   = await fetch(`${GAS_URL}?${sp.toString()}`);
      const result = await resp.json();
      // If GAS rejects the token (e.g. browser still holds a mock/expired token),
      // fall back to MockDB so the user can still see local data
      if (result.error === 'UNAUTHORIZED' && Mock[action]) {
        console.warn('[API] GAS UNAUTHORIZED for', action, '— falling back to MockDB');
        return Mock[action](params);
      }
      return result;
    } catch (err) {
      return { error: 'NETWORK_ERROR', message: String(err) };
    }
  }

  // ── Public API ────────────────────────────────────────────
  const auth = {
    async login(email, password) {
      const r = await _call('login', { email, password });
      if (r.ok) _saveSession(r.token, r.user);
      return r;
    },
    async loginWithGoogle(idToken) {
      const r = await _call('loginWithGoogle', { idToken });
      if (r.ok) _saveSession(r.token, r.user);
      return r;
    },
    logout,
    getUser,
    isLoggedIn
  };

  const dashboard = {
    async getKPIs(fiscalYear = FISCAL_YEAR) { return _call('getDashboardKPIs', { fiscal_year: fiscalYear }); }
  };

  const projects = {
    async list(filters = {})           { return _call('getProjects', filters); },
    async get(projectId)               { return _call('getProject', { project_id: projectId }); },
    async create(data)                 { return _call('createProject', data); },
    async update(projectId, data)      { return _call('updateProject', { project_id: projectId, ...data }); },
    async cancel(projectId, reason, mergeTarget, note) {
      return _call('cancelProject', { project_id: projectId, cancel_reason: reason, merged_into_id: mergeTarget || '', note: note || '' });
    },
    async getHistory(projectId)        { return _call('getProjectHistory', { project_id: projectId }); },
    // Rounds
    async getRounds(projectId)         { return _call('getRounds', { project_id: projectId }); },
    async addRound(projectId, data)    { return _call('addRound', { project_id: projectId, ...data }); },
    async updateRound(roundId, data)   { return _call('updateRound', { round_id: roundId, ...data }); },
    async deleteRound(roundId, projectId) { return _call('deleteRound', { round_id: roundId, project_id: projectId }); }
  };

  const budget = {
    async getEstimates(fy = FISCAL_YEAR)            { return _call('getBudgetEstimates',       { fiscal_year: fy }); },
    async getAllocations(fy = FISCAL_YEAR)           { return _call('getBudgetAllocations',     { fiscal_year: fy }); },
    async createAllocation(data)                    { return _call('createBudgetAllocation',   data); },
    async deleteAllocation(id)                      { return _call('deleteBudgetAllocation',   { alloc_id: id }); },
    async getReceived(fy = FISCAL_YEAR)             { return _call('getBudgetReceived',        { fiscal_year: fy }); },
    async createReceived(data)                      { return _call('createBudgetReceived',     data); },
    async deleteReceived(id)                        { return _call('deleteBudgetReceived',     { recv_id: id }); },
    async getDistribution(fy = FISCAL_YEAR)         { return _call('getBudgetDistribution',    { fiscal_year: fy }); },
    async createDistribution(data)                  { return _call('createBudgetDistribution', data); },
    async deleteDistribution(id)                    { return _call('deleteBudgetDistribution', { dist_id: id }); },
    async getDisbursements(filters = {})            { return _call('getDisbursements', filters); },
    async createDisbursement(data)                  { return _call('createDisbursement', data); },
    async approveDisbursement(id, approved, remark = '') {
      return _call('approveDisbursement', { disburse_id: id, approved, remark });
    }
  };

  const settings = {
    async getAll()          { return _call('getSettings'); },
    async update(key, value, category, label) { return _call('updateSettings', { key, value, category, label }); },
    async getUsers()        { return _call('getUsers'); },
    async createUser(data)  { return _call('createUser', data); },
    async updateUser(userId, data) { return _call('updateUser', { user_id: userId, ...data }); }
  };

  // ── Format Helpers ────────────────────────────────────────
  const fmt = {
    thb(n)      { return '฿' + Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); },
    pct(n)      { return Math.round(Number(n || 0)) + '%'; },
    date(d)     { if (!d) return '—'; const dt = new Date(d); const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']; return `${dt.getDate()} ${m[dt.getMonth()]} ${dt.getFullYear()+543}`; },
    statusColor(s) {
      const map = { draft:'ink', approved:'amber', active:'navy', completed:'teal', cancelled:'rose' };
      return map[s] || 'ink';
    },
    statusLabel(s) {
      const map = { draft:'ร่าง', approved:'อนุมัติแล้ว', active:'กำลังดำเนิน', completed:'ปิดโครงการ', cancelled:'ยกเลิก' };
      return map[s] || s;
    }
  };

  // ── MockDB (localStorage + seed) ─────────────────────────
  const Mock = (() => {
    const DB_KEY = 'plan_mockdb_v5';

    function _load() {
      try { return JSON.parse(localStorage.getItem(DB_KEY) || 'null'); } catch { return null; }
    }
    function _save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

    function _getDB() {
      let db = _load();
      if (!db) { db = _seed(); _save(db); }
      return db;
    }

    function _uid() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); }
    function _now() { return new Date().toISOString(); }

    // ── Seed from real project data ─────────────────────────
    function _seed() {
      const projects = _buildProjects();
      return {
        projects,
        rounds:               [],
        history:              [],
        disbursements:        [],
        budget_allocations:   _seedBudgetAllocations(),
        budget_received:      _seedBudgetReceived(),
        budget_distribution:  [],
        users: [{ user_id: 'u1', email: 'admin@msc.ac.th', display_name: 'ผู้ดูแลระบบ', role: 'admin', department: 'งานแผนฯ', is_active: true }],
        settings: _defaultSettings()
      };
    }

    // ── Budget seed helpers ───────────────────────────────────
    // lf=311,030  sub=3,596,060  bk=3,352,400  other=10,000  central=3,850,000  total=11,119,490
    function _seedBudgetAllocations() {
      return [
        { alloc_id:'al1', alloc_no:1, alloc_date:'2025-10-01', memo_no:'สอศ.2568/3451', budget_type:'sub',     amount:1500000, quarter:1, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบดำเนินงาน ครั้งที่ 1/2569',            created_by:'u1', created_at:'2025-10-01T00:00:00.000Z' },
        { alloc_id:'al2', alloc_no:2, alloc_date:'2025-10-01', memo_no:'สอศ.2568/3452', budget_type:'bk',      amount:1500000, quarter:1, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบบำรุงการศึกษา ครั้งที่ 1/2569',        created_by:'u1', created_at:'2025-10-01T00:00:00.000Z' },
        { alloc_id:'al3', alloc_no:3, alloc_date:'2026-01-08', memo_no:'สอศ.2569/0122', budget_type:'lf',      amount:186618,  quarter:2, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบเรียนฟรี ครั้งที่ 1/2569',             created_by:'u1', created_at:'2026-01-08T00:00:00.000Z' },
        { alloc_id:'al4', alloc_no:4, alloc_date:'2026-01-08', memo_no:'สอศ.2569/0123', budget_type:'sub',     amount:1096060, quarter:2, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบดำเนินงาน ครั้งที่ 2/2569',            created_by:'u1', created_at:'2026-01-08T00:00:00.000Z' },
        { alloc_id:'al5', alloc_no:5, alloc_date:'2026-01-08', memo_no:'สอศ.2569/0124', budget_type:'bk',      amount:1852400, quarter:2, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบบำรุงการศึกษา ครั้งที่ 2/2569',        created_by:'u1', created_at:'2026-01-08T00:00:00.000Z' },
        { alloc_id:'al6', alloc_no:6, alloc_date:'2026-04-01', memo_no:'สอศ.2569/1201', budget_type:'central',  amount:3850000, quarter:3, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบส่วนกลาง ครุภัณฑ์แผนกช่างก่อสร้าง',  created_by:'u1', created_at:'2026-04-01T00:00:00.000Z' },
        { alloc_id:'al7', alloc_no:7, alloc_date:'2026-04-01', memo_no:'สอศ.2569/1202', budget_type:'lf',      amount:124412,  quarter:3, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบเรียนฟรี ครั้งที่ 2/2569',             created_by:'u1', created_at:'2026-04-01T00:00:00.000Z' },
        { alloc_id:'al8', alloc_no:8, alloc_date:'2026-04-01', memo_no:'สอศ.2569/1203', budget_type:'other',   amount:10000,   quarter:3, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบรายจ่ายอื่น',                          created_by:'u1', created_at:'2026-04-01T00:00:00.000Z' },
        { alloc_id:'al9', alloc_no:9, alloc_date:'2026-07-01', memo_no:'สอศ.2569/2301', budget_type:'sub',     amount:1000000, quarter:4, fiscal_year:FISCAL_YEAR, note:'จัดสรรงบดำเนินงาน ครั้งที่ 3/2569',            created_by:'u1', created_at:'2026-07-01T00:00:00.000Z' },
      ];
    }

    function _seedBudgetReceived() {
      return [
        { recv_id:'rv1', recv_no:1, recv_date:'2025-10-15', ref_no:'บช.ร.001/68', budget_type:'sub',     amount:1500000, fiscal_year:FISCAL_YEAR, note:'รับงบดำเนินงาน ไตรมาส 1',           created_by:'u1', created_at:'2025-10-15T00:00:00.000Z' },
        { recv_id:'rv2', recv_no:2, recv_date:'2025-10-15', ref_no:'บช.ร.002/68', budget_type:'bk',      amount:1500000, fiscal_year:FISCAL_YEAR, note:'รับงบบำรุงการศึกษา ไตรมาส 1',       created_by:'u1', created_at:'2025-10-15T00:00:00.000Z' },
        { recv_id:'rv3', recv_no:3, recv_date:'2026-01-20', ref_no:'บช.ร.003/69', budget_type:'lf',      amount:186618,  fiscal_year:FISCAL_YEAR, note:'รับงบเรียนฟรี ครั้งที่ 1',          created_by:'u1', created_at:'2026-01-20T00:00:00.000Z' },
        { recv_id:'rv4', recv_no:4, recv_date:'2026-01-20', ref_no:'บช.ร.004/69', budget_type:'sub',     amount:1096060, fiscal_year:FISCAL_YEAR, note:'รับงบดำเนินงาน ไตรมาส 2',           created_by:'u1', created_at:'2026-01-20T00:00:00.000Z' },
        { recv_id:'rv5', recv_no:5, recv_date:'2026-01-20', ref_no:'บช.ร.005/69', budget_type:'bk',      amount:1852400, fiscal_year:FISCAL_YEAR, note:'รับงบบำรุงการศึกษา ไตรมาส 2',       created_by:'u1', created_at:'2026-01-20T00:00:00.000Z' },
        { recv_id:'rv6', recv_no:6, recv_date:'2026-04-15', ref_no:'บช.ร.006/69', budget_type:'central',  amount:3850000, fiscal_year:FISCAL_YEAR, note:'รับงบส่วนกลาง ครุภัณฑ์ช่างก่อสร้าง', created_by:'u1', created_at:'2026-04-15T00:00:00.000Z' },
        { recv_id:'rv7', recv_no:7, recv_date:'2026-04-15', ref_no:'บช.ร.007/69', budget_type:'lf',      amount:124412,  fiscal_year:FISCAL_YEAR, note:'รับงบเรียนฟรี ครั้งที่ 2',          created_by:'u1', created_at:'2026-04-15T00:00:00.000Z' },
        { recv_id:'rv8', recv_no:8, recv_date:'2026-04-15', ref_no:'บช.ร.008/69', budget_type:'other',   amount:10000,   fiscal_year:FISCAL_YEAR, note:'รับงบรายจ่ายอื่น',                   created_by:'u1', created_at:'2026-04-15T00:00:00.000Z' },
      ];
    }

    // ข้อมูลโครงการจริงปีงบประมาณ 2569 วิทยาลัยการอาชีพแม่สะเรียง (121 โครงการ)
    function _buildProjects() {
      // lf=งบเรียนฟรีรวม, sub=งบดำเนินงาน, bk=บกศ., other=งบรายจ่ายอื่น, central=งบส่วนกลาง
      const raw = [
        // ── ฝ่ายบริหารทรัพยากร (1-16) ─────────────────────────
        { no:'1',  name:'โครงการรับสมัครและรายงานตัวนักเรียน นักศึกษา ประจำปีการศึกษา 2569',                     div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:15000,    lf:0,       sub:15000,   bk:0,       other:0, central:0,       resp:'งานทะเบียน' },
        { no:'2',  name:'โครงการมอบประกาศนียบัตรแก่ผู้สำเร็จการศึกษา ประจำปี 2568',                             div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:55000,    lf:0,       sub:0,       bk:55000,   other:0, central:0,       resp:'งานทะเบียน' },
        { no:'3',  name:'โครงการจัดซื้อครุภัณฑ์งานอาคารสถานที่',                                                div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,   lf:0,       sub:0,       bk:200000,  other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'4',  name:'โครงการจัดซื้อวัสดุ/อุปกรณ์ ซ่อมแซมงานอาคารสถานที่',                                  div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:400000,   lf:0,       sub:0,       bk:400000,  other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'5',  name:'โครงการจัดจ้างตรวจสอบความปลอดภัยงานอาคาร เพื่อบำรุงรักษาและพัฒนา',                    div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:20000,    lf:0,       sub:0,       bk:20000,   other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'6',  name:'โครงการจัดจ้างปรับปรุงซ่อมแซมอาคารสถานที่',                                            div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:300000,   lf:0,       sub:0,       bk:300000,  other:0, central:0,       resp:'งานอาคารสถานที่', actual:103610 },
        { no:'7',  name:'โครงการจ้างเหมาบริการแม่บ้าน',                                                         div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:156000,   lf:0,       sub:0,       bk:156000,  other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'8',  name:'โครงการจัดซื้อวัสดุงานบ้านงานครัวสำนักงาน งานอาคารสถานที่',                            div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:80000,    lf:0,       sub:0,       bk:80000,   other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'9',  name:'โครงการปรับปรุงภูมิทัศน์อาคารสถานที่และพัฒนาสิ่งแวดล้อม',                              div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:500000,   lf:0,       sub:0,       bk:500000,  other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'10', name:'โครงการปรับปรุงสนามกีฬา วิทยาลัยการอาชีพแม่สะเรียง',                                   div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,   lf:0,       sub:0,       bk:200000,  other:0, central:0,       resp:'งานอาคารสถานที่' },
        { no:'11', name:'โครงการจัดทำป้ายประชาสัมพันธ์ และเผยแพร่เอกลักษณ์อัตลักษณ์วิทยาลัยฯ ประจำปี 2569',    div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:50000,    lf:0,       sub:50000,   bk:0,       other:0, central:0,       resp:'งานประชาสัมพันธ์' },
        { no:'12', name:'โครงการจัดหาครุภัณฑ์และซ่อมแซมครุภัณฑ์ในงานประชาสัมพันธ์ ประจำปีงบประมาณ 2569',       div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:50000,    lf:0,       sub:0,       bk:50000,   other:0, central:0,       resp:'งานประชาสัมพันธ์' },
        { no:'13', name:'โครงการจัดซื้อวัสดุสำนักงาน ประจำปีงบประมาณ 2569',                                     div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,   lf:0,       sub:0,       bk:200000,  other:0, central:0,       resp:'พัสดุ' },
        { no:'14', name:'โครงการซ่อมบำรุงดูแลรักษายานพาหนะ',                                                    div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:100000,   lf:0,       sub:0,       bk:100000,  other:0, central:0,       resp:'งานยานพาหนะ' },
        { no:'15', name:'งานเอกสารและการพิมพ์',                                                                  div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:10000,    lf:0,       sub:10000,   bk:0,       other:0, central:0,       resp:'งานเอกสารงานพิมพ์' },
        { no:'16', name:'จัดจ้างครูผู้สอนและบุคลากรทางการศึกษาในสาขาที่ขาดแคลน',                                div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:3000000,  lf:0,       sub:3000000, bk:0,       other:0, central:0,       resp:'งานบุคลากร' },
        // ── ฝ่ายแผนงานและความร่วมมือ (17-23) ─────────────────
        { no:'17', name:'โครงการประชุมเชิงปฏิบัติการ การจัดทำแผนปฏิบัติราชการประจำปีงบประมาณ พ.ศ. 2570',        div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:10000,  lf:0, sub:10000, bk:0,     other:0, central:0, resp:'งานวางแผนและงบประมาณ' },
        { no:'18', name:'โครงการประชุมพิจารณาแผนปฏิบัติราชการประจำปีงบประมาณ พ.ศ. 2569',                        div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:10000,  lf:0, sub:10000, bk:0,     other:0, central:0, resp:'งานวางแผนและงบประมาณ' },
        { no:'19', name:'โครงการประกวดผลงานสิ่งประดิษฐ์ของคนรุ่นใหม่ ประจำปีการศึกษา 2569',                     div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:25000,  lf:0, sub:25000, bk:0,     other:0, central:0, resp:'งานวิจัย พัฒนาฯ' },
        { no:'20', name:'โครงการสร้างองค์ความรู้ทางการอาชีวศึกษาเพื่อถ่ายทอดเทคโนโลยี ประจำปีการศึกษา 2569',   div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:61000,  lf:0, sub:0,     bk:61000, other:0, central:0, resp:'งานวิจัย พัฒนาฯ' },
        { no:'21', name:'โครงการจัดซื้อครุภัณฑ์ในการพัฒนานวัตกรรมสิ่งประดิษฐ์',                                 div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:30000,  lf:0, sub:0,     bk:30000, other:0, central:0, resp:'งานวิจัย พัฒนาฯ' },
        { no:'22', name:'โครงการส่งเสริมการประกอบอาชีพอิสระในกลุ่มผู้เรียนอาชีวศึกษา',                          div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:30000,  lf:0, sub:0,     bk:30000, other:0, central:0, resp:'งานส่งเสริมผลิตผลการค้าฯ' },
        { no:'23', name:'โครงการพัฒนาการประกันคุณภาพ',                                                           div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:25000,  lf:0, sub:25000, bk:0,     other:0, central:0, resp:'งานประกันฯ' },
        // ── ฝ่ายพัฒนากิจการนักเรียน นักศึกษา (24-38) ──────────
        { no:'24', name:'โครงการออกเยี่ยมบ้าน หอพัก บ้านเช่า ที่พักอาศัยของนักเรียน นักศึกษา',                  div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:8000,   lf:8000,  sub:0,    bk:0,      other:0, central:0, resp:'งานครูที่ปรึกษา' },
        { no:'25', name:'โครงการการประชุมผู้ปกครองนักเรียน นักศึกษา',                                            div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:5000,   lf:5000,  sub:0,    bk:0,      other:0, central:0, resp:'งานครูที่ปรึกษา' },
        { no:'26', name:'โครงการอาชีวะด้านยาเสพติด',                                                             div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:20000,  lf:0,     sub:0,    bk:20000,  other:0, central:0, resp:'งานปกครอง' },
        { no:'27', name:'โครงการปฐมนิเทศนักเรียน นักศึกษา ประจำปีการศึกษา 2569',                                 div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:2000,   lf:2000,  sub:0,    bk:0,      other:0, central:0, resp:'งานแนะแนวฯ' },
        { no:'28', name:'โครงการระดมทุนและทรัพยากรเพื่อการศึกษาของนักเรียน นักศึกษา วิทยาลัยการอาชีพแม่สะเรียง',div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:2000,   lf:0,     sub:2000, bk:0,      other:0, central:0, resp:'งานแนะแนวฯ' },
        { no:'29', name:'โครงการแนะแนวการศึกษาต่อ วิทยาลัยการอาชีพแม่สะเรียง',                                  div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:30000,  lf:0,     sub:30000,bk:0,      other:0, central:0, resp:'งานแนะแนวฯ' },
        { no:'30', name:'โครงการติดตามผู้สำเร็จการศึกษา วิทยาลัยการอาชีพแม่สะเรียง',                            div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:7500,   lf:0,     sub:0,    bk:7500,   other:0, central:0, resp:'งานแนะแนวฯ' },
        { no:'31', name:'โครงการปัจฉิมนิเทศนักเรียน นักศึกษา ประจำปีการศึกษา 2568',                              div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:8000,   lf:0,     sub:8000, bk:0,      other:0, central:0, resp:'งานแนะแนวฯ' },
        { no:'32', name:'โครงการจัดซื้อเวชภัณฑ์ยาสามัญประจำบ้าน ประจำปีการศึกษา 2569',                           div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:15000,  lf:0,     sub:0,    bk:15000,  other:0, central:0, resp:'งานสวัสดิการ' },
        { no:'33', name:'โครงการตรวจสุขภาพนักเรียนนักศึกษา ประจำปีการศึกษา 2569',                                 div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:105000, lf:0,     sub:0,    bk:105000, other:0, central:0, resp:'งานสวัสดิการ' },
        { no:'34', name:'โครงการประกันอุบัติเหตุ ประจำปีการศึกษา 2569',                                           div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:175000, lf:0,     sub:0,    bk:175000, other:0, central:0, resp:'งานสวัสดิการ' },
        { no:'35', name:'โครงการอาชีวอาสา "เทศกาลสงกรานต์ 2569"',                                                div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:15000,  lf:0,     sub:0,    bk:15000,  other:0, central:0, resp:'โครงการพิเศษฯ' },
        { no:'36', name:'โครงการศูนย์ซ่อมสร้างเพื่อชุมชน Fix it center (จิตอาสา) ประจำปี 2569',                  div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:142000, lf:0,     sub:0,    bk:142000, other:0, central:0, resp:'โครงการพิเศษฯ' },
        { no:'37', name:'โครงการจัดการอาชีวศึกษาเพื่อสนองพระราชดำริ ประจำปีงบประมาณ 2569',                       div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:100000, lf:0,     sub:0,    bk:100000, other:0, central:0, resp:'โครงการพิเศษฯ' },
        { no:'38', name:'โครงการส่งเสริมสืบสานประเพณีทางวัฒนธรรม ประจำปีงบประมาณ 2569',                          div:'student', dept:'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', total:10000,  lf:10000, sub:0,    bk:0,      other:0, central:0, resp:'โครงการพิเศษฯ' },
        // ── ฝ่ายวิชาการ (39-75) ──────────────────────────────
        { no:'39', name:'โครงการจัดทำโต๊ะปฏิบัติงานแผนกช่างยนต์',                                               div:'academic', dept:'ฝ่ายวิชาการ', total:30000,    lf:0,      sub:0,     bk:30000,   other:0,       central:0,       resp:'แผนกช่างยนต์' },
        { no:'40', name:'โครงการซ่อมแซมห้องเครื่องมือแผนกช่างยนต์',                                              div:'academic', dept:'ฝ่ายวิชาการ', total:5000,     lf:0,      sub:0,     bk:5000,    other:0,       central:0,       resp:'แผนกช่างยนต์' },
        { no:'41', name:'โครงการซ่อมแซมวัสดุฝึกสำหรับการเรียนการสอนรายวิชางานเครื่องยนต์เล็กแก๊สโซลีนและดีเซล', div:'academic', dept:'ฝ่ายวิชาการ', total:65000,    lf:0,      sub:0,     bk:65000,   other:0,       central:0,       resp:'แผนกช่างยนต์' },
        { no:'42', name:'โครงการศึกษาดูงานในสถานประกอบการ นักเรียน นักศึกษาแผนกวิชาช่างยนต์',                    div:'academic', dept:'ฝ่ายวิชาการ', total:6500,     lf:6500,   sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกช่างยนต์' },
        { no:'43', name:'โครงการเทคโนโลยีนวัตกรรมการเรียนรู้การอนุรักษ์พลังงาน สำหรับนายช่างไฟฟ้าสู่สถานประกอบการ',div:'academic',dept:'ฝ่ายวิชาการ', total:2300,     lf:0,      sub:0,     bk:2300,    other:0,       central:0,       resp:'แผนกช่างไฟฟ้า' },
        { no:'44', name:'โครงการจัดสภาพแวดล้อมสำหรับการเรียนรู้ในศตวรรษที่ 21 แผนกวิชาช่างไฟฟ้ากำลัง',          div:'academic', dept:'ฝ่ายวิชาการ', total:33200,    lf:0,      sub:0,     bk:33200,   other:0,       central:0,       resp:'แผนกช่างไฟฟ้า' },
        { no:'45', name:'โครงการทดสอบมาตรฐานฝีมือแรงงานแห่งชาติ ช่างไฟฟ้าระดับ 1',                              div:'academic', dept:'ฝ่ายวิชาการ', total:14500,    lf:0,      sub:0,     bk:14500,   other:0,       central:0,       resp:'แผนกช่างไฟฟ้า' },
        { no:'46', name:'โครงการศึกษาดูงานในสถานประกอบการ แผนกช่างไฟฟ้า ประจำปีการศึกษา 2569',                   div:'academic', dept:'ฝ่ายวิชาการ', total:2500,     lf:2500,   sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกช่างไฟฟ้า' },
        { no:'47', name:'โครงการจัดซื้อโต๊ะพร้อมเก้าอี้สำหรับผู้เรียนสาขาวิชาการบัญชี',                         div:'academic', dept:'ฝ่ายวิชาการ', total:50000,    lf:0,      sub:0,     bk:50000,   other:0,       central:0,       resp:'แผนกการบัญชี' },
        { no:'48', name:'โครงการสัมมนาเชิงปฏิบัติการวิชาชีพบัญชี',                                               div:'academic', dept:'ฝ่ายวิชาการ', total:0,        lf:0,      sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกการบัญชี' },
        { no:'49', name:'โครงการศึกษาดูงานในสถานประกอบการ แผนกวิชาการบัญชี ประจำปีการศึกษา 2569',                 div:'academic', dept:'ฝ่ายวิชาการ', total:3980,     lf:3980,   sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกการบัญชี' },
        { no:'50', name:'โครงการจัดซื้อครุภัณฑ์สำนักงาน (ศูนย์เรียนรู้การพัฒนาเทคโนโลยี Coding และหุ่นยนต์เพื่อชุมชน)',div:'academic',dept:'ฝ่ายวิชาการ', total:48700, lf:0,  sub:0,     bk:48700,   other:0,       central:0,       resp:'แผนกเทคโนโลยีสารสนเทศ' },
        { no:'51', name:'โครงการอบรมการพัฒนาและประยุกต์ใช้งาน AI บนระบบสมองกลฝังตัว',                            div:'academic', dept:'ฝ่ายวิชาการ', total:2000,     lf:0,      sub:0,     bk:2000,    other:0,       central:0,       resp:'แผนกเทคโนโลยีสารสนเทศ' },
        { no:'52', name:'โครงการศึกษาดูงานในสถานประกอบการ แผนกวิชาเทคโนโลยีสารสนเทศ ประจำปีการศึกษา 2569',       div:'academic', dept:'ฝ่ายวิชาการ', total:2000,     lf:2000,   sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกเทคโนโลยีสารสนเทศ' },
        { no:'53', name:'โครงการซ่อมแซมโรงฝึกงานแผนกวิชาช่างก่อสร้าง',                                           div:'academic', dept:'ฝ่ายวิชาการ', total:50000,    lf:0,      sub:0,     bk:50000,   other:0,       central:0,       resp:'แผนกก่อสร้าง' },
        { no:'54', name:'โครงการศึกษาดูงาน ประจำปีการศึกษา 2569 แผนกวิชาช่างก่อสร้าง',                           div:'academic', dept:'ฝ่ายวิชาการ', total:850,      lf:850,    sub:0,     bk:0,       other:0,       central:0,       resp:'แผนกก่อสร้าง' },
        { no:'55', name:'โครงการจัดซื้อครุภัณฑ์สำหรับใช้ในการจัดการเรียนการสอนแผนกวิชาช่างก่อสร้าง',             div:'academic', dept:'ฝ่ายวิชาการ', total:3850000,  lf:0,      sub:0,     bk:0,       other:0,       central:3850000, resp:'แผนกก่อสร้าง' },
        { no:'56', name:'โครงการการจัดสภาพแวดล้อมสำหรับการเรียนรู้ ซ่อมบำรุงครุภัณฑ์ แผนกเทคนิคพื้นฐาน',        div:'academic', dept:'ฝ่ายวิชาการ', total:50000,    lf:0,      sub:0,     bk:50000,   other:0,       central:0,       resp:'แผนกเทคนิคพื้นฐาน' },
        { no:'57', name:'โครงการสอบธรรมศึกษา สร้างความดีเยาวชนไทย ประจำปีการศึกษา 2568',                         div:'academic', dept:'ฝ่ายวิชาการ', total:3050,     lf:0,      sub:3050,  bk:0,       other:0,       central:0,       resp:'แผนกสามัญสัมพันธ์' },
        { no:'58', name:'โครงการอบรมเชิงปฏิบัติการจัดทำแผนการเรียนรู้ตามหลักสูตรสมรรถนะและการวัดและประเมินผลตามสภาพจริง สำหรับครูอาชีวศึกษา',div:'academic',dept:'ฝ่ายวิชาการ', total:42000, lf:0, sub:42000, bk:0, other:0, central:0, resp:'งานพัฒนาหลักสูตร' },
        { no:'59', name:'โครงการนิเทศการจัดการเรียนการสอน',                                                       div:'academic', dept:'ฝ่ายวิชาการ', total:2000,     lf:0,      sub:2000,  bk:0,       other:0,       central:0,       resp:'งานพัฒนาหลักสูตร' },
        { no:'60', name:'โครงการแข่งขันทักษะวิชาชีพระดับภาค และชาติ ประจำปีการศึกษา 2568',                       div:'academic', dept:'ฝ่ายวิชาการ', total:250000,   lf:0,      sub:250000,bk:0,       other:0,       central:0,       resp:'งานพัฒนาหลักสูตร' },
        { no:'61', name:'โครงการพัฒนาหลักสูตรร่วมกับสถานประกอบการ ประจำปีการศึกษา 2569',                         div:'academic', dept:'ฝ่ายวิชาการ', total:32000,    lf:0,      sub:32000, bk:0,       other:0,       central:0,       resp:'งานพัฒนาหลักสูตร' },
        { no:'62', name:'โครงการอบรมเชิงปฏิบัติการเสริมสร้างทักษะในการพัฒนาหลักสูตรรายวิชาของสถานศึกษา โดยใช้พื้นที่เป็นฐาน',div:'academic',dept:'ฝ่ายวิชาการ', total:5650, lf:0, sub:5650, bk:0, other:0, central:0, resp:'งานพัฒนาหลักสูตร' },
        { no:'63', name:'โครงการทดสอบมาตรฐานวิชาชีพ ประจำปีการศึกษา 2568',                                       div:'academic', dept:'ฝ่ายวิชาการ', total:14000,    lf:0,      sub:14000, bk:0,       other:0,       central:0,       resp:'งานวัดผลฯ' },
        { no:'64', name:'โครงการทดสอบความรู้ความถนัดทางวิชาชีพของนักเรียน ปวช. และ ปวส. ประจำปีการศึกษา 2569',   div:'academic', dept:'ฝ่ายวิชาการ', total:0,        lf:0,      sub:0,     bk:0,       other:0,       central:0,       resp:'งานวัดผลฯ' },
        { no:'65', name:'โครงการทดสอบทางการศึกษาระดับชาติ V-NET ประจำปีการศึกษา 2568',                            div:'academic', dept:'ฝ่ายวิชาการ', total:5000,     lf:0,      sub:5000,  bk:0,       other:0,       central:0,       resp:'งานวัดผลฯ' },
        { no:'66', name:'โครงการสัปดาห์ห้องสมุด',                                                                 div:'academic', dept:'ฝ่ายวิชาการ', total:5165,     lf:0,      sub:5165,  bk:0,       other:0,       central:0,       resp:'งานวิทยบริการ' },
        { no:'67', name:'โครงการพัฒนาและปรับปรุงห้องสมุด',                                                        div:'academic', dept:'ฝ่ายวิชาการ', total:10000,    lf:0,      sub:10000, bk:0,       other:0,       central:0,       resp:'งานวิทยบริการ' },
        { no:'68', name:'โครงการนิเทศนักเรียน นักศึกษาฝึกอาชีพและฝึกประสบการณ์วิชาชีพในสถานประกอบการ',          div:'academic', dept:'ฝ่ายวิชาการ', total:0,        lf:0,      sub:0,     bk:0,       other:0,       central:0,       resp:'งานทวิภาคี' },
        { no:'69', name:'โครงการปฐมนิเทศการฝึกประสบการณ์วิชาชีพของนักเรียน นักศึกษาระบบทวิภาคี ประจำปีการศึกษา 2569',div:'academic',dept:'ฝ่ายวิชาการ', total:9100, lf:0, sub:9100, bk:0, other:0, central:0, resp:'งานทวิภาคี' },
        { no:'70', name:'โครงการปัจฉิมนิเทศนักเรียน นักศึกษาฝึกอาชีพและฝึกประสบการณ์วิชาชีพในสถานประกอบการ ประจำปีการศึกษา 2568',div:'academic',dept:'ฝ่ายวิชาการ', total:9695, lf:0, sub:9695, bk:0, other:0, central:0, resp:'งานทวิภาคี' },
        { no:'71', name:'โครงการเสริมสร้างความร่วมมือในการจัดการศึกษาร่วมกับสถานประกอบการ ร่วมพัฒนาหลักสูตร เพื่อสร้างมาตรฐานในการจัดการศึกษา ระบบทวิภาคี',div:'academic',dept:'ฝ่ายวิชาการ', total:20200, lf:0, sub:0, bk:20200, other:0, central:0, resp:'งานทวิภาคี' },
        { no:'72', name:'ประชุมภาคี 4 ฝ่าย ภาคเรียนที่ 1/2569 และภาคเรียนที่ 2/2569',                            div:'academic', dept:'ฝ่ายวิชาการ', total:13400,    lf:0,      sub:13400, bk:0,       other:0,       central:0,       resp:'งานสื่อการเรียน' },
        { no:'73', name:'ซื้อหนังสือเรียนฟรี 15 ปี ภาคเรียนที่ 1/2569 และภาคเรียนที่ 2/2569',                   div:'academic', dept:'ฝ่ายวิชาการ', total:0,        lf:0,      sub:0,     bk:0,       other:0,       central:0,       resp:'งานสื่อการเรียน' },
        { no:'74', name:'โครงการวันวิทยาศาสตร์แห่งชาติ',                                                          div:'academic', dept:'ฝ่ายวิชาการ', total:10000,    lf:0,      sub:10000, bk:0,       other:0,       central:0,       resp:'สามัญสัมพันธ์' },
        { no:'75', name:'โครงการอนุรักษ์สิ่งแวดล้อมและพันธุ์พืช',                                                 div:'academic', dept:'ฝ่ายวิชาการ', total:10000,    lf:0,      sub:0,     bk:0,       other:10000,   central:0,       resp:'งานสวนพฤกษ์' },
        // ── งานกิจกรรมพัฒนาผู้เรียน (76-121) ────────────────
        { no:'76',  name:'โครงการวันนวมินทรมหาราช ประจำปีพุทธศักราช 2568',                                       div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2500,  lf:2500,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'77',  name:'โครงการวันปิยมหาราช ประจำปีการศึกษา 2568',                                             div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2500,  lf:2500,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'78',  name:'โครงการประเมินผลการดำเนินงานองค์การมาตรฐานดีเด่น ประจำปีการศึกษา 2568',                div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:5000,  lf:5000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'79',  name:'โครงการแห่เทียนเนื่องในเทศกาลออกพรรษา ประจำปีการศึกษา 2568',                          div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:15000, lf:15000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'80',  name:'โครงการประชุมวิชาการองค์การนักวิชาชีพในอนาคตแห่งประเทศไทยและแข่งขันทักษะวิชาชีพ ทักษะพื้นฐาน ระดับสถานศึกษา ระดับอศจ. ประจำปีการศึกษา 2568',div:'activity',dept:'งานกิจกรรมพัฒนาผู้เรียน', total:30000, lf:10000, sub:0, bk:20000, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'81',  name:'โครงการสืบสานและอนุรักษ์ประเพณีลอยกระทง ประจำปีการศึกษา 2568',                        div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:7000,  lf:7000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'82',  name:'โครงการแข่งขันกีฬาภายในต้านภัยยาเสพติด ประจำปีการศึกษา 2568',                         div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:25000, lf:25000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'83',  name:'โครงการเชิดชูเกียรติผู้นำที่สำเร็จการศึกษา ประจำปีการศึกษา 2568',                     div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:3500,  lf:3500,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'84',  name:'โครงการสร้างแนวป้องกันไฟป่ารอบวิทยาลัยฯ ประจำปี 2569',                                div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'85',  name:'โครงการแห่พระพุทธรูปประเพณีสงกรานต์ ประจำปี 2569',                                    div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:10000, lf:10000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'86',  name:'โครงการอบรมคุณธรรม จริยธรรมนักเรียน นักศึกษาใหม่ ประจำปีการศึกษา 2569',               div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:20000, lf:20000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'87',  name:'โครงการเฉลิมพระเกียรติสมเด็จพระนางเจ้าสุทิดาฯ พระบรมราชินี เนื่องในโอกาสวันเฉลิมพระชนมพรรษา ประจำปีพุทธศักราช 2569',div:'activity',dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000, lf:2000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'88',  name:'โครงการวันต้นไม้ประจำปีของชาติ ประจำปีการศึกษา 2569',                                  div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'89',  name:'โครงการปฐมนิเทศสมาชิกชมรมวิชาชีพ ประจำปีการศึกษา 2569',                               div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'90',  name:'โครงการทำบุญวันสถาปนาวิทยาลัยการอาชีพแม่สะเรียง',                                     div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:15000, lf:15000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'91',  name:'โครงการวันไหว้ครู ประจำปีการศึกษา 2569',                                               div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:13000, lf:13000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'92',  name:'โครงการอบรมผู้นำคู่คุณธรรม ตามหลักธรรมาภิบาลในสถานศึกษา ประจำปีการศึกษา 2569',       div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:1000,  lf:1000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'93',  name:'โครงการเฉลิมพระเกียรติพระบาทสมเด็จพระเจ้าอยู่หัว เนื่องในโอกาสวันเฉลิมพระชนมพรรษา ประจำปีพุทธศักราช 2569',div:'activity',dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000, lf:2000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'94',  name:'โครงการแห่เทียนพรรษา ประจำปีการศึกษา 2569',                                           div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:10000, lf:10000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'95',  name:'โครงการเฉลิมพระเกียรติสมเด็จพระนางเจ้าสิริกิติ์ พระบรมราชินีนาถ พระบรมราชชนนีพันปีหลวง เนื่องในโอกาสวันเฉลิมพระชนมพรรษา ประจำปีพุทธศักราช 2569',div:'activity',dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000, lf:2000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'96',  name:'โครงการพิธีประดับแถบสองสี เตรียมลูกเสือวิสามัญ ประจำปีการศึกษา 2569',                 div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:4000,  lf:4000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'97',  name:'โครงการเลือกตั้งนายกองค์การนักวิชาชีพในอนาคตแห่งประเทศไทย ประจำปีการศึกษา 2569',     div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:1500,  lf:1500,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'98',  name:'โครงการประเมินผลการดำเนินงานชมรมวิชาชีพดีเด่น ประจำปีการศึกษา 2569',                  div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:3000,  lf:3000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'99',  name:'โครงการเดินทางไกลและเข้าค่ายพักแรมของลูกเสือวิสามัญ ประจำปีการศึกษา 2569',            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:52000, lf:52000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'100', name:'โครงการแข่งขันทักษะภาษาอังกฤษ ประจำปีการศึกษา 2568',                                  div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:10000, lf:10000, sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'101', name:'โครงการรักษ์ภาษาไทย ประจำปีการศึกษา 2568',                                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:9000,  lf:9000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจกรรมฯ' },
        { no:'102', name:'โครงการน้ำใจคนพันธุ์ R ต้านภัยหนาว ครั้งที่ 12',                                      div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:500,   lf:500,   sub:0, bk:0, other:0, central:0, resp:'ชมรม To Be Number One' },
        { no:'103', name:'โครงการเลือกตั้งคณะกรรมการดำเนินงานชมรม To Be Number One',                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:0,     lf:0,     sub:0, bk:0, other:0, central:0, resp:'ชมรม To Be Number One' },
        { no:'104', name:'โครงการส่งเสริมการเรียนรู้วัฒนธรรมอาเซียน',                                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:3400,  lf:3400,  sub:0, bk:0, other:0, central:0, resp:'ชมรม To Be Number One' },
        { no:'105', name:'โครงการไอทีเทคเซอร์วิส ประจำปีการศึกษา 2568',                                         div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมเทคโนโลยีสารสนเทศ' },
        { no:'106', name:'โครงการเลือกตั้งคณะกรรมการชมรมวิชาชีพเทคโนโลยีสารสนเทศ ประจำปีการศึกษา 2569',        div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:0,     lf:0,     sub:0, bk:0, other:0, central:0, resp:'ชมรมเทคโนโลยีสารสนเทศ' },
        { no:'107', name:'โครงการบำรุงรักษาคอมพิวเตอร์ ประจำปีการศึกษา 2569',                                    div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมเทคโนโลยีสารสนเทศ' },
        { no:'108', name:'โครงการกีฬาไฟฟ้าต้านภัยยาเสพติด (ตะกร้อคัพ) ครั้งที่ 1',                             div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:3000,  lf:3000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างไฟฟ้า' },
        { no:'109', name:'โครงการเลือกตั้งคณะกรรมการดำเนินงานชมรมวิชาชีพช่างไฟฟ้า',                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:0,     lf:0,     sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างไฟฟ้า' },
        { no:'110', name:'โครงการปรับปรุงรักษา และซ่อมแซมอุปกรณ์เครื่องใช้ไฟฟ้าพัดลม ภายในวิทยาลัยฯ',          div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2800,  lf:2800,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างไฟฟ้า' },
        { no:'111', name:'โครงการมาตรการการลดใช้พลังงานไฟฟ้า ภายในวิทยาลัยการอาชีพแม่สะเรียง',                  div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:3000,  lf:3000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างไฟฟ้า' },
        { no:'112', name:'โครงการ 5 ส (สะสาง สะดวก สุขลักษณะ สะอาด สร้างนิสัย) ปีการศึกษา 2569',               div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:1000,  lf:1000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างยนต์' },
        { no:'113', name:'โครงการขับขี่ปลอดภัยสร้างวินัยจราจร',                                                  div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:9000,  lf:9000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างยนต์' },
        { no:'114', name:'โครงการเลือกตั้งประธานชมรมวิชาชีพช่างยนต์ ประจำปีการศึกษา 2569',                      div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:500,   lf:500,   sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างยนต์' },
        { no:'115', name:'โครงการแข่งกีฬาฟุตบอลภายในแผนก Auto Cup 2025',                                        div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:5000,  lf:5000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างยนต์' },
        { no:'116', name:'โครงการเลือกตั้งประธานชมรมวิชาชีพการบัญชี',                                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:500,   lf:500,   sub:0, bk:0, other:0, central:0, resp:'ชมรมการบัญชี' },
        { no:'117', name:'โครงการส่งเสริมการประกอบอาชีพอิสระในกลุ่มผู้เรียนอาชีวศึกษา ประจำปีการศึกษา 2569',    div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมการบัญชี' },
        { no:'118', name:'โครงการประกวดสิ่งประดิษฐ์จากวัสดุเหลือใช้',                                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:2000,  lf:2000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมการบัญชี' },
        { no:'119', name:'โครงการแข่งขันฟุตบอล 3 คน',                                                            div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:1500,  lf:1500,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างก่อสร้าง' },
        { no:'120', name:'โครงการจิตอาสาชมรมวิชาชีพช่างก่อสร้าง',                                                div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:1000,  lf:1000,  sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างก่อสร้าง' },
        { no:'121', name:'โครงการเลือกตั้งประธานชมรมวิชาชีพช่างก่อสร้าง',                                        div:'activity', dept:'งานกิจกรรมพัฒนาผู้เรียน', total:0,     lf:0,     sub:0, bk:0, other:0, central:0, resp:'ชมรมช่างก่อสร้าง' },
      ];

      return raw.map(r => ({
        project_id:       _uid(),
        project_no:       r.no,
        project_name:     r.name,
        responsible_person: r.resp,
        division_code:    r.div,
        department:       r.dept,
        budget_category_code: '',
        budget_type:      '',
        total_budget:     r.total,
        budget_planned:   r.total,
        budget_actual:    r.actual || 0,
        budget_remaining: r.total - (r.actual || 0),
        b_learning_free:  r.lf,
        b_subsidy:        r.sub,
        b_nonformal:      r.bk,
        b_other:          r.other,
        b_central:        r.central,
        status:           r.actual >= r.total ? 'completed' : r.actual > 0 ? 'active' : 'approved',
        is_supplementary: false,
        parent_project_id:'',
        memo_ref_no:      '',
        approval_date:    '',
        exec_start_date:  '',
        exec_end_date:    '',
        cancel_reason:    '',
        merged_into_id:   '',
        audit_step1:      r.actual > 0,
        audit_step2:      r.actual >= r.total * 0.5,
        audit_step3:      r.actual >= r.total,
        fiscal_year:      FISCAL_YEAR,
        note:             '',
        is_active:        true,
        created_at:       '2025-10-01T00:00:00.000Z',
        updated_at:       new Date().toISOString(),
        created_by:       'u1',
        round_count:      0
      }));
    }

    function _defaultSettings() {
      return {
        project_status: {
          draft:     { label:'ร่าง', color:'#6B7280' },
          approved:  { label:'อนุมัติแล้ว', color:'#D97706' },
          active:    { label:'กำลังดำเนิน', color:'#1D3A73' },
          completed: { label:'ปิดโครงการ', color:'#0F766E' },
          cancelled: { label:'ยกเลิก', color:'#B3261E' }
        },
        division: {
          admin:    { label:'ฝ่ายบริหารทรัพยากร' },
          plan:     { label:'ฝ่ายแผนงานและความร่วมมือ' },
          student:  { label:'ฝ่ายพัฒนากิจการนักเรียน' },
          academic: { label:'ฝ่ายวิชาการ' },
          activity: { label:'งานกิจกรรม/ชมรม' }
        },
        system: { fiscal_year: FISCAL_YEAR, college_name: 'วิทยาลัยการอาชีพแม่สะเรียง' }
      };
    }

    // ── Mock Methods ─────────────────────────────────────────
    function getProjects(p) {
      const db = _getDB();
      let rows = [...db.projects];
      if (p.division_code) rows = rows.filter(r => r.division_code === p.division_code);
      if (p.status)        rows = rows.filter(r => r.status === p.status);
      if (p.q)             rows = rows.filter(r => r.project_name.includes(p.q) || r.project_no.includes(p.q));
      return { ok:true, data: rows };
    }

    function getProject(p) {
      const db = _getDB();
      const proj = db.projects.find(r => r.project_id === p.project_id);
      if (!proj) return { error:'NOT_FOUND' };
      proj.history = db.history.filter(h => h.project_id === p.project_id);
      proj.rounds  = db.rounds.filter(r => r.project_id === p.project_id).sort((a,b)=>a.round_no-b.round_no);
      return { ok:true, data: proj };
    }

    function createProject(p) {
      const db = _getDB();
      if (db.projects.find(r => r.project_no === p.project_no)) return { error:'DUPLICATE_PROJECT_NO' };
      const proj = { project_id: _uid(), fiscal_year: FISCAL_YEAR, is_active: true, created_at: _now(),
        budget_actual: 0, budget_remaining: Number(p.total_budget)||0, round_count: 0, ...p };
      db.projects.push(proj); _save(db);
      return { ok:true, data: proj };
    }

    function updateProject(p) {
      const db = _getDB();
      const idx = db.projects.findIndex(r => r.project_id === p.project_id);
      if (idx === -1) return { error:'NOT_FOUND' };
      const old = { ...db.projects[idx] };
      const changes = [];
      Object.keys(p).forEach(k => {
        if (k !== 'project_id' && p[k] !== undefined && String(p[k]) !== String(old[k])) {
          changes.push({ field:k, old_value: String(old[k]), new_value: String(p[k]) });
          db.projects[idx][k] = p[k];
        }
      });
      db.projects[idx].updated_at = _now();
      changes.forEach(c => {
        db.history.push({ history_id:_uid(), project_id:p.project_id, changed_field:c.field,
          old_value:c.old_value, new_value:c.new_value, changed_by:'u1', changed_at:_now(), note:'' });
      });
      _save(db); return { ok:true, changes };
    }

    function cancelProject(p) {
      const db = _getDB();
      const idx = db.projects.findIndex(r => r.project_id === p.project_id);
      if (idx === -1) return { error:'NOT_FOUND' };
      db.projects[idx].status = 'cancelled';
      db.projects[idx].cancel_reason = p.cancel_reason;
      db.projects[idx].merged_into_id = p.merged_into_id || '';
      db.projects[idx].is_active = false;
      db.projects[idx].updated_at = _now();
      _save(db); return { ok:true };
    }

    function getRounds(p) {
      const db = _getDB();
      const rounds = db.rounds.filter(r => r.project_id === p.project_id).sort((a,b)=>a.round_no-b.round_no);
      return { ok:true, data: rounds };
    }

    function addRound(p) {
      const db = _getDB();
      const proj = db.projects.find(r => r.project_id === p.project_id);
      if (!proj) return { error:'NOT_FOUND' };
      const existing = db.rounds.filter(r => r.project_id === p.project_id);
      const prevCum  = existing.reduce((s,r) => s + Number(r.budget_used||0), 0);
      const thisUsed = Number(p.budget_used) || 0;
      const cumulative = prevCum + thisUsed;
      const remaining  = Number(proj.total_budget) - cumulative;
      const round = { round_id:_uid(), project_id:p.project_id, round_no:existing.length+1,
        exec_start_date:p.exec_start_date||'', exec_end_date:p.exec_end_date||'',
        budget_used:thisUsed, budget_cumulative:cumulative, budget_remaining:remaining,
        procurement_batch_no:p.procurement_batch_no||'', finance_disburse_no:p.finance_disburse_no||'',
        round_status:p.round_status||'active', remark:p.remark||'', created_by:'u1', created_at:_now() };
      db.rounds.push(round);
      proj.budget_actual = cumulative; proj.budget_remaining = remaining;
      proj.round_count = (proj.round_count||0) + 1;
      _save(db); return { ok:true, data:round, overspend: remaining < 0 };
    }

    function deleteRound(p) {
      const db = _getDB();
      db.rounds = db.rounds.filter(r => r.round_id !== p.round_id);
      // Recalc
      const proj  = db.projects.find(r => r.project_id === p.project_id);
      const rounds = db.rounds.filter(r => r.project_id === p.project_id).sort((a,b)=>a.round_no-b.round_no);
      let cum = 0;
      rounds.forEach((r,i) => { cum += Number(r.budget_used||0); r.round_no=i+1; r.budget_cumulative=cum; r.budget_remaining=Number(proj.total_budget)-cum; });
      if (proj) { proj.budget_actual=cum; proj.budget_remaining=Number(proj.total_budget)-cum; proj.round_count=rounds.length; }
      _save(db); return { ok:true };
    }

    // ── Budget functions ──────────────────────────────────────
    const _BT_LABELS = { lf:'งบเรียนฟรีรวม', sub:'งบดำเนินงาน', bk:'บกศ.', other:'งบรายจ่ายอื่น', central:'งบส่วนกลาง สอศ.' };
    const _BT_KEYS   = ['lf','sub','bk','other','central'];
    const _BT_MAP    = { lf:'b_learning_free', sub:'b_subsidy', bk:'b_nonformal', other:'b_other', central:'b_central' };

    function getBudgetEstimates(p) {
      const db = _getDB();
      const fy = Number(p.fiscal_year) || FISCAL_YEAR;
      const ps = db.projects.filter(r => r.fiscal_year === fy && r.is_active !== false);
      const totals = { total:0, lf:0, sub:0, bk:0, other:0, central:0 };
      ps.forEach(r => {
        totals.total   += Number(r.total_budget||0);
        totals.lf      += Number(r.b_learning_free||0);
        totals.sub     += Number(r.b_subsidy||0);
        totals.bk      += Number(r.b_nonformal||0);
        totals.other   += Number(r.b_other||0);
        totals.central += Number(r.b_central||0);
      });
      return { ok:true, data: ps, totals, fiscal_year: fy };
    }

    function getBudgetAllocations(p) {
      const db = _getDB();
      const fy = Number(p.fiscal_year) || FISCAL_YEAR;
      const rows = db.budget_allocations.filter(r => r.fiscal_year === fy).sort((a,b)=>a.alloc_no-b.alloc_no);
      const totals = {};
      _BT_KEYS.forEach(k => { totals[k] = rows.filter(r=>r.budget_type===k).reduce((s,r)=>s+Number(r.amount||0),0); });
      return { ok:true, data: rows, totals };
    }

    function createBudgetAllocation(p) {
      const db = _getDB();
      if (!db.budget_allocations) db.budget_allocations = [];
      const seq = db.budget_allocations.filter(r=>r.fiscal_year===FISCAL_YEAR).length + 1;
      const rec = { alloc_id:_uid(), alloc_no:seq, alloc_date:p.alloc_date||'', memo_no:p.memo_no||'',
        budget_type:p.budget_type||'sub', amount:Number(p.amount)||0, quarter:Number(p.quarter)||1,
        fiscal_year:FISCAL_YEAR, note:p.note||'', created_by:'u1', created_at:_now() };
      db.budget_allocations.push(rec); _save(db);
      return { ok:true, data: rec };
    }

    function deleteBudgetAllocation(p) {
      const db = _getDB();
      db.budget_allocations = db.budget_allocations.filter(r => r.alloc_id !== p.alloc_id);
      _save(db); return { ok:true };
    }

    function getBudgetReceived(p) {
      const db = _getDB();
      const fy = Number(p.fiscal_year) || FISCAL_YEAR;
      const rows = db.budget_received.filter(r => r.fiscal_year === fy).sort((a,b)=>a.recv_no-b.recv_no);
      const totals = {};
      _BT_KEYS.forEach(k => { totals[k] = rows.filter(r=>r.budget_type===k).reduce((s,r)=>s+Number(r.amount||0),0); });
      return { ok:true, data: rows, totals };
    }

    function createBudgetReceived(p) {
      const db = _getDB();
      if (!db.budget_received) db.budget_received = [];
      const seq = db.budget_received.filter(r=>r.fiscal_year===FISCAL_YEAR).length + 1;
      const rec = { recv_id:_uid(), recv_no:seq, recv_date:p.recv_date||'', ref_no:p.ref_no||'',
        budget_type:p.budget_type||'sub', amount:Number(p.amount)||0,
        fiscal_year:FISCAL_YEAR, note:p.note||'', created_by:'u1', created_at:_now() };
      db.budget_received.push(rec); _save(db);
      return { ok:true, data: rec };
    }

    function deleteBudgetReceived(p) {
      const db = _getDB();
      db.budget_received = db.budget_received.filter(r => r.recv_id !== p.recv_id);
      _save(db); return { ok:true };
    }

    function getBudgetDistribution(p) {
      const db = _getDB();
      const fy = Number(p.fiscal_year) || FISCAL_YEAR;
      const rows = (db.budget_distribution||[]).filter(r => r.fiscal_year === fy).sort((a,b)=>a.dist_no-b.dist_no);
      const ps   = db.projects;
      const enriched = rows.map(r => {
        const proj = ps.find(pp => pp.project_id === r.project_id || pp.project_no === r.project_no) || {};
        return { ...r, project_name: proj.project_name||'', project_no_display: proj.project_no||r.project_no||'' };
      });
      const totals = {};
      _BT_KEYS.forEach(k => { totals[k] = enriched.filter(r=>r.budget_type===k).reduce((s,r)=>s+Number(r.amount||0),0); });
      return { ok:true, data: enriched, totals };
    }

    function createBudgetDistribution(p) {
      const db = _getDB();
      if (!db.budget_distribution) db.budget_distribution = [];
      const seq = db.budget_distribution.filter(r=>r.fiscal_year===FISCAL_YEAR).length + 1;
      const rec = { dist_id:_uid(), dist_no:seq, dist_date:p.dist_date||'', project_id:p.project_id||'',
        project_no:p.project_no||'', budget_type:p.budget_type||'sub', amount:Number(p.amount)||0,
        fiscal_year:FISCAL_YEAR, note:p.note||'', created_by:'u1', created_at:_now() };
      db.budget_distribution.push(rec); _save(db);
      return { ok:true, data: rec };
    }

    function deleteBudgetDistribution(p) {
      const db = _getDB();
      db.budget_distribution = db.budget_distribution.filter(r => r.dist_id !== p.dist_id);
      _save(db); return { ok:true };
    }

    function getDashboardKPIs() {
      const db = _getDB();
      const ps = db.projects;
      const total  = ps.reduce((s,p) => s+Number(p.total_budget||0), 0);
      const actual = ps.reduce((s,p) => s+Number(p.budget_actual||0), 0);
      return { ok:true, fiscal_year:FISCAL_YEAR,
        summary:{ total_budget:total, total_actual:actual, total_remaining:total-actual,
          used_pct: total>0?Math.round(actual/total*100):0, project_count:ps.length,
          pending_disburse:0, overspend_count:ps.filter(p=>Number(p.budget_actual)>Number(p.total_budget)).length },
        by_division: _groupByDiv(ps), alerts:[] };
    }

    function _groupByDiv(ps) {
      const r={};
      ps.forEach(p=>{ const d=p.division_code||'other'; if(!r[d])r[d]={total:0,actual:0,count:0}; r[d].total+=Number(p.total_budget||0); r[d].actual+=Number(p.budget_actual||0); r[d].count+=1; });
      return r;
    }

    function getSettings() {
      return { ok:true, data: _getDB().settings };
    }

    function updateSettings(p) {
      const db = _getDB();
      if (!db.settings[p.category]) db.settings[p.category] = {};
      db.settings[p.category][p.key] = p.value;
      _save(db); return { ok:true };
    }

    function getUsers()    { return { ok:true, data: _getDB().users }; }
    function resetDB()     { localStorage.removeItem(DB_KEY); return { ok:true }; }

    function login(p) {
      const db   = _getDB();
      const user = db.users.find(u => u.email === p.email && (u.is_active === true || u.is_active === 'true'));
      if (!user) return { error: 'INVALID_CREDENTIALS', message: 'ไม่พบบัญชีผู้ใช้นี้ในระบบ Demo' };
      const token = 'mock_' + _uid();
      return { ok:true, token, user:{ user_id:user.user_id, email:user.email,
        display_name:user.display_name, role:user.role, department:user.department } };
    }

    return { login, getProjects, getProject, createProject, updateProject, cancelProject,
             getRounds, addRound, deleteRound, getDashboardKPIs, getSettings, updateSettings, getUsers,
             getDisbursements: ()=>({ok:true,data:[]}), createDisbursement:()=>({ok:true}),
             approveDisbursement:()=>({ok:true}),
             getBudgetEstimates, getBudgetAllocations, createBudgetAllocation, deleteBudgetAllocation,
             getBudgetReceived, createBudgetReceived, deleteBudgetReceived,
             getBudgetDistribution, createBudgetDistribution, deleteBudgetDistribution,
             exportReport:()=>({ok:true}), resetDB };
  })();

  return { auth, dashboard, projects, budget, settings, fmt, Mock };
})();
