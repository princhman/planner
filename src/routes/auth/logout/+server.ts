import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ cookies }) => {
  cookies.delete("workos_access_token", { path: "/" });
  cookies.delete("workos_refresh_token", { path: "/" });

  throw redirect(302, "/");
};
