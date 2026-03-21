import type { PlannerRepository, CreateSubjectInput, UpdateSubjectInput, ImportTopicsInput, UpdateTopicRatingInput, UpdateTopicInput, ReorderTopicsInput, ReorganizeTopicsInput, CompleteSessionInput } from "$lib/repository.js";
import type { Subject, Topic, StudySession, RecommendationRequest, Recommendation } from "$lib/types.js";
import { readSubjects, writeSubjects, readTopics, writeTopics, readStudySessions, writeStudySessions } from "./local-storage.js";
import { generateId, nowTimestamp } from "$lib/utils.js";
import { computeRecommendation } from "$lib/engine.js";

/**
 * Local browser-storage backed implementation of PlannerRepository.
 * All data lives in localStorage.
 */
export class LocalRepository implements PlannerRepository {
	// Subjects

	async listSubjects(): Promise<Subject[]> {
		return readSubjects();
	}

	async getSubject(id: string): Promise<Subject | null> {
		return readSubjects().find((s) => s.id === id) ?? null;
	}

	async createSubject(input: CreateSubjectInput): Promise<Subject> {
		const subjects = readSubjects();
		const now = nowTimestamp();
		const subject: Subject = {
			id: generateId(),
			name: input.name,
			examDate: input.examDate,
			defaultSessionMinutes: input.defaultSessionMinutes,
			createdAt: now,
			updatedAt: now,
		};
		subjects.push(subject);
		writeSubjects(subjects);
		return subject;
	}

	async updateSubject(input: UpdateSubjectInput): Promise<Subject> {
		const subjects = readSubjects();
		const idx = subjects.findIndex((s) => s.id === input.id);
		if (idx === -1) throw new Error(`Subject not found: ${input.id}`);
		const subject = subjects[idx];
		if (input.name !== undefined) subject.name = input.name;
		if (input.examDate !== undefined) subject.examDate = input.examDate;
		if (input.defaultSessionMinutes !== undefined) subject.defaultSessionMinutes = input.defaultSessionMinutes;
		subject.updatedAt = nowTimestamp();
		subjects[idx] = subject;
		writeSubjects(subjects);
		return subject;
	}

	async deleteSubject(id: string): Promise<void> {
		writeSubjects(readSubjects().filter((s) => s.id !== id));
		// Also delete related topics and sessions
		writeTopics(readTopics().filter((t) => t.subjectId !== id));
		writeStudySessions(readStudySessions().filter((s) => s.subjectId !== id));
	}

	// Topics

	async listTopics(subjectId: string): Promise<Topic[]> {
		return readTopics().filter((t) => t.subjectId === subjectId);
	}

	async getTopic(id: string): Promise<Topic | null> {
		return readTopics().find((t) => t.id === id) ?? null;
	}

	async importTopics(input: ImportTopicsInput): Promise<Topic[]> {
		const allTopics = readTopics();
		const now = nowTimestamp();

		// Map from temporary code-based references to real IDs
		const codeToId = new Map<string, string>();

		const newTopics: Topic[] = input.topics.map((t) => {
			const id = generateId();
			codeToId.set(t.code, id);

			// Resolve parentTopicId from code
			let parentTopicId: string | null = null;
			if (t.parentTopicId) {
				parentTopicId = codeToId.get(t.parentTopicId) ?? null;
			}

			return {
				id,
				subjectId: input.subjectId,
				code: t.code,
				title: t.title,
				depth: t.depth,
				parentTopicId,
				importance: 3 as const,
				confidence: "not_started" as const,
				lastStudiedAt: null,
				lastRecallAt: null,
				createdAt: now,
				updatedAt: now,
			};
		});

		writeTopics([...allTopics, ...newTopics]);
		return newTopics;
	}

	async updateTopicRating(input: UpdateTopicRatingInput): Promise<Topic> {
		const topics = readTopics();
		const idx = topics.findIndex((t) => t.id === input.topicId);
		if (idx === -1) throw new Error(`Topic not found: ${input.topicId}`);
		const topic = topics[idx];
		if (input.confidence !== undefined) topic.confidence = input.confidence;
		if (input.importance !== undefined) topic.importance = input.importance;
		topic.updatedAt = nowTimestamp();
		topics[idx] = topic;
		writeTopics(topics);
		return topic;
	}

	async updateTopic(input: UpdateTopicInput): Promise<Topic> {
		const topics = readTopics();
		const idx = topics.findIndex((t) => t.id === input.topicId);
		if (idx === -1) throw new Error(`Topic not found: ${input.topicId}`);
		const topic = topics[idx];
		if (input.title !== undefined) topic.title = input.title;
		if (input.code !== undefined) topic.code = input.code;
		topic.updatedAt = nowTimestamp();
		topics[idx] = topic;
		writeTopics(topics);
		return topic;
	}

