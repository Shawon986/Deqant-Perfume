import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cartItems, carts, contactMessages, deliveryZones, orderItems, orders, productImages, products, productVariants, websiteSettings } from "@db/schema";
import { getDb } from "./queries/connection";
import { authedQuery, createRouter, publicQuery } from "./middleware";
import { sendOrderNotifications } from "./email";
import { withMediaUrl } from "./media";

const tokenSchema = z.string().uuid().optional().nullable();
const phoneSchema = z.string().trim().min(11).max(20).regex(/^[+0-9\s-]+$/, "Enter a valid mobile number");
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  // Vercel supplies the connecting address in x-forwarded-for. Keep this
  // process-local guard bounded; production should additionally use the
  // deployment provider's distributed WAF/rate limiting.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${scope}:${ip.slice(0, 80)}`;
  const now = Date.now();
  if (rateBuckets.size > 20_000) {
    for (const [bucket, value] of rateBuckets) if (value.resetAt <= now) rateBuckets.delete(bucket);
    if (rateBuckets.size > 20_000) rateBuckets.clear();
  }
  const current = rateBuckets.get(key);
  if (!current || current.resetAt < now) rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
  else {
    current.count += 1;
    if (current.count > limit) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait a moment and try again." });
  }
}

async function ensureCart(token?: string | null) {
  const db = getDb();
  if (token) {
    const [existing] = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
    if (existing) return existing;
  }
  const newToken = randomUUID();
  const [{ id }] = await db.insert(carts).values({ token: newToken }).$returningId();
  const [cart] = await db.select().from(carts).where(eq(carts.id, id)).limit(1);
  return cart;
}

async function readCart(token?: string | null) {
  const db = getDb();
  const cart = await ensureCart(token);
  const rows = await db.select({ item: cartItems, variant: productVariants, product: products }).from(cartItems)
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(cartItems.cartId, cart.id)).orderBy(asc(cartItems.createdAt));
  const items = rows.map(({ item, variant, product }) => ({ ...item, variant, product: withMediaUrl(product), lineTotal: variant.price * item.quantity }));
  return { token: cart.token, items, subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0), count: items.reduce((sum, item) => sum + item.quantity, 0) };
}

async function listCatalog() {
  const db = getDb();
  const rows = await db.select({ product: products, variant: productVariants }).from(products)
    .innerJoin(productVariants, eq(products.id, productVariants.productId))
    .where(and(eq(products.active, true), eq(productVariants.active, true)))
    .orderBy(desc(products.featured), desc(products.popularity), asc(products.id));
  const grouped = new Map<number, { product: typeof products.$inferSelect; variants: Array<typeof productVariants.$inferSelect> }>();
  for (const row of rows) {
    const product = withMediaUrl(row.product);
    if (!grouped.has(product.id)) grouped.set(product.id, { product, variants: [] });
    grouped.get(product.id)!.variants.push(row.variant);
  }
  return [...grouped.values()];
}

