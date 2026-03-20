export type ConfidenceLevel =
	| "not_started"
	| "recognize"
	| "explain"
	| "standard_questions"
	| "exam_ready";

export type ActionType =
	| "review_core_material"
	| "closed_book_recall"
	| "brief_summary"
	| "review_flashcards"
	| "practice_questions"
	| "exam_questions";

export type Subject = {
	id: string;
	name: string;
	examDate: string | null; // ISO date string e.g. "2025-06-15"
	defaultSessionMinutes: number; // e.g. 25
	createdAt: number;
	updatedAt: number;
};

export type Topic = {
	id: string;
	subjectId: string;
	code: string; // e.g. "1", "2.3", "5.3.1"
	title: string;
	depth: number;
	parentTopicId: string | null;
	importance: 1 | 2 | 3 | 4 | 5;
	confidence: ConfidenceLevel;
	lastStudiedAt: number | null;
	lastRecallAt: number | null;
	createdAt: number;
	updatedAt: number;
};

export type RecommendationRequest = {
	subjectId?: string | null;
	availableMinutes: number;
	now: number;
};

export type Recommendation = {
	topicId: string;
	subjectId: string;
	actionType: ActionType;
	durationMinutes: number;
	rationale: {
		confidence: ConfidenceLevel;
		daysUntilExam: number | null;
		daysSinceRecall: number | null;
		importance: number;
	};
	successCriteria: string;
};

export type StudySession = {
	id: string;
	subjectId: string;
	topicId: string;
	actionType: ActionType;
	plannedMinutes: number;
	completedAt: number;
	confidenceBefore: ConfidenceLevel;
	confidenceAfter: ConfidenceLevel | null;
};

// Display helpers

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
	not_started: "Not Started",
	recognize: "Recognize",
	explain: "Can Explain",
	standard_questions: "Standard Questions",
	exam_ready: "Exam Ready",
};

export const IMPORTANCE_LABELS: Record<number, string> = {
	1: "Low",
	2: "Low-Med",
	3: "Medium",
	4: "High",
	5: "Critical",
};

export const ACTION_LABELS: Record<ActionType, string> = {
	review_core_material: "Review Core Material",
	closed_book_recall: "Closed-Book Recall",
	brief_summary: "Brief Summary",
	review_flashcards: "Review Flashcards",
	practice_questions: "Practice Questions",
	exam_questions: "Exam Questions",
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
	not_started: "bg-neutral-300",
	recognize: "bg-amber-400",
	explain: "bg-yellow-400",
	standard_questions: "bg-emerald-400",
	exam_ready: "bg-green-500",
};

export const CONFIDENCE_LEVELS: ConfidenceLevel[] = [
	"not_started",
	"recognize",
	"explain",
	"standard_questions",
	"exam_ready",
];
