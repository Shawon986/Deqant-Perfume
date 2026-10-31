import { describe, expect, it } from "vitest";
import { withMediaUrl } from "./media";

describe("withMediaUrl", () => {
  it("maps a persisted object key to an encoded application media URL", () => {
    const product = { imageKey: "products/amber nuit#01.png", imageUrl: "" };
    const mapped = withMediaUrl(product);

    expect(mapped.imageUrl).toBe("/api/media?key=products%2Famber%20nuit%2301.png");
    expect(mapped.imageKey).toBe(product.imageKey);
    expect(product.imageUrl).toBe("");
  });

  it("preserves bundled artwork when no object key exists", () => {
    const product = { imageKey: null, imageUrl: "/products/rouge-amber.svg" };
    expect(withMediaUrl(product)).toBe(product);
  });
});
