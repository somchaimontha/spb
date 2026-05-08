# ระบบงานแผนและงบประมาณ · วก.แม่สะเรียง

ชุดเอกสาร + ต้นแบบสำหรับระบบบริหารโครงการและงบประมาณออนไลน์ของ **วิทยาลัยการอาชีพแม่สะเรียง** ปีงบประมาณ 2569

## สิ่งที่อยู่ในโปรเจกต์

| ไฟล์ | คำอธิบาย |
|------|----------|
| `index.html` | หน้ารวม deliverable เริ่มต้นจากที่นี่ |
| `Plan.html` | เอกสารแผนฉบับเต็ม 14 ส่วน — สถาปัตยกรรม, schema, API, roadmap |
| `Mockup.html` | Hi-fi mockup 8 หน้าจอหลัก ใน design canvas |
| `styles.css` | CSS tokens (navy/gold/paper) ใช้ร่วมกัน |
| `design-canvas.jsx` | starter component — pan/zoom canvas สำหรับ mockup |

## สถาปัตยกรรมที่เสนอ

```
ผู้ใช้ ─▶ GitHub Pages (HTML/JS) ─▶ Apps Script Web App ─▶ Google Sheets (DB)
                                                       └▶ Google Drive (ไฟล์แนบ)
```

- **ไม่ต้องเช่า server** — ใช้ Google Workspace ของวิทยาลัย
- **โค้ดอยู่บน GitHub** — version control ครบ ทุกคนในทีมเห็น
- **DB คือ Google Sheets** — เจ้าหน้าที่เปิดดู/ตรวจสอบได้เอง คุ้นเคยอยู่แล้ว

## หน้าจอที่ออกแบบ

1. หน้า Sign in — Google login กรองโดเมน
2. Dashboard — ภาพรวมงบ + กราฟไตรมาส + alert
3. ทะเบียนโครงการ — ตาราง 198 โครงการ จัดกลุ่มตาม 5 ฝ่าย
4. รายละเอียดโครงการ — งบขอ vs ใช้จริง + ใบเบิกย่อย + ไฟล์แนบ
5. บัญชีคุมงบ — heatmap หมวดงบ × 14 ประเภทเงิน
6. ใบขอเบิก — ฟอร์มพร้อมเช็คงบ realtime
7. กล่องอนุมัติ — รายการรออนุมัติ + ปุ่มอนุมัติ/ปฏิเสธ
8. รายงาน — Export PDF/Excel/Sheet

## เริ่มพัฒนาอย่างไร

ดู `Plan.html` ส่วน **§11 การติดตั้งและ Deploy** และ **§13 Roadmap**
สรุปสั้น ๆ:

```
W 1-2   เตรียมข้อมูล clean Excel เข้า Sheet template
W 3-4   MVP read-only — Dashboard + ทะเบียน + บัญชีคุมงบ
W 5-7   ระบบขอเบิก + workflow อนุมัติ
W 8-9   CRUD โครงการ + Export รายงาน
W 10    Pilot 1 ฝ่าย
W 11-12 Roll-out ทั้งวิทยาลัย
```

## เปิดดูเอกสาร

```bash
# เปิดในเครื่อง — เปิดไฟล์ index.html ในเบราว์เซอร์ตรง ๆ ได้
open index.html

# หรือ deploy ขึ้น GitHub Pages
git push origin main
# Settings → Pages → Source: main /(root)
```

---

ออกแบบและพัฒนาระบบโดยนาสมชาย   มณฑา  · งานแผนและงบประมาณ · พ.ค. 2569
