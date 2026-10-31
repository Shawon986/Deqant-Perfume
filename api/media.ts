export function withMediaUrl<T extends { imageKey: string | null; imageUrl: string }>(product: T): T {
  return product.imageKey ? { ...product, imageUrl: `/api/media?key=${encodeURIComponent(product.imageKey)}` } : product;
}
