import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import {
  internalMutation,
  mutation,
  MutationCtx,
  query,
} from "./_generated/server.js";

// ── Queries ──

export const listBySubject = query({
  args: { subjectId: v.id("subjects"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .collect();
    // Verify ownership
    return topics.filter((t) => t.userId === args.userId);
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    title: v.string(),
    parentId: v.optional(v.id("topics")),
  },
  handler: async (ctx, args) => {
    // order starts at 1
    const topicWithMaxOrder = await ctx.db
      .query("topics")
      .withIndex("by_subject_parenId_order", (q) =>
        q.eq("subjectId", args.subjectId).eq("parentId", args.parentId),
      )
      .order("desc")
      .first();
    const order = topicWithMaxOrder ? topicWithMaxOrder.order + 1 : 1;

    const id = await ctx.db.insert("topics", {
      userId: args.userId,
      subjectId: args.subjectId,
      order: order,
      title: args.title,
      parentId: args.parentId,
      confidence: 1,
      lastRecallAt: undefined,
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
    }
  },
});

export const deleteBySubject = mutation({
  args: { subjectId: v.id("subjects"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId))
      .collect();
    for (const topic of topics) {
      if (topic.userId === args.userId) {
        await ctx.db.delete(topic._id);
      }
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
      // updating confidence, maybe should enforce the leaf-only updates
      await ctx.db.patch(args.id, { confidence: args.confidence });

      // recompute for ancestors
      let parentId = topic.parentId;

      await recomputeAncestorConfidence(ctx, parentId);
    }
  },
});

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
