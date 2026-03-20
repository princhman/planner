import type {
	Subject,
	Topic,
	StudySession,
	RecommendationRequest,
	Recommendation,
	ConfidenceLevel,
} from "./types.js";

// Input types for creating/updating records

export type CreateSubjectInput = {
	name: string;
	examDate: string | null;
	defaultSessionMinutes: number;
};

export type UpdateSubjectInput = {
	id: string;
	name?: string;
	examDate?: string | null;
	defaultSessionMinutes?: number;
};

export type ImportTopicsInput = {
	subjectId: string;
	topics: Array<{
		code: string;
		title: string;
		depth: number;
		parentTopicId: string | null;
	}>;
};

export type UpdateTopicRatingInput = {
	topicId: string;
	confidence?: ConfidenceLevel;
	importance?: 1 | 2 | 3 | 4 | 5;
};

export type CompleteSessionInput = {
	subjectId: string;
	topicId: string;
	actionType: string;
	plannedMinutes: number;
	confidenceAfter: ConfidenceLevel | null;
};

/**
 * Domain repository interface.
 *
 * This abstraction is used by UI code so the data source
 * can be swapped between local browser storage and Convex
 * without changing the UI layer.
 */
export interface PlannerRepository {
	// Subjects
	listSubjects(): Promise<Subject[]>;
	getSubject(id: string): Promise<Subject | null>;
	createSubject(input: CreateSubjectInput): Promise<Subject>;
	updateSubject(input: UpdateSubjectInput): Promise<Subject>;
	deleteSubject(id: string): Promise<void>;

	// Topics
	listTopics(subjectId: string): Promise<Topic[]>;
	getTopic(id: string): Promise<Topic | null>;
	importTopics(input: ImportTopicsInput): Promise<Topic[]>;
	updateTopicRating(input: UpdateTopicRatingInput): Promise<Topic>;
	deleteTopicsBySubject(subjectId: string): Promise<void>;

	// Recommendations
	getRecommendation(input: RecommendationRequest): Promise<Recommendation | null>;

	// Study Sessions
	listStudySessions(subjectId?: string): Promise<StudySession[]>;
	completeStudySession(input: CompleteSessionInput): Promise<StudySession>;
}
