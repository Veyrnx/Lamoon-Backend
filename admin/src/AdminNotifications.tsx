import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabase";
import "./AdminNotifications.css";

type Notification = {
  id: string;
  order_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  scheduled_delivery_at: string;
};

export default function AdminNotifications({ onOpenOrder }: { onOpenOrder: (orderId: string) => void }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 80, right: 16 });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPosition({ top: rect.bottom + 12, right: Math.max(12, window.innerWidth - rect.right) });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => { window.removeEventListener("resize", updatePosition); window.removeEventListener("scroll", updatePosition, true); };
  }, [open]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error: queryError } = await supabase
        .from("admin_order_notifications")
        .select("id,order_id,title,message,is_read,created_at,scheduled_delivery_at")
        .eq("notification_type", "tub_delivery_2h")
        .order("created_at", { ascending: false })
        .limit(50);
      if (!alive) return;
      if (queryError) setError(`ไม่สามารถโหลดแจ้งเตือนได้: ${queryError.message}`);
      else { setItems((data ?? []) as Notification[]); setError(""); }
    }
    void load();
    const channel = supabase.channel("lamoon-admin-tub-reminders")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_order_notifications" }, () => { void load(); })
      .subscribe();
    // Fallback when Realtime is not enabled or temporarily disconnected.
    const interval = window.setInterval(() => { void load(); }, 60_000);
    return () => { alive = false; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function markRead(item: Notification) {
    if (item.is_read) return true;
    setBusyId(item.id);
    const { error: updateError } = await supabase
      .from("admin_order_notifications")
      .update({ is_read: true })
      .eq("id", item.id);
    setBusyId(null);
    if (updateError) { setError(`บันทึกสถานะการอ่านไม่สำเร็จ: ${updateError.message}`); return false; }
    setItems((current) => current.map((n) => n.id === item.id ? { ...n, is_read: true } : n));
    setError("");
    return true;
  }

  const unread = items.filter((n) => !n.is_read).length;
  return (
    <div className="lamoon-notify" ref={root}>
      <button type="button" className="notification lamoon-notify-button" aria-label={`การแจ้งเตือนที่ยังไม่ได้อ่าน ${unread} รายการ`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {unread > 0 && <span className="lamoon-notify-count">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && createPortal(<section ref={panel} className="lamoon-notify-panel" style={{ top: panelPosition.top, right: panelPosition.right }} aria-label="รายการแจ้งเตือนออเดอร์แบบถัง">
        <div className="lamoon-notify-heading"><strong>แจ้งเตือนจัดส่งแบบถัง</strong><span>ยังไม่อ่าน {unread}</span></div>
        {error && <p className="lamoon-notify-error" role="alert">{error}</p>}
        {items.length === 0 && !error && <p className="lamoon-notify-empty">ยังไม่มีการแจ้งเตือน</p>}
        <div className="lamoon-notify-list">
          {items.map((item) => <article className={`lamoon-notify-item ${item.is_read ? "" : "is-unread"}`} key={item.id}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <small>แจ้งเมื่อ {new Date(item.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" })}</small>
            <div className="lamoon-notify-actions">
              <button type="button" onClick={async () => { if (await markRead(item)) { onOpenOrder(item.order_id); setOpen(false); } }}>ดูออเดอร์</button>
              {!item.is_read && <button type="button" disabled={busyId === item.id} onClick={() => { void markRead(item); }}>อ่านแล้ว</button>}
            </div>
          </article>)}
        </div>
      </section>, document.body)}
    </div>
  );
}
