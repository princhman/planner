/**
 * Convex-backed implementation of PlannerRepository.
 *
 * This repository is used after login. It communicates with
 * Convex cloud functions via the ConvexClient.
 *
 * NOTE: Requires `npx convex dev` to be run first to generate
 * the `_generated/` directory and deploy the schema.
 */

import type {
	PlannerRepository,
	CreateSubjectInput,
	UpdateSubjectInput,
	ImportTopicsInput,
	UpdateTopicRatingInput,
	CompleteSessionInput,
} from "$lib/repository.js";
import type {
	Subject,
	Topic,
	StudySession,
	RecommendationRequest,
	Recommendation,
	ConfidenceLevel,
} from "$lib/types.js";
import { computeRecommendation } from "$lib/engine.js";
import type { ConvexClient } from "convex/browser";

/**
 * Create a ConvexRepository once the Convex API is available.
 *
 * Usage:
 *   const api = (await import('$convex/_generated/api.js')).api;
 *   const repo = new ConvexRepository(client, userId, api);
 */
export class ConvexRepository implements PlannerRepository {
	constructor(
		private client: ConvexClient,
		private userId: string,
		private api: any, // Will be typed once _generated exists
	) {}

	// ── Subjects ──

	async listSubjects(): Promise<Subject[]> {
		const docs = await this.client.query(this.api.subjects.list, {
			userId: this.userId,
		});
		return docs.map(this.docToSubject);
	}

	async getSubject(id: string): Promise<Subject | null> {
		const doc = await this.client.query(this.api.subjects.get, {
			id,
			userId: this.userId,
		});
		return doc ? this.docToSubject(doc) : null;
	}

	async createSubject(input: CreateSubjectInput): Promise<Subject> {
		const id = await this.client.mutation(this.api.subjects.create, {
			userId: this.userId,
			name: input.name,
			examDate: input.examDate ?? undefined,
			defaultSessionMinutes: input.defaultSessionMinutes,
		});
		const now = Date.now();
		return {
			id: id as string,
			name: input.name,
			examDate: input.examDate,
			defaultSessionMinutes: input.defaultSessionMinutes,
			createdAt: now,
			updatedAt: now,
		};
	}

	async updateSubject(input: UpdateSubjectInput): Promise<Subject> {
		await this.client.mutation(this.api.subjects.update, {
			id: input.id,
			userId: this.userId,
			name: input.name,
			examDate: input.examDate ?? undefined,
			defaultSessionMinutes: input.defaultSessionMinutes,
		});
		// Refetch to get updated doc
		const doc = await this.client.query(this.api.subjects.get, {
			id: input.id,
			userId: this.userId,
		});
		return this.docToSubject(doc);
	}

	async deleteSubject(id: string): Promise<void> {
		await this.client.mutation(this.api.subjects.remove, {
			id,
			userId: this.userId,
		});
	}

	// ── Topics ──

	async listTopics(subjectId: string): Promise<Topic[]> {
		const docs = await this.client.query(this.api.topics.listBySubject, {
			subjectId,
			userId: this.userId,
		});
		return docs.map(this.docToTopic);
	}

	async getTopic(id: string): Promise<Topic | null> {
		const doc = await this.client.query(this.api.topics.get, {
			id,
			userId: this.userId,
		});
		return doc ? this.docToTopic(doc) : null;
	}

	async importTopics(input: ImportTopicsInput): Promise<Topic[]> {
		const ids = await this.client.mutation(this.api.topics.importBatch, {
			userId: this.userId,
			subjectId: input.subjectId,
			topics: input.topics.map((t) => ({
				code: t.code,
				title: t.title,
				depth: t.depth,
				parentCode: t.parentTopicId ?? undefined,
			})),
		});
		// Refetch to get full docs
		const docs = await this.client.query(this.api.topics.listBySubject, {
			subjectId: input.subjectId,
			userId: this.userId,
		});
		return docs.map(this.docToTopic);
	}

