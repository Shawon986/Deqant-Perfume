import { useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile } from "firebase/auth";
import { firebaseAuth, firebaseReady, googleProvider } from "@/lib/firebase";
import { Logo } from "@/components/Storefront";
import { syncCustomerProfile } from "@/lib/profile-sync";
import { trpc } from "@/providers/trpc";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  async function continueToAccount() {
    await utils.auth.me.invalidate();
    const profile = await utils.auth.me.fetch().catch(() => null);
    navigate(profile?.role === "admin" ? "/admin" : "/account", { replace: true });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return toast.error("Authentication is not configured yet.");
    setBusy(true);
    try {
      if (mode === "reset") {
        await sendPasswordResetEmail(firebaseAuth, email.trim());
        toast.success("Password reset email sent.");
        setMode("signin");
      } else if (mode === "signup") {
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
        await sendEmailVerification(credential.user);
        await signOut(firebaseAuth);
        toast.success("Account created. Check your inbox to verify your email before signing in.");
        setMode("signin");
      } else {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        if (!credential.user.emailVerified) {
          await sendEmailVerification(credential.user);
          await signOut(firebaseAuth);
          throw new Error("Please verify your email. We have sent a new verification link.");
        }
        await credential.user.getIdToken(true);
        try { await syncCustomerProfile(credential.user); } catch (profileError) { console.warn("Supabase profile sync is not ready:", profileError); }
        await continueToAccount();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setBusy(false); }
  }

  async function googleSignIn() {
    if (!firebaseAuth) return toast.error("Authentication is not configured yet.");
    setBusy(true);
    try { const credential = await signInWithPopup(firebaseAuth, googleProvider); await credential.user.getIdToken(true); try { await syncCustomerProfile(credential.user); } catch (profileError) { console.warn("Supabase profile sync is not ready:", profileError); } await continueToAccount(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }

  return <main className="admin-login"><section><Link to="/"><Logo /></Link><div><p>DEQANT OWNER PORTAL</p><h1>Your house.<br /><em>Your signature.</em></h1><span>Securely manage the collection, orders, inventory and client experience.</span></div><small>Protected by Firebase Authentication and server-verified access.</small></section><section><Link className="text-link light" to="/"><ArrowLeft /> Back to storefront</Link><div className="login-card"><LockKeyhole /><p>SECURE ACCOUNT ACCESS</p><h2>{mode === "signup" ? "Create account." : mode === "reset" ? "Reset password." : "Welcome back."}</h2>
    {!firebaseReady && <span>Firebase setup is incomplete. Add the VITE_FIREBASE_* settings from your Firebase Web App.</span>}
    <form onSubmit={submit} className="grid gap-3">
      {mode === "signup" && <input aria-label="Full name" placeholder="Full name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} required />}
      <input aria-label="Email" type="email" placeholder="Email address" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required />
      {mode !== "reset" && <input aria-label="Password" type="password" placeholder="Password (minimum 6 characters)" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required />}
      <button className="button button-burgundy" type="submit" disabled={busy || !firebaseReady}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in"}</button>
    </form>
    {mode === "signin" && <><button className="button button-outline" disabled={busy || !firebaseReady} onClick={googleSignIn}>Continue with Google</button><button className="text-link" onClick={()=>setMode("reset")}>Forgot password?</button><small>New here? <button onClick={()=>setMode("signup")}>Create an account</button></small></>}
    {mode !== "signin" && <button className="text-link" onClick={()=>setMode("signin")}>Back to sign in</button>}
    <small>Customer accounts do not automatically receive administrator privileges.</small>
  </div></section></main>;
}
