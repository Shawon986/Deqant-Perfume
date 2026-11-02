import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ArrowRight, Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { ErrorState, LoadingState, PageShell, ProductCard } from "@/components/Storefront";
import { money } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/providers/cart";
import { useWishlist } from "@/providers/wishlist";
import { useAuth } from "@/hooks/useAuth";

export default function Product() {
  const { slug = "" } = useParams();
  const query = trpc.store.product.useQuery({ slug });
  const relatedQuery = trpc.store.catalog.useQuery({ sort: "popular" });
  const { add, isMutating } = useCart();
  const wishlist = useWishlist();
  const { user } = useAuth();
  const reviews = trpc.store.productReviews.useQuery({ slug });
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const submitReview = trpc.store.submitReview.useMutation({ onSuccess: async () => { await reviews.refetch(); setReviewOrderId(""); setReviewTitle(""); setReviewBody(""); } });
  const [variantId, setVariantId] = useState<number>();
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    if (!query.data) return;
    document.title = `${query.data.product.name} — DEQANT Fragrance`;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.deqantProduct = "true";
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: query.data.product.name, brand: { "@type": "Brand", name: query.data.product.brand }, description: query.data.product.description, image: query.data.product.imageUrl, offers: query.data.variants.map((variant) => ({ "@type": "Offer", priceCurrency: "BDT", price: variant.price, availability: variant.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: window.location.href })) });
    document.head.appendChild(script);
    return () => script.remove();
  }, [query.data]);
  if (query.isLoading) return <PageShell><LoadingState /></PageShell>;
  if (query.error || !query.data) return <PageShell><ErrorState message={query.error?.message ?? "Fragrance not found."} /></PageShell>;
  const { product, variants } = query.data;
  const selected = variants.find((v) => v.id === variantId) ?? variants.find((v) => v.stock > 0) ?? variants[0];
  const discount = selected.originalPrice > selected.price ? Math.round((1 - selected.price / selected.originalPrice) * 100) : 0;
  const related = relatedQuery.data?.filter((entry) => entry.product.id !== product.id && entry.product.family === product.family).slice(0, 2) ?? [];
  return <PageShell>
    <div className="product-breadcrumb"><Link to="/shop"><ArrowLeft /> Collection</Link><span>/</span><span>{product.name}</span></div>
    <section className="product-detail">
      <div className="product-gallery"><div className="product-main-image"><img src={product.imageUrl} alt={`${product.name} by ${product.brand}`} width="900" height="1100" /><span>{product.category === "decant" ? "DEQANT DECANT" : "INTACT EDITION"}</span></div></div>
      <div className="product-purchase">
        <p className="eyebrow">{product.brand} / {product.family}</p><h1>{product.name}</h1>
        <div className="detail-price"><strong>{money(selected.price)}</strong>{selected.originalPrice > selected.price && <><del>{money(selected.originalPrice)}</del><span>Save {discount}%</span></>}</div>
        <p className="detail-description">{product.description}</p><button className={`product-wishlist-action ${wishlist.has(product.slug) ? "is-saved" : ""}`} onClick={() => wishlist.toggle(product.slug)} aria-pressed={wishlist.has(product.slug)}><Heart size={17} fill={wishlist.has(product.slug) ? "currentColor" : "none"}/>{wishlist.has(product.slug) ? "Saved to wishlist" : "Save to wishlist"}</button>
        <fieldset className="size-selector"><legend>Select your size <span>{product.category === "decant" ? "Hand-prepared decant" : "Sealed intact bottle"}</span></legend><div>{variants.map((variant) => <button key={variant.id} className={selected.id === variant.id ? "selected" : ""} onClick={() => { setVariantId(variant.id); setQuantity(1); }} disabled={variant.stock === 0} aria-pressed={selected.id === variant.id}><strong>{variant.sizeMl}ml</strong><span>{variant.stock === 0 ? "Sold out" : money(variant.price)}</span></button>)}</div></fieldset>
        <div className="stock-note">{selected.stock > 0 ? <><span className="stock-dot" /> {selected.stock < 8 ? `Only ${selected.stock} left in this size` : "In stock, ready to prepare"}</> : "Currently unavailable"}</div>
        <div className="add-row"><div className="quantity"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity(Math.min(Math.min(10, selected.stock), quantity + 1))} disabled={quantity >= Math.min(10, selected.stock)} aria-label="Increase quantity"><Plus /></button></div><button className="button button-burgundy add-button" onClick={() => add(selected.id, quantity)} disabled={isMutating || selected.stock === 0}><ShoppingBag />{isMutating ? "Adding…" : "Add to cart"}</button></div>
        <p className="cod-note">Cash on delivery · Delivery calculated clearly at checkout</p>
        <div className="product-accordions"><details open><summary>Fragrance notes <Plus /></summary><p>{product.notes}</p></details><details><summary>Delivery & returns <Plus /></summary><p>Delivery is ৳120–৳170 depending on your selected zone. Inspect your order at delivery. See our return policy for eligibility.</p></details><details><summary>Decant preparation <Plus /></summary><p>Decants are transferred into clearly labelled, travel-friendly atomisers with care. The original fragrance name and size are always shown.</p></details></div>
      </div>
    </section>
    <section className="notes-story"><p>ON SKIN</p><h2>A composition in<br /><em>three movements.</em></h2><div>{product.notes.split(" · ").map((note, index) => <div key={note}><span>0{index + 1}</span><h3>{note}</h3><p>{index === 0 ? "The first impression" : index < 3 ? "The unfolding heart" : "The lasting trail"}</p></div>)}</div></section>
    <section className="product-reviews"><div className="section-intro"><p>VERIFIED CUSTOMER NOTES</p><h2>Worn, loved<br/><em>and remembered.</em></h2><span>{reviews.data?.count ?? 0} approved reviews · Average {reviews.data?.average ?? "—"}/5</span></div><div className="review-list">{reviews.data?.reviews.map((review) => <article key={review.id}><div aria-label={"Rated " + review.rating + " out of 5"}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</div><h3>{review.title}</h3><p>{review.body}</p><small>{review.customerName || "Verified customer"} · {new Date(review.createdAt).toLocaleDateString()}</small></article>)}{!reviews.data?.count && <p>Be the first to share a verified experience with this fragrance.</p>}</div>{user && <form className="review-form" onSubmit={(event) => { event.preventDefault(); submitReview.mutate({ slug, orderNumber: reviewOrderId, rating: reviewRating, title: reviewTitle, body: reviewBody }); }}><h3>Write a verified review</h3><p>Only customers with a delivered order for this fragrance can submit a review. Your review appears after moderation.</p><label>Delivered order number<input type="text" minLength={5} required value={reviewOrderId} onChange={(event) => setReviewOrderId(event.target.value)} placeholder="Enter the order number from your DEQANT order confirmation"/></label><label>Rating<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label>Review title<input required minLength={3} maxLength={120} value={reviewTitle} onChange={(event) => setReviewTitle(event.target.value)}/></label><label>Your experience<textarea required minLength={10} maxLength={2000} rows={4} value={reviewBody} onChange={(event) => setReviewBody(event.target.value)}/></label>{submitReview.error && <p className="form-error">{submitReview.error.message}</p>}{submitReview.isSuccess && <p>Your review was submitted for moderation.</p>}<button className="button button-burgundy" disabled={submitReview.isPending}>Submit review</button></form>}</section>
    {related.length > 0 && <section className="related-products"><div className="section-intro"><p>IN THE SAME FAMILY</p><h2>You may also<br /><em>be drawn to.</em></h2></div><div className="catalog-grid">{related.map((entry, index) => <ProductCard key={entry.product.id} entry={entry} index={index} />)}</div><Link className="text-link" to="/shop">Explore all fragrance <ArrowRight /></Link></section>}
  </PageShell>;
}
