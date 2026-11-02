import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import { products } from "@db/schema";
import { storage } from "../lib/storage";
import { getDb } from "../queries/connection";

export const mediaRoutes = new Hono();
mediaRoutes.get("/", async (c) => {
  const key = c.req.query("key");
  if (!key || key.length > 600 || key.includes("..") || key.includes("\\") || !/^products\/[a-zA-Z0-9._/-]+$/.test(key)) return c.body(null, 400);
  const { url } = await storage.getPresignedUrl({ key });
  return c.redirect(url, 302);
});

export const discoveryRoutes = new Hono();
discoveryRoutes.get("/sitemap.xml", async (c) => {
  const origin = new URL(c.req.url).origin;
  const entries = await getDb().select({ slug: products.slug, updatedAt: products.updatedAt }).from(products).where(eq(products.active, true)).orderBy(asc(products.slug));
  const paths = ["/", "/shop", "/decants", "/intact", "/best-sellers", "/offers", "/about", "/contact", "/track", "/privacy", "/terms", "/delivery-policy", ...entries.map((entry) => `/product/${entry.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  return c.body(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
});
discoveryRoutes.get("/robots.txt", (c) => {
  const origin = new URL(c.req.url).origin;
  return c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nSitemap: ${origin}/sitemap.xml`);
});
