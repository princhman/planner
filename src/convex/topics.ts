import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";
import { getAuthUser, getAuthUserOrThrow } from "./auth.js";

const initialStabilityToConfidence = [1, 3, 7, 12, 20]; // subject to be updated
const REVIEW_THRESHOLD = 0.9;

export const listByCourse = query({
  args: { courseId: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.courseId),
      )
      .collect();
    const now = Date.now();
    const dayMs = 86_400_000;
    return topics.map((topic) => {
      let nextReview: number | null = null;
      let r: number | null = null;
      if (topic.isLeaf) {
        const s = Math.max(topic.stability ?? 1, 0.05);
        const tDaysUntilThreshold =
          s * (81 / 19) * (Math.pow(REVIEW_THRESHOLD, -2) - 1);
        const lastRecallAt = topic.lastRecallAt ?? 0;
        const reviewAtMs = lastRecallAt + tDaysUntilThreshold * dayMs;
        nextReview = reviewAtMs - now;

        const tDays = Math.max(0.05, (now - (topic.lastRecallAt ?? 0)) / dayMs);
        r = Math.pow(1 + (19 / 81) * (tDays / s), -0.5);
      }
      return { ...topic, nextReview, r };
    });
  },
});

export const recomendations = query({
  args: {
    includeNotStarted: v.boolean(),
    courseId: v.optional(v.id("courses")),
    limit: v.optional(v.number()),
    applyThresholds: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return { items: [], nextReviewMs: null };
    const courseId = args.courseId;
    const now = Date.now();
    const dayMs = 86_400_000;
    let needsNext = false;

    let topics: Doc<"topics">[];
    if (courseId) {
      topics = await ctx.db
        .query("topics")
        .withIndex("by_user_course_leaf_confidence", (q) =>
          q
            .eq("userId", user._id)
            .eq("courseId", courseId)
            .eq("isLeaf", true)
            .gt("confidence", args.includeNotStarted ? 0 : 1),
        )
        .collect();
    } else {
      topics = await ctx.db
        .query("topics")
        .withIndex("by_user_leaf_confidence", (q) =>
          q
            .eq("userId", user._id)
            .eq("isLeaf", true)
            .gt("confidence", args.includeNotStarted ? 0 : 1),
        )
        .collect();
    }

    const courseCache = new Map<
      Id<"courses">,
      { eu: number; name: string; examDate?: string }
    >();

    const parentPathCache = new Map<Id<"topics"> | undefined, string[]>();

    const allComputed = await Promise.all(
      topics.map(async (topic) => {
        if (!courseCache.has(topic.courseId)) {
          const course = await ctx.db.get(topic.courseId);
          if (!course) throw new Error(`Course not found: ${topic.courseId}`);
          const eu = computeExamUrgency(course?.examDate, now);
          courseCache.set(topic.courseId, {
            eu,
            name: course.name,
            examDate: course?.examDate,
          });
        }

        if (!parentPathCache.has(topic.parentId)) {
          const parentPath = await findTopicPath(ctx, topic.parentId);
          parentPathCache.set(topic.parentId, parentPath);
        }

        const { eu, name, examDate } = courseCache.get(topic.courseId)!;
        const s = Math.max(topic.stability ?? 1, 0.05);
        const tDays = Math.max(0.05, (now - (topic.lastRecallAt ?? 0)) / dayMs);
        const r = Math.pow(1 + (19 / 81) * (tDays / s), -0.5);
        const needsReview = r < REVIEW_THRESHOLD;
        needsNext ||= needsReview;

        const priority = (5 - topic.confidence) * (1 - r) * eu;
        return {
          topic,
          details: {
            priority,
            r,
            eu,
            tDays,
          },
          courseId: topic.courseId,
          courseName: name,
          examDate: examDate,
          needsReview,
          path: parentPathCache.get(topic.parentId),
        };
      }),
    );

    let nextReviewMs: number | null = null;
    if (args.applyThresholds && !needsNext) {
      for (const item of allComputed) {
        if (item.needsReview) continue;
        const s = Math.max(item.topic.stability ?? 1, 0.05);
        const tDaysUntilThreshold =
          s * (81 / 19) * (Math.pow(REVIEW_THRESHOLD, -2) - 1);
        const lastRecallAt = item.topic.lastRecallAt ?? 0;
        const reviewAtMs = lastRecallAt + tDaysUntilThreshold * dayMs;
        const msUntil = reviewAtMs - now;
        if (msUntil > 0 && (nextReviewMs === null || msUntil < nextReviewMs)) {
          nextReviewMs = msUntil;
        }
      }
    }

    const filtered = args.applyThresholds
      ? allComputed.filter((item) => item.needsReview)
      : allComputed;

    filtered.sort((a, b) => b.details.priority - a.details.priority);
    const limit = Math.max(1, Math.min(args.limit ?? 12, 100));
    const moreToReview = filtered.length - limit;

    return {
      items: filtered.slice(0, limit),
      nextReviewMs,
      moreToReview,
    };
  },
});

