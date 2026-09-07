import { ConvexHttpClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import { getPublicConvexUrl } from "$lib/public-env";
import type { PageServerLoad } from "./$types";
import type { Id } from "$convex/_generated/dataModel";

export const load: PageServerLoad = async ({ params, locals }) => {
  if (!locals.token) return { initialTopics: null };

  const convex = new ConvexHttpClient(getPublicConvexUrl());
  convex.setAuth(locals.token);

  const topics = await convex.query(api.topics.listByCourse, {
    courseId: params.id as Id<"courses">,
  });

  return { initialTopics: topics };
};
