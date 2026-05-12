# PROJECT STATUS — ระบบงานนโยบายและแผน v2.0
### วิทยาลัยการอาชีพแม่สะเรียง · ปีงบประมาณ 2569

> อัปเดตล่าสุด: 12 พฤษภาคม 2569 · Branch: `main` · Version: **2.0**

---

## สถานะโปรเจกต์โดยรวม

| หัวข้อ | รายละเอียด |
|--------|-----------|
| **Version** | v2.0 (redesigned) |
| **Backend** | Google Apps Script v3 (Deploy: 12 พ.ค. 2569 12:44) |
| **Frontend** | GitHub Pages: `somchaimontha.github.io/spb/` |
| **GAS URL** | `https://script.google.com/macros/s/AKfycbzqNFlei.../exec` |
| **Google Sheet ID** | `1vMO4k2VdEbV85xqnDFbYjGbyyxQaoigKQ5ZPU1cxIr4` |
| **Auth** | Email/Password + Google OAuth (GSI) เฉพาะ @msr.ac.th |

---

## โครงสร้างไฟล์ทั้งหมด

```
planwork webapp/
├── app.html              ← Shell หลัก v2.0 (sidebar collapsible, 24 routes)
├── signin.html           ← Login: Email/Password + Google Sign-In
├── styles.css            ← Design system (Sarabun + navy/gold/paper)
├── index.html            ← Landing / redirect
├── logo-msr.png
│
├── js/
│   ├── api.js            ← API client + MockDB fallback
│   ├── security.js       ← Session integrity guard (FNV-1a hash)
│   └── tamper-guard.js   ← DevTools deterrent (ปิดด้วย devmode)
│
├── pages/                ← 27 หน้า (SPA)
│   │
│   ├── dashboard.html        ✅ 4 budget-type cards + chart + requests
│   │
│   ├── [แผนงาน]
│   ├── strategic-plan.html   ✅ แผนกลยุทธ์ 4 กลยุทธ์ + KPI ต่อโครงการ
│   ├── annual-plan.html      ✅ แผนปฏิบัติการ Gantt-style 12 เดือน
│   ├── kpi.html              ✅ ติดตาม KPI พร้อม progress bar
│   │
│   ├── [โครงการ]
│   ├── propose-project.html  ✅ เสนอโครงการ 5-step + month selector
│   ├── projects.html         ✅ ทะเบียนโครงการ 121 รายการ (MockDB)
│   ├── activities.html       ✅ จัดการกิจกรรม card grid
│   │
│   ├── [งบประมาณ]
│   ├── disbursement.html     ✅ สร้างคำขอใหม่ (form)
│   ├── budget.html           ✅ ตัดงบประมาณ / บัญชีคุมงบ
│   ├── repay.html            ✅ คืนเงินยืม
│   ├── budget-received.html  ✅ ดูยอดคงเหลือ
│   │
│   ├── [กล่องอนุมัติ]
│   ├── approve-deputy.html   ✅ อนุมัติ รอง ผอ. (expand cards)
│   ├── approve-director.html ✅ อนุมัติ ผอ.
│   ├── verify-docs.html      ✅ ตรวจสอบเอกสาร (PDF/IMG/XLS preview)
│   ├── approval.html         ✅ ตรวจสอบโครงการ
│   ├── all-requests.html     ✅ คำขอทั้งหมด (table + filter)
│   │
│   ├── [รายงาน]
│   ├── reports.html          ✅ สรุปภาพรวม
│   ├── project-summary.html  ✅ สรุปโครงการที่เสนอ
│   ├── evaluation.html       ✅ ประเมินผล CIPP Model (C/I/P/P)
│   ├── project-report.html   ✅ รายงานโครงการ + ประวัติเบิกจ่าย
│   ├── history.html          ✅ ประวัติดำเนินการ (timeline)
│   ├── calendar.html         ✅ ปฏิทินกิจกรรม (grid)
│   │
│   ├── [ผู้ดูแลระบบ]
│   ├── audit-log.html        ✅ Audit Log ทุก action
│   └── settings.html         ✅ 7 แท็บ (รวม Telegram Bot + Security)
│
└── gas/                  ← Google Apps Script (ไม่ push ขึ้น git)
    ├── Code.gs           🔒 (SHEET_ID + credentials)
    ├── Auth.gs           ✅ Login, Google OAuth, session, roles
    ├── Projects.gs       ✅ CRUD, cancel, execution rounds, history
    ├── Budget.gs         ✅ KPIs, disbursements, allocations
    └── Settings.gs       ✅ Users, dynamic settings
```

---

## หน้าใน Settings (7 แท็บ)

| แท็บ | เนื้อหา |
|------|--------|
| ทั่วไป | ข้อมูลองค์กร, ปีงบประมาณ |
| สถานะ & หมวด | ตั้งค่า tag status/category |
| ฝ่าย/แผนก | รายชื่อฝ่ายและหัวหน้า |
| ผู้มีอำนาจ | ลายมือชื่อ รอง ผอ. / ผอ. |
| ผู้ใช้งาน | CRUD users, reset password |
| การแจ้งเตือน | **Telegram Bot** (token + chat_id + test) + Email |
| ความปลอดภัย | Developer Mode toggle + Login history |