export const add = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    parentId: v.optional(v.id("topics")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const topicWithMaxOrder = await ctx.db
      .query("topics")
      .withIndex("by_courses_parentId_order", (q) =>
        q.eq("courseId", args.courseId).eq("parentId", args.parentId),
      )
      .order("desc")
      .first();
    const order = topicWithMaxOrder ? topicWithMaxOrder.order + 1 : 1;

    const id = await ctx.db.insert("topics", {
      userId: user._id,
      courseId: args.courseId,
      order: order,
      title: args.title,
      parentId: args.parentId,
      confidence: 1,
      lastRecallAt: undefined,
      stability: initialStabilityToConfidence[0],
      isLeaf: true,
    });

    await recomputeAncestorConfidence(ctx, args.parentId);

    return id;
  },
});

export const bulkAdd = mutation({
  args: {
    courseId: v.id("courses"),
    topics: v.array(
      v.object({
        title: v.string(),
        depth: v.number(),
      }),
    ),
  },
  handler: async (ctx, { courseId, topics }) => {
    const user = await getAuthUserOrThrow(ctx);
    const lastIdAtDepth = new Map<number, Id<"topics">>();
    const orderCounters = new Map<string, number>();

    const existingMax = await ctx.db
      .query("topics")
      .withIndex("by_courses_parentId_order", (q) =>
        q.eq("courseId", courseId).eq("parentId", undefined),
      )
      .order("desc")
      .first();

    let rootOffset = existingMax ? existingMax.order : 0;

    const getOrder = (parentId: Id<"topics"> | undefined): number => {
      const key = parentId ?? "__root__";
      const current = (orderCounters.get(key) ?? 0) + 1;
      orderCounters.set(key, current);
      return parentId ? current : current + rootOffset;
    };

    for (const topic of topics) {
      const parentId =
        topic.depth > 0 ? lastIdAtDepth.get(topic.depth - 1) : undefined;

      if (topic.depth > 0 && !parentId) continue;

      if (parentId) {
        await ctx.db.patch(parentId, { isLeaf: false });
      }

      const id = await ctx.db.insert("topics", {
        userId: user._id,
        courseId,
        title: topic.title,
        order: getOrder(parentId),
        parentId,
        confidence: 1,
        stability: initialStabilityToConfidence[0],
        isLeaf: true,
        lastRecallAt: undefined,
      });

      lastIdAtDepth.set(topic.depth, id);
    }
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
    const user = await getAuthUserOrThrow(ctx);
    const affectedParentIds = new Set<Id<"topics">>();
    for (const u of updates) {
      const existing = await ctx.db.get(u.id);
      if (!existing || existing.userId !== user._id) {
        throw new Error("Topic not found");
      }
      const oldParentId = existing.parentId;
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
    const user = await getAuthUserOrThrow(ctx);
    const topic = await ctx.db.get(args.id);
    if (!topic || topic.userId !== user._id) {
      throw new Error("Topic not found");
    }
    await ctx.db.patch(args.id, { title: args.title });
  },
});

export const updateConfidence = mutation({
  args: {
    id: v.id("topics"),
    confidence: v.number(),
    backlogMode: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const topic = await ctx.db.get(args.id);
    if (!topic || topic.userId !== user._id) {
      throw new Error("Topic not found");
    }
    if (args.backlogMode) {
      await ctx.db.patch(args.id, {
        confidence: args.confidence,
        stability: initialStabilityToConfidence[args.confidence - 1],
      });
    } else {
      const now = Date.now();
      if (topic.lastRecallAt) {
        // WU - went up, SS - stayed the same, WD - wend down
        const WU_CONF = 0.35; // how much conf delta impacts new s
        const WU_R = 2; // how much good review time impacts new s
        const SS_R = 1.3; // how much good review impacts
        const SS_C = 1.15; // constant in staty the same
        const WD_C = 0.65; // constant to decrease
        const WD_R = 0.4; // how much review impacts

        const s = topic.stability;
        const confDelta = args.confidence - topic.confidence;

        // calculate t since last review
        const t = Math.max(
          0.05,
          Math.max(0, now - topic.lastRecallAt) / 86_400_000,
        );

        // calculate r - retriviability (0-1 score of how long since last review, kind of urgency)
        const r = Math.pow(1 + ((19 / 81) * t) / s, -0.5);

        // calculate new s (n days to get 100% -> 90% of remembering)
        let newS: number;
        if (confDelta > 0) {
          newS = s * (1 + WU_CONF * confDelta) * (1 + WU_R * (1 - r)); // reward good time review and good delta
        } else if (confDelta == 0) {
          newS = s * (SS_C + SS_R * (1 - r)); // increase a bit, depending on when it was reviewed
        } else {
          newS = s * (WD_C + WD_R * (1 - r)); // reducing s for next time
        }

        await ctx.db.patch(args.id, {
          confidence: args.confidence,
          lastRecallAt: now,
          stability: newS,
        });
      } else {
        await ctx.db.patch(args.id, {
          confidence: args.confidence,
          stability: initialStabilityToConfidence[args.confidence - 1],
          lastRecallAt: now,
        });
      }
    }
    await recomputeAncestorConfidence(ctx, topic.parentId);
  },
});

export const deleteTopic = mutation({
  args: { id: v.id("topics") },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const topic = await ctx.db.get(args.id);
    if (!topic || topic.userId !== user._id) return;

    await deleteDescendants(ctx, args.id);
    await ctx.db.delete(args.id);
    await verifyOrder(ctx, topic.courseId, topic.parentId);
  },
});

