# Implementation Summary — ระบบงานนโยบายและแผน v2.0
### วิทยาลัยการอาชีพแม่สะเรียง

---

## v2.0 Redesign (12 พ.ค. 2569)

### สิ่งที่เปลี่ยนแปลงหลัก

**เป้าหมาย:** ปรับระบบให้เหมือนระบบอ้างอิง "ระบบงานนโยบายและแผน v2.0" ทั้งหมด โดยคงข้อมูลเดิม

#### 1. Sidebar ใหม่ (app.html)
- สีพื้น `#0f2044` (dark navy) เข้มกว่าเดิม
- Version badge `v2.0`
- เมนูแบบ **Collapsible groups** 5 หมวด
- Logout button ในแถบผู้ใช้

| หมวด | รายการเมนู |
|------|-----------|
| แผนงาน | แผนกลยุทธ์, แผนปฏิบัติการ, ติดตาม KPI |
| โครงการ | เสนอโครงการ, จัดการโครงการ, จัดการกิจกรรม |
| งบประมาณ | สร้างคำขอใหม่, ตัดงบประมาณ, คืนเงินยืม, ดูยอดคงเหลือ |
| กล่องอนุมัติ | อนุมัติ รอง ผอ., อนุมัติ ผอ., ตรวจสอบเอกสาร, ตรวจสอบโครงการ, คำขอทั้งหมด |
| รายงาน | สรุปภาพรวม, สรุปโครงการ, ประเมินผล, รายงานโครงการ, ประวัติดำเนินการ, ปฏิทิน |
| ผู้ดูแลระบบ *(admin only)* | Audit Log, จัดการผู้ใช้, ตั้งค่าระบบ |

#### 2. Dashboard ใหม่ (pages/dashboard.html)
- **4 Budget-type cards** พร้อม progress bar:
  - เงินอุดหนุน (12,605,470)
  - กิจกรรมพัฒนาผู้เรียน (3,379,965)
  - เงินบำรุงการศึกษา (29,948,820)
  - รายได้สถานศึกษา (18,251)
- Panel สถานะคำขอ (รออนุมัติ/อนุมัติ/ไม่อนุมัติ + รายการล่าสุด)
- แผนภูมิแท่งการใช้จ่ายตามหมวด
- ตารางกิจกรรมล่าสุด 5 รายการ

#### 3. หน้าใหม่ 16 หน้า

| หน้า | ฟีเจอร์หลัก |
|------|------------|
| `strategic-plan.html` | 4 กลยุทธ์ collapsible, KPI table + progress bar ต่อโครงการ |
| `annual-plan.html` | Gantt 12 เดือน, filter กลยุทธ์/ประเภทงบ, legend สี |
| `kpi.html` | KPI summary 4 cards, table พร้อม progress + status |
| `propose-project.html` | 5-step form: ข้อมูล → งบ → กิจกรรม → เอกสาร → ส่ง; month selector; budget breakdown table |
| `activities.html` | Card grid พร้อมสีประเภท, meta: วันที่/ผู้รับผิดชอบ/งบ |
| `repay.html` | ตารางยืมที่ค้างชำระ + แบบฟอร์มคืนเงิน |
| `approve-deputy.html` | Expandable cards, ความเห็น, approve/reject buttons |
| `approve-director.html` | รายการที่ผ่านรอง ผอ. แล้ว, อนุมัติ ผอ. ขั้นสุดท้าย |
| `verify-docs.html` | Preview PDF/IMG/XLS, checklist ตรวจสอบ, แจ้งแก้ไข |
| `all-requests.html` | ตาราง filter หลายมิติ, pagination |
| `evaluation.html` | CIPP Model (Context/Input/Process/Product), star scoring, summary card |
| `project-summary.html` | Stats 4 cards, chart by budget type/strategy, project list |
| `project-report.html` | Project detail, disbursement history, CIPP summary |
| `history.html` | Timeline พร้อม dot color ตาม action type |
| `calendar.html` | Monthly grid 7x5, event chips สี, legend |
| `audit-log.html` | ตาราง action log ทุก event, filter by action/user/date |

