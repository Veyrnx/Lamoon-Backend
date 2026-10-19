import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import AdminNotifications from "./AdminNotifications";

type IconName =
  | "home" | "bag" | "truck" | "calendar" | "plus" | "minus" | "arrow"
  | "check" | "clock" | "box" | "store" | "edit" | "trash" | "close"
  | "card" | "leaf" | "search" | "upload" | "file" | "map" | "phone"
  | "bell" | "wallet" | "user" | "users" | "star";

const icons: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7z" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  arrow: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
  box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
  store: <><path d="M4 10v11h16V10M3 10l2-6h14l2 6" /><path d="M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2M9 21v-5h6v5" /></>,
  edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 7 3.5 3.5" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  leaf: <><path d="M20 4C11 4 5 8 5 15c0 3 2 5 5 5 7 0 10-7 10-16Z" /><path d="M4 21c3-6 7-10 13-13" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5" /><path d="M5 15v5h14v-5" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2c-3-1.2-5.8-4-7-7l2-2-2-5Z" />,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  wallet: <><path d="M3 6h17v14H3z" /><path d="M3 6l13-3v3M15 11h6v5h-6z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-5 3.5-7 8-7s7.2 2 8 7" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-4.2 2.8-6.2 6.5-6.2s5.9 2 6.5 6.2M16 5.5a3 3 0 0 1 0 5.8M17 14c2.6.5 4 2.4 4.5 5" /></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />,
};

