import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type WishlistContextValue = { slugs: string[]; has: (slug: string) => boolean; toggle: (slug: string) => void; remove: (slug: string) => void };
const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem("deqant-wishlist") || "[]");
      return Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string").slice(0, 200) : [];
    } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem("deqant-wishlist", JSON.stringify(slugs)); } catch { /* Storage may be disabled by the browser. */ } }, [slugs]);
  const value = useMemo<WishlistContextValue>(() => ({
    slugs,
    has: (slug) => slugs.includes(slug),
    toggle: (slug) => setSlugs((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug].slice(-200)),
    remove: (slug) => setSlugs((current) => current.filter((item) => item !== slug)),
  }), [slugs]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
  const value = useContext(WishlistContext);
  if (!value) throw new Error("useWishlist must be used within WishlistProvider");
  return value;
}