export const storeRouter = createRouter({
  catalog: publicQuery.input(z.object({
    q: z.string().trim().max(120).optional(), category: z.enum(["decant", "intact"]).optional(),
    size: z.number().int().optional(), maxPrice: z.number().int().optional(),
    offer: z.boolean().optional(), bestSeller: z.boolean().optional(),
    sort: z.enum(["featured", "price-asc", "price-desc", "popular", "new"]).default("featured"),
  }).optional()).query(async ({ input }) => {
    let entries = await listCatalog();
    const filters = input ?? { sort: "featured" as const };
    if (filters.q) {
      const q = filters.q.toLowerCase();
      entries = entries.filter(({ product }) => `${product.name} ${product.brand} ${product.family} ${product.notes}`.toLowerCase().includes(q));
    }
    if (filters.category) entries = entries.filter(({ product }) => product.category === filters.category);
    if (filters.size) entries = entries.filter(({ variants }) => variants.some((v) => v.sizeMl === filters.size));
    if (filters.maxPrice) entries = entries.filter(({ variants }) => variants.some((v) => v.price <= filters.maxPrice!));
    if (filters.offer) entries = entries.filter(({ product, variants }) => product.specialOffer || variants.some((v) => v.originalPrice > v.price));
    if (filters.bestSeller) entries = entries.filter(({ product }) => product.bestSeller);
    const minPrice = (entry: (typeof entries)[number]) => Math.min(...entry.variants.map((v) => v.price));
    if (filters.sort === "price-asc") entries.sort((a, b) => minPrice(a) - minPrice(b));
    if (filters.sort === "price-desc") entries.sort((a, b) => minPrice(b) - minPrice(a));
    if (filters.sort === "popular") entries.sort((a, b) => b.product.popularity - a.product.popularity);
    if (filters.sort === "new") entries.sort((a, b) => Number(b.product.newArrival) - Number(a.product.newArrival) || b.product.createdAt.getTime() - a.product.createdAt.getTime());
    return entries;
  }),

  product: publicQuery.input(z.object({ slug: z.string().trim().min(1).max(160) })).query(async ({ input }) => {
    const entries = await listCatalog();
    const entry = entries.find(({ product }) => product.slug === input.slug);
    if (!entry) throw new TRPCError({ code: "NOT_FOUND", message: "This fragrance is no longer available." });
    const images = await getDb().select().from(productImages).where(eq(productImages.productId, entry.product.id)).orderBy(asc(productImages.sortOrder));
    return { ...entry, images };
  }),

  settings: publicQuery.query(async () => {
    // Never expose arbitrary settings through the public storefront API.
    const publicKeys = ["announcement", "contactEmail", "contactPhone", "footerText", "heroTitle", "heroText"];
    const rows = await getDb().select({ settingKey: websiteSettings.settingKey, settingValue: websiteSettings.settingValue }).from(websiteSettings);
    return Object.fromEntries(rows.filter((row) => publicKeys.includes(row.settingKey)).map((row) => [row.settingKey, row.settingValue]));
  }),

  zones: publicQuery.query(() => getDb().select().from(deliveryZones).where(eq(deliveryZones.active, true)).orderBy(asc(deliveryZones.fee))),

  cart: publicQuery.input(z.object({ token: tokenSchema }).optional()).query(({ input, ctx }) => { rateLimit(ctx.req, "cart-read", 180, 60_000); return readCart(input?.token); }),

  addToCart: publicQuery.input(z.object({ token: tokenSchema, variantId: z.number().int().positive(), quantity: z.number().int().min(1).max(10).default(1) })).mutation(async ({ input, ctx }) => {
    rateLimit(ctx.req, "cart", 120, 60_000);
    const db = getDb();
    const cart = await ensureCart(input.token);
    const [variant] = await db.select().from(productVariants).where(and(eq(productVariants.id, input.variantId), eq(productVariants.active, true), gt(productVariants.stock, 0))).limit(1);
    if (!variant) throw new TRPCError({ code: "BAD_REQUEST", message: "This size is currently out of stock." });
    const [existing] = await db.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.variantId, input.variantId))).limit(1);
    const nextQuantity = (existing?.quantity ?? 0) + input.quantity;
    if (nextQuantity > Math.min(variant.stock, 10)) throw new TRPCError({ code: "BAD_REQUEST", message: `Only ${variant.stock} available in this size.` });
    if (existing) await db.update(cartItems).set({ quantity: nextQuantity }).where(eq(cartItems.id, existing.id));
    else await db.insert(cartItems).values({ cartId: cart.id, variantId: input.variantId, quantity: input.quantity });
    return readCart(cart.token);
  }),

  updateCartItem: publicQuery.input(z.object({ token: z.string().uuid(), itemId: z.number().int().positive(), quantity: z.number().int().min(1).max(10) })).mutation(async ({ input, ctx }) => {
    rateLimit(ctx.req, "cart-write", 120, 60_000);
    const db = getDb();
    const [row] = await db.select({ item: cartItems, stock: productVariants.stock }).from(cartItems).innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)).innerJoin(carts, eq(cartItems.cartId, carts.id)).where(and(eq(cartItems.id, input.itemId), eq(carts.token, input.token))).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Cart item not found." });
    if (input.quantity > row.stock) throw new TRPCError({ code: "BAD_REQUEST", message: `Only ${row.stock} available.` });
    await db.update(cartItems).set({ quantity: input.quantity }).where(eq(cartItems.id, input.itemId));
    return readCart(input.token);
  }),

  removeCartItem: publicQuery.input(z.object({ token: z.string().uuid(), itemId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    rateLimit(ctx.req, "cart-write", 120, 60_000);
    const db = getDb();
    const [cart] = await db.select().from(carts).where(eq(carts.token, input.token)).limit(1);
    if (cart) await db.delete(cartItems).where(and(eq(cartItems.id, input.itemId), eq(cartItems.cartId, cart.id)));
    return readCart(input.token);
  }),

  myOrders: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total, createdAt: orders.createdAt, phone: orders.phone }).from(orders).where(eq(orders.customerUserId, ctx.user.id)).orderBy(desc(orders.createdAt)).limit(50);
    if (!rows.length) return [];
    const items = await db.select({ orderId: orderItems.orderId, productName: orderItems.productName, sizeMl: orderItems.sizeMl, quantity: orderItems.quantity, lineTotal: orderItems.lineTotal }).from(orderItems).where(inArray(orderItems.orderId, rows.map((row) => row.id)));
    return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) }));
  }),

  checkout: publicQuery.input(z.object({
    token: z.string().uuid(), idempotencyKey: z.string().uuid(),
    customerName: z.string().trim().min(2).max(180), phone: phoneSchema,
    email: z.union([z.literal(""), z.string().email().max(320)]).optional(),
    district: z.string().trim().min(2).max(120), area: z.string().trim().min(2).max(160),
    address: z.string().trim().min(8).max(1200), instructions: z.string().max(1000).optional(),
    deliveryZoneId: z.number().int().positive(),
  })).mutation(async ({ input, ctx }) => {
    rateLimit(ctx.req, "checkout", 8, 10 * 60_000);
    const db = getDb();
    const [duplicate] = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
    if (duplicate) return { orderNumber: duplicate.orderNumber, total: duplicate.total };
    const cart = await ensureCart(input.token);
    const currentItems = await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    if (!currentItems.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart is empty." });
    const [zone] = await db.select().from(deliveryZones).where(and(eq(deliveryZones.id, input.deliveryZoneId), eq(deliveryZones.active, true))).limit(1);
    if (!zone) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a valid delivery zone." });
    const orderNumber = `DQ-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    const orderId = await db.transaction(async (tx) => {
      const lines = [];
      for (const item of currentItems) {
        const [row] = await tx.select({ variant: productVariants, product: products }).from(productVariants).innerJoin(products, eq(productVariants.productId, products.id)).where(eq(productVariants.id, item.variantId)).for("update").limit(1);
        if (!row || !row.variant.active || !row.product.active || row.variant.stock < item.quantity) throw new TRPCError({ code: "CONFLICT", message: "Stock changed while you were checking out. Please review your cart." });
        lines.push({ item, ...row });
        await tx.update(productVariants).set({ stock: row.variant.stock - item.quantity }).where(eq(productVariants.id, row.variant.id));
      }
      const subtotal = lines.reduce((sum, line) => sum + line.variant.price * line.item.quantity, 0);
      const [{ id }] = await tx.insert(orders).values({
        orderNumber, idempotencyKey: input.idempotencyKey, customerUserId: ctx.user?.id ?? null, customerName: input.customerName,
        phone: input.phone, email: input.email || null, district: input.district, area: input.area,
        address: input.address, instructions: input.instructions || null, deliveryZoneId: zone.id,
        subtotal, deliveryFee: zone.fee, total: subtotal + zone.fee,
      }).$returningId();
      await tx.insert(orderItems).values(lines.map((line) => ({
        orderId: id, productId: line.product.id, variantId: line.variant.id,
        productName: line.product.name, brand: line.product.brand, category: line.product.category,
        sizeMl: line.variant.sizeMl, quantity: line.item.quantity, unitPrice: line.variant.price,
        originalPrice: line.variant.originalPrice, lineTotal: line.variant.price * line.item.quantity,
      })));
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      return id;
    });
    void sendOrderNotifications(orderId).catch(() => undefined);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return { orderNumber: order.orderNumber, total: order.total };
  }),

  orderSuccess: publicQuery.input(z.object({ orderNumber: z.string().trim().min(5).max(40), phone: phoneSchema })).query(async ({ input, ctx }) => {
    rateLimit(ctx.req, "order-lookup", 8, 10 * 60_000);
    const [order] = await getDb().select({
      id: orders.id, orderNumber: orders.orderNumber, status: orders.status, total: orders.total,
      deliveryFee: orders.deliveryFee, customerName: orders.customerName, address: orders.address,
      area: orders.area, district: orders.district, phone: orders.phone,
    }).from(orders).where(and(eq(orders.orderNumber, input.orderNumber.toUpperCase()), eq(orders.phone, input.phone))).limit(1);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "We could not find an order with those details." });
    const items = await getDb().select({
      id: orderItems.id, productName: orderItems.productName, sizeMl: orderItems.sizeMl,
      quantity: orderItems.quantity, lineTotal: orderItems.lineTotal,
    }).from(orderItems).where(eq(orderItems.orderId, order.id));
    return { order, items };
  }),

  track: publicQuery.input(z.object({ orderNumber: z.string().trim().min(5).max(40), phone: phoneSchema })).query(async ({ input, ctx }) => {
    rateLimit(ctx.req, "tracking", 30, 10 * 60_000);
    const [order] = await getDb().select({ orderNumber: orders.orderNumber, status: orders.status, total: orders.total, createdAt: orders.createdAt }).from(orders).where(and(eq(orders.orderNumber, input.orderNumber.toUpperCase()), eq(orders.phone, input.phone))).limit(1);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "No matching order. Check your order ID and phone number." });
    return order;
  }),

  contact: publicQuery.input(z.object({ name: z.string().trim().min(2).max(180), email: z.string().email(), message: z.string().trim().min(10).max(3000) })).mutation(async ({ input, ctx }) => {
    rateLimit(ctx.req, "contact", 5, 60 * 60_000);
    await getDb().insert(contactMessages).values(input);
    return { ok: true };
  }),
});