#### 4. Settings เพิ่ม 2 แท็บ
- **การแจ้งเตือน:** Telegram Bot (token + chat_id + ทดสอบส่งจริง) + Email
- **ความปลอดภัย:** Developer Mode toggle + Login history table

---

## v1.x History

### v1.3 — Security System (พ.ค. 2569)
- `js/security.js` — Session Integrity Guard (FNV-1a hash)
- `js/tamper-guard.js` — DevTools deterrent
- Developer Mode toggle (Admin only) ใน Settings
- Google Sign-In (GSI library, domain @msr.ac.th)
- GAS `loginWithGoogle()` + domain check `payload.hd !== 'msr.ac.th'`

### v1.2 — Data & Budget (พ.ค. 2569)
- MockDB: 121 โครงการจริง ปีงบประมาณ 2569
- 4 หน้างบประมาณ: ประมาณการ, รายการจัดสรร, งปม.เข้า, จัดสรร งปม.
- DB status indicator (online/mock/error)

### v1.1 — Core Pages
- Projects: ตาราง dept-group, audit 3 ขั้น, 5 modals, running balance
- Settings: 5 แท็บ (ทั่วไป, สถานะ, ฝ่าย, ผู้มีอำนาจ, ผู้ใช้)
- GAS Backend v1: Auth, Projects, Budget, Settings

### v1.0 — Foundation
- SPA routing (loadPage)
- Login + session localStorage
- Sidebar nav + Topbar + DB status

---

## Design System

### Color Palette
```css
--ink-900:  #0b1726   /* Text หลัก */
--ink-700:  #1e2a3a
--ink-500:  #475467   /* Subtext */
--ink-200:  #d0d5dd   /* Border */
--ink-100:  #eaecf0
--ink-50:   #f5f7fa
--paper:    #fbfaf6   /* Background */
--gold-500: #d4a017   /* Accent */
--navy-700: #142850   /* Brand */
--navy-500: #27518f
--navy-100: #e3ecf8
/* v2.0 Sidebar */
Sidebar BG: #0f2044
```

### Typography
- Thai: **Sarabun** (300–800) — Google Fonts
- Mono: **JetBrains Mono** — codes, numbers

### Component Classes
```
.btn / .btn.primary / .btn.gold / .btn.ghost / .btn.sm
.tag / .tag.navy / .tag.gold / .tag.green / .tag.rose / .tag.amber / .tag.teal
.card   .stat   .panel   .callout.rose
```

---

## Routing Architecture (SPA)

```javascript
// app.html — 25 routes
const pages = {
  dashboard, 'strategic-plan', 'annual-plan', kpi,
  'propose-project', projects, activities,
  disbursement, budget, repay, 'budget-received',
  'approve-deputy', 'approve-director', 'verify-docs', approval, 'all-requests',
  reports, 'project-summary', evaluation, 'project-report', history, calendar,
  'audit-log', users, settings
};
// loadPage() → fetch → inject HTML → re-exec <script> tags → cache
```

---

## Authentication Flow

```
signin.html
  ├── Email/Password → API.auth.login() → GAS Auth.gs
  │     verify hash(SALT+password) → create session → token+user
  └── Google Sign-In (GSI) → handleGoogleCredentialResponse()
        → GAS loginWithGoogle() → verify tokeninfo → check hd=msr.ac.th

app.html checkAuth()
  1. Security.enforce() — verify plan_sig (FNV-1a)
  2. parse plan_user from localStorage
  3. set window.__currentUser
```

---

## GAS API Pattern

```javascript
// Frontend: GET only (no CORS preflight)
fetch(GAS_URL + '?action=X&token=Y&param=Z')

// GAS Code.gs doGet(e)
// Public: ping, login, loginWithGoogle
// Protected: listProjects, getSettings, approve, ...
// Fallback: if UNAUTHORIZED → MockDB (plan_mockdb_v5)
```

---

*อัปเดต: 12 พฤษภาคม 2569 | v2.0 redesign complete*
