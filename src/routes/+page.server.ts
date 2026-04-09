import { ConvexHttpClient } from "convex/browser";
import { api } from "$convex/_generated/api";
import { PUBLIC_CONVEX_URL } from "$env/static/public";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.token)
    return { initialCourses: null, initialRecommendations: null };

  const convex = new ConvexHttpClient(PUBLIC_CONVEX_URL);
  convex.setAuth(locals.token);

  const [courses, recommendations] = await Promise.all([
    convex.query(api.courses.list, {}),
    convex.query(api.topics.recomendations, {
      includeNotStarted: false,
      limit: 4,
      applyThresholds: true,
    }),
  ]);

  return { initialCourses: courses, initialRecommendations: recommendations };
};
