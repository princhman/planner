import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel.js";
import {
  internalMutation,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server.js";

const initialStabilityToConfidence = [1, 3, 7, 14, 30];

export const listByCourse = query({
  args: { courseId: v.id("courses"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_course", (q) => q.eq("courseId", args.courseId))
      .collect();
    // Verify ownership
    return topics.filter((t) => t.userId === args.userId);
  },
});

export const recomendations = query({
  args: {
    userId: v.id("users"),
    includeNotStarted: v.boolean(),
    courseId: v.optional(v.id("courses")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const courseId = args.courseId;
    const now = Date.now();
    const dayMs = 86_400_000;
    let topics: Doc<"topics">[];
    if (courseId) {
      topics = await ctx.db
        .query("topics")
        .withIndex("by_user_course_leaf_confidence", (q) =>
          q
            .eq("userId", args.userId)
            .eq("courseId", courseId)
            .eq("isLeaf", true)
            .gte("confidence", args.includeNotStarted ? 0 : 1),
        )
        .collect();
    } else {
      topics = await ctx.db
        .query("topics")
        .withIndex("by_user_leaf_confidence", (q) =>
          q
            .eq("userId", args.userId)
            .eq("isLeaf", true)
            .gte("confidence", args.includeNotStarted ? 0 : 1),
        )
        .collect();
    }

    // const EU - exam urgency - need to add
    // calculate priority
    const ranked = await Promise.all(
      topics.map(async (topic) => {
        const courseExamDate = args.courseId
          ? (await ctx.db.get(args.courseId))?.examDate
          : undefined;

        const eu = computeExamUrgency(courseExamDate, now);
        const c = topic.confidence;
        const s = Math.max(topic.stability ?? 1, 0.05); // min 0.05
        const tDays = Math.max(
          0.05,
          (now - (topic.lastRecallAt ?? now)) / dayMs,
        );
        const r = Math.pow(1 + (19 / 81) * (tDays / s), -0.5);

        const priority = (5 - c) * (1 - r) * eu;
        return { topic, priority, r, eu, tDays };
      }),
    );
    ranked.sort((a, b) => b.priority - a.priority);
    const limit = Math.max(1, Math.min(args.limit ?? 12, 100));
    return ranked.slice(0, limit);
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    courseId: v.id("courses"),
    title: v.string(),
    parentId: v.optional(v.id("topics")),
  },
  handler: async (ctx, args) => {
    // order starts at 1
    const topicWithMaxOrder = await ctx.db
      .query("topics")
      .withIndex("by_courses_parentId_order", (q) =>
        q.eq("courseId", args.courseId).eq("parentId", args.parentId),
      )
      .order("desc")
      .first();
    const order = topicWithMaxOrder ? topicWithMaxOrder.order + 1 : 1;

    const id = await ctx.db.insert("topics", {
      userId: args.userId,
      courseId: args.courseId,
      order: order,
      title: args.title,
      parentId: args.parentId,
      confidence: 1,
      lastRecallAt: undefined,
      stability: initialStabilityToConfidence[0], // need proper stability assigning
      isLeaf: true,
    });

    await recomputeAncestorConfidence(ctx, args.parentId);

    return id;
  },
});

export const update = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("topics"),
        parentId: v.optional(v.id("topics")),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, { updates }) => {
    const affectedParentIds = new Set<Id<"topics">>();
    for (const u of updates) {
      const oldParentId = (await ctx.db.get(u.id))?.parentId;
      await ctx.db.patch(u.id, {
        parentId: u.parentId,
        order: u.order,
      });
      if (u.parentId !== oldParentId) {
        if (u.parentId) affectedParentIds.add(u.parentId);
        if (oldParentId) affectedParentIds.add(oldParentId);
      }
    }
    for (const parentId of affectedParentIds) {
      await recomputeAncestorConfidence(ctx, parentId);
      await setIsLeafFromChildren(ctx, parentId);
    }
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("topics"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { title: args.title });
  },
});

export const updateConfidence = mutation({
  args: {
    id: v.id("topics"),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const topic = await ctx.db.get(args.id);
    if (topic) {
      // maybe should enforce the leaf-only updates
      // algorithm that was improved by AI, but i understand it
      // some constants that can be improved
      // WU - went up, SS - stayed the same, WD - wend down
      const WU_CONF = 0.3; // how much conf delta impacts new s
      const WU_R = 0.6; // how much good review time impacts new s
      const SS_R = 0.15; // how much good review impacts
      const WD_C = 0.35; // constant to decrease
      const WD_R = 0.25; // how much review impacts

      const s = topic.stability;
      const confDelta = args.confidence - topic.confidence;

      // calculate t since last review
      const now = Date.now();
      const lastRecallAt = topic.lastRecallAt ?? now;
      const tMs = Math.max(0, now - lastRecallAt);
      const t = Math.max(0.05, tMs / 86_400_000);

      // calculate r - retriviability (0-1 score of how long since last review, kind of urgency)
      const r = (1 + ((19 / 81) * t) / s) ^ 0.5;

      // calculate new s (n days to get 100% -> 90% of remembering)
      let newS: number;
      if (confDelta > 0) {
        newS = s * (1 + WU_CONF * confDelta) * (1 + WU_R * (1 - r)); // reward good time review and good delta
      } else if (confDelta == 0) {
        newS = s * (1 + SS_R * (1 - r)); // increase a bit, depending on when it was reviewed
      } else {
        newS = s * (WD_C + WD_R * r); // reducing s for next time
      }

      await ctx.db.patch(args.id, {
        confidence: args.confidence,
        lastRecallAt: now,
        stability: newS,
      });

      // recompute for ancestors
      await recomputeAncestorConfidence(ctx, topic.parentId);
    }
  },
});

// helpers
async function recomputeAncestorConfidence(
  ctx: MutationCtx,
  parentId: Id<"topics"> | undefined,
): Promise<void> {
  let currentParentId = parentId;

  while (currentParentId) {
    const parent = await ctx.db.get(currentParentId);
    if (!parent) break;

    const directChildren = await ctx.db
      .query("topics")
      .withIndex("by_parentId", (q) => q.eq("parentId", currentParentId))
      .collect();

    if (directChildren.length > 0) {
      const minConfidence = Math.min(
        ...directChildren.map((child) => child.confidence),
      );

      if (parent.confidence !== minConfidence) {
        await ctx.db.patch(currentParentId, { confidence: minConfidence });
      }
    }

    currentParentId = parent.parentId;
  }
}

async function setIsLeafFromChildren(
  ctx: MutationCtx,
  topicId: Id<"topics"> | undefined,
): Promise<void> {
  if (!topicId) return;
  const children = await ctx.db
    .query("topics")
    .withIndex("by_parentId", (q) => q.eq("parentId", topicId))
    .collect();
  await ctx.db.patch(topicId, { isLeaf: children.length === 0 });
}

function computeExamUrgency(
  examDate: string | undefined,
  nowMs: number,
): number {
  if (!examDate) return 1;

  const examMs = Date.parse(examDate);
  if (Number.isNaN(examMs)) return 1;

  const daysLeft = Math.max(0, (examMs - nowMs) / 86_400_000);

  // 90 days -> 1, 0 days -> 2 (simple linear urgency boost)
  const eu = 1 + Math.max(0, (90 - daysLeft) / 30);
  return Math.min(2, Math.max(1, eu));
}
