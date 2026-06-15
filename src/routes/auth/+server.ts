import { redirect, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { ConvexHttpClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import { encryptAuthUser } from "$lib/server/auth-crypto";

export const GET: RequestHandler = async ({ url, locals }) => {
  const callbackUrl = url.searchParams.get("callback_url");

  if (!callbackUrl) {
    throw error(400, "callback_url parameter is required");
  }

  try {
    new URL(callbackUrl);
  } catch {
    throw error(400, "callback_url must be a valid URL");
  }

  const token = locals.token;
  let user = locals.user;

  if (!user && token) {
    const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);
    convex.setAuth(token);
    user = await convex.query(api.auth.currentUser, {});
  }

  if (!user) {
    throw redirect(
      302,
      `/auth/login?callback_url=${encodeURIComponent(callbackUrl)}`,
    );
  }

  const encryptedUser = encryptAuthUser({
    email: user.email,
    name: user.name ?? "",
    company: "Personal",
  });

  const redirectUrl = new URL(callbackUrl);
  redirectUrl.searchParams.set("user", encryptedUser);

  throw redirect(302, redirectUrl.toString());
};