function Icon({ name, size = 21 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

type View = "orders" | "delivery" | "finance" | "products" | "ingredients" | "members";
type Stage = "new" | "accepted" | "preparing" | "ready" | "shipping" | "delivered" | "cancelled";
type Order = {
  databaseId?: string; id: string; customer: string; phone: string; address: string; due: string; dueText: string;
  items: { name: string; qty: number }[]; total: number; paid: boolean; payment: string;
  slip?: string; stage: Stage; leadDays?: number; source: string;
};

const stageLabels: Record<Stage, string> = {
  new: "รออนุมัติ", accepted: "รับออเดอร์แล้ว", preparing: "กำลังจัดเตรียม",
  ready: "พร้อมจัดส่ง", shipping: "กำลังจัดส่ง", delivered: "ส่งสำเร็จ", cancelled: "ยกเลิก",
};
const stageOrder: Stage[] = ["accepted", "preparing", "ready", "shipping", "delivered"];

const initialOrders: Order[] = [
  { id: "BLM-250624", customer: "คุณสมใจ ใจดี", phone: "081-245-7890", address: "88/12 ซอยพหลโยธิน 24 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900", due: "26 มิ.ย. 2568", dueText: "เหลือ 1 วัน 6 ชั่วโมง", items: [{ name: "มะพร้าวน้ำหอม", qty: 2 }, { name: "ชาไทย", qty: 1 }], total: 247, paid: true, payment: "พร้อมเพย์", slip: "ชำระแล้ว 24 มิ.ย. 10:42 น.", stage: "new", source: "หน้าเว็บ" },
  { id: "BLM-250623", customer: "คุณวราภรณ์ แสงทอง", phone: "089-554-3201", address: "15/4 หมู่บ้านพฤกษา ถนนรังสิต-นครนายก ปทุมธานี 12130", due: "25 มิ.ย. 2568", dueText: "เหลือ 4 ชั่วโมง 20 นาที", items: [{ name: "สตรอเบอร์รี่", qty: 3 }, { name: "วนิลลา", qty: 2 }], total: 425, paid: true, payment: "โอนธนาคาร", slip: "ชำระแล้ว 23 มิ.ย. 18:20 น.", stage: "preparing", leadDays: 2, source: "LINE" },
  { id: "BLM-250622", customer: "คุณธนกร สุขใจ", phone: "086-111-9087", address: "119 ถนนสุขุมวิท 71 แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110", due: "27 มิ.ย. 2568", dueText: "เหลือ 2 วัน 8 ชั่วโมง", items: [{ name: "ช็อกโกแลต", qty: 2 }], total: 198, paid: false, payment: "เก็บเงินปลายทาง", stage: "accepted", leadDays: 3, source: "โทรศัพท์" },
  { id: "BLM-250621", customer: "คุณณัฐชา วงศ์ดี", phone: "092-987-4402", address: "44 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200", due: "25 มิ.ย. 2568", dueText: "เลยกำหนด 35 นาที", items: [{ name: "เผือก", qty: 4 }], total: 356, paid: true, payment: "บัตรเครดิต", slip: "ชำระแล้ว 21 มิ.ย. 14:05 น.", stage: "shipping", leadDays: 3, source: "หน้าเว็บ" },
];

type Product = { id: string; name: string; price: number; stock: number; color: string };
const initialProducts: Product[] = [];

type Member = { id: string; name: string; phone: string; points: number; visits: number; lastPurchase: string };
const initialMembers: Member[] = [];

function App() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const todayText = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "Asia/Bangkok", weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(today);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [staffName, setStaffName] = useState("ผู้ดูแลร้าน");
  const [view, setView] = useState<View>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRevision, setOrdersRevision] = useState(0);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  async function refreshProducts() {
    if (!session) return;
    setProductsLoading(true); setProductsError("");
    const { data, error } = await supabase.from("products").select("id,name,price,is_active,product_stock(quantity)").eq("is_active", true).order("name");
    if (error) setProductsError(error.message);
    else setProducts((data ?? []).map((p: any) => ({ id: p.id, name: p.name, price: Number(p.price), stock: Number((Array.isArray(p.product_stock) ? p.product_stock[0]?.quantity : p.product_stock?.quantity) ?? 0), color: "#d7c9ad" })));
    setProductsLoading(false);
  }
  useEffect(() => { if (session) void refreshProducts(); else setProducts([]); }, [session?.user?.id]);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError("ตรวจสอบสถานะเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    let mounted = true;
    async function checkStaffRole() {
      if (!session?.user) { setStaffName("ผู้ดูแลร้าน"); return; }
      const { data, error } = await supabase.from("profiles").select("full_name, role").eq("id", session.user.id).maybeSingle();
      if (!mounted) return;
      if (error || !data || !["owner", "assistant"].includes(data.role)) {
        setAuthError("บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบจัดการร้าน กรุณาตรวจสอบ role ในตาราง profiles");
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setStaffName(data.full_name || session.user.email || "ผู้ดูแลร้าน");
      setAuthError("");
    }
    void checkStaffRole();
    return () => { mounted = false; };
  }, [session?.user?.id]);
  useEffect(() => {
    let mounted = true;
    async function loadOrders() {
      if (!session?.user) return;
      setOrdersLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, status, order_date, delivery_date, delivery_type, delivery_address, total_amount, payment_status, payment_method, notes, customers!inner(id, phone, profiles(full_name, phone)), order_items(id, product_name_snapshot, quantity, unit_price, line_total, item_options), deliveries(delivery_status)")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      if (error) {
        setOrders([]);
        flash("โหลดออเดอร์ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ RLS และโครงสร้างตาราง");
      } else {
        const mapped: Order[] = (data ?? []).map((row: any) => {
          const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
          const profile = Array.isArray(customer?.profiles) ? customer.profiles[0] : customer?.profiles;
          const statusMap: Record<string, Stage> = {
            pending: "new", confirmed: "accepted", preparing: "preparing",
            ready: "ready", delivered: "delivered", cancelled: "cancelled",
          };
          const delivery = row.delivery_date ? new Date(row.delivery_date) : null;
          const due = delivery && !Number.isNaN(delivery.getTime())
            ? delivery.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
            : "ยังไม่กำหนด";
          return {
            id: row.order_number || row.id,
            databaseId: row.id,
            customer: profile?.full_name || "ลูกค้า",
            phone: customer?.phone?.trim() || profile?.phone?.trim() || "ไม่ได้ระบุ",
            address: row.delivery_address || "รับสินค้าที่ร้าน",
            due,
            dueText: delivery ? (delivery.getTime() < Date.now() ? "เลยกำหนดส่ง" : "กำหนดส่งตามวันที่ระบุ") : "ยังไม่กำหนดวันส่ง",
            items: (row.order_items ?? []).map((item: any) => {
              const flavor = item.item_options?.flavor;

              return {
                name: flavor
                  ? `${item.product_name_snapshot} — รส${flavor}`
                  : item.product_name_snapshot,
                qty: item.quantity,
              };
            }),
            total: Number(row.total_amount ?? 0),
            paid: row.payment_status === "paid",
            payment: row.payment_method || "ไม่ระบุ",
            stage: (() => {
              const delivery = Array.isArray(row.deliveries) ? row.deliveries[0] : row.deliveries;
              if (delivery?.delivery_status === "out_for_delivery") return "shipping" as Stage;
              if (delivery?.delivery_status === "delivered") return "delivered" as Stage;
              return statusMap[row.status] || "new";
            })(),
            source: "Supabase",
          };
        });
        setOrders(mapped);
        setSelectedId((current) => mapped.some((item) => item.id === current) ? current : (mapped[0]?.id ?? ""));
      }
      setOrdersLoading(false);
    }
    void loadOrders();
    return () => { mounted = false; };
  }, [session?.user?.id, ordersRevision]);

  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function updateOrder(id: string, change: Partial<Order>) {
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    const stage = change.stage ?? order.stage;
    const statusMap: Record<Stage, string> = {
      new: "pending", accepted: "confirmed", preparing: "preparing",
      ready: "ready", shipping: "ready", delivered: "delivered", cancelled: "cancelled",
    };
    const { data: dbOrder, error: lookupError } = await supabase
      .from("orders").select("id").eq("order_number", id).maybeSingle();
    if (lookupError || !dbOrder) {
      flash("ไม่พบออเดอร์ในฐานข้อมูล จึงยังบันทึกสถานะไม่ได้");
      return;
    }
    // All order state transitions are staff-only RPCs; approval deducts cup stock atomically.
    if (stage === "accepted") {
      const { error } = await supabase.rpc("approve_lamoon_order", {
        p_order_number: id,
        p_lead_days: change.leadDays ?? 2,
      });
      if (error) { flash(`อนุมัติไม่สำเร็จ: ${error.message}`); return; }
    } else {
      const { error } = await supabase.rpc("admin_set_order_stage", {
        p_order_number: id,
        p_status: statusMap[stage],
        p_payment_paid: false,
      });
      if (error) { flash(`บันทึกสถานะไม่สำเร็จ: ${error.message}`); return; }
    }
    if (stage === "shipping" || stage === "delivered") {
      const { error } = await supabase.rpc("admin_set_delivery", {
        p_order_number: id,
        p_status: stage === "shipping" ? "out_for_delivery" : "delivered",
      });
      if (error) { flash(`บันทึกสถานะจัดส่งไม่สำเร็จ: ${error.message}`); return; }
    }
    setOrders((current) => current.map((item) => item.id === id ? { ...item, ...change, ...(stage === "accepted" ? { paid: true } : {}) } : item));
    flash("บันทึกสถานะออเดอร์แล้ว");
  }

  async function editOrder(id: string, address: string, quantities: { id: string; quantity: number }[]) {
    const { error } = await supabase.rpc("admin_edit_pending_order", {
      p_order_number: id, p_delivery_address: address, p_items: quantities
    });
    if (error) { flash(`แก้ไขไม่สำเร็จ: ${error.message}`); return false; }
    setOrdersRevision(v => v + 1);
    flash("แก้ไขออเดอร์ใน Supabase แล้ว");
    return true;
  }
  async function cancelOrder(id: string, reason: string) {
    const { error } = await supabase.rpc("admin_cancel_lamoon_order", {
      p_order_number: id, p_reason: reason
    });
    if (error) { flash(`ยกเลิกไม่สำเร็จ: ${error.message}`); return false; }
    setOrdersRevision(v => v + 1);
    flash("ยกเลิกออเดอร์แล้ว และคืนสต็อกกล่องที่เคยตัด (ถ้ามี)");
    return true;
  }
  async function acceptOrder(id: string, days: number) {
    await updateOrder(id, { stage: "accepted", leadDays: days });
  }

  if (authLoading) return <main className="admin-login-page"><section className="admin-login-card"><h1>กำลังตรวจสอบบัญชี...</h1><p>รอสักครู่นะคะ</p></section></main>;
  if (!session) return <LoginScreen initialError={authError} onLogin={async (email, password) => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message.includes("Invalid login credentials") ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง" : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบการตั้งค่า Supabase แล้วลองใหม่");
      return false;
    }
    return true;
  }} />;

  return (
    <div className="management-app">
      <aside className="side-nav">
        <button className="brand" onClick={() => setView("orders")} aria-label="หน้าหลัก">
          <span className="brand-mark"><Icon name="leaf" size={25} /></span>
          <span><b>บ้านละมุน</b><small>ระบบจัดการร้าน</small></span>
        </button>
        <div className="shop-open"><i /><span><b>ร้านกำลังเปิด</b><small>รับออเดอร์อัตโนมัติ</small></span></div>
        <nav aria-label="เมนูจัดการร้าน">
          <SideButton icon="bag" label="ออเดอร์ลูกค้า" active={view === "orders"} badge={orders.filter((o) => o.stage === "new").length} onClick={() => setView("orders")} />
          <SideButton icon="truck" label="ตารางจัดส่ง" active={view === "delivery"} onClick={() => setView("delivery")} />
          <SideButton icon="wallet" label="บัญชีการเงิน" active={view === "finance"} onClick={() => setView("finance")} />
          <SideButton icon="store" label="รสชาติและสต็อก" active={view === "products"} onClick={() => setView("products")} />
          <SideButton icon="box" label="คลังวัตถุดิบ" active={view === "ingredients"} onClick={() => setView("ingredients")} />
          <SideButton icon="users" label="สมาชิกและแต้ม" active={view === "members"} onClick={() => setView("members")} />
        </nav>
        <button className="side-help" onClick={() => { void supabase.auth.signOut(); }}><Icon name="user" /><span><b>{staffName}</b><small>ออกจากระบบ</small></span><Icon name="arrow" size={16} /></button>
      </aside>

      <div className="workspace">
        <header className="workspace-head">
          <div><span className="today">{todayText}</span><h1>{view === "orders" ? "จัดการออเดอร์" : view === "delivery" ? "ตารางจัดส่ง" : view === "finance" ? "บัญชีการเงิน" : view === "products" ? "รสชาติและสต็อก" : view === "ingredients" ? "คลังวัตถุดิบ" : "สมาชิกและแต้ม"}</h1></div>
          <div className="header-actions"><AdminNotifications onOpenOrder={(orderId) => { const match = orders.find((order) => order.databaseId === orderId); setView("orders"); if (match) setSelectedId(match.id); else { setOrdersRevision((value) => value + 1); flash("กำลังเปิดรายการออเดอร์ กรุณาค้นหาออเดอร์ที่เกี่ยวข้อง"); } }} /><div className="header-user">มล</div></div>
        </header>

        <main>
          {view === "orders" && <>{ordersLoading && <p className="panel" style={{ padding: 16 }}>กำลังโหลดออเดอร์จาก Supabase...</p>}{!ordersLoading && orders.length === 0 && <p className="panel" style={{ padding: 16 }}>ยังไม่มีออเดอร์ในฐานข้อมูล หรือบัญชีนี้ยังไม่มีสิทธิ์อ่านข้อมูล</p>}<OrdersView orders={orders} selected={selected} onSelect={setSelectedId} onUpdate={updateOrder} onAccept={acceptOrder} onEdit={editOrder} onCancel={cancelOrder} flash={flash} /></>}
          {view === "delivery" && <DeliveryView orders={orders} onSelect={(id) => { setSelectedId(id); setView("orders"); }} />}
          {view === "finance" && <FinanceView flash={flash} />}
          {view === "products" && <ProductsView products={products} refresh={refreshProducts} loading={productsLoading} error={productsError} flash={flash} />}
          {view === "ingredients" && <IngredientsView flash={flash} />}
          {view === "members" && <MembersView members={members} setMembers={setMembers} flash={flash} />}
        </main>
      </div>
      {notice && <div className="toast"><Icon name="check" size={18} /> {notice}</div>}
    </div>
  );
}

