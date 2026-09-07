import { ConvexHttpClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import { getPublicConvexUrl } from "$lib/public-env";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.token)
    return { initialCourses: null, initialRecommendations: null };

  const convex = new ConvexHttpClient(getPublicConvexUrl());
  convex.setAuth(locals.token);

  const [courses, recommendations] = await Promise.all([
    convex.query(api.courses.list, {}),
    convex.query(api.topics.recommendations, {
      includeNotStarted: true,
      limit: 4,
      applyThresholds: true,
      group: false,
    }),
  ]);

  return { initialCourses: courses, initialRecommendations: recommendations };
};
