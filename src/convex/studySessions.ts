import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

// ── Queries ──

export const list = query({
	args: { userId: v.id("users"), subjectId: v.optional(v.id("subjects")) },
	handler: async (ctx, args) => {
		if (args.subjectId) {
			const sessions = await ctx.db
				.query("studySessions")
				.withIndex("by_subject", (q) => q.eq("subjectId", args.subjectId!))
				.collect();
			return sessions.filter((s) => s.userId === args.userId);
		}
		return await ctx.db
			.query("studySessions")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
	},
});

// ── Mutations ──

export const complete = mutation({
	args: {
		userId: v.id("users"),
		subjectId: v.id("subjects"),
		topicId: v.id("topics"),
		actionType: v.string(),
		plannedMinutes: v.number(),
		confidenceAfter: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		// Get topic for confidenceBefore
		const topic = await ctx.db.get(args.topicId);
		if (!topic || topic.userId !== args.userId) {
			throw new Error("Topic not found");
		}

		// Create session record
		const sessionId = await ctx.db.insert("studySessions", {
			userId: args.userId,
			subjectId: args.subjectId,
			topicId: args.topicId,
			actionType: args.actionType,
			plannedMinutes: args.plannedMinutes,
			completedAt: now,
			confidenceBefore: topic.confidence,
			confidenceAfter: args.confidenceAfter,
		});

		// Update topic
		const topicUpdates: Record<string, unknown> = {
			lastStudiedAt: now,
			lastRecallAt: now,
			updatedAt: now,
		};
		if (args.confidenceAfter) {
			topicUpdates.confidence = args.confidenceAfter;
		}
		await ctx.db.patch(args.topicId, topicUpdates);

		return sessionId;
	},
});
