import { env } from "$env/dynamic/public";

export function getPublicConvexUrl(): string {
  const url = env.PUBLIC_CONVEX_URL;

  if (!url) {
    throw new Error("PUBLIC_CONVEX_URL is not configured");
  }

  return url;
}
