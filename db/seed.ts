import { getDb } from "../api/queries/connection";
import { deliveryZones, productImages, products, productVariants, websiteSettings } from "./schema";

const catalogue = [
  { slug: "velvet-oud", name: "Velvet Oud", category: "decant" as const, family: "Woody Oriental", description: "A slow-burning composition of polished oud, dark rose and supple suede. Velvet Oud opens with saffron brightness before settling into a warm, resonant trail.", notes: "Saffron · Bulgarian rose · Smoked oud · Suede · Amber", imageUrl: "/products/velvet-oud.svg", bestSeller: true, specialOffer: true, featured: true, popularity: 98, sizes: [3, 6, 10, 15, 30], base: 150 },
  { slug: "ivory-santal", name: "Ivory Santal", category: "decant" as const, family: "Woody Musk", description: "Creamy sandalwood softened by iris and a sheer veil of musk. Quietly magnetic, with the warmth of sunlit wood and freshly pressed linen.", notes: "Cardamom · Iris · Australian sandalwood · Cedar · White musk", imageUrl: "/products/ivory-santal.svg", bestSeller: true, specialOffer: false, featured: true, popularity: 93, sizes: [3, 6, 10, 15, 30], base: 165 },
  { slug: "rouge-amber", name: "Rouge Amber", category: "decant" as const, family: "Amber Floral", description: "An incandescent amber floral with a crystalline opening and a deep, velvety drydown. Radiant without becoming sweet, composed for evenings that linger.", notes: "Bitter almond · Jasmine · Saffron · Ambergris · Cedar resin", imageUrl: "/products/rouge-amber.svg", bestSeller: true, specialOffer: true, featured: true, popularity: 100, sizes: [3, 6, 10, 15, 30], base: 180 },
  { slug: "midnight-vetiver", name: "Midnight Vetiver", category: "decant" as const, family: "Earthy Aromatic", description: "An after-dark study in contrast: cool bergamot, aromatic sage and the dark mineral edge of vetiver. Crisp at first, compellingly earthy at its core.", notes: "Bergamot · Clary sage · Haitian vetiver · Flint · Tonka bean", imageUrl: "/products/midnight-vetiver.svg", bestSeller: false, specialOffer: false, featured: false, popularity: 77, sizes: [3, 6, 10, 15, 30], base: 140 },
  { slug: "citrus-atelier", name: "Citrus Atelier", category: "intact" as const, family: "Citrus Aromatic", description: "Precision-cut citrus with aromatic depth. Yuzu and Calabrian bergamot meet green tea and soft woods in a composition made for warm days.", notes: "Yuzu · Calabrian bergamot · Green tea · Neroli · Blond woods", imageUrl: "/products/citrus-atelier.svg", bestSeller: false, specialOffer: true, featured: true, popularity: 82, sizes: [60, 100, 150], base: 75 },
  { slug: "noir-rose", name: "Noir Rose", category: "intact" as const, family: "Floral Woody", description: "A rose stripped of politeness. Turkish rose and black pepper unfold over patchouli, creating a deep floral with a distinctly modern silhouette.", notes: "Black pepper · Turkish rose · Peony · Patchouli · Dark vanilla", imageUrl: "/products/noir-rose.svg", bestSeller: true, specialOffer: false, featured: true, popularity: 91, sizes: [60, 100, 150], base: 82 },
  { slug: "santal-reserve", name: "Santal Réserve", category: "intact" as const, family: "Woody Leather", description: "Our reserve sandalwood edition, layered with papyrus and supple leather. Dry, tactile and enduring—a signature for those who prefer understatement.", notes: "Papyrus · Sandalwood · Violet leaf · Leather · Amberwood", imageUrl: "/products/santal-reserve.svg", bestSeller: false, specialOffer: false, featured: false, popularity: 73, sizes: [60, 100, 150], base: 88 },
  { slug: "amber-nuit", name: "Amber Nuit", category: "intact" as const, family: "Amber Spicy", description: "A nocturnal amber framed by cinnamon, labdanum and vanilla bourbon. Rich yet controlled, leaving an elegant warmth on skin and fabric.", notes: "Cinnamon · Labdanum · Benzoin · Vanilla bourbon · Sandalwood", imageUrl: "/products/amber-nuit.svg", bestSeller: true, specialOffer: true, featured: true, popularity: 95, sizes: [60, 100, 150], base: 80 },
];

async function seed() {
  const db = getDb();
  console.log("Seeding DEQANT catalogue…");
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (!existing.length) {
    for (const entry of catalogue) {
      const { sizes, base, ...productData } = entry;
      void sizes;
      void base;
      const [{ id }] = await db.insert(products).values({ ...productData, brand: "DEQANT" }).$returningId();
      const multiplier = entry.category === "decant" ? 1 : 1;
      const variants = entry.sizes.map((size, index) => {
        const price = Math.round(entry.base * size * multiplier * (1 - index * 0.045) / 10) * 10;
        const originalPrice = entry.specialOffer ? Math.round(price * 1.18 / 10) * 10 : price;
        return { productId: id, sizeMl: size, price, originalPrice, stock: 18 + index * 4, sku: `${entry.slug}-${size}`.toUpperCase() };
      });
      await db.insert(productVariants).values(variants);
      await db.insert(productImages).values({ productId: id, url: entry.imageUrl, alt: `${entry.name} eau de parfum` });
    }
  }
  const zones = await db.select({ id: deliveryZones.id }).from(deliveryZones).limit(1);
  if (!zones.length) await db.insert(deliveryZones).values([
    { name: "Inside Dhaka", districts: "Dhaka city and surrounding metro areas", fee: 120 },
    { name: "Chattogram", districts: "Chattogram city", fee: 150 },
    { name: "Outside Dhaka", districts: "All other serviceable districts in Bangladesh", fee: 170 },
  ]);
  const defaults = {
    heroTitle: "YOUR SCENT. YOUR SIGNATURE.",
    heroText: "Discover the art of fragrance. Find the scent that defines you.",
    announcement: "COMPLIMENTARY DELIVERY ON ORDERS OVER ৳8,000",
    contactPhone: "+880 1700 000000",
    contactEmail: "concierge@deqant.com",
    footerText: "Independent fragrance, thoughtfully decanted and delivered across Bangladesh.",
  };
  for (const [settingKey, settingValue] of Object.entries(defaults)) {
    await db.insert(websiteSettings).values({ settingKey, settingValue }).onDuplicateKeyUpdate({ set: { settingValue } });
  }
  console.log("DEQANT seed complete.");
  process.exit(0);
}

seed().catch((error) => { console.error(error); process.exit(1); });
