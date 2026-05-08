# 🔒 Git Security & Protection Guide

## วิธีป้องกันไฟล์ที่อ่อนไหวจากการ push ไปยัง GitHub

ได้ติดตั้งการป้องกันหลายชั้นแล้ว:

---

## 1️⃣ `.gitignore` - ไฟล์ที่ 1 (ป้องกันหลัก)

ไฟล์ `.gitignore` มีรายการไฟล์/โฟลเดอร์ที่จะถูก ignore โดยอัตโนมัติ:

```bash
# ตัวอย่าง: ค้นหาว่าไฟล์ถูก ignore หรือไม่
git check-ignore -v config.js
# Output: .gitignore:19:config.js    config.js
# ถ้าปรากฏ = ถูก ignore ✓
```

**ถูกป้องกัน:**
- `.DS_Store` - ไฟล์ระบบ
- `config.js` - ไฟล์คอนฟิก
- `Code.gs` - Google Apps Script
- `credentials.json` - Google credentials
- `.env` - Environment variables
- และอีก 40+ รายการ

---

## 2️⃣ `pre-commit hook` - ไฟล์ 2 (ป้องกันเพิ่มเติม)

📍 สถานที่: `.git/hooks/pre-commit`

**ทำการตรวจสอบก่อน commit:**
- ✅ ตรวจสอบไฟล์ที่ห้ามตามชื่อแน่นอน
- ✅ ตรวจสอบ Pattern อันตรายในไฟล์ (API_KEY, PASSWORD, SECRET)
- ✅ ป้องกันไฟล์ที่ใหญ่เกิน 5MB
- ✅ หยุด commit ถ้ามีเรื่องน่ากังวล

---

## 🧪 ทดสอบการป้องกัน

### **ทดสอบที่ 1: สร้างไฟล์ config.js**

```bash
# สร้างไฟล์ที่ห้าม
echo "API_URL = 'http://secret.api'" > config.js

# ลองเพิ่มเข้า git
git add config.js

# ลองทำ commit
git commit -m "test"

# ผลลัพธ์: ❌ COMMIT REJECTED
# ✓ git check-ignore ยังทำงาน
```

### **ทดสอบที่ 2: ไฟล์ที่มี API_KEY**

```bash
# สร้างไฟล์ที่มี API_KEY
echo "API_KEY=abc123xyz" > app.js
git add app.js
git commit -m "test"

# Pre-commit hook จะหยุด commit ✓
```

---

## 🚨 ถ้าทำผิดพลาดและ commit ไปแล้ว

### **วิธี 1: อันดู commit ล่าสุด**

```bash
# ถ้าเพิ่งเกิด ยังไม่ push
git reset --soft HEAD~1   # ยกเลิก commit เก่าไว้
git rm --cached config.js # เอาไฟล์ออก
git commit -m "Fix: remove sensitive file"
```

### **วิธี 2: Amend commit ล่าสุด**

```bash
# ถ้ายังไม่ push
git rm --cached config.js
git commit --amend --no-edit
git push --force-with-lease
```

### **วิธี 3: History rewrite (ถ้า push แล้ว)**

```bash
# ⚠️ อันตราย ใช้เมื่อเป็นที่ยอม
git filter-branch --tree-filter 'rm -f config.js' HEAD
git push --force-with-lease
```

---

## 📋 Bypass Hook (ถ้าต้องการ)

ถ้าต้อง commit ไฟล์ที่ hook บล็อก (เช่น test):

```bash
# Skip pre-commit hook
git commit --no-verify -m "Emergency commit"
```

⚠️ **ใช้ระมัดระวัง เฉพาะเมื่อจำเป็น**

---

## 🔧 เพิ่มรายการใหม่ไปยัง Hook

### **เพิ่มไฟล์ใหม่ที่ต้องป้องกัน:**

แก้ไข `.git/hooks/pre-commit`:

```bash
FORBIDDEN_FILES=(
    "config.js"
    "config.local.js"
    "your-new-file.txt"  # ← เพิ่มเข้าที่นี่
)
```

### **เพิ่ม Pattern ใหม่:**

```bash
FORBIDDEN_PATTERNS=(
    "API_KEY"
    "PASSWORD"
    "YOUR_NEW_PATTERN"  # ← เพิ่มเข้าที่นี่
)
```

---

## 📊 สรุปการป้องกัน

| ระดับ | วิธี | ป้องกัน |
|------|-----|--------|
| 1 | `.gitignore` | ไฟล์ที่ชื่อตรงกัน 100% |
| 2 | `pre-commit hook` | Pattern อันตราย |
| 3 | GitHub Branch Protection | ป้องกัน force push |

---

## ✅ Status ปัจจุบัน

```bash
# ตรวจสอบ hook
ls -la .git/hooks/pre-commit

# ทดสอบ
git check-ignore -v config.js
```

---

**ระบบปลอดภัยแล้ว! 🔒** ไฟล์ที่อ่อนไหวป้องกันได้ 3 ชั้น
