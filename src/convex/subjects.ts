import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

// ── Queries ──

export const list = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("subjects")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

export const get = query({
	args: { id: v.id("subjects"), userId: v.id("users") },
	handler: async (ctx, args) => {
		const subject = await ctx.db.get(args.id);
		if (!subject || subject.userId !== args.userId) return null;
		return subject;
	},
});

// ── Mutations ──

export const create = mutation({
	args: {
		userId: v.id("users"),
		name: v.string(),
		examDate: v.optional(v.string()),
		defaultSessionMinutes: v.number(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("subjects", {
			userId: args.userId,
			name: args.name,
			examDate: args.examDate,
			defaultSessionMinutes: args.defaultSessionMinutes,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const update = mutation({
	args: {
		id: v.id("subjects"),
		userId: v.id("users"),
		name: v.optional(v.string()),
		examDate: v.optional(v.string()),
		defaultSessionMinutes: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== args.userId) {
			throw new Error("Subject not found");
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
	args: { id: v.id("subjects"), userId: v.id("users") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== args.userId) {
			throw new Error("Subject not found");
		}
		// Delete related topics
		const topics = await ctx.db
			.query("topics")
			.withIndex("by_subject", (q) => q.eq("subjectId", args.id))
			.collect();
		for (const topic of topics) {
			await ctx.db.delete(topic._id);
		}
		// Delete related sessions
		const sessions = await ctx.db
			.query("studySessions")
			.withIndex("by_subject", (q) => q.eq("subjectId", args.id))
			.collect();
		for (const session of sessions) {
			await ctx.db.delete(session._id);
		}
		// Delete the subject
		await ctx.db.delete(args.id);
	},
});
