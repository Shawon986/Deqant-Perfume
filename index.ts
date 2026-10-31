// Vercel detects Hono applications from a root app/index/server entrypoint.
import { Hono } from "hono";
import app from "./api/boot";

// Export the framework symbol so Vercel's Hono detector can identify this app.
export { Hono };
export default app;
