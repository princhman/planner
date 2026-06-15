import { redirect, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
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

  const user = locals.user;

  if (!user) {
    throw redirect(
      302,
      `/auth/login?callback_url=${encodeURIComponent(callbackUrl)}`,
    );
  }

  console.log(user.email, user.name);

  const encryptedUser = encryptAuthUser({
    email: user.email,
    name: user.name ?? "",
    company: "Personal",
  });

  const redirectUrl = new URL(callbackUrl);
  redirectUrl.searchParams.set("user", encryptedUser);

  throw redirect(302, redirectUrl.toString());
};
