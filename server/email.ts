import { and, eq } from "drizzle-orm";
import { emailLogs, orderItems, orders } from "@db/schema";
import { getDb } from "./queries/connection";

const money = (value: number) => `৳${value.toLocaleString("en-BD")}`;
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);

type EmailOrder = Pick<typeof orders.$inferSelect, "orderNumber" | "customerName" | "phone" | "address" | "area" | "district" | "subtotal" | "deliveryFee" | "total">;
type EmailItem = Pick<typeof orderItems.$inferSelect, "productName" | "category" | "sizeMl" | "quantity" | "lineTotal">;

export function buildOrderEmail(order: EmailOrder, items: EmailItem[]) {
  const rows = items.map((item) => `<tr><td style="padding:12px 0;border-bottom:1px solid #d8d1c5">${escapeHtml(item.productName)}<br><small>${item.category} · ${item.sizeMl}ml × ${item.quantity}</small></td><td style="padding:12px 0;border-bottom:1px solid #d8d1c5;text-align:right">${money(item.lineTotal)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#CEC9BD;font-family:Arial,sans-serif;color:#4D0220"><div style="max-width:640px;margin:auto;background:#f4f0e7"><div style="background:#4D0220;color:#CEC9BD;padding:32px"><div style="font-family:Georgia,serif;font-size:30px;letter-spacing:5px">DEQANT</div><div style="font-size:10px;letter-spacing:6px;margin-top:6px">FRAGRANCE</div></div><div style="padding:32px"><p style="font-size:12px;letter-spacing:3px">ORDER ${order.orderNumber}</p><h1 style="font-family:Georgia,serif;font-weight:400">Your scent is being prepared.</h1><p>${escapeHtml(order.customerName)} · ${escapeHtml(order.phone)}<br>${escapeHtml(order.address)}, ${escapeHtml(order.area)}, ${escapeHtml(order.district)}</p><table style="width:100%;border-collapse:collapse">${rows}</table><p>Subtotal <strong style="float:right">${money(order.subtotal)}</strong></p><p>Delivery <strong style="float:right">${money(order.deliveryFee)}</strong></p><p style="font-size:20px">Total <strong style="float:right">${money(order.total)}</strong></p><p style="font-size:12px">Payment: Cash on delivery</p></div></div></body></html>`;
}

export async function sendOrderNotifications(orderId: number) {
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const html = buildOrderEmail(order, items);
  const recipients: Array<{ kind: "owner" | "customer"; email: string }> = [
    { kind: "owner", email: process.env.OWNER_EMAIL || "owner@not-configured.local" },
    ...(order.email ? [{ kind: "customer" as const, email: order.email }] : []),
  ];
  const apiKey = process.env.RESEND_API_KEY;
  for (const recipient of recipients) {
    if (!recipient.email) continue;
    const [existing] = await db.select().from(emailLogs).where(and(eq(emailLogs.orderId, orderId), eq(emailLogs.kind, recipient.kind))).limit(1);
    if (existing?.status === "sent") continue;
    if (!apiKey) {
      if (existing) await db.update(emailLogs).set({ status: "not_configured", error: "RESEND_API_KEY is not configured" }).where(eq(emailLogs.id, existing.id));
      else await db.insert(emailLogs).values({ orderId, recipient: recipient.email, kind: recipient.kind, status: "not_configured", error: "RESEND_API_KEY is not configured" });
      continue;
    }
    const logId = existing?.id ?? (await db.insert(emailLogs).values({ orderId, recipient: recipient.email, kind: recipient.kind, status: "pending" }).$returningId())[0].id;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? "DEQANT <orders@resend.dev>", to: [recipient.email], subject: `DEQANT order ${order.orderNumber}`, html }),
      });
      if (!response.ok) throw new Error(`Resend returned ${response.status}`);
      await db.update(emailLogs).set({ status: "sent", attempts: (existing?.attempts ?? 0) + 1, error: null }).where(eq(emailLogs.id, logId));
    } catch (error) {
      await db.update(emailLogs).set({ status: "failed", attempts: (existing?.attempts ?? 0) + 1, error: error instanceof Error ? error.message : "Email failed" }).where(eq(emailLogs.id, logId));
    }
  }
}
