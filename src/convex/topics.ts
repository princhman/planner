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

export const update = mutation({
	args: {
		id: v.id("topics"),
		userId: v.id("users"),
		title: v.optional(v.string()),
		code: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== args.userId) {
			throw new Error("Topic not found");
		}

		const updates: Record<string, unknown> = { updatedAt: Date.now() };
		if (args.title !== undefined) updates.title = args.title;
		if (args.code !== undefined) updates.code = args.code;
		await ctx.db.patch(args.id, updates);
	},
});

export const reorganize = mutation({
	args: {
		userId: v.id("users"),
		subjectId: v.id("subjects"),
		topics: v.array(
			v.object({
				id: v.id("topics"),
				code: v.string(),
				depth: v.number(),
				parentTopicId: v.optional(v.id("topics")),
			}),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		for (const topic of args.topics) {
			const existing = await ctx.db.get(topic.id);
			if (
				!existing ||
				existing.userId !== args.userId ||
				existing.subjectId !== args.subjectId
			) {
				throw new Error("Topic not found");
			}
		}

		for (const topic of args.topics) {
			await ctx.db.patch(topic.id, {
				code: topic.code,
				depth: topic.depth,
				parentTopicId: topic.parentTopicId,
				updatedAt: now,
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

export const remove = mutation({
	args: { id: v.id("topics"), userId: v.id("users") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing || existing.userId !== args.userId) {
			throw new Error("Topic not found");
		}

		const subjectTopics = await ctx.db
			.query("topics")
			.withIndex("by_subject", (q) => q.eq("subjectId", existing.subjectId))
			.collect();

		const idsToDelete = new Set<string>([args.id]);
		let changed = true;

		while (changed) {
			changed = false;
			for (const topic of subjectTopics) {
				if (
					topic.userId === args.userId &&
					topic.parentTopicId &&
					idsToDelete.has(topic.parentTopicId) &&
					!idsToDelete.has(topic._id)
				) {
					idsToDelete.add(topic._id);
					changed = true;
				}
			}
		}

		for (const topicId of idsToDelete) {
			await ctx.db.delete(topicId as never);
		}

		const now = Date.now();
		const remainingTopics = subjectTopics
			.filter((topic) => topic.userId === args.userId && !idsToDelete.has(topic._id))
			.sort(compareTopicDocsByCode);
		const updates = buildRenumberedTopicUpdates(remainingTopics);

		for (const update of updates) {
			await ctx.db.patch(update.id, {
				code: update.code,
				updatedAt: now,
			});
		}
	},
});

function buildRenumberedTopicUpdates(
	topics: Array<{
		_id: Id<"topics">;
		code: string;
		parentTopicId?: Id<"topics">;
	}>,
): Array<{ id: Id<"topics">; code: string }> {
	const siblingCounter = new Map<string, number>();
	const codes = new Map<Id<"topics">, string>();

	return topics.map((topic) => {
		const key = topic.parentTopicId ?? "__root__";
		const count = (siblingCounter.get(key) ?? 0) + 1;
		siblingCounter.set(key, count);

		const parentCode = topic.parentTopicId
			? (codes.get(topic.parentTopicId) ?? "")
			: "";
		const code = parentCode ? `${parentCode}.${count}` : `${count}`;
		codes.set(topic._id, code);

		return { id: topic._id, code };
	});
}

function compareTopicDocsByCode(
	a: { code: string },
	b: { code: string },
): number {
	const aParts = a.code.split(".").map((part) => Number(part));
	const bParts = b.code.split(".").map((part) => Number(part));
	const maxLength = Math.max(aParts.length, bParts.length);

	for (let i = 0; i < maxLength; i++) {
		const aPart = aParts[i];
		const bPart = bParts[i];

		if (aPart === undefined) return -1;
		if (bPart === undefined) return 1;
		if (aPart !== bPart) return aPart - bPart;
	}

	return 0;
}