	async reorderTopics(input: ReorderTopicsInput): Promise<Topic[]> {
		const allTopics = readTopics();
		const subjectTopics = allTopics.filter((t) => t.subjectId === input.subjectId);
		const otherTopics = allTopics.filter((t) => t.subjectId !== input.subjectId);

		// Build a map for quick lookup
		const topicMap = new Map<string, Topic>();
		for (const t of subjectTopics) topicMap.set(t.id, t);

		// Reorder based on provided ID order
		const reordered: Topic[] = [];
		for (const id of input.topicIds) {
			const topic = topicMap.get(id);
			if (topic) reordered.push(topic);
		}

		// Include any topics not in the reorder list (shouldn't happen but be safe)
		for (const t of subjectTopics) {
			if (!input.topicIds.includes(t.id)) reordered.push(t);
		}

		writeTopics([...otherTopics, ...reordered]);
		return reordered;
	}

	async reorganizeTopics(input: ReorganizeTopicsInput): Promise<Topic[]> {
		const allTopics = readTopics();
		const otherTopics = allTopics.filter((t) => t.subjectId !== input.subjectId);
		const topicMap = new Map<string, Topic>();
		for (const t of allTopics.filter((t) => t.subjectId === input.subjectId)) {
			topicMap.set(t.id, t);
		}

		const now = nowTimestamp();
		const reordered: Topic[] = [];
		for (const update of input.topics) {
			const existing = topicMap.get(update.topicId);
			if (!existing) continue;
			reordered.push({
				...existing,
				code: update.code,
				depth: update.depth,
				parentTopicId: update.parentTopicId,
				updatedAt: now,
			});
		}

		writeTopics([...otherTopics, ...reordered]);
		return reordered;
	}

	async deleteTopic(topicId: string): Promise<void> {
		const topics = readTopics();
		const topic = topics.find((t) => t.id === topicId);
		if (!topic) return;
		// Delete the topic and all its children
		const idsToDelete = new Set<string>([topicId]);
		let changed = true;
		while (changed) {
			changed = false;
			for (const t of topics) {
				if (t.parentTopicId && idsToDelete.has(t.parentTopicId) && !idsToDelete.has(t.id)) {
					idsToDelete.add(t.id);
					changed = true;
				}
			}
		}
		const remainingTopics = topics.filter((t) => !idsToDelete.has(t.id));
		const subjectTopics = remainingTopics
			.filter((t) => t.subjectId === topic.subjectId)
			.sort(compareTopicsByCode);
		const renumbered = renumberTopics(subjectTopics);
		const otherTopics = remainingTopics.filter((t) => t.subjectId !== topic.subjectId);
		writeTopics([...otherTopics, ...renumbered]);
	}

	async deleteTopicsBySubject(subjectId: string): Promise<void> {
		writeTopics(readTopics().filter((t) => t.subjectId !== subjectId));
	}

	// Recommendations

	async getRecommendation(input: RecommendationRequest): Promise<Recommendation | null> {
		const subjects = input.subjectId
			? readSubjects().filter((s) => s.id === input.subjectId)
			: readSubjects();

		const allTopics = readTopics();
		const relevantTopics = subjects.length > 0
			? allTopics.filter((t) => subjects.some((s) => s.id === t.subjectId))
			: allTopics;

		return computeRecommendation(relevantTopics, subjects, input);
	}

	// Study Sessions

	async listStudySessions(subjectId?: string): Promise<StudySession[]> {
		const sessions = readStudySessions();
		return subjectId ? sessions.filter((s) => s.subjectId === subjectId) : sessions;
	}

	async completeStudySession(input: CompleteSessionInput): Promise<StudySession> {
		const sessions = readStudySessions();
		const now = nowTimestamp();

		// Get topic to record confidence before
		const topic = readTopics().find((t) => t.id === input.topicId);
		if (!topic) throw new Error(`Topic not found: ${input.topicId}`);

		const session: StudySession = {
			id: generateId(),
			subjectId: input.subjectId,
			topicId: input.topicId,
			actionType: input.actionType as StudySession["actionType"],
			plannedMinutes: input.plannedMinutes,
			completedAt: now,
			confidenceBefore: topic.confidence,
			confidenceAfter: input.confidenceAfter,
		};

		sessions.push(session);
		writeStudySessions(sessions);

		// Update topic: lastStudiedAt, lastRecallAt, and confidence
		const topics = readTopics();
		const topicIdx = topics.findIndex((t) => t.id === input.topicId);
		if (topicIdx !== -1) {
			topics[topicIdx].lastStudiedAt = now;
			topics[topicIdx].lastRecallAt = now;
			if (input.confidenceAfter) {
				topics[topicIdx].confidence = input.confidenceAfter;
			}
			topics[topicIdx].updatedAt = now;
			writeTopics(topics);
		}

		return session;
	}
}

function renumberTopics(topics: Topic[]): Topic[] {
	const now = nowTimestamp();
	const siblingCounter = new Map<string, number>();
	const codes = new Map<string, string>();

	return topics.map((topic) => {
		const key = topic.parentTopicId ?? "__root__";
		const count = (siblingCounter.get(key) ?? 0) + 1;
		siblingCounter.set(key, count);

		const parentCode = topic.parentTopicId
			? (codes.get(topic.parentTopicId) ?? "")
			: "";
		const code = parentCode ? `${parentCode}.${count}` : `${count}`;
		codes.set(topic.id, code);

		return {
			...topic,
			code,
			updatedAt: now,
		};
	});
}

function compareTopicsByCode(a: Topic, b: Topic): number {
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
