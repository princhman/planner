import { v } from "convex/values";
import { mutation } from "./_generated/server.js";

/**
 * Import local planner data into a Convex account.
 * Used during first-login sync.
 */
export const importLocalData = mutation({
	args: {
		userId: v.id("users"),
		subjects: v.array(
			v.object({
				localId: v.string(),
				name: v.string(),
				examDate: v.optional(v.string()),
				defaultSessionMinutes: v.number(),
				createdAt: v.number(),
				updatedAt: v.number(),
			}),
		),
		topics: v.array(
			v.object({
				localId: v.string(),
				localSubjectId: v.string(),
				code: v.string(),
				title: v.string(),
				depth: v.number(),
				importance: v.number(),
				confidence: v.string(),
				lastStudiedAt: v.optional(v.number()),
				lastRecallAt: v.optional(v.number()),
				createdAt: v.number(),
				updatedAt: v.number(),
			}),
		),
		sessions: v.array(
			v.object({
				localSubjectId: v.string(),
				localTopicId: v.string(),
				actionType: v.string(),
				plannedMinutes: v.number(),
				completedAt: v.number(),
				confidenceBefore: v.string(),
				confidenceAfter: v.optional(v.string()),
			}),
		),
	},
	handler: async (ctx, args) => {
		// Map local IDs to Convex IDs
		const subjectIdMap = new Map<string, string>();
		const topicIdMap = new Map<string, string>();

		// Import subjects
		for (const s of args.subjects) {
			const id = await ctx.db.insert("subjects", {
				userId: args.userId,
				name: s.name,
				examDate: s.examDate,
				defaultSessionMinutes: s.defaultSessionMinutes,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
			});
			subjectIdMap.set(s.localId, id);
		}

		// Import topics
		for (const t of args.topics) {
			const subjectId = subjectIdMap.get(t.localSubjectId);
			if (!subjectId) continue;

			const id = await ctx.db.insert("topics", {
				userId: args.userId,
				subjectId: subjectId as any,
				code: t.code,
				title: t.title,
				depth: t.depth,
				parentTopicId: undefined,
				importance: t.importance,
				confidence: t.confidence,
				lastStudiedAt: t.lastStudiedAt,
				lastRecallAt: t.lastRecallAt,
				createdAt: t.createdAt,
				updatedAt: t.updatedAt,
			});
			topicIdMap.set(t.localId, id);
		}

		// Import sessions
		for (const s of args.sessions) {
			const subjectId = subjectIdMap.get(s.localSubjectId);
			const topicId = topicIdMap.get(s.localTopicId);
			if (!subjectId || !topicId) continue;

			await ctx.db.insert("studySessions", {
				userId: args.userId,
				subjectId: subjectId as any,
				topicId: topicId as any,
				actionType: s.actionType,
				plannedMinutes: s.plannedMinutes,
				completedAt: s.completedAt,
				confidenceBefore: s.confidenceBefore,
				confidenceAfter: s.confidenceAfter,
			});
		}

		return { imported: true };
	},
});