export const addBelow = mutation({
  args: { id: v.id("topics") },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const topic = await ctx.db.get(args.id);
    if (!topic || topic.userId !== user._id) return;

    const sibilings = await ctx.db
      .query("topics")
      .withIndex("by_parentId", (q) => q.eq("parentId", topic.parentId))
      .collect();

    for (const sibling of sibilings) {
      if (sibling.order > topic.order) {
        await ctx.db.patch(sibling._id, { order: sibling.order + 1 });
      }
    }

    return await ctx.db.insert("topics", {
      userId: user._id,
      courseId: topic.courseId,
      order: topic.order + 1,
      parentId: topic.parentId,
      confidence: 1,
      stability: 1,
      lastRecallAt: undefined,
      isLeaf: true,
      title: `New Topic`,
    });
  },
});

// helpers
async function verifyOrder(
  ctx: MutationCtx,
  courseId: Id<"courses">,
  parentId: Id<"topics"> | undefined,
): Promise<void> {
  const sibilings = await ctx.db
    .query("topics")
    .withIndex("by_courses_parentId_order", (q) =>
      q.eq("courseId", courseId).eq("parentId", parentId),
    )
    .order("asc")
    .collect();

  for (let i = 0; i < sibilings.length; i++) {
    const expectedOrder = i + 1;
    if (sibilings[i].order !== expectedOrder) {
      await ctx.db.patch(sibilings[i]._id, { order: expectedOrder });
    }
  }
}
async function deleteDescendants(
  ctx: MutationCtx,
  topicId: Id<"topics">,
): Promise<void> {
  const children = await ctx.db
    .query("topics")
    .withIndex("by_parentId", (q) => q.eq("parentId", topicId))
    .collect();

  for (const child of children) {
    await deleteDescendants(ctx, child._id);
    await ctx.db.delete(child._id);
  }
}

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

async function findTopicPath(
  ctx: QueryCtx,
  topicId: Id<"topics"> | undefined,
): Promise<string[]> {
  if (!topicId) return [];
  const topic = await ctx.db.get(topicId);
  if (!topic) return [];

  const parentPath = await findTopicPath(ctx, topic.parentId);
  return [...parentPath, topic.title];
}

function computeExamUrgency(
  examDate: string | undefined,
  nowMs: number,
): number {
  if (!examDate) return 1;

  const examMs = Date.parse(examDate);
  if (Number.isNaN(examMs)) return 1;

  const daysLeft = Math.max(0, (examMs - nowMs) / 86_400_000);

  const eu = 1 + Math.max(0, (90 - daysLeft) / 90);
  return Math.min(2, Math.max(1, eu));
}
