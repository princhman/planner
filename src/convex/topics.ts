import { v } from "convex/values";
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

export const get = query({
	args: { id: v.id("topics"), userId: v.id("users") },
	handler: async (ctx, args) => {
		const topic = await ctx.db.get(args.id);
		if (!topic || topic.userId !== args.userId) return null;
		return topic;
	},
});

export const listByUser = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("topics")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

// ── Mutations ──

export const importBatch = mutation({
	args: {
		userId: v.id("users"),
		subjectId: v.id("subjects"),
		topics: v.array(
			v.object({
				code: v.string(),
				title: v.string(),
				depth: v.number(),
				parentCode: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const codeToId = new Map<string, string>();
		const results = [];

		for (const t of args.topics) {
			const parentTopicId = t.parentCode ? codeToId.get(t.parentCode) : undefined;

			const id = await ctx.db.insert("topics", {
				userId: args.userId,
				subjectId: args.subjectId,
				code: t.code,
				title: t.title,
				depth: t.depth,
				parentTopicId: parentTopicId as any,
				importance: 3,
				confidence: "not_started",
				lastStudiedAt: undefined,
				lastRecallAt: undefined,
				createdAt: now,
				updatedAt: now,
			});

			codeToId.set(t.code, id);
			results.push(id);
		}

		return results;
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
