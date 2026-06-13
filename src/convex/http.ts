import { httpRouter } from "convex/server";
import { authKit } from "./auth";
import { encryptUser } from "./encryptAction";

const http = httpRouter();

authKit.registerRoutes(http);

// Auth endpoint that returns encrypted user data via callback URL
http.route({
  path: "/auth",
  method: "GET",
  handler: async (ctx, request) => {
    // Get query parameters
    const url = new URL(request.url);
    const callbackUrl = url.searchParams.get("callback_url");

    if (!callbackUrl) {
      return new Response(
        JSON.stringify({ error: "callback_url parameter is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    try {
      new URL(callbackUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "callback_url must be a valid URL" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Get authenticated user from WorkOS
    const workosUser = await authKit.getAuthUser(ctx);

    if (!workosUser) {
      // User not logged in - redirect to login with return URL
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("callback_url", callbackUrl);
      return new Response(null, {
        status: 302,
        headers: { Location: loginUrl.toString() },
      });
    }

    // User is authenticated - fetch from database
    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", workosUser.id))
      .unique();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found in database" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    // Prepare user data with company defaulting to a B2C placeholder
    const userData = {
      email: user.email,
      name: user.name || "",
      company: "Personal", // Default company for B2C
    };

    // Encrypt user data via action
    const encryptedUser = await ctx.runAction(encryptUser, {
      user: userData,
    });

    // Redirect to callback URL with encrypted user data
    const redirectUrl = new URL(callbackUrl);
    redirectUrl.searchParams.set("user", encryptedUser);

    return new Response(null, {
      status: 302,
      headers: { Location: redirectUrl.toString() },
    });
  },
});

export default http;