function LoginScreen({ onLogin, initialError = "" }: { onLogin: (email: string, password: string) => Promise<boolean>; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const success = await onLogin(email.trim(), password);
      if (!success) setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
    } catch {
      setError("เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจสอบการตั้งค่าอินเทอร์เน็ตและ Supabase");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="login-brand">
          <span className="brand-mark"><Icon name="leaf" size={29} /></span>
          <div><b>บ้านละมุน</b><small>ระบบจัดการร้าน</small></div>
        </div>
        <div className="login-intro">
          <span className="login-lock"><Icon name="user" size={25} /></span>
          <small>สำหรับผู้ดูแลร้าน</small>
          <h1>เข้าสู่ระบบ</h1>
          <p>ใช้อีเมลและรหัสผ่านของบัญชี Supabase เพื่อเข้าสู่ระบบจัดการร้าน</p>
        </div>
        <form className="admin-login-form" onSubmit={submit}>
          <label><span>อีเมล</span><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="กรอกอีเมลบัญชีแอดมิน" autoComplete="username" autoFocus required /></label>
          <label><span>รหัสผ่าน</span><input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="กรอกรหัสผ่าน" autoComplete="current-password" required /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}><Icon name="check" size={18} /> {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button>
        </form>
        <p className="login-security"><Icon name="check" size={14} /> อนุญาตเฉพาะบัญชีที่มี role owner หรือ assistant</p>
      </section>
      <aside className="login-welcome">
        <span className="eyebrow-admin"><Icon name="leaf" size={16} /> บ้านละมุนโฮมเมด</span>
        <h2>ดูแลทุกออเดอร์<br />ให้น่ารักและละมุน</h2>
        <p>จัดการออเดอร์ การจัดส่ง บัญชี สต็อก และสมาชิกได้ครบในที่เดียว</p>
        <div className="login-feature-list">
          <span><Icon name="bag" /><b>จัดการออเดอร์</b></span>
          <span><Icon name="box" /><b>ตรวจสอบสต็อก</b></span>
          <span><Icon name="users" /><b>ดูแลสมาชิก</b></span>
        </div>
      </aside>
    </main>
  );
}

function SideButton({ icon, label, active, badge, onClick }: { icon: IconName; label: string; active: boolean; badge?: number; onClick: () => void }) {
  return <button className={`side-button ${active ? "active" : ""}`} onClick={onClick}><Icon name={icon} /><span>{label}</span>{badge ? <b>{badge}</b> : null}</button>;
}

