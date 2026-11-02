import { asc, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { contactMessages, deliveryZones, emailLogs, orderItems, orders, productImages, products, productVariants, websiteSettings } from "@db/schema";
import { getDb } from "./queries/connection";
import { adminQuery, createRouter } from "./middleware";
import { sendOrderNotifications } from "./email";
import { withMediaUrl } from "./media";
import { storage } from "./lib/storage";

const variantInput = z.object({ sizeMl: z.number().int().positive(), price: z.number().int().nonnegative(), originalPrice: z.number().int().nonnegative(), stock: z.number().int().nonnegative() });
const productInput = z.object({
  name: z.string().trim().min(2).max(180), slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/),
  brand: z.string().trim().min(2).max(120), category: z.enum(["decant", "intact"]),
  description: z.string().trim().min(20), notes: z.string().trim().min(3), family: z.string().trim().min(2),
  imageUrl: z.string().trim().max(2000).refine((value) => value === "" || value.startsWith("/") || /^https:\/\//i.test(value), "Use a local path or HTTPS image URL"), imageKey: z.string().max(600).optional().nullable(), bestSeller: z.boolean(), specialOffer: z.boolean(), featured: z.boolean(),
  variants: z.array(variantInput).min(1).max(8),
}).refine((data) => Boolean(data.imageUrl || data.imageKey), { message: "Add an image or image URL", path: ["imageUrl"] })
  .refine((data) => data.variants.every((v) => v.price <= v.originalPrice), { message: "Discounted price cannot exceed regular price", path: ["variants"] })
  .refine((data) => data.variants.every((v) => data.category === "decant" ? [3, 6, 10, 15, 30].includes(v.sizeMl) : [60, 100, 150].includes(v.sizeMl)), { message: "Variant sizes must match the selected product category", path: ["variants"] })
  .refine((data) => new Set(data.variants.map((v) => v.sizeMl)).size === data.variants.length, { message: "Each size can only be added once", path: ["variants"] });

async function adminProducts() {
  const db = getDb();
  const rows = await db.select({ product: products, variant: productVariants }).from(products).leftJoin(productVariants, eq(products.id, productVariants.productId)).orderBy(desc(products.createdAt));
  const map = new Map<number, { product: typeof products.$inferSelect; variants: Array<typeof productVariants.$inferSelect> }>();
  for (const row of rows) {
    const product = withMediaUrl(row.product);
    if (!map.has(product.id)) map.set(product.id, { product, variants: [] });
    if (row.variant) map.get(product.id)!.variants.push(row.variant);
  }
  return [...map.values()];
}

export const adminRouter = createRouter({
  overview: adminQuery.query(async () => {
    const db = getDb();
    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
    const items = await db.select().from(orderItems);
    const counts = Object.fromEntries(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((status) => [status, allOrders.filter((o) => o.status === status).length]));
    const bestMap = new Map<string, { name: string; units: number; sales: number }>();
    for (const item of items) {
      const current = bestMap.get(item.productName) ?? { name: item.productName, units: 0, sales: 0 };
      current.units += item.quantity; current.sales += item.lineTotal; bestMap.set(item.productName, current);
    }
    return {
      totalOrders: allOrders.length,
      newOrders: allOrders.filter((o) => Date.now() - o.createdAt.getTime() < 86400000).length,
      counts,
      sales: allOrders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0),
      bestSellers: [...bestMap.values()].sort((a, b) => b.units - a.units).slice(0, 5),
      recentOrders: allOrders.slice(0, 6),
    };
  }),

  orders: adminQuery.input(z.object({ q: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = getDb();
    const q = input?.q?.trim();
    const rows = q ? await db.select().from(orders).where(or(like(orders.orderNumber, `%${q}%`), like(orders.phone, `%${q}%`), like(orders.customerName, `%${q}%`))).orderBy(desc(orders.createdAt)).limit(100) : await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
    const items = await db.select().from(orderItems).orderBy(asc(orderItems.id));
    return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) }));
  }),

  updateOrder: adminQuery.input(z.object({ id: z.number().int().positive(), status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]), internalNotes: z.string().max(3000).optional() })).mutation(async ({ input }) => {
    await getDb().update(orders).set({ status: input.status, ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}) }).where(eq(orders.id, input.id));
    return { ok: true };
  }),

  products: adminQuery.query(() => adminProducts()),

  uploadImage: adminQuery.input(z.object({
    name: z.string().min(1).max(180),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    contentBase64: z.string().max(14_000_000),
  })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.contentBase64, "base64");
    if (!bytes.byteLength || bytes.byteLength > 8 * 1024 * 1024) throw new Error("Images must be between 1 byte and 8 MB");
    // Verify the actual file signature; do not trust the browser-supplied MIME type.
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
    if (!(input.contentType === "image/jpeg" && isJpeg) && !(input.contentType === "image/png" && isPng) && !(input.contentType === "image/webp" && isWebp)) throw new Error("The uploaded file does not match its image format");
    const safeName = input.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100);
    const saved = await storage.uploadFile({ fileContent: bytes, fileName: `products/${Date.now()}-${safeName}`, contentType: input.contentType });
    return { key: saved.key, size: saved.size };
  }),

  createProduct: adminQuery.input(productInput).mutation(async ({ input }) => {
    const db = getDb();
    const id = await db.transaction(async (tx) => {
      const { variants, ...data } = input;
      const [{ id }] = await tx.insert(products).values({ ...data, imageUrl: data.imageKey ? "" : data.imageUrl, newArrival: true }).$returningId();
      await tx.insert(productVariants).values(variants.map((variant) => ({ ...variant, productId: id, sku: `${input.slug}-${variant.sizeMl}`.toUpperCase() })));
      await tx.insert(productImages).values({ productId: id, url: input.imageUrl, storageKey: input.imageKey, alt: `${input.name} by ${input.brand}` });
      return id;
    });
    return { id };
  }),

  updateProduct: adminQuery.input(z.object({ id: z.number().int().positive(), data: productInput })).mutation(async ({ input }) => {
    const db = getDb();
    await db.transaction(async (tx) => {
      const { variants, ...data } = input.data;
      await tx.update(products).set({ ...data, imageUrl: data.imageKey ? "" : data.imageUrl }).where(eq(products.id, input.id));
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, input.id));
      for (const variant of variants) {
        const match = existing.find((item) => item.sizeMl === variant.sizeMl);
        if (match) await tx.update(productVariants).set({ ...variant, active: true }).where(eq(productVariants.id, match.id));
        else await tx.insert(productVariants).values({ ...variant, productId: input.id, sku: `${input.data.slug}-${variant.sizeMl}-${input.id}`.toUpperCase() });
      }
      for (const variant of existing.filter((item) => !variants.some((next) => next.sizeMl === item.sizeMl))) {
        await tx.update(productVariants).set({ active: false }).where(eq(productVariants.id, variant.id));
      }
      await tx.update(productImages).set({ url: input.data.imageUrl, storageKey: input.data.imageKey, alt: `${input.data.name} by ${input.data.brand}` }).where(eq(productImages.productId, input.id));
    });
    return { ok: true };
  }),

  setProductActive: adminQuery.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => {
    await getDb().update(products).set({ active: input.active }).where(eq(products.id, input.id));
    return { ok: true };
  }),

  archiveProduct: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    // Soft archive: historical order-item snapshots remain intact.
    await getDb().update(products).set({ active: false }).where(eq(products.id, input.id));
    return { ok: true };
  }),

  zones: adminQuery.query(() => getDb().select().from(deliveryZones).orderBy(asc(deliveryZones.id))),
  createZone: adminQuery.input(z.object({ name: z.string().min(2), districts: z.string().min(2), fee: z.number().int().min(0).max(1000) })).mutation(async ({ input }) => {
    await getDb().insert(deliveryZones).values(input);
    return { ok: true };
  }),
  updateZone: adminQuery.input(z.object({ id: z.number().int().positive(), name: z.string().min(2), districts: z.string().min(2), fee: z.number().int().min(0).max(1000) })).mutation(async ({ input }) => {
    await getDb().update(deliveryZones).set({ name: input.name, districts: input.districts, fee: input.fee }).where(eq(deliveryZones.id, input.id));
    return { ok: true };
  }),

  settings: adminQuery.query(() => getDb().select().from(websiteSettings)),
  updateSetting: adminQuery.input(z.object({ key: z.string().min(2).max(100), value: z.string().max(5000) })).mutation(async ({ input }) => {
    await getDb().insert(websiteSettings).values({ settingKey: input.key, settingValue: input.value }).onDuplicateKeyUpdate({ set: { settingValue: input.value } });
    return { ok: true };
  }),

  messages: adminQuery.query(() => getDb().select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(100)),
  emails: adminQuery.query(() => getDb().select({ log: emailLogs, orderNumber: orders.orderNumber }).from(emailLogs).innerJoin(orders, eq(emailLogs.orderId, orders.id)).orderBy(desc(emailLogs.createdAt)).limit(100)),
  retryEmail: adminQuery.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input }) => {
    await sendOrderNotifications(input.orderId);
    return { ok: true };
  }),
});