	async updateTopicRating(input: UpdateTopicRatingInput): Promise<Topic> {
		await this.client.mutation(this.api.topics.updateRating, {
			id: input.topicId,
			userId: this.userId,
			confidence: input.confidence,
			importance: input.importance,
		});
		const doc = await this.client.query(this.api.topics.get, {
			id: input.topicId,
			userId: this.userId,
		});
		return this.docToTopic(doc);
	}

	async deleteTopicsBySubject(subjectId: string): Promise<void> {
		await this.client.mutation(this.api.topics.deleteBySubject, {
			subjectId,
			userId: this.userId,
		});
	}

	// ── Recommendations ──

	async getRecommendation(
		input: RecommendationRequest,
	): Promise<Recommendation | null> {
		// Recommendation runs client-side using the engine
		const allTopics = input.subjectId
			? await this.listTopics(input.subjectId)
			: await this.getAllUserTopics();
		const subjects = await this.listSubjects();
		const relevantSubjects = input.subjectId
			? subjects.filter((s) => s.id === input.subjectId)
			: subjects;
		const relevantTopics = relevantSubjects.length > 0
			? allTopics.filter((t) =>
					relevantSubjects.some((s) => s.id === t.subjectId),
				)
			: allTopics;

		return computeRecommendation(relevantTopics, relevantSubjects, input);
	}

	// ── Study Sessions ──

	async listStudySessions(subjectId?: string): Promise<StudySession[]> {
		const docs = await this.client.query(this.api.studySessions.list, {
			userId: this.userId,
			subjectId: subjectId ?? undefined,
		});
		return docs.map(this.docToSession);
	}

	async completeStudySession(input: CompleteSessionInput): Promise<StudySession> {
		const sessionId = await this.client.mutation(
			this.api.studySessions.complete,
			{
				userId: this.userId,
				subjectId: input.subjectId,
				topicId: input.topicId,
				actionType: input.actionType,
				plannedMinutes: input.plannedMinutes,
				confidenceAfter: input.confidenceAfter ?? undefined,
			},
		);
		const now = Date.now();
		const topic = await this.getTopic(input.topicId);
		return {
			id: sessionId as string,
			subjectId: input.subjectId,
			topicId: input.topicId,
			actionType: input.actionType as StudySession["actionType"],
			plannedMinutes: input.plannedMinutes,
			completedAt: now,
			confidenceBefore: topic?.confidence ?? "not_started",
			confidenceAfter: input.confidenceAfter,
		};
	}

	// ── Helpers ──

	private async getAllUserTopics(): Promise<Topic[]> {
		const docs = await this.client.query(this.api.topics.listByUser, {
			userId: this.userId,
		});
		return docs.map(this.docToTopic);
	}

	private docToSubject(doc: any): Subject {
		return {
			id: doc._id,
			name: doc.name,
			examDate: doc.examDate ?? null,
			defaultSessionMinutes: doc.defaultSessionMinutes,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}

	private docToTopic(doc: any): Topic {
		return {
			id: doc._id,
			subjectId: doc.subjectId,
			code: doc.code,
			title: doc.title,
			depth: doc.depth,
			parentTopicId: doc.parentTopicId ?? null,
			importance: doc.importance as Topic["importance"],
			confidence: doc.confidence as ConfidenceLevel,
			lastStudiedAt: doc.lastStudiedAt ?? null,
			lastRecallAt: doc.lastRecallAt ?? null,
			createdAt: doc.createdAt,
			updatedAt: doc.updatedAt,
		};
	}

	private docToSession(doc: any): StudySession {
		return {
			id: doc._id,
			subjectId: doc.subjectId,
			topicId: doc.topicId,
			actionType: doc.actionType as StudySession["actionType"],
			plannedMinutes: doc.plannedMinutes,
			completedAt: doc.completedAt,
			confidenceBefore: doc.confidenceBefore as ConfidenceLevel,
			confidenceAfter: (doc.confidenceAfter as ConfidenceLevel) ?? null,
		};
	}
}
