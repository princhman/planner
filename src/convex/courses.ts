import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

// ── Queries ──

export const list = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    return await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId!))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("courses"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const course = await ctx.db.get(args.id);
    if (!course || course.userId !== args.userId) return null;
    return course;
  },
});

// ── Mutations ──

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    examDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("courses", {
      userId: args.userId,
      name: args.name,
      examDate: args.examDate,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("courses"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    examDate: v.optional(v.string()),
    defaultSessionMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== args.userId) {
      throw new Error("course not found");
    }
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.examDate !== undefined) updates.examDate = args.examDate;
    if (args.defaultSessionMinutes !== undefined)
      updates.defaultSessionMinutes = args.defaultSessionMinutes;
    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("courses"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== args.userId) {
      throw new Error("Course not found");
    }
    // Delete related topics
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", args.userId).eq("courseId", args.id),
      )
      .collect();
    for (const topic of topics) {
      await ctx.db.delete(topic._id);
    }
    // Delete the course
    await ctx.db.delete(args.id);
  },
});
