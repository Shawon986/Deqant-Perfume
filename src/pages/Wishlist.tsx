import { Link } from "react-router";
import { ArrowRight, Heart } from "lucide-react";
import { ErrorState, LoadingState, PageShell, ProductCard } from "@/components/Storefront";
import { useWishlist } from "@/providers/wishlist";
import { trpc } from "@/providers/trpc";

export default function Wishlist() {
  const wishlist = useWishlist();
  const catalog = trpc.store.catalog.useQuery({ sort: "featured" });
  if (catalog.isLoading) return <PageShell><LoadingState label="Gathering your saved fragrances…" /></PageShell>;
  if (catalog.error) return <PageShell><ErrorState message={catalog.error.message} /></PageShell>;
  const saved = (catalog.data ?? []).filter((entry) => wishlist.has(entry.product.slug));
  return <PageShell><section className="wishlist-page">
    <div className="wishlist-heading"><p>YOUR PRIVATE EDIT</p><h1>Saved with<br/><em>intention.</em></h1><span>{saved.length} {saved.length === 1 ? "fragrance" : "fragrances"} saved for later.</span></div>
    {saved.length ? <div className="catalog-grid">{saved.map((entry,index) => <ProductCard key={entry.product.id} entry={entry} index={index}/>)}</div> : <div className="wishlist-empty"><Heart/><h2>Your wishlist is a blank canvas.</h2><p>Save fragrances that catch your attention and return when the moment feels right.</p><Link className="button button-burgundy" to="/shop">Discover fragrances <ArrowRight/></Link></div>}
  </section></PageShell>;
}
