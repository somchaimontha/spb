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
  }

  function logout() {
    _token = null; _user = null;
    localStorage.removeItem('plan_token');
    localStorage.removeItem('plan_user');
  }

  // ── HTTP helper ──────────────────────────────────────────
  async function _call(action, params = {}) {
    if (!GAS_URL) return Mock[action] ? Mock[action](params) : { error: 'MOCK_NOT_FOUND', action };
    const url  = `${GAS_URL}?action=${action}&token=${encodeURIComponent(_token || '')}`;
    const resp = await fetch(url, {
      method:      'POST',
      body:        JSON.stringify({ token: _token, ...params })
      // ไม่ใส่ Content-Type: application/json → ป้องกัน CORS Preflight
      // browser จะส่งเป็น text/plain (Simple Request) → GAS ตอบได้โดยตรง
    });
    return resp.json();
  }

  // ── Public API ────────────────────────────────────────────
  const auth = {
    async login(email, password) {
      const r = await _call('login', { email, password });
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
    async getEstimates(fy = FISCAL_YEAR)    { return _call('getBudgetEstimates',    { fiscal_year: fy }); },
    async getAllocations(fy = FISCAL_YEAR)   { return _call('getBudgetAllocations',  { fiscal_year: fy }); },
    async getReceived(fy = FISCAL_YEAR)     { return _call('getBudgetReceived',      { fiscal_year: fy }); },
    async getDistribution(fy = FISCAL_YEAR) { return _call('getBudgetDistribution',  { fiscal_year: fy }); },
    async getDisbursements(filters = {})    { return _call('getDisbursements', filters); },
    async createDisbursement(data)          { return _call('createDisbursement', data); },
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
    const DB_KEY = 'plan_mockdb_v3';

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
        rounds:        [],
        history:       [],
        disbursements: [],
        users: [{ user_id: 'u1', email: 'admin@msc.ac.th', display_name: 'ผู้ดูแลระบบ', role: 'admin', department: 'งานแผนฯ', is_active: true }],
        settings: _defaultSettings()
      };
    }

    // แปลงข้อมูลโครงการจริงปี 2569
    function _buildProjects() {
      const raw = [
        // ── ฝ่ายบริหารทรัพยากร ────────────────────────────────
        { no:'1',  name:'โครงการรับสมัครและรายงานตัวนักเรียน นักศึกษา ประจำปีการศึกษา 2569', div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:15000,   lf:15000,    sub:0,      bk:0,       other:0,     central:0,      resp:'งานทะเบียน' },
        { no:'2',  name:'โครงการมอบประกาศนียบัตรแก่ผู้สำเร็จการศึกษา ประจำปี 2568',         div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:55000,   lf:55000,    sub:0,      bk:0,       other:0,     central:0,      resp:'งานทะเบียน' },
        { no:'3',  name:'โครงการจัดซื้อครุภัณฑ์งานอาคารสถานที่',                             div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,  lf:200000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร' },
        { no:'4',  name:'โครงการจัดซื้อวัสดุ/อุปกรณ์ ซ่อมแซมงานอาคารสถานที่',               div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:400000,  lf:400000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร' },
        { no:'5',  name:'โครงการจัดจ้างตรวจสอบความปลอดภัยงานอาคารเพื่อบำรุงรักษาและพัฒนา',  div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:20000,   lf:20000,    sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร' },
        { no:'6',  name:'โครงการจัดจ้างปรับปรุงซ่อมแซมอาคารสถานที่',                         div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:300000,  lf:300000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร',   actual:103610 },
        { no:'7',  name:'โครงการจ้างเหมาบริการแม่บ้าน',                                      div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:156000,  lf:156000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร',   actual:156000 },
        { no:'8',  name:'โครงการจัดซื้อวัสดุงานบ้านงานครัวสำนักงาน งานอาคารสถานที่',         div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:80000,   lf:80000,    sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร' },
        { no:'9',  name:'โครงการปรับปรุงภูมิทัศน์อาคารสถานที่และพัฒนาสิ่งแวดล้อม',           div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:500000,  lf:500000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร',   actual:498000 },
        { no:'10', name:'โครงการปรับปรุงสนามกีฬา วิทยาลัยการอาชีพแม่สะเรียง',               div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,  lf:200000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานอาคาร' },
        { no:'11', name:'โครงการจัดทำป้ายประชาสัมพันธ์และเผยแพร่เอกลักษณ์ วก. ประจำปี 2569', div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:50000,   lf:0,        sub:0,      bk:50000,   other:0,     central:0,      resp:'งานประชาสัมพันธ์' },
        { no:'12', name:'โครงการจัดหาครุภัณฑ์และซ่อมแซมครุภัณฑ์ในงานประชาสัมพันธ์ 2569',    div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:50000,   lf:50000,    sub:0,      bk:0,       other:0,     central:0,      resp:'งานประชาสัมพันธ์' },
        { no:'13', name:'โครงการจัดซื้อวัสดุสำนักงาน ประจำปีงบประมาณ 2569',                  div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:200000,  lf:200000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานธุรการ' },
        { no:'14', name:'โครงการซ่อมบำรุงดูแลรักษายานพาหนะ',                                 div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:100000,  lf:100000,   sub:0,      bk:0,       other:0,     central:0,      resp:'งานพัสดุ' },
        { no:'15', name:'งานเอกสารและการพิมพ์',                                               div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:10000,   lf:0,        sub:0,      bk:10000,   other:0,     central:0,      resp:'งานธุรการ' },
        { no:'16', name:'จัดจ้างครูผู้สอนและบุคลากรทางการศึกษาในสาขาที่ขาดแคลน',             div:'admin', dept:'ฝ่ายบริหารทรัพยากร', total:3000000, lf:3000000,  sub:0,      bk:0,       other:0,     central:0,      resp:'งานบุคลากร' },
        // ── ฝ่ายแผนงานและความร่วมมือ ──────────────────────────
        { no:'17', name:'โครงการจัดทำแผนปฏิบัติราชการประจำปี 2569',                           div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:30000,  lf:30000,   sub:0,     bk:0,     other:0, central:0, resp:'งานแผน' },
        { no:'18', name:'โครงการจัดทำรายงานประจำปี 2568',                                     div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:20000,  lf:20000,   sub:0,     bk:0,     other:0, central:0, resp:'งานแผน' },
        { no:'19', name:'โครงการติดตามและประเมินผลการปฏิบัติงาน',                              div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:15000,  lf:15000,   sub:0,     bk:0,     other:0, central:0, resp:'งานแผน' },
        { no:'20', name:'โครงการประกันคุณภาพการศึกษา (สมศ.)',                                 div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:50000,  lf:50000,   sub:0,     bk:0,     other:0, central:0, resp:'งานประกันคุณภาพ' },
        { no:'21', name:'โครงการจัดทำข้อมูลสารสนเทศเพื่อการบริหาร',                           div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:26000,  lf:26000,   sub:0,     bk:0,     other:0, central:0, resp:'งานแผน' },
        { no:'22', name:'โครงการความร่วมมือกับสถานประกอบการ',                                  div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:30000,  lf:30000,   sub:0,     bk:0,     other:0, central:0, resp:'งานความร่วมมือ' },
        { no:'23', name:'โครงการจัดซื้อวัสดุสำนักงานงานแผนและงบประมาณ',                       div:'plan',  dept:'ฝ่ายแผนงานและความร่วมมือ', total:20000,  lf:20000,   sub:0,     bk:0,     other:0, central:0, resp:'งานแผน' },
        // ── ฝ่ายพัฒนากิจการนักเรียน นักศึกษา ─────────────────
        { no:'24', name:'โครงการปฐมนิเทศนักเรียน นักศึกษาใหม่',                               div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'25', name:'โครงการกีฬาภายใน',                                                   div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:50000,  lf:50000,  sub:0, bk:0, other:0, central:0, resp:'งานกีฬา' },
        { no:'26', name:'โครงการวันไหว้ครู',                                                   div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:30000,  lf:30000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'27', name:'โครงการวันลอยกระทง',                                                  div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:15000,  lf:15000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'28', name:'โครงการควบคุมดูแลนักเรียนนักศึกษา',                                   div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'29', name:'โครงการอนามัยโรงเรียน',                                               div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:30000,  lf:30000,  sub:0, bk:0, other:0, central:0, resp:'งานสุขภาพ' },
        { no:'30', name:'โครงการนักศึกษาวิชาทหาร',                                             div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:10000,  lf:10000,  sub:0, bk:0, other:0, central:0, resp:'งาน นศท.' },
        { no:'31', name:'โครงการปลูกจิตสำนึกประชาธิปไตย',                                     div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:15000,  lf:15000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'32', name:'โครงการส่งเสริมคุณธรรมจริยธรรม',                                     div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'33', name:'โครงการกองทุนกู้ยืมเพื่อการศึกษา (กยศ.)',                             div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:10000,  lf:10000,  sub:0, bk:0, other:0, central:0, resp:'งาน กยศ.' },
        { no:'34', name:'โครงการแนะแนวอาชีพ',                                                  div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานแนะแนว' },
        { no:'35', name:'โครงการป้องกันและแก้ไขยาเสพติด',                                      div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานป้องกัน' },
        { no:'36', name:'โครงการชมรมวิชาชีพ',                                                  div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        { no:'37', name:'โครงการส่งเสริมสุขภาพนักเรียน',                                       div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:20000,  lf:20000,  sub:0, bk:0, other:0, central:0, resp:'งานสุขภาพ' },
        { no:'38', name:'โครงการจัดซื้อวัสดุสำนักงานฝ่ายกิจการ',                               div:'student',dept:'ฝ่ายพัฒนากิจการนักเรียน', total:14500,  lf:14500,  sub:0, bk:0, other:0, central:0, resp:'งานกิจการ' },
        // ── ฝ่ายวิชาการ (sample - ย่อจาก 37 โครงการ) ─────────
        { no:'39', name:'โครงการพัฒนาหลักสูตรประกาศนียบัตรวิชาชีพ (ปวช.)',                    div:'academic',dept:'ฝ่ายวิชาการ', total:30000,  lf:30000,   sub:0,       bk:0,     other:0, central:0, resp:'งานหลักสูตร' },
        { no:'40', name:'โครงการจัดซื้อวัสดุฝึก สาขาช่างยนต์',                                div:'academic',dept:'ฝ่ายวิชาการ', total:150000, lf:0,        sub:150000,  bk:0,     other:0, central:0, resp:'สาขาช่างยนต์' },
        { no:'41', name:'โครงการจัดซื้อวัสดุฝึก สาขาช่างไฟฟ้า',                               div:'academic',dept:'ฝ่ายวิชาการ', total:120000, lf:0,        sub:120000,  bk:0,     other:0, central:0, resp:'สาขาช่างไฟฟ้า' },
        { no:'42', name:'โครงการจัดซื้อวัสดุฝึก สาขาช่างก่อสร้าง',                            div:'academic',dept:'ฝ่ายวิชาการ', total:100000, lf:0,        sub:100000,  bk:0,     other:0, central:0, resp:'สาขาช่างก่อสร้าง' },
        { no:'43', name:'โครงการจัดซื้อวัสดุฝึก สาขาคอมพิวเตอร์ธุรกิจ',                      div:'academic',dept:'ฝ่ายวิชาการ', total:80000,  lf:0,        sub:80000,   bk:0,     other:0, central:0, resp:'สาขาคอมพิวเตอร์' },
        { no:'44', name:'โครงการจัดซื้อวัสดุฝึก สาขาการเกษตร',                                div:'academic',dept:'ฝ่ายวิชาการ', total:90000,  lf:0,        sub:90000,   bk:0,     other:0, central:0, resp:'สาขาเกษตร' },
        { no:'45', name:'โครงการอบรมพัฒนาครูและบุคลากร',                                       div:'academic',dept:'ฝ่ายวิชาการ', total:50000,  lf:50000,    sub:0,       bk:0,     other:0, central:0, resp:'งานบุคลากร' },
        { no:'46', name:'โครงการนิเทศการสอนภายใน',                                             div:'academic',dept:'ฝ่ายวิชาการ', total:20000,  lf:20000,    sub:0,       bk:0,     other:0, central:0, resp:'งานวัดผล' },
        { no:'47', name:'โครงการประเมินผลการเรียน',                                             div:'academic',dept:'ฝ่ายวิชาการ', total:30000,  lf:30000,    sub:0,       bk:0,     other:0, central:0, resp:'งานวัดผล' },
        { no:'48', name:'โครงการสอนซ่อมเสริม',                                                  div:'academic',dept:'ฝ่ายวิชาการ', total:20000,  lf:20000,    sub:0,       bk:0,     other:0, central:0, resp:'งานวัดผล' },
        { no:'49', name:'โครงการปรับปรุงห้องปฏิบัติการคอมพิวเตอร์',                            div:'academic',dept:'ฝ่ายวิชาการ', total:500000, lf:0,        sub:0,       bk:0,     other:0, central:500000, resp:'สาขาคอมพิวเตอร์' },
        { no:'50', name:'โครงการจัดซื้อครุภัณฑ์ห้องปฏิบัติการช่างยนต์',                      div:'academic',dept:'ฝ่ายวิชาการ', total:350000, lf:0,        sub:0,       bk:0,     other:350000, central:0, resp:'สาขาช่างยนต์' },
        { no:'51', name:'โครงการจัดจ้างซ่อมบำรุงรักษาครุภัณฑ์',                               div:'academic',dept:'ฝ่ายวิชาการ', total:100000, lf:100000,   sub:0,       bk:0,     other:0, central:0, resp:'งานพัสดุ' },
        { no:'52', name:'โครงการห้องสมุดและสื่อการเรียน',                                      div:'academic',dept:'ฝ่ายวิชาการ', total:60000,  lf:60000,    sub:0,       bk:0,     other:0, central:0, resp:'งานห้องสมุด' },
        { no:'53', name:'โครงการปรับห้องเรียนมาตรฐาน',                                         div:'academic',dept:'ฝ่ายวิชาการ', total:200000, lf:0,        sub:0,       bk:0,     other:0, central:200000, resp:'งานอาคาร' },
        { no:'54', name:'โครงการจัดซื้อสื่อการสอนและแบบเรียน',                                 div:'academic',dept:'ฝ่ายวิชาการ', total:80000,  lf:80000,    sub:0,       bk:0,     other:0, central:0, resp:'งานหลักสูตร' },
        // ── งานกิจกรรมนักเรียน/ชมรม (sample) ─────────────────
        { no:'55', name:'ชมรมช่างยนต์',                                                        div:'activity',dept:'งานกิจกรรม/ชมรม', total:5000,  lf:5000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
        { no:'56', name:'ชมรมคอมพิวเตอร์',                                                     div:'activity',dept:'งานกิจกรรม/ชมรม', total:5000,  lf:5000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
        { no:'57', name:'ชมรมดนตรี',                                                           div:'activity',dept:'งานกิจกรรม/ชมรม', total:8000,  lf:8000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
        { no:'58', name:'ชมรมศิลปะ',                                                           div:'activity',dept:'งานกิจกรรม/ชมรม', total:5000,  lf:5000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
        { no:'59', name:'ชมรมเกษตร',                                                           div:'activity',dept:'งานกิจกรรม/ชมรม', total:7000,  lf:7000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
        { no:'60', name:'ชมรมกีฬา',                                                            div:'activity',dept:'งานกิจกรรม/ชมรม', total:10000, lf:10000, sub:0, bk:0, other:0, central:0, resp:'ครูที่ปรึกษา' },
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
             approveDisbursement:()=>({ok:true}), getBudgetEstimates:()=>({ok:true,data:[]}),
             getBudgetAllocations:()=>({ok:true,data:[]}), getBudgetReceived:()=>({ok:true,data:[],totals:{}}),
             getBudgetDistribution:()=>({ok:true,data:[],summary:{}}), exportReport:()=>({ok:true}),
             resetDB };
  })();

  return { auth, dashboard, projects, budget, settings, fmt, Mock };
})();