function OrdersView({ orders, selected, onSelect, onUpdate, onAccept, onEdit, onCancel, flash }: {
  orders: Order[]; selected?: Order; onSelect: (id: string) => void;
  onUpdate: (id: string, change: Partial<Order>) => void; onAccept: (id: string, days: number) => void; onEdit: (id: string, address: string, quantities: { id: string; quantity: number }[]) => Promise<boolean>; onCancel: (id: string, reason: string) => Promise<boolean>; flash: (message: string) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = orders.filter((order) => (filter === "all" || order.stage === filter) && (`${order.id}${order.customer}${order.phone}`).includes(query));
  return (
    <>
      <div className="overview-grid">
        <SummaryCard icon="bag" label="ออเดอร์ทั้งหมด" value={`${orders.length}`} note="รายการวันนี้" />
        <SummaryCard icon="clock" label="รออนุมัติ" value={`${orders.filter((o) => o.stage === "new").length}`} note="ควรตรวจสอบทันที" urgent />
        <SummaryCard icon="truck" label="ต้องส่งวันนี้" value={`${orders.filter((o) => o.stage !== "delivered").length}`} note="1 รายการใกล้ถึงเวลา" />
        <SummaryCard icon="card" label="รอชำระเงิน" value={`${orders.filter((o) => !o.paid).length}`} note={`ยอดค้าง ฿${orders.filter((o) => !o.paid).reduce((s, o) => s + o.total, 0)}`} />
      </div>
      <div className="orders-layout">
        <section className="panel order-list-panel">
          <div className="panel-head">
            <div><h2>รายการออเดอร์</h2><p>อัปเดตล่าสุดเมื่อสักครู่</p></div>
            <label className="management-search"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ หรือเลขออเดอร์" /></label>
          </div>
          <div className="filter-tabs">
            {[["all", "ทั้งหมด"], ["new", "รออนุมัติ"], ["preparing", "กำลังเตรียม"], ["shipping", "กำลังส่ง"], ["delivered", "ส่งสำเร็จ"]].map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
          <div className="order-list">
            {filtered.map((order) => (
              <button key={order.id} className={`order-list-item ${selected?.id === order.id ? "active" : ""}`} onClick={() => onSelect(order.id)}>
                <span className={`source-icon ${order.stage}`}><Icon name={order.stage === "shipping" ? "truck" : "bag"} size={19} /></span>
                <span className="order-main"><span><b>{order.customer}</b><small>{order.id}</small></span><small>{order.items.map((item) => `${item.name} ${item.qty}`).join(" · ")}</small></span>
                <span className="order-meta"><b>฿{order.total.toLocaleString("th-TH")}</b><small className={order.paid ? "paid" : "unpaid"}>{order.paid ? `ชำระแล้ว · ${order.payment}` : "ยังไม่ชำระ"}</small></span>
                <span className={`stage-tag ${order.stage}`}>{stageLabels[order.stage]}</span>
              </button>
            ))}
          </div>
        </section>
        {selected && <OrderDetail order={selected} onUpdate={onUpdate} onAccept={onAccept} onEdit={onEdit} onCancel={onCancel} flash={flash} />}
      </div>
    </>
  );
}

function SummaryCard({ icon, label, value, note, urgent }: { icon: IconName; label: string; value: string; note: string; urgent?: boolean }) {
  return <div className="summary-card"><span className={urgent ? "urgent" : ""}><Icon name={icon} /></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></div>;
}

function OrderDetail({ order, onUpdate, onAccept, onEdit, onCancel, flash }: { order: Order; onUpdate: (id: string, change: Partial<Order>) => void; onAccept: (id: string, days: number) => void; onEdit: (id: string, address: string, quantities: { id: string; quantity: number }[]) => Promise<boolean>; onCancel: (id: string, reason: string) => Promise<boolean>; flash: (message: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState(order.address);
  const [lines, setLines] = useState<{ id: string; name: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { setEditing(false); setAddress(order.address); setLines([]); setReason(""); }, [order.id]);
  async function beginEdit() {
    const { data, error } = await supabase.from("orders").select("order_items(id,product_name_snapshot,quantity)").eq("order_number", order.id).single();
    if (error) { flash(`โหลดรายการแก้ไขไม่สำเร็จ: ${error.message}`); return; }
    setLines((data?.order_items ?? []).map((l: any) => ({ id: l.id, name: l.product_name_snapshot, quantity: l.quantity })));
    setAddress(order.address === "รับสินค้าที่ร้าน" ? "" : order.address); setEditing(true);
  }
  async function saveEdit() { setSaving(true); const ok = await onEdit(order.id, address, lines.map(l => ({ id: l.id, quantity: l.quantity }))); if (ok) setEditing(false); setSaving(false); }
  async function doCancel() {
    if (!reason.trim()) { flash("กรุณาระบุเหตุผลการยกเลิก"); return; }
    if (!window.confirm(`ยืนยันยกเลิกออเดอร์ ${order.id}? การยกเลิกจะคืนสต็อกกล่องที่ตัดแล้ว และไม่สามารถย้อนกลับจากหน้านี้ได้`)) return;
    setSaving(true); await onCancel(order.id, reason.trim()); setSaving(false);
  }
  const [leadDays, setLeadDays] = useState(order.leadDays ?? 2);
  const isTubOrder = order.items.some(item => /ไอศกรีมแบบถัง|แบบถัง|ถังไอศกรีม/.test(item.name));
  const stageIndex = order.stage === "new" ? -1 : stageOrder.indexOf(order.stage);
  function advance() {
    const next = stageOrder[Math.min(stageOrder.length - 1, stageIndex + 1)];
    onUpdate(order.id, { stage: next });
    flash(`ยืนยันขั้นตอน “${stageLabels[next]}” แล้ว`);
  }
  return (
    <aside className="panel order-detail">
      <div className="detail-head"><div><small>รายละเอียดออเดอร์</small><h2>#{order.id}</h2></div><span className={`stage-tag ${order.stage}`}>{stageLabels[order.stage]}</span></div>
      <div className={`deadline ${order.dueText.includes("เลย") ? "late" : ""}`}><Icon name="clock" /><div><small>กำหนดส่ง {order.due}</small><b>{order.dueText}</b></div></div>
      <div className="customer-info">
        <div className="section-label">ข้อมูลลูกค้า</div>
        <div className="customer-name"><span><Icon name="user" /></span><div><b>{order.customer}</b><small>{order.source}</small></div></div>
        <button className="contact-row" onClick={() => flash(`โทรหา ${order.phone}`)}><Icon name="phone" size={18} /><span><small>เบอร์โทรศัพท์</small><b>{order.phone}</b></span><Icon name="arrow" size={17} /></button>
        <div className="address-box"><Icon name="map" /><div><small>ที่อยู่จัดส่ง</small><p>{order.address}</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer">เปิดใน Google Maps <Icon name="arrow" size={15} /></a></div></div>
      </div>
      <div className="detail-items"><div className="section-label">รายการสินค้า</div>{order.items.map((item) => <div key={item.name}><span>{item.name}</span><b>× {item.qty}</b></div>)}<div className="detail-total"><span>ยอดรวม</span><strong>฿{order.total.toLocaleString("th-TH")}</strong></div></div>
      <div className={`payment-box ${order.paid ? "paid" : "unpaid"}`}>
        <span><Icon name={order.paid ? "check" : "clock"} /></span><div><b>{order.paid ? "ชำระเงินแล้ว" : "ยังไม่ได้ชำระเงิน"}</b><small>{order.payment}</small></div>
        {order.slip && <button onClick={() => flash("เปิดดูสลิปการชำระเงิน")}><Icon name="file" size={16} /> ดูสลิป</button>}
      </div>
      <div style={{ padding: "16px 20px", borderTop: "1px solid #e7e0d3", display: "grid", gap: 10 }}>
        <div className="section-label">จัดการออเดอร์</div>
        {order.stage === "new" && <button className="outline-action" disabled={saving} onClick={() => editing ? setEditing(false) : void beginEdit()}><Icon name="edit" size={16} />{editing ? "ปิดการแก้ไข" : "แก้ไขจำนวนสินค้า / ที่อยู่"}</button>}
        {editing && <div style={{ display: "grid", gap: 10 }}>
          <label>ที่อยู่จัดส่ง<input style={{ width: "100%", padding: 10 }} value={address} onChange={e => setAddress(e.target.value)} /></label>
          {lines.map(line => <label key={line.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>{line.name}<input type="number" min="1" max="10000" step="1" style={{ width: 90, padding: 8 }} value={line.quantity} onChange={e => setLines(current => current.map(l => l.id === line.id ? { ...l, quantity: Number(e.target.value) } : l))} /></label>)}
          <small>แก้ไขได้เฉพาะออเดอร์รออนุมัติ ระบบจะคำนวณยอดรวมใหม่ตามราคาที่สั่งเดิม</small>
          <button className="primary-action" disabled={saving || lines.some(l => !Number.isInteger(l.quantity) || l.quantity < 1)} onClick={() => void saveEdit()}>บันทึกการแก้ไข</button>
        </div>}
        {order.stage !== "delivered" && order.stage !== "cancelled" && !order.paid && <>
          <input style={{ padding: 10, width: "100%" }} placeholder="เหตุผลการยกเลิก (จำเป็น)" value={reason} onChange={e => setReason(e.target.value)} />
          <button className="outline-action" style={{ color: "#aa473a" }} disabled={saving || !reason.trim()} onClick={() => void doCancel()}><Icon name="trash" size={16} /> ยกเลิกออเดอร์ (เก็บประวัติ)</button>
        </>}
        {order.paid && order.stage !== "cancelled" && <small>ออเดอร์ที่ชำระแล้วต้องจัดการคืนเงินก่อนยกเลิก</small>}
      </div>
      {order.stage === "new" ? (
        <div className="approval-box">{isTubOrder ? <><div style={{ display: "grid", gap: 6, marginBottom: 12 }}><b>วันจัดส่งที่ลูกค้าเลือก</b><span>{order.due}</span><small>ออเดอร์แบบถังใช้วันจัดส่งที่ลูกค้าเลือกไว้ ไม่ต้องกำหนดระยะเวลาเตรียมและจัดส่งใหม่</small></div></> : <><label><span>ระยะเวลาเตรียมและจัดส่ง</span><select value={leadDays} onChange={(e) => setLeadDays(Number(e.target.value))}>{[1, 2, 3, 4, 5, 7].map((day) => <option key={day} value={day}>{day} วัน</option>)}</select></label><p>ระบบจะแจ้งวันส่งโดยประมาณให้ลูกค้าทราบ · กล่องธรรมดาตัดสต็อกอัตโนมัติ</p></>}<button onClick={() => onAccept(order.id, leadDays)}><Icon name="check" /> อนุมัติออเดอร์</button></div>
      ) : (
        <div className="workflow">
          <div className="section-label">ขั้นตอนการจัดส่ง</div>
          {stageOrder.map((stage, index) => <div className={`workflow-step ${index <= stageIndex ? "done" : ""}`} key={stage}><span>{index < stageIndex || order.stage === "delivered" ? <Icon name="check" size={14} /> : index === stageIndex ? index + 1 : index + 1}</span><b>{stageLabels[stage]}</b></div>)}
          {order.stage !== "delivered" && order.stage !== "cancelled" && <button onClick={advance}><Icon name="check" /> ยืนยัน “{stageLabels[stageOrder[stageIndex + 1]]}”</button>}
        </div>
      )}
    </aside>
  );
}

function DeliveryView({ orders, onSelect }: { orders: Order[]; onSelect: (id: string) => void }) {
  const [selectedDate, setSelectedDate] = useState("");

  return (
    <section className="panel delivery-panel">
      <div className="page-section-head"><div><span className="eyebrow-admin"><Icon name="calendar" size={16} /> แผนงานจัดส่ง</span><h2>ออเดอร์ที่ต้องส่ง</h2><p>เรียงตามออเดอร์ที่ใกล้ถึงกำหนดที่สุด</p></div><button className="outline-action"><Icon name="calendar" size={18} /> ดูแบบปฏิทิน</button></div>
      <div className="delivery-table">
        <div className="table-head"><span>กำหนดส่ง</span><span>ลูกค้าและที่อยู่</span><span>การชำระเงิน</span><span>สถานะ</span><span /></div>
        {orders.filter((o) => o.stage !== "delivered").map((order) => <div className="delivery-row" key={order.id}>
          <div className="delivery-date"><b>{order.due}</b><small className={order.dueText.includes("เลย") ? "late" : ""}>{order.dueText}</small></div>
          <div className="delivery-customer"><b>{order.customer}</b><small>{order.address}</small><span><Icon name="phone" size={14} /> {order.phone}</span></div>
          <div><span className={`pay-tag ${order.paid ? "paid" : ""}`}>{order.paid ? order.payment : "ยังไม่ชำระ"}</span></div>
          <div><span className={`stage-tag ${order.stage}`}>{stageLabels[order.stage]}</span></div>
          <button className="row-action" onClick={() => onSelect(order.id)}>ดูรายละเอียด <Icon name="arrow" size={17} /></button>
        </div>)}
      </div>
    </section>
  );
}

type FinanceEntry = { id: string; date: string; type: "income" | "expense"; category: string; note: string; amount: number; source: string; locked: boolean; dayKey: string };
function FinanceView({ flash }: { flash: (message: string) => void }) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [period, setPeriod] = useState<0 | 1 | 3 | 6>(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (date: string) => new Date(date).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
  const dayKey = (date: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }

    return new Date(date).toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    });
  }; const [entryDate, setEntryDate] = useState(
    new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
    })
  );
  async function load() {
    setLoading(true); setError("");
    const [manual, orders] = await Promise.all([
      supabase.from("finance_entries").select("id,entry_type,description,amount,entry_date,created_at").order("entry_date", { ascending: false }),
      supabase.from("orders").select("id,order_number,total_amount,payment_status,status,order_date,created_at").eq("payment_status", "paid").neq("status", "cancelled").order("created_at", { ascending: false })
    ]);
    if (manual.error || orders.error) { setError(manual.error?.message || orders.error?.message || "โหลดบัญชีไม่สำเร็จ"); setLoading(false); return; }
    const manually: FinanceEntry[] = (manual.data ?? []).map((r: any) => ({ id: r.id, date: formatDate(r.entry_date), dayKey: dayKey(r.entry_date), type: r.entry_type, category: r.entry_type === "income" ? "รายรับอื่น ๆ" : "รายจ่าย", note: r.description, amount: Number(r.amount), source: "บันทึกเอง", locked: false }));
    const sales: FinanceEntry[] = (orders.data ?? []).map((r: any) => ({ id: `order:${r.id}`, date: formatDate(r.order_date ?? r.created_at), dayKey: dayKey(r.order_date ?? r.created_at), type: "income", category: "ยอดขายที่ชำระแล้ว", note: r.order_number, amount: Number(r.total_amount), source: "ออเดอร์", locked: true }));
    setEntries([...manually, ...sales].sort((x, y) => y.dayKey.localeCompare(x.dayKey)));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  // กำหนดช่วงวันที่ย้อนหลังตาม Dropdown
  const today = new Date();

  const startDate = new Date(today);

  if (period === 0) {
    startDate.setDate(startDate.getDate() - 6);
  } else {
    startDate.setMonth(startDate.getMonth() - period);
  }

  startDate.setHours(0, 0, 0, 0);


  // แปลงวันที่เป็น YYYY-MM-DD ตามเวลาไทย
  const thaiKey = (date: Date) =>
    date.toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  // กรองรายการบัญชีตามช่วงเวลาหรือวันที่ที่เลือก
  const filteredEntries = entries.filter((entry) => {
    if (selectedDate) {
      return entry.dayKey === selectedDate;
    }

    return (
      entry.dayKey >= thaiKey(startDate) &&
      entry.dayKey <= thaiKey(today)
    );
  });
  const income = filteredEntries
    .filter(e => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);

  const expense = filteredEntries
    .filter(e => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0);
  // กำหนดวันที่ปัจจุบันตามเวลาไทย
  const getThaiDateKey = (date: Date) =>
    date.toLocaleDateString("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  // วันที่สิ้นสุดช่วงที่เลือก
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  // วันที่เริ่มต้นย้อนหลังตามจำนวนเดือน
  const chartStartDate = new Date();

  if (period === 0) {
    // 7 วันล่าสุด รวมวันนี้ด้วย
    chartStartDate.setDate(chartStartDate.getDate() - 6);
  } else {
    // ย้อนหลังตามจำนวนเดือนที่เลือก
    chartStartDate.setMonth(chartStartDate.getMonth() - period);
  }

  chartStartDate.setHours(0, 0, 0, 0);

  // สร้างรายการวันที่สำหรับกราฟ
  const chartData: {
    key: string;
    label: string;
    income: number;
    expense: number;
  }[] = [];

  // แปลงวันที่เป็น YYYY-MM-DD ตามเวลาไทย


  // รวมรายรับรายจ่ายภายในช่วงวันที่
  const sumRange = (start: string, end: string) => {
    const items = entries.filter(
      (e) => e.dayKey >= start && e.dayKey <= end
    );

    return {
      income: items
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + e.amount, 0),

      expense: items
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + e.amount, 0),
    };
  };

  if (selectedDate) {
    // เลือกวันที่จากปฏิทิน: แสดงเฉพาะวันนั้น
    chartData.push({
      key: selectedDate,
      label: new Date(`${selectedDate}T12:00:00`)
        .toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        }),
      ...sumRange(selectedDate, selectedDate),
    });

  } else if (period === 0) {
    // 7 วันล่าสุด: แสดงรายวัน
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      const key = thaiKey(date);

      chartData.push({
        key,
        label: date.toLocaleDateString("th-TH", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
        ...sumRange(key, key),
      });
    }

  } else if (period === 1) {
    // 1 เดือนย้อนหลัง: แสดงรายสัปดาห์
    // แต่ละกลุ่มมีสูงสุด 7 วัน โดยเริ่มจากวันแรกของช่วงที่เลือก
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setMonth(start.getMonth() - 1);

    let week = 1;
    const cursor = new Date(start);

    while (cursor <= today) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);

      if (weekEnd > today) {
        weekEnd.setTime(today.getTime());
      }

      chartData.push({
        key: `week-${week}`,
        label: `สัปดาห์ ${week}`,
        ...sumRange(thaiKey(weekStart), thaiKey(weekEnd)),
      });

      cursor.setDate(cursor.getDate() + 7);
      week++;
    }

  } else {
    // 3 หรือ 6 เดือนย้อนหลัง: แสดงรายเดือน
    const today = new Date();

    for (let i: number = period; i >= 0; i--) {
      const monthStart = new Date(
        today.getFullYear(),
        today.getMonth() - i,
        1
      );

      const monthEnd = new Date(
        today.getFullYear(),
        today.getMonth() - i + 1,
        0
      );

      const start =
        i === period
          ? new Date(
            today.getFullYear(),
            today.getMonth() - period,
            today.getDate()
          )
          : monthStart;

      const end = i === 0 ? today : monthEnd;

      if (start > end) continue;

      chartData.push({
        key: thaiKey(monthStart),
        label: monthStart.toLocaleDateString("th-TH", {
          month: "short",
          year: "2-digit",
        }),
        ...sumRange(thaiKey(start), thaiKey(end)),
      });
    }
  }
  const maxBar = Math.max(
    1,
    ...chartData.flatMap((d) => [d.income, d.expense])
  );
  async function addEntry(e: React.FormEvent) {
    e.preventDefault(); if (!note.trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return;
    setBusy(true); setError("");
    const { error } = await supabase
      .from("finance_entries")
      .insert({
        entry_type: type,
        description: note.trim(),
        amount: Number(amount),
        entry_date: entryDate,
      });
    if (error) setError(error.message); else { setNote(""); setAmount(""); setFormOpen(false); await load(); flash("บันทึกรายการบัญชีลง Supabase แล้ว"); }
    setBusy(false);
  }
  async function removeEntry(entry: FinanceEntry) {
    if (entry.locked || !window.confirm(`ลบรายการ ${entry.note} ใช่หรือไม่?`)) return;
    setBusy(true); setError(""); const { error } = await supabase.from("finance_entries").delete().eq("id", entry.id);
    if (error) setError(error.message); else { await load(); flash("ลบรายการบัญชีแล้ว"); } setBusy(false);
  }
  return <>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        flexWrap: "wrap",
        marginBottom: "24px",
      }}
    >
      {/* Dropdown เลือกช่วงเวลา */}
      <label>เลือกช่วงเวลา:</label>

      <select
        value={period}
        onChange={(e) => {
          setPeriod(Number(e.target.value) as 0 | 1 | 3 | 6);
          setSelectedDate("");
        }}
        style={{
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid #D9CDBD",
          background: "#D6B89C",
          color: "#4E3728",
          fontWeight: 600,
        }}
      >
        <option value={0}>7 วันล่าสุด</option>
        <option value={1}>ย้อนหลัง 1 เดือน</option>
        <option value={3}>ย้อนหลัง 3 เดือน</option>
        <option value={6}>ย้อนหลัง 6 เดือน</option>
      </select>

      {/* ปุ่มปฏิทินและช่องวันที่ */}
      {!showCalendar ? (
        <button
          type="button"
          onClick={() => setShowCalendar(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px 16px",
            background: "#FFFDF8",
            color: "#536A56",
            border: "1px solid #D9CDBD",
            borderRadius: "10px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 10h18" />
            <path d="M8 14h2M14 14h2M8 17h2" />
          </svg>

          <span>ดูแบบปฏิทิน</span>
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{
              padding: "11px 14px",
              border: "1px solid #D9CDBD",
              borderRadius: "10px",
              background: "#FFFDF8",
              color: "#4E3728",
            }}
          />

          <button
            type="button"
            onClick={() => {
              setShowCalendar(false);
              setSelectedDate("");
              setPeriod(0);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#80624F",
              cursor: "pointer",
            }}
          >
            กลับ
          </button>
        </div>
      )}
    </div>
    <div className="finance-top">
      <div className="finance-stat income"><small>รายรับทั้งหมด</small><strong>฿{money(income)}</strong><span>ยอดชำระแล้ว + รายรับบันทึกเอง</span></div>
      <div className="finance-stat expense"><small>รายจ่ายทั้งหมด</small><strong>฿{money(expense)}</strong><span>จากรายการรายจ่ายที่บันทึก</span></div>
      <div className="finance-stat profit"><small>ยอดคงเหลือสุทธิ</small><strong>฿{money(income - expense)}</strong><span>รายรับ − รายจ่าย (ไม่ใช่กำไรทางบัญชี)</span></div>
    </div>
    {error && <p role="alert" style={{ color: "#a32727", padding: 12 }}>Supabase: {error}</p>}
    {loading && <p>กำลังโหลดข้อมูลบัญชี...</p>}
    <section className="panel finance-chart-panel"><div className="page-section-head"><div><h2>ภาพรวมรายรับ–รายจ่าย</h2><p>
      {selectedDate
        ? "ข้อมูลเฉพาะวันที่เลือก · เวลาไทย"
        : period === 0
          ? "ข้อมูลจริง 7 วันล่าสุด · รายวัน"
          : period === 1
            ? "ข้อมูลย้อนหลัง 1 เดือน · รายสัปดาห์"
            : `ข้อมูลย้อนหลัง ${period} เดือน · รายเดือน`}
    </p></div><div className="chart-key"><span className="green" /> รายรับ <span className="brown" /> รายจ่าย</div></div>
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div
          className="big-chart"
          style={{
            minWidth: period === 0 ? "100%" : `${chartData.length * 52}px`,
          }}
        >
          {chartData.map(d => (
            <div className="chart-col" key={d.key}>
              <div>
                <i
                  title={`รายรับ ฿${money(d.income)}`}
                  style={{ height: `${d.income / maxBar * 100}%` }}
                />
                <i
                  title={`รายจ่าย ฿${money(d.expense)}`}
                  style={{ height: `${d.expense / maxBar * 100}%` }}
                />
              </div>
              <small>{d.label}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
    <section className="panel finance-table-panel"><div className="page-section-head"><div><h2>ตารางบัญชี</h2><p>ยอดขายมาจากออเดอร์ที่ชำระแล้ว · รายจ่ายและรายรับอื่นเพิ่มได้เอง</p></div><div className="finance-actions"><button className="outline-action" onClick={() => void load()} disabled={busy || loading}>รีเฟรชข้อมูล</button><button className="primary-action" onClick={() => setFormOpen(!formOpen)} disabled={busy}><Icon name={formOpen ? "close" : "plus"} size={17} />{formOpen ? "ปิด" : "เพิ่มรายการ"}</button></div></div>
      {formOpen && <form className="finance-form" onSubmit={e => void addEntry(e)}><div className="type-toggle"><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>รายรับ</button><button type="button" className={type === "expense" ? "active expense" : ""} onClick={() => setType("expense")}>รายจ่าย</button></div>
        <div style={{ display: "flex", gap: "12px", alignItems: "end" }}>
          <label style={{ width: "170px", flexShrink: 0 }}>
            <span>วันที่ทำรายการ</span>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box" }}
              required
            />
          </label>

          <label style={{ flex: 1, minWidth: 0 }}>
            <span>รายละเอียด</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ซื้อวัตถุดิบเพิ่ม"
              required
            />
          </label>
        </div><label><span>จำนวนเงิน</span><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></label>
        <button className="primary-action" type="submit" disabled={busy}><Icon name="check" size={17} />บันทึกลง Supabase</button></form>}
      <div className="account-table"><div className="table-head"><span>วันที่</span><span>ประเภท</span><span>รายละเอียด</span><span>แหล่งข้อมูล</span><span>จำนวนเงิน</span><span /></div>
        {filteredEntries.map(entry => <div className="account-row" key={entry.id}><span>{entry.date}</span><span className={`entry-type ${entry.type}`}>{entry.type === "income" ? "รายรับ" : "รายจ่าย"}</span><div><b>{entry.category}</b><small>{entry.note}</small></div><span className="source-tag"><Icon name={entry.locked ? "bag" : "edit"} size={14} />{entry.source}</span><strong className={entry.type}>{entry.type === "income" ? "+" : "−"}฿{money(entry.amount)}</strong>{entry.locked ? <span title="รายการออเดอร์แก้ไขจากหน้าบัญชีไม่ได้">—</span> : <button disabled={busy} aria-label="ลบรายการ" onClick={() => void removeEntry(entry)}><Icon name="trash" size={17} /></button>}</div>)}
        {!loading && filteredEntries.length === 0 && (
          <p style={{ padding: 16 }}>
            ไม่มีรายการบัญชีในช่วงเวลาที่เลือก
          </p>
        )}      </div>
    </section>
  </>;
}

function ProductsView({ products, refresh, loading, error, flash }: { products: Product[]; refresh: () => Promise<void>; loading: boolean; error: string; flash: (message: string) => void }) {
  const [open, setOpen] = useState(false), [name, setName] = useState(""), [price, setPrice] = useState(""), [quantity, setQuantity] = useState("0"), [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  async function add(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setActionError("");
    const { error } = await supabase.rpc("admin_create_catalog_product", { p_name: name.trim(), p_price: Number(price), p_quantity: Number(quantity) });
    if (error) setActionError(error.message);
    else { setName(""); setPrice(""); setQuantity("0"); setOpen(false); await refresh(); flash("เพิ่มสินค้าใน Supabase แล้ว"); }
    setBusy(false);
  }
  async function adjust(id: string, delta: number) {
    setBusy(true); setActionError("");
    const { error } = await supabase.rpc("admin_adjust_catalog_stock", { p_product_id: id, p_delta: delta });
    if (error) setActionError(error.message); else { await refresh(); flash("อัปเดตสต็อกใน Supabase แล้ว"); }
    setBusy(false);
  }
  async function hide(id: string, label: string) {
    if (!window.confirm(`ซ่อนสินค้า "${label}" จากหน้าร้านและแอดมิน? ประวัติออเดอร์เดิมจะยังอยู่`)) return;
    setBusy(true); setActionError("");
    const { error } = await supabase.rpc("admin_hide_catalog_product", { p_product_id: id });
    if (error) setActionError(error.message); else { await refresh(); flash("ซ่อนสินค้าแล้ว (ไม่ลบประวัติออเดอร์)"); }
    setBusy(false);
  }
  return <section className="panel catalog-panel">
    <div className="page-section-head"><div><span className="eyebrow-admin"><Icon name="store" size={16} /> สินค้าพร้อมขาย</span><h2>รสชาติไอศกรีม</h2><p>เชื่อม Supabase products และ product_stock โดยตรง</p></div><button className="primary-action" disabled={busy} onClick={() => setOpen(!open)}><Icon name={open ? "close" : "plus"} size={18} />{open ? "ปิด" : "เพิ่มรสชาติ"}</button></div>
    {(error || actionError) && <p role="alert" style={{ color: "#a32727", padding: "12px" }}>เชื่อมต่อสินค้าไม่สำเร็จ: {error || actionError}</p>}
    {open && <form className="catalog-form" onSubmit={add}><label><span>ชื่อรสชาติ</span><input value={name} onChange={e => setName(e.target.value)} minLength={2} required /></label><label><span>ราคาต่อกล่อง</span><input type="number" min="0.01" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required /></label><label><span>สต็อกเริ่มต้น (กล่อง)</span><input type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} required /></label><button className="primary-action" disabled={busy} type="submit"><Icon name="check" size={17} /> บันทึกลง Supabase</button></form>}
    {loading && <p>กำลังโหลดสินค้า...</p>}
    {!loading && !error && products.length === 0 && <p>ยังไม่มีสินค้าใน products</p>}
    <div className="catalog-grid">{products.map(product => <article className="catalog-card" key={product.id}><span className="flavor-color" style={{ background: product.color }} /><div><small>ไอศกรีมโฮมเมด</small><h3>{product.name}</h3><b>฿{product.price} / กล่อง</b></div><div className={`catalog-stock ${product.stock <= 5 ? "low" : ""}`}><small>คงเหลือ</small><strong>{product.stock}</strong><span>กล่อง</span></div><div className="stock-buttons"><button disabled={busy} onClick={() => void adjust(product.id, -1)}><Icon name="minus" size={16} /> ลดสต็อก</button><button disabled={busy} onClick={() => void adjust(product.id, 1)}><Icon name="plus" size={16} /> เพิ่มสต็อก</button><button disabled={busy} className="delete" aria-label={`ซ่อน${product.name}`} onClick={() => void hide(product.id, product.name)}><Icon name="trash" size={16} /></button></div></article>)}</div>
  </section>;
}

type Ingredient = { id: string; name: string; quantity: number; unit: string; minimum: number; category: string };

function IngredientsView({ flash }: { flash: (message: string) => void }) {
  const [items, setItems] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [quantity, setQuantity] = useState("0");
  const [unit, setUnit] = useState("กก."); const [minimum, setMinimum] = useState("5");
  const [category, setCategory] = useState("รายการอื่น ๆ");
  async function load() {
    setLoading(true); setError("");
    const { data, error } = await supabase.from("ingredients").select("id,name,quantity,unit,minimum,category").eq("is_active", true).order("created_at");
    if (error) setError(error.message);
    else setItems((data ?? []).map((row: any) => ({ ...row, quantity: Number(row.quantity), minimum: Number(row.minimum) })));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  const low = items.filter((item) => item.quantity <= item.minimum).length;
  async function add(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    const { error } = await supabase.rpc("admin_create_ingredient", { p_name: name.trim(), p_quantity: Number(quantity), p_unit: unit, p_minimum: Number(minimum), p_category: category });
    if (error) setError(error.message);
    else { setName(""); setQuantity("0"); setOpen(false); await load(); flash("เพิ่มวัตถุดิบใน Supabase แล้ว"); }
    setBusy(false);
  }
  async function adjust(id: string, delta: number) {
    setBusy(true); setError("");
    const { error } = await supabase.rpc("admin_adjust_ingredient", { p_ingredient_id: id, p_delta: delta });
    if (error) setError(error.message); else { await load(); flash("อัปเดตสต็อกวัตถุดิบแล้ว"); }
    setBusy(false);
  }
  async function remove(item: Ingredient) {
    if (!window.confirm(`ซ่อนวัตถุดิบ ${item.name} จากคลัง?`)) return;
    setBusy(true); setError("");
    const { error } = await supabase.rpc("admin_hide_ingredient", { p_ingredient_id: item.id });
    if (error) setError(error.message); else { await load(); flash("ซ่อนวัตถุดิบแล้ว"); }
    setBusy(false);
  }
  return <section className="panel ingredient-page"><div className="page-section-head"><div><span className="eyebrow-admin"><Icon name="box" size={16} /> คลังสำหรับผลิต</span><h2>วัตถุดิบทั้งหมด</h2><p>ข้อมูลจาก Supabase ตาราง ingredients — เพิ่ม ลด และซ่อนวัตถุดิบได้</p></div><div className="ingredient-head-actions">{low > 0 && <span className="low-warning">{low} รายการใกล้หมด</span>}<button disabled={busy} className="primary-action" onClick={() => setOpen(!open)}><Icon name={open ? "close" : "plus"} size={17} /> {open ? "ปิด" : "เพิ่มวัตถุดิบ"}</button></div></div>
    {error && <p role="alert" style={{ color: "#a32727", padding: 12 }}>Supabase: {error}</p>}
    {open && <form className="ingredient-add-form" onSubmit={add}><label><span>ชื่อวัตถุดิบ</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น อัลมอนด์" minLength={2} required /></label><label><span>จำนวน</span><input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required /></label><label><span>หน่วย</span><select value={unit} onChange={(e) => setUnit(e.target.value)}><option>กก.</option><option>กรัม</option><option>ลิตร</option><option>ถุง</option><option>ลูก</option><option>ชุด</option></select></label><label><span>จุดเตือนสต็อก</span><input type="number" min="0" step="1" value={minimum} onChange={e => setMinimum(e.target.value)} required /></label><label><span>ประเภท</span><select value={category} onChange={e => setCategory(e.target.value)}><option>รายการอื่น ๆ</option><option>ของแห้ง</option><option>ควบคุมความเย็น</option><option>วัตถุดิบสด</option><option>ผลิตภัณฑ์นม</option><option>บรรจุภัณฑ์</option></select></label><button disabled={busy} className="primary-action"><Icon name="check" size={17} /> บันทึก</button></form>}
    {loading && <p>กำลังโหลดวัตถุดิบ...</p>}
    {!loading && !error && items.length === 0 && <p>ยังไม่มีวัตถุดิบ กดเพิ่มวัตถุดิบเพื่อเริ่มต้น</p>}
    <div className="ingredient-grid">{items.map((item) => { const isLow = item.quantity <= item.minimum; return <article className={`ingredient-card ${isLow ? "low" : ""}`} key={item.id}><div className="ingredient-card-head"><span><Icon name={item.category === "วัตถุดิบสด" ? "leaf" : "box"} /></span><button disabled={busy} aria-label={`ลบ${item.name}`} onClick={() => void remove(item)}><Icon name="trash" size={17} /></button></div><small>{item.category}</small><h3>{item.name}</h3><div className="ingredient-count"><strong>{item.quantity}</strong><span>{item.unit}</span>{isLow && <em>ควรเติมสต็อก</em>}</div><div className="ingredient-stepper"><button disabled={busy || item.quantity === 0} onClick={() => void adjust(item.id, -1)}><Icon name="minus" size={16} /> นำออก</button><button disabled={busy} onClick={() => void adjust(item.id, 1)}><Icon name="plus" size={16} /> เพิ่มเข้า</button></div></article>; })}</div>
  </section>;
}

function MembersView({ members, setMembers, flash }: {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  flash: (message: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [memberError, setMemberError] = useState("");
  async function loadMembers() {
    setLoading(true); setMemberError("");
    const { data, error } = await supabase.from("customers")
      .select("id,profile_id,is_member,points_balance,phone,profiles!customers_profile_id_fkey(full_name,phone),orders(id,created_at)")
      .eq("is_member", true).order("created_at", { ascending: false });
    if (error) setMemberError(error.message);
    else {
      const mapped: Member[] = (data ?? []).map((c: any) => {
        const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        const orders = c.orders ?? [];
        const latest = orders.reduce((last: string, o: any) => !last || o.created_at > last ? o.created_at : last, "");
        return {
          id: c.id, name: profile?.full_name || "สมาชิก",
          phone: c.phone || profile?.phone || "-",
          points: Number(c.points_balance ?? 0), visits: orders.length,
          lastPurchase: latest ? new Date(latest).toLocaleDateString("th-TH") : "ยังไม่มีรายการ"
        };
      });
      setMembers(mapped);
      setSelectedId(previous => mapped.some(m => m.id === previous) ? previous : (mapped[0]?.id ?? ""));
    }
    setLoading(false);
  }
  useEffect(() => { void loadMembers(); }, []);
  const selected = members.find(member => member.id === selectedId) ?? members[0];
  const earnedPoints = Math.floor(Math.max(0, Number(amount) || 0) / 10);
  const filtered = members.filter(member => `${member.name}${member.phone}`.toLowerCase().includes(query.toLowerCase()));
  const totalPoints = members.reduce((sum, member) => sum + member.points, 0);
  async function addPoints(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || earnedPoints < 1 || busy) return;
    setBusy(true); setMemberError("");
    const { error } = await supabase.rpc("admin_record_customer_purchase", {
      p_customer_id: selected.id, p_amount: Number(amount)
    });
    if (error) setMemberError(error.message);
    else { setAmount(""); await loadMembers(); flash(`เพิ่ม ${earnedPoints} แต้มให้ ${selected.name} แล้ว`); }
    setBusy(false);
  }
  return (
    <>
      <div className="overview-grid member-overview">
        <SummaryCard icon="users" label="สมาชิกทั้งหมด" value={`${members.length}`} note="บัญชีลูกค้าจาก Supabase" />
        <SummaryCard icon="star" label="แต้มสะสมรวม" value={totalPoints.toLocaleString("th-TH")} note="แต้มของสมาชิกทั้งหมด" />
        <SummaryCard icon="store" label="สมาชิกมาใช้บริการ" value={`${members.filter(member => member.lastPurchase === new Date().toLocaleDateString("th-TH")).length}`} note="รายการวันนี้" />
        <SummaryCard icon="card" label="อัตราการรับแต้ม" value="10 ฿ = 1" note="ปัดเศษลงอัตโนมัติ" />
      </div>
      <div className="members-layout">
        <section className="panel member-list-panel">
          <div className="panel-head member-panel-head">
            <div><h2>รายชื่อสมาชิก</h2><p>ลูกค้าที่สมัครผ่าน Ordering และมี is_member = true</p></div>
            <button className="primary-action" disabled={loading} onClick={() => void loadMembers()}><Icon name="refresh" size={17} /> รีเฟรช</button>
          </div>
          {memberError && <p role="alert" style={{ color: "#b13c27", padding: 12 }}>Supabase: {memberError}</p>}
          {loading && <p style={{ padding: 12 }}>กำลังโหลดสมาชิก...</p>}
          <div className="member-search-wrap"><label className="management-search"><Icon name="search" size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาชื่อหรือเบอร์โทร" /></label></div>
          <div className="member-list">
            {filtered.map(member => <button key={member.id} className={`member-row ${selected?.id === member.id ? "active" : ""}`} onClick={() => setSelectedId(member.id)}>
              <span className="member-avatar">{member.name.replace("คุณ", "").trim().slice(0, 1)}</span>
              <span className="member-identity"><b>{member.name}</b><small>{member.phone} · มีออเดอร์ {member.visits} รายการ</small></span>
              <span className="member-points"><strong>{member.points.toLocaleString("th-TH")}</strong><small>แต้มสะสม</small></span>
              <Icon name="arrow" size={17} />
            </button>)}
            {!loading && filtered.length === 0 && <div className="member-empty">ไม่พบสมาชิกที่ค้นหา</div>}
          </div>
        </section>
        <aside className="panel points-panel">
          {selected ? <>
            <div className="points-member-head"><span className="member-avatar large">{selected.name.replace("คุณ", "").trim().slice(0, 1)}</span><div><small>กำลังเพิ่มแต้มให้</small><h2>{selected.name}</h2><p>{selected.phone}</p></div></div>
            <div className="current-points"><span><Icon name="star" /></span><div><small>แต้มคงเหลือปัจจุบัน</small><strong>{selected.points.toLocaleString("th-TH")} <em>แต้ม</em></strong></div></div>
            <form className="points-form" onSubmit={addPoints}>
              <div className="section-label">บันทึกยอดซื้อหน้าร้าน</div>
              <label><span>ยอดที่ลูกค้าชำระ</span><div className="purchase-input"><b>฿</b><input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" /></div></label>
              <div className="points-calculation">
                <div><small>แต้มที่จะได้รับ</small><strong>{earnedPoints.toLocaleString("th-TH")} <span>แต้ม</span></strong></div><Icon name="arrow" />
                <div><small>ยอดแต้มหลังบันทึก</small><strong>{(selected.points + earnedPoints).toLocaleString("th-TH")} <span>แต้ม</span></strong></div>
              </div>
              <p className="points-rule"><Icon name="check" size={15} /> ทุกยอดซื้อ 10 บาท รับ 1 แต้ม เศษไม่ครบ 10 บาทไม่สะสม</p>
              <button className="points-submit" type="submit" disabled={earnedPoints < 1 || busy}><Icon name="star" size={18} /> ยืนยันเพิ่ม {earnedPoints.toLocaleString("th-TH")} แต้ม</button>
            </form>
            <div className="member-history"><span>ใช้บริการล่าสุด</span><b>{selected.lastPurchase}</b></div>
          </> : <div className="member-empty">ยังไม่มีสมาชิกในระบบ</div>}
        </aside>
      </div>
    </>
  );
}

export default App;
