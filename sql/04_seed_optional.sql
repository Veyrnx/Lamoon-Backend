-- OPTIONAL: creates five catalog products only in a NEW EMPTY project. No historical stock copied.
BEGIN;
INSERT INTO public.products(name,price,unit_label) VALUES
('ช็อกโกแลต',70,'ถ้วย'),('ชาไทย',70,'ถ้วย'),('มะพร้าว',65,'ถ้วย'),('วานิลลา',70,'ถ้วย'),('สตรอว์เบอร์รี',70,'ถ้วย')
ON CONFLICT(name) DO NOTHING;
INSERT INTO public.product_stock(product_id,quantity)
SELECT p.id,0 FROM public.products p
WHERE p.name IN ('ช็อกโกแลต','ชาไทย','มะพร้าว','วานิลลา','สตรอว์เบอร์รี')
ON CONFLICT(product_id) DO NOTHING;
INSERT INTO public.promotions(name,code,description,promotion_type,value,minimum_order_amount,member_only,is_active)
VALUES('สุขสันต์วันปีใหม่','NEWYEAR120','ส่วนลด 120 บาท เมื่อซื้อครบ 600 บาท','fixed',120,600,false,true),('เย็นฉ่ำวันสงกรานต์','SONGKRAN80','ส่วนลด 80 บาท เมื่อซื้อครบ 400 บาท','fixed',80,400,false,true),('วันเด็กแสนสนุก','KIDSDAY50','ส่วนลด 50 บาท เมื่อซื้อครบ 200 บาท','fixed',50,200,false,true)
ON CONFLICT(code) DO NOTHING;
COMMIT;