---

## ระบบความปลอดภัย (3 ชั้น)

| ชั้น | ไฟล์ | หน้าที่ |
|------|------|--------|
| **1. Tamper Guard** | `js/tamper-guard.js` | บล็อก F12, DevTools shortcuts, right-click, window-size detect, intercept localStorage.setItem |
| **2. Session Integrity** | `js/security.js` | FNV-1a hash ผูก token+user_id+role+email → `plan_sig`; detect ถ้าแก้ไข |
| **3. Server-side** | `gas/Auth.gs` | Token validate ทุก request, domain restrict @msr.ac.th |

**Developer Mode:** Admin toggle ใน Settings → Security → ปิด tamper-guard ชั่วคราว (key: `plan_devmode=1`)

---

## Google OAuth (Google Sign-In)

| รายละเอียด | ค่า |
|------------|-----|
| Client ID | `37039050545-i6pnj5mb5oradig0l35up4i3ahibm395.apps.googleusercontent.com` |
| GCP Project | `spb-planwork` (msr.ac.th) |
| Domain restrict | `payload.hd !== 'msr.ac.th'` (ใน Auth.gs) |
| Library | Google Identity Services `accounts.google.com/gsi/client` |
| Callback | `handleGoogleCredentialResponse(response)` ใน signin.html |

---

## MockDB (Offline Fallback)

- Key: `localStorage → plan_mockdb_v5`
- ข้อมูล: **121 โครงการจริง ปีงบประมาณ 2569** (ใน `js/api.js`)
- ใช้ได้ทุกหน้า เมื่อ GAS ไม่ตอบสนอง
- Session ใน MockDB: `plan_token`, `plan_user`, `plan_sig`, `plan_sig_ts`

---

## แหล่งเงิน 4 ประเภท (Budget Types)

| key | ชื่อ | สี |
|-----|------|-----|
| `เงินอุดหนุน` | เงินอุดหนุน | #3b82f6 (blue) |
| `กิจกรรมพัฒนาผู้เรียน` | กิจกรรมพัฒนาผู้เรียน | #10b981 (green) |
| `เงินบำรุงการศึกษา` | เงินบำรุงการศึกษา | #f59e0b (amber) |
| `รายได้สถานศึกษา` | รายได้สถานศึกษา | #8b5cf6 (purple) |

---

## GAS Sheet Schema (13 sheets)

| Sheet | วัตถุประสงค์ |
|-------|-------------|
| USERS | บัญชีผู้ใช้ + role + last_login |
| SESSIONS | session token (TTL 8h) |
| PROJECTS | ทะเบียนโครงการหลัก 121 รายการ |
| PROJECT_HISTORY | ประวัติการแก้ไขทุก field |
| PROJECT_CANCELLATIONS | บันทึกการยกเลิกโครงการ |
| EXECUTION_ROUNDS | รอบการดำเนินงาน running balance |
| DISBURSEMENTS | รายการเบิกจ่าย |
| BUDGET_ESTIMATES | ประมาณการรายจ่าย |
| BUDGET_ALLOCATIONS | รายการจัดสรร |
| BUDGET_RECEIVED | งบประมาณที่ได้รับ |
| BUDGET_DISTRIBUTION | การจำหน่ายงบ |
| AUDIT_LOG | Audit trail (append-only) |
| SETTINGS | ตั้งค่าระบบ dynamic |

---

## สิ่งที่ต้องพัฒนาต่อ (Next Steps)

### Phase 3 — เชื่อม Backend จริง

- [ ] เชื่อม GAS API กับหน้า strategic-plan, annual-plan, kpi
- [ ] เชื่อม GAS API กับหน้า propose-project (บันทึก/ดึงข้อมูลโครงการ)
- [ ] เชื่อม GAS API กับ approve-deputy/director (อนุมัติจริง อัปเดต Sheet)
- [ ] Telegram Bot: เชื่อม webhook จริงกับ GAS (แจ้งเตือนอัตโนมัติ)
- [ ] PDF export: สร้าง PDF ใบขออนุมัติโครงการ (7 หน้า) ผ่าน GAS/HTML

### Phase 4 — ยกระดับ

- [ ] File upload เอกสารแนบไปยัง Google Drive
- [ ] ลายเซ็นดิจิทัล (signature capture) สำหรับการอนุมัติ
- [ ] ปฏิทิน: เชื่อม Google Calendar API
- [ ] รายงาน: Export Excel จาก GAS (SpreadsheetApp)
- [ ] แจ้งเตือน Email ผ่าน GAS MailApp

---

## วิธี Deploy GAS (ทบทวน)

```
1. script.google.com → Project: PlanWork MSC 2569
2. วาง Code.gs (ใส่ SHEET_ID + DRIVE_FOLDER_ID ที่ถูกต้อง)
3. วาง Auth.gs, Projects.gs, Budget.gs, Settings.gs
4. รัน initSheets() → _seedAdminUser()
5. Deploy → Web App → Execute as: Me → Access: Anyone
6. Copy URL → วางใน app.html window.__GAS_URL__
```

---

*พัฒนาโดย งานแผนและงบประมาณ วิทยาลัยการอาชีพแม่สะเรียง*
*v2.0 redesign: 12 พฤษภาคม 2569*
