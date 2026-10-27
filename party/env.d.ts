// Bindings and secrets the Worker sees. Secrets are set with `wrangler secret put`, locally in `.dev.vars`.
declare namespace Cloudflare {
  interface Env {
    Main: DurableObjectNamespace; // binding name "Main" = the default "main" party in the client URL
    JWT_SECRET: string;
    SETTLE_SECRET?: string;
    SETTLE_URL?: string;
  }
}
