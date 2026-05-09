# PROJECT STATUS — ระบบงานแผนและงบประมาณ
### วิทยาลัยการอาชีพแม่สะเรียง · ปีงบประมาณ 2569

> อัปเดตล่าสุด: พฤษภาคม 2569 · Branch: `main`

---

## สถานะไฟล์ทั้งหมด

### Frontend (HTML/CSS/JS)

| ไฟล์ | สถานะ | คำอธิบาย |
|------|--------|----------|
| `app.html` | ✅ พร้อม | Shell หลัก — sidebar, routing, session, api.js |
| `signin.html` | ✅ พร้อม | หน้า login (MockDB mode) |
| `styles.css` | ✅ พร้อม | Design tokens: navy/gold/paper, shared classes |
| `js/api.js` | ✅ พร้อม | API client + MockDB (60 โครงการจริงปี 2569) |

### Pages

| ไฟล์ | สถานะ | ฟีเจอร์ที่มี |
|------|--------|-------------|
| `pages/dashboard.html` | ✅ พร้อม | KPI cards, progress bars, alerts |
| `pages/projects.html` | ✅ พร้อม (ซับซ้อนที่สุด) | ตาราง dept-group, audit 3 ขั้น, execution rounds, 5 modals, running balance, cancel workflow |
| `pages/settings.html` | ✅ พร้อม | 5 แท็บ: ทั่วไป, สถานะ/หมวด, ฝ่าย, ผู้มีอำนาจ, ผู้ใช้ |
| `pages/budget.html` | ⚠️ โครงร่างเบื้องต้น | บัญชีคุมงบ — ยังไม่ครบ |
| `pages/disbursement.html` | ⚠️ โครงร่างเบื้องต้น | ฟอร์มขอเบิก — ยังไม่ครบ |
| `pages/approval.html` | ⚠️ โครงร่างเบื้องต้น | กล่องอนุมัติ — ยังไม่ครบ |
| `pages/reports.html` | ⚠️ โครงร่างเบื้องต้น | รายงาน/Export — ยังไม่ครบ |

### Google Apps Script Backend

| ไฟล์ | สถานะ Git | พร้อม Deploy | หมายเหตุ |
|------|-----------|-------------|---------|
| `gas/Code.gs` | 🔒 ซ่อน (.gitignore) | ✅ พร้อม (แก้ ID ก่อน) | มี SHEET_ID + DRIVE_FOLDER_ID จริง |
| `gas/Auth.gs` | ✅ tracked | ✅ พร้อม Deploy | Login, session, roles, audit |
| `gas/Projects.gs` | ✅ tracked | ✅ พร้อม Deploy | CRUD, cancel, execution rounds, history |
| `gas/Budget.gs` | ✅ tracked | ✅ พร้อม Deploy | KPIs, disbursements, allocations, CSV export |
| `gas/Settings.gs` | ✅ tracked | ✅ พร้อม Deploy | Users, dynamic settings |

---

## วิธี Deploy ไปยัง Google Apps Script

### ขั้นตอน (ทำครั้งเดียว)

