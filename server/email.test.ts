import { describe, expect, it } from "vitest";
import { buildOrderEmail } from "./email";

const order = {
  orderNumber: "DQ-20261030-TEST01",
  customerName: "A <script>alert('x')</script>",
  phone: "+8801700000000",
  address: "House & Road <One>",
  area: "Dhanmondi",
  district: "Dhaka",
  subtotal: 1640,
  deliveryFee: 120,
  total: 1760,
};

describe("buildOrderEmail", () => {
  it("renders branded order details, historical lines and BDT totals", () => {
    const html = buildOrderEmail(order, [{
      productName: "Rouge Amber",
      category: "decant",
      sizeMl: 10,
      quantity: 1,
      lineTotal: 1640,
    }]);

    expect(html).toContain("DEQANT");
    expect(html).toContain("DQ-20261030-TEST01");
    expect(html).toContain("Rouge Amber");
    expect(html).toContain("10ml × 1");
    expect(html).toContain("৳1,640");
    expect(html).toContain("৳120");
    expect(html).toContain("৳1,760");
    expect(html).toContain("Cash on delivery");
  });

  it("escapes customer and product content before creating HTML", () => {
    const html = buildOrderEmail(order, [{
      productName: "<img src=x onerror=alert(1)>",
      category: "decant",
      sizeMl: 3,
      quantity: 1,
      lineTotal: 540,
    }]);

    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("House &amp; Road &lt;One&gt;");
  });
});
