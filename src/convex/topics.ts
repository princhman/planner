import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import { mutation, query } from "./_generated/server.js";

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
      importance: 3,
      confidence: "not_started",
      lastRecallAt: undefined,
    });

    return id;
  },
});

export const updateRating = mutation({
  args: {
    id: v.id("topics"),
    userId: v.id("users"),
    confidence: v.optional(v.string()),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== args.userId) {
      throw new Error("Topic not found");
    }
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.confidence !== undefined) updates.confidence = args.confidence;
    if (args.importance !== undefined) updates.importance = args.importance;
    await ctx.db.patch(args.id, updates);
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
    for (const u of updates) {
      await ctx.db.patch(u.id, {
        parentId: u.parentId,
        order: u.order,
      });
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
