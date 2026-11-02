import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  brand: varchar("brand", { length: 120 }).notNull().default("DEQANT"),
  category: mysqlEnum("category", ["decant", "intact"]).notNull(),
  description: text("description").notNull(),
  notes: text("notes").notNull(),
  family: varchar("family", { length: 120 }).notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: text("imageKey"),
  bestSeller: boolean("bestSeller").default(false).notNull(),
  specialOffer: boolean("specialOffer").default(false).notNull(),
  featured: boolean("featured").default(false).notNull(),
  newArrival: boolean("newArrival").default(true).notNull(),
  popularity: int("popularity").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  categoryIdx: index("products_category_idx").on(table.category),
  activeIdx: index("products_active_idx").on(table.active),
}));

export const productVariants = mysqlTable("product_variants", {
  id: serial("id").primaryKey(),
  productId: bigint("productId", { mode: "number", unsigned: true }).notNull().references(() => products.id, { onDelete: "cascade" }),
  sizeMl: int("sizeMl").notNull(),
  price: int("price").notNull(),
  originalPrice: int("originalPrice").notNull(),
  stock: int("stock").default(0).notNull(),
  sku: varchar("sku", { length: 80 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
}, (table) => ({
  productIdx: index("variants_product_idx").on(table.productId),
  sizeIdx: index("variants_size_idx").on(table.sizeMl),
}));

export const productImages = mysqlTable("product_images", {
  id: serial("id").primaryKey(),
  productId: bigint("productId", { mode: "number", unsigned: true }).notNull().references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storageKey"),
  alt: varchar("alt", { length: 255 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const carts = mysqlTable("carts", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 80 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const cartItems = mysqlTable("cart_items", {
  id: serial("id").primaryKey(),
  cartId: bigint("cartId", { mode: "number", unsigned: true }).notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: bigint("variantId", { mode: "number", unsigned: true }).notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  cartVariantUnique: uniqueIndex("cart_variant_unique").on(table.cartId, table.variantId),
  cartIdx: index("cart_items_cart_idx").on(table.cartId),
}));

export const deliveryZones = mysqlTable("delivery_zones", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  districts: text("districts").notNull(),
  fee: int("fee").notNull(),
  active: boolean("active").default(true).notNull(),
});

export const orders = mysqlTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("orderNumber", { length: 40 }).notNull().unique(),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  customerUserId: bigint("customerUserId", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  email: varchar("email", { length: 320 }),
  district: varchar("district", { length: 120 }).notNull(),
  area: varchar("area", { length: 160 }).notNull(),
  address: text("address").notNull(),
  instructions: text("instructions"),
  deliveryZoneId: bigint("deliveryZoneId", { mode: "number", unsigned: true }).notNull().references(() => deliveryZones.id),
  subtotal: int("subtotal").notNull(),
  deliveryFee: int("deliveryFee").notNull(),
  total: int("total").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cod"]).default("cod").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]).default("pending").notNull(),
  internalNotes: text("internalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
}, (table) => ({
  phoneIdx: index("orders_phone_idx").on(table.phone),
  statusIdx: index("orders_status_idx").on(table.status),
  createdIdx: index("orders_created_idx").on(table.createdAt),
  customerUserIdx: index("orders_customer_user_idx").on(table.customerUserId),
}));

export const orderItems = mysqlTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: bigint("productId", { mode: "number", unsigned: true }).notNull(),
  variantId: bigint("variantId", { mode: "number", unsigned: true }).notNull(),
  productName: varchar("productName", { length: 180 }).notNull(),
  brand: varchar("brand", { length: 120 }).notNull(),
  category: mysqlEnum("category", ["decant", "intact"]).notNull(),
  sizeMl: int("sizeMl").notNull(),
  quantity: int("quantity").notNull(),
  unitPrice: int("unitPrice").notNull(),
  originalPrice: int("originalPrice").notNull(),
  lineTotal: int("lineTotal").notNull(),
});

export const websiteSettings = mysqlTable("website_settings", {
  settingKey: varchar("settingKey", { length: 100 }).primaryKey(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const emailLogs = mysqlTable("email_logs", {
  id: serial("id").primaryKey(),
  orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  recipient: varchar("recipient", { length: 320 }).notNull(),
  kind: mysqlEnum("kind", ["owner", "customer"]).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "not_configured"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const contactMessages = mysqlTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type DeliveryZone = typeof deliveryZones.$inferSelect;
