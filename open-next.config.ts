import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental (ISR) cache override: this app has no statically revalidated
// pages — every route is dynamic and auth-gated — so the default in-memory
// cache is sufficient and we avoid needing an R2 bucket.
export default defineCloudflareConfig();