1. เปิด [script.google.com](https://script.google.com) → **New project**
2. ตั้งชื่อโปรเจกต์: `PlanWork MSC 2569`
3. Copy โค้ดจากไฟล์ตามลำดับ:

```
gas/Code.gs      → วางในไฟล์ Code.gs หลัก (ไฟล์แรกที่มีอยู่)
gas/Auth.gs      → สร้างไฟล์ใหม่ ชื่อ Auth.gs
gas/Projects.gs  → สร้างไฟล์ใหม่ ชื่อ Projects.gs
gas/Budget.gs    → สร้างไฟล์ใหม่ ชื่อ Budget.gs
gas/Settings.gs  → สร้างไฟล์ใหม่ ชื่อ Settings.gs
```

4. **แก้ไข Code.gs** — อัปเดต CFG:

```javascript
const CFG = {
  SHEET_ID:        '1vMO4k2VdEbV85xqnDFbYjGbyyxQaoigKQ5ZPU1cxIr4',  // ← Google Sheet ID จริง
  DRIVE_FOLDER_ID: '1-WJkIK_9Xg-00SrNyd6VjeZe2bC5GGUK',              // ← Google Drive Folder ID จริง
  SESSION_TTL_H:   8,
  FISCAL_YEAR:     2569,
  SALT:            'MSC_PLAN_2569'
};
```

5. รัน `initSheets()` ครั้งแรกเพื่อสร้าง Sheet ทั้งหมด
6. รัน `_seedAdminUser()` เพื่อสร้าง admin account เริ่มต้น
7. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (หรือ domain เฉพาะถ้ามี Workspace)
8. Copy URL → วางใน `app.html` เพิ่ม:

```html
<script>window.__GAS_URL__ = 'https://script.google.com/macros/s/AKfy.../exec';</script>
```

---

## Sheet Schema (13 sheets ที่ initSheets() สร้าง)

| Sheet | วัตถุประสงค์ |
|-------|-------------|
| USERS | บัญชีผู้ใช้ + role |
| SESSIONS | session token (TTL 8h) |
| PROJECTS | ทะเบียนโครงการหลัก |
| PROJECT_HISTORY | ประวัติการแก้ไขทุก field |
| PROJECT_CANCELLATIONS | บันทึกการยกเลิกโครงการ |
| EXECUTION_ROUNDS | รอบการดำเนินงาน (running balance) |
| DISBURSEMENTS | รายการเบิกจ่าย seq 001-099 |
| BUDGET_ESTIMATES | ประมาณการรายจ่าย |
| BUDGET_ALLOCATIONS | รายการจัดสรร |
| BUDGET_RECEIVED | งบประมาณที่ได้รับ |
| BUDGET_DISTRIBUTION | การจำหน่ายงบ |
| AUDIT_LOG | Audit trail (append-only) |
| SETTINGS | ตั้งค่าระบบ dynamic |

---

## แหล่งเงิน 4 ประเภทหลัก

| key | ชื่อ | คอลัมน์ใน Sheet |
|-----|------|----------------|
| `b_learning_free` | งบเรียนฟรี | D (กิจกรรม) + E (อุดหนุน) |
| `b_nonformal` | บกศ. (Non-Formal) | G |
| `b_other` | งบรายจ่ายอื่น | H |
| `b_central` | งบส่วนกลาง สอศ. | I |

---

## สิ่งที่ต้องพัฒนาต่อ (Next Steps)

### Phase 2 — ฟีเจอร์ที่ยังขาด

- [ ] **pages/budget.html** — บัญชีคุมงบ: heatmap หมวดงบ × แหล่งเงิน, drill-down รายการ
- [ ] **pages/disbursement.html** — ฟอร์มขอเบิกพร้อมตรวจสอบงบ realtime
- [ ] **pages/approval.html** — inbox อนุมัติ/ปฏิเสธ พร้อม badge จำนวนรอ
- [ ] **pages/reports.html** — Export CSV/PDF: สรุปโครงการ, ใบสำคัญจ่าย, รายงานรายฝ่าย

### Phase 3 — ยกระดับ

- [ ] เชื่อม GAS URL จริง (เปลี่ยนจาก MockDB → Production)
- [ ] Upload ไฟล์แนบไปยัง Google Drive
- [ ] Print layout สำหรับใบเบิกจ่าย (ลายเซ็นจาก Settings)
- [ ] แจ้งเตือน email เมื่อมีรายการรออนุมัติ

---

## โครงสร้างไฟล์โปรเจกต์

```
planwork webapp/
├── app.html              ← Shell หลัก (SPA)
├── signin.html           ← หน้า Login
├── styles.css            ← Design system
├── index.html            ← Landing/เอกสาร
├── js/
│   └── api.js            ← API client + MockDB
├── pages/
│   ├── dashboard.html    ✅
│   ├── projects.html     ✅ (full-feature)
│   ├── settings.html     ✅
│   ├── budget.html       ⚠️
│   ├── disbursement.html ⚠️
│   ├── approval.html     ⚠️
│   └── reports.html      ⚠️
├── gas/                  ← Google Apps Script (deploy แยก)
│   ├── Code.gs           🔒 (ไม่ push — มี credentials)
│   ├── Auth.gs           ✅
│   ├── Projects.gs       ✅
│   ├── Budget.gs         ✅
│   └── Settings.gs       ✅
└── .gitignore            ← ป้องกัน uploads/ + Code.gs + credentials
```

---

## ความปลอดภัย Git

| ประเภทไฟล์ | นโยบาย |
|-----------|--------|
| `uploads/*.xlsx, *.json` | 🔒 **ห้าม push** — ข้อมูลงบจริง |
| `gas/Code.gs` | 🔒 **ห้าม push** — มี SHEET_ID + DRIVE_FOLDER_ID |
| `*.env, config.js` | 🔒 **ห้าม push** — credentials |
| `gas/Auth.gs` ถึง `Settings.gs` | ✅ push ได้ — ไม่มี secrets |
| `pages/*.html, js/api.js` | ✅ push ได้ |

---

*พัฒนาโดย งานแผนและงบประมาณ วก.แม่สะเรียง*
