import { money } from "@/lib/format";
import { trpc } from "@/providers/trpc";

export function AdminCoupons() {
  const utils = trpc.useUtils();
  const coupons = trpc.admin.coupons.useQuery();
  const save = trpc.admin.saveCoupon.useMutation({ onSuccess: () => utils.admin.coupons.invalidate() });
  return <section><div className="admin-panel"><h2>Discount codes</h2><p>Coupons are validated and recalculated by the server during cash-on-delivery checkout.</p>
    <form className="admin-coupon-form" onSubmit={(event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      save.mutate({
        code: String(data.get("code")).toUpperCase(),
        discountType: String(data.get("discountType")) as "percent" | "fixed",
        discountValue: Number(data.get("discountValue")),
        minSubtotal: Number(data.get("minSubtotal") || 0),
        maxDiscount: data.get("maxDiscount") ? Number(data.get("maxDiscount")) : null,
        usageLimit: data.get("usageLimit") ? Number(data.get("usageLimit")) : null,
        expiresAt: data.get("expiresAt") ? new Date(String(data.get("expiresAt")) + "T23:59:59") : null,
        active: true,
      }, { onSuccess: () => form.reset() });
    }}>
      <h3>Create a coupon</h3><div className="admin-form-grid">
        <label>Code<input name="code" required maxLength={40} placeholder="WELCOME10"/></label>
        <label>Discount type<select name="discountType"><option value="percent">Percentage</option><option value="fixed">Fixed amount (৳)</option></select></label>
        <label>Discount value<input name="discountValue" type="number" min="1" required/></label>
        <label>Minimum subtotal (৳)<input name="minSubtotal" type="number" min="0" defaultValue="0"/></label>
        <label>Maximum discount (৳)<input name="maxDiscount" type="number" min="1"/></label>
        <label>Usage limit<input name="usageLimit" type="number" min="1"/></label>
        <label>Expiry date<input name="expiresAt" type="date"/></label>
      </div><button className="button button-burgundy" disabled={save.isPending}>Create coupon</button>
    </form>
    <div className="admin-coupon-list">{coupons.data?.map((coupon) => <article key={coupon.id}>
      <div><strong>{coupon.code}</strong><small>{coupon.discountType === "percent" ? coupon.discountValue + "% off" : money(coupon.discountValue) + " off"} · {coupon.usageCount}{coupon.usageLimit ? " / " + coupon.usageLimit : ""} uses</small></div>
      <span className={coupon.active ? "status status-delivered" : "status status-cancelled"}>{coupon.active ? "active" : "inactive"}</span>
      <button className="text-link" onClick={() => save.mutate({ id: coupon.id, code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue, minSubtotal: coupon.minSubtotal, maxDiscount: coupon.maxDiscount, usageLimit: coupon.usageLimit, expiresAt: coupon.expiresAt, active: !coupon.active })}>{coupon.active ? "Deactivate" : "Activate"}</button>
    </article>)}</div>
  </div></section>;
}

export function AdminReviews() {
  const utils = trpc.useUtils();
  const reviews = trpc.admin.reviews.useQuery();
  const moderate = trpc.admin.moderateReview.useMutation({ onSuccess: () => utils.admin.reviews.invalidate() });
  return <section><div className="admin-panel"><h2>Customer reviews</h2><p>Only verified delivered-order reviews can be published.</p>
    {reviews.data?.map(({ review, productName, customerName }) => <article className="admin-review-row" key={review.id}>
      <div><strong>{productName} · {customerName || "Customer"}</strong><small>{"★".repeat(review.rating)} · {review.title}</small><p>{review.body}</p><small>{review.createdAt.toLocaleString()} · {review.status}</small></div>
      {review.status === "pending" && <div><button className="button button-burgundy" onClick={() => moderate.mutate({ id: review.id, status: "approved" })}>Approve</button><button className="text-link danger" onClick={() => moderate.mutate({ id: review.id, status: "rejected" })}>Reject</button></div>}
    </article>)}
  </div></section>;
}
