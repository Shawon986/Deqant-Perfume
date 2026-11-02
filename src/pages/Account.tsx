import { Link } from "react-router";
import { ArrowRight, LogOut, MapPin, PackageSearch, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { LoadingState, PageShell } from "@/components/Storefront";
import { money } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";

export default function Account() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  const orders = trpc.store.myOrders.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const addresses = trpc.store.addresses.useQuery(undefined, { enabled: Boolean(user), retry: false });
  const saveAddress = trpc.store.saveAddress.useMutation({ onSuccess: () => addresses.refetch() });
  const deleteAddress = trpc.store.deleteAddress.useMutation({ onSuccess: () => addresses.refetch() });
  if (isLoading || !user) return <PageShell><LoadingState label="Opening your DEQANT account…" /></PageShell>;
  const displayName = user.name?.trim() || user.email?.split("@")[0] || "DEQANT customer";
  return <PageShell>
    <section className="account-page">
      <div className="account-heading"><p>YOUR PRIVATE SPACE</p><h1>Welcome back,<br/><em>{displayName}.</em></h1><span>Your fragrance journey, in one place.</span></div>
      <div className="account-grid">
        <article className="account-profile glass-account">
          <span className="account-profile-icon"><UserRound /></span><p>ACCOUNT PROFILE</p><h2>{displayName}</h2><span>{user.email}</span><div className="account-verified"><ShieldCheck /> Verified sign-in</div>
        </article>
        <article className="account-action-card"><PackageSearch /><p>ORDER CARE</p><h2>Your orders, your way.</h2><span>Check the latest status of an order using your order number and checkout phone number.</span><Link className="button button-burgundy" to="/track">Track an order <ArrowRight/></Link></article>
        <article className="account-action-card"><UserRound/><p>THE COLLECTION</p><h2>Find your next signature.</h2><span>Explore decants, complete bottles and considered offers selected by DEQANT.</span><Link className="button button-outline" to="/shop">Explore fragrances <ArrowRight/></Link></article>
      </div>
      <section className="account-orders"><div className="account-orders-heading"><p>YOUR PURCHASES</p><h2>Order history</h2><span>Orders placed while signed in appear here. Guest orders remain available through order tracking.</span></div>{orders.isLoading ? <p>Loading your order history…</p> : orders.error ? <p className="account-muted">We could not load your orders right now.</p> : orders.data?.length ? orders.data.map((order) => <article className="account-order-row" key={order.id}><div><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></div><span className={`status status-${order.status}`}>{order.status}</span><b>{money(order.total)}</b><div className="account-order-items">{order.items.map((item,index) => <span key={`${order.id}-${index}`}>{item.productName} · {item.sizeMl}ml × {item.quantity}</span>)}</div></article>) : <div className="account-no-orders"><PackageSearch/><p>Your signed-in order history is waiting for your first purchase.</p><Link className="text-link" to="/shop">Explore the collection <ArrowRight/></Link></div>}</section>
      <section className="account-orders account-addresses"><div className="account-orders-heading"><p>DELIVERY DETAILS</p><h2>Saved addresses</h2><span>Keep your delivery details ready for your next cash-on-delivery order.</span></div>{addresses.data?.map((address) => <article className="account-order-row" key={address.id}><div><strong><MapPin/> {address.label} {address.isDefault ? "· Default" : ""}</strong><small>{address.recipientName} · {address.phone}</small></div><span>{address.area}, {address.district}</span><p>{address.address}</p><button className="text-link danger" onClick={() => deleteAddress.mutate({ id: address.id })}><Trash2/> Remove</button></article>)}<form className="account-address-form" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); saveAddress.mutate({ label: String(data.get("label")), recipientName: String(data.get("recipientName")), phone: String(data.get("phone")), district: String(data.get("district")), area: String(data.get("area")), address: String(data.get("address")), instructions: String(data.get("instructions") || ""), isDefault: addresses.data?.length === 0 }, { onSuccess: () => form.reset() }); }}><h3>Add an address</h3><div className="form-grid"><label>Label<input name="label" required maxLength={60} placeholder="Home / Office"/></label><label>Recipient name<input name="recipientName" required minLength={2}/></label><label>Phone<input name="phone" required minLength={11}/></label><label>District<input name="district" required/></label><label>Area<input name="area" required/></label><label className="full-field">Full address<textarea name="address" required minLength={8}/></label><label className="full-field">Delivery instructions<textarea name="instructions" maxLength={1000}/></label></div><button className="button button-burgundy" disabled={saveAddress.isPending}>Save address</button></form></section>
      <button className="account-signout" onClick={() => void logout()}><LogOut/> Sign out securely</button>
    </section>
  </PageShell>;
}
