import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { getAuthUser, getAuthUserOrThrow } from "./auth.js";

// ── Queries ──

export const list = query({
  args: {},
  handler: async (ctx) => {
    // getAuthUser reads the JWT and finds the user — no args needed
    const user = await getAuthUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await getAuthUser(ctx);
    if (!user) return null;
    const course = await ctx.db.get(args.id);
    if (!course || course.userId !== user._id) return null;
    return course;
  },
});

// ── Mutations ──

export const create = mutation({
  args: {
    name: v.string(),
    examDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    return await ctx.db.insert("courses", {
      userId: user._id,
      name: args.name,
      examDate: args.examDate,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("courses"),
    name: v.optional(v.string()),
    examDate: v.optional(v.string()),
    defaultSessionMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
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
  args: { id: v.id("courses") },
  handler: async (ctx, args) => {
    const user = await getAuthUserOrThrow(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== user._id) {
      throw new Error("Course not found");
    }
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", user._id).eq("courseId", args.id),
      )
      .collect();
    for (const topic of topics) {
      await ctx.db.delete(topic._id);
    }
    await ctx.db.delete(args.id);
  },
});
