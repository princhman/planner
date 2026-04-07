import { defineApp } from "convex/server";
import workos from "@convex-dev/workos-authkit/convex.config";

const app = defineApp();
app.use(workos);

export default app;
