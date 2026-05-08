# ระบบงานแผนและงบประมาณ · วก.แม่สะเรียง
## คู่มือใช้งาน (User Guide)

---

## 📋 สารบัญ

1. [เข้าใช้งานระบบ](#การเข้าใช้งาน)
2. [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
3. [การใช้แต่ละหน้า](#การใช้แต่ละหน้า)
4. [วิธี Deploy](#วิธี-deploy)
5. [ข้อมูลเทคนิค](#ข้อมูลเทคนิค)

---

## 🚀 การเข้าใช้งาน

### เปิดระบบเป็นครั้งแรก

1. เปิดเบราว์เซอร์และไปที่หน้า `index.html`
2. ระบบจะเปลี่ยนเส้นทางไปยัง `signin.html` โดยอัตโนมัติ
3. เข้าสู่ระบบโดยใช้:
   - **ตัวเลือก 1:** อีเมล + รหัสผ่าน (ต้องลงท้ายด้วย @msc.ac.th)
   - **ตัวเลือก 2:** ล็อกอินด้วย Google (ในอนาคต)

### ข้อมูลสำหรับทดสอบ

```
อีเมล: example@msc.ac.th
รหัสผ่าน: password123
```

---

## 🎯 ฟีเจอร์หลัก

ระบบนี้มี 6 หน้าแรกหลัก:

### 1. **Dashboard** 📊
- ภาพรวมงบประมาณทั้งหมด
- กราฟความก้าวหน้าตามหมวดงบ
- รายการเตือนสำคัญ
- กิจกรรมล่าสุดของระบบ

### 2. **ทะเบียนโครงการ** 📁
- รายชื่อโครงการทั้งหมด (198 โครงการ)
- จัดกลุ่มตามแผนก/ฝ่าย
- แสดงงบประมาณ + การเบิกใช้
- สถานะของแต่ละโครงการ

### 3. **บัญชีคุมงบ** 📈
- แผนที่อบอุณหภูมิ (Heatmap) ของการเบิกใช้
- สรุปตามหมวดงบ
- ข้อมูลเบิกใช้ vs งบประมาณ
- สถิติตามแผนก

### 4. **ขอเบิก** 💰
- ฟอร์มส่งขอเบิกใหม่
- เลือกโครงการและจำนวนเงิน
- แนบเอกสารประกอบ (ใบเสร็จ, ใบสั่งซื้อ)
- บันทึกร่างหรือส่งได้ทันที

### 5. **กล่องอนุมัติ** ✅
- รายการขอเบิกรObj อนุมัติ
- ปุ่มอนุมัติ/ปฏิเสธทันที
- ติดตามสถานะลายเซ็น
- ประวัติการจัดการ

### 6. **รายงาน** 📑
- รายงานสรุปงบประมาณ
- ดาวน์โหลด PDF / Excel
- ข้อมูลแบบ Quarterly
- ข้อเสนอแนะการจัดการ

---

## 📖 การใช้แต่ละหน้า

### Dashboard
- ดูภาพรวมงบประมาณในแนวมองเดียว
- ติดตามงบคงเหลือเรียลไทม์
- รับเตือนเรื่องสำคัญทันที

### ทะเบียนโครงการ
- **ค้นหา:** ใช้ช่องค้นหาด้านบน
- **กรองตามแผนก:** เลือกจากเมนู dropdown
- **เพิ่มโครงการ:** คลิกปุ่ม "+ เพิ่มโครงการ"
- **ดูรายละเอียด:** คลิกชื่อโครงการ

### บัญชีคุมงบ
- **Heatmap:** แสดงสีต่างกันตามการเบิกใช้
  - 🟩 สีเขียว = ยังเบิกไม่ถึง 50%
  - 🟨 สีเหลือง = เบิก 60-80%
  - 🟥 สีแดง = เบิกเกิน 100%

### ขอเบิก
1. เลือกโครงการจาก dropdown
2. ระบุประเภทเงินที่ขอเบิก
3. ใส่จำนวนเงิน
4. เพิ่มหมายเหตุ (ถ้ามี)
5. **แนบไฟล์:** ลาก & ดรอป หรือคลิกเพื่อเลือก
6. คลิก "ส่งขอเบิก"

### กล่องอนุมัติ
- **อนุมัติ:** คลิก ✓ เขียว
- **ปฏิเสธ:** คลิก ✕ แดง
- **ดูรายละเอียด:** ปุ่มสีเทา

### รายงาน
- เลือกประเภทรายงาน
- เลือกไตรมาสที่ต้องการ
- ดาวน์โหลดเป็น PDF หรือ Excel

---

## 🔧 วิธี Deploy

### สำหรับ GitHub Pages

1. **ตั้ง GitHub repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Budget system MVP"
   git branch -M main
   git remote add origin https://github.com/msc-college/planwork.git
   git push -u origin main
   ```

2. **เปิด GitHub Pages:**
   - ไปที่ Settings → Pages
   - เลือก Source: `main`
   - เลือก folder: `/ (root)`
   - Save

3. **เข้าถึงได้ที่:** 
   - `https://username.github.io/planwork`
   - หรือ custom domain: `https://plan.msc.ac.th`

### สำหรับโลคัลเมื่อน

```bash
# ใช้ Python built-in server
cd /Users/admin/Desktop/planwork\ webapp
python3 -m http.server 8000

# เปิดเบราว์เซอร์ไปที่ http://localhost:8000
```

### สำหรับ Google Apps Script (Backend)

ที่อนาคต จะต้องเชื่อมต่อกับ:
- **Apps Script Web App** สำหรับ API
- **Google Sheets** เป็น Database
- **Google Drive** สำหรับเก็บไฟล์แนบ

---

## 📁 โครงสร้างไฟล์

```
/planwork-webapp
├── index.html              ← Entry point (redirects to signin)
├── signin.html             ← Sign-in page
├── app.html                ← Main application shell
├── styles.css              ← Shared CSS tokens
├── README.md
├── Plan-original.html      ← Full documentation (archived)
├── Mockup.html             ← Design mockups (reference)
├── pages/
│   ├── dashboard.html      ← Dashboard
│   ├── projects.html       ← Project registry
│   ├── budget.html         ← Budget control
│   ├── disbursement.html   ← Disbursement form
│   ├── approval.html       ← Approval inbox
│   └── reports.html        ← Reports
├── uploads/                ← Budget & project files (reference data)
└── assets/                 ← Icons & images (future)
```

---

## 🔑 เทคนิค

### ใช้เทคโนโลยี
- **HTML5** สำหรับ Structure
- **CSS3** + CSS Variables (tokens) สำหรับ Styling
- **Vanilla JavaScript** สำหรับ Routing & Logic
- **Sarabun font** สำหรับไทย + JetBrains Mono สำหรับ Code

### สี Design System
```css
Navy:   #142850 (หลัก)
Gold:   #d4a017 (เน้น)
Paper:  #fbfaf6 (พื้นหลัง)
Ink:    #0b1726 (ข้อความ)
```

### Authentication (ปัจจุบัน)
- เก็บ user ใน `localStorage` เป็น JSON
- ตรวจสอบโดเมน `@msc.ac.th` (เพื่อความปลอดภัยเบื้องต้น)
- ในอนาคต: เชื่อมต่อ Google OAuth2

### Routing
- ใช้ JavaScript `fetch()` เพื่อโหลดหน้า
- URL ไม่เปลี่ยน (Single Page App)
- สามารถเพิ่ม `history.pushState` เพื่อ URL ที่งามขึ้น

---

## 🚨 ข้อควรระวัง

- ระบบนี้เป็น **MVP (Minimum Viable Product)**
- ยังไม่มี Backend APIs เชื่อมต่อ Google Sheets
- ข้อมูลปัจจุบันเป็น **Demo/Mock data** เท่านั้น
- ต้องทำ Backend ด้วย Google Apps Script สำหรับการจริง
- บันทึกรหัสผ่านใน localStorage ไม่ปลอดภัย (ใช้ OAuth จริง)

---

## ✉️ ติดต่อ

- **ที่ปรึกษา:** งานแผนและงบประมาณ วิทยาลัยการอาชีพแม่สะเรียง
- **วันที่ผลิต:** 8 พฤษภาคม 2569
- **รุ่นปัจจุบัน:** 0.1 (MVP)

---

**ขอให้ใช้งานได้สำเร็จ! 🎉**
