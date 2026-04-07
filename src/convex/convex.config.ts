import { defineApp } from "convex/server";
import stripe from "@convex-dev/stripe/convex.config.js";
import workos from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();
app.use(stripe);
app.use(workos);

export default app;
