วิธีติดตั้ง Management ร้านละมุน
1. คัดลอกไฟล์ .env.example เป็น .env.local
2. ใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY (หรือ publishable key) ของโปรเจกต์ของร้าน
3. เปิด Terminal ในโฟลเดอร์นี้ แล้วรัน npm install จากนั้น npm run dev

หมายเหตุ:
- หน้าออเดอร์อ่านข้อมูลจริงจาก public.orders และ public.order_items พร้อมข้อมูลลูกค้าจาก customers/profiles
- การอัปเดตสถานะต้องมี RLS policy ที่อนุญาต public.is_staff() ให้บัญชี owner/assistant จัดการ orders และ deliveries
- ข้อมูลเมนูสินค้า สมาชิก การเงิน และวัตถุดิบยังไม่ได้เปลี่ยนจากข้อมูลตัวอย่างในรุ่นนี้
- ห้ามใส่ service_role key ในตัวแปร VITE_* หรือในแอปฝั่ง browser
