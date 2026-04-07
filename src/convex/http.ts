import { httpRouter } from "convex/server";
// import { components } from "./_generated/api";
// import { registerRoutes } from "@convex-dev/stripe";
import { authKit } from "./auth";

const http = httpRouter();

// Register Stripe webhook handler at /stripe/webhook
// registerRoutes(http, components.stripe, {
//   webhookPath: "/stripe/webhook",
// });

authKit.registerRoutes(http);
export default http;
