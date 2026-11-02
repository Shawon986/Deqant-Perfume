import { Link } from "react-router";
import { ArrowRight, LogOut, PackageSearch, ShieldCheck, UserRound } from "lucide-react";
import { LoadingState, PageShell } from "@/components/Storefront";
import { useAuth } from "@/hooks/useAuth";

export default function Account() {
  const { user, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
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
      <button className="account-signout" onClick={() => void logout()}><LogOut/> Sign out securely</button>
    </section>
  </PageShell>;
}
