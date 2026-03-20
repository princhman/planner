import type {
	Subject,
	Topic,
	RecommendationRequest,
	Recommendation,
	ConfidenceLevel,
	ActionType,
} from "./types.js";

// ── Confidence-to-action mapping ──

const CONFIDENCE_ACTION_MAP: Record<
	ConfidenceLevel,
	{ primary: ActionType; secondary: ActionType }
> = {
	not_started: { primary: "review_core_material", secondary: "brief_summary" },
	recognize: { primary: "closed_book_recall", secondary: "review_core_material" },
	explain: { primary: "practice_questions", secondary: "closed_book_recall" },
	standard_questions: { primary: "exam_questions", secondary: "practice_questions" },
	exam_ready: { primary: "exam_questions", secondary: "closed_book_recall" },
};

// ── Success criteria templates ──

const SUCCESS_CRITERIA: Record<ActionType, string> = {
	review_core_material:
		"Review the core material for this topic and identify 3 key points without looking at notes at the end.",
	closed_book_recall:
		"Recall the topic from memory, then check gaps and update confidence.",
	brief_summary:
		"Write a 5-bullet summary from memory, then compare against source material.",
	review_flashcards:
		"Review a short flashcard set for this topic and mark weak cards.",
	practice_questions:
		"Answer 3 short practice questions and check accuracy before updating confidence.",
	exam_questions:
		"Do 1 exam-style question under time pressure and review the marking points.",
};

// ── Confidence numeric values for scoring ──

const CONFIDENCE_SCORE: Record<ConfidenceLevel, number> = {
	not_started: 0,
	recognize: 1,
	explain: 2,
	standard_questions: 3,
	exam_ready: 4,
};

// ── Constants ──

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const NEVER_STUDIED_BOOST = 30;
const MAX_RECALL_GAP_DAYS = 90;

// ── Core engine ──

/**
 * Deterministic recommendation heuristic.
 *
 * Ranks all eligible topics by urgency score, picks the top one,
 * maps confidence to an action type, and formats the output.
 */
export function computeRecommendation(
	topics: Topic[],
	subjects: Subject[],
	request: RecommendationRequest,
): Recommendation | null {
	if (topics.length === 0) return null;

	const subjectMap = new Map(subjects.map((s) => [s.id, s]));
	const now = request.now;
	const availableMinutes = request.availableMinutes;
	const importanceEnabled = request.importanceEnabled ?? true;

	// Score each topic
	const scored = topics.map((topic) => {
		const subject = subjectMap.get(topic.subjectId);
		const score = computeUrgencyScore(topic, subject, now, importanceEnabled);
		return { topic, subject, score };
	});

	// Sort by score descending (most urgent first)
	scored.sort((a, b) => b.score - a.score);

	const best = scored[0];
	if (!best || best.score <= 0) return null;

	const { topic, subject } = best;

	// Pick action based on confidence
	const actionMapping = CONFIDENCE_ACTION_MAP[topic.confidence];

	// For exam_ready topics with a long recall gap, use secondary (closed_book_recall)
	let actionType = actionMapping.primary;
	if (topic.confidence === "exam_ready" && topic.lastRecallAt) {
		const daysSinceRecall = (now - topic.lastRecallAt) / MS_PER_DAY;
		if (daysSinceRecall > 14) {
			actionType = actionMapping.secondary;
		}
	}

	// Duration: clamp to available time
	const durationMinutes = computeDuration(availableMinutes, actionType);

	// Rationale
	const daysUntilExam = subject?.examDate
		? Math.ceil((new Date(subject.examDate).getTime() - now) / MS_PER_DAY)
		: null;
	const daysSinceRecall = topic.lastRecallAt
		? Math.round((now - topic.lastRecallAt) / MS_PER_DAY)
		: null;

	return {
		topicId: topic.id,
		subjectId: topic.subjectId,
		actionType,
		durationMinutes,
		rationale: {
			confidence: topic.confidence,
			daysUntilExam,
			daysSinceRecall,
			importance: topic.importance,
		},
		successCriteria: SUCCESS_CRITERIA[actionType],
	};
}

/**
 * Compute an urgency score for a single topic.
 * Higher = more urgent to study now.
 */
function computeUrgencyScore(
	topic: Topic,
	subject: Subject | undefined,
	now: number,
	importanceEnabled: boolean,
): number {
	let score = 0;

	// 1. Lower confidence = higher urgency
	// not_started=20, recognize=15, explain=10, standard_questions=5, exam_ready=0
	const confidenceUrgency = (4 - CONFIDENCE_SCORE[topic.confidence]) * 5;
	score += confidenceUrgency;

	// 2. Higher importance = higher urgency (1-5 scale → 0-20 range)
	if (importanceEnabled) {
		score += topic.importance * 4;
	}

	// 3. Never-studied boost
	if (topic.lastStudiedAt === null) {
		score += NEVER_STUDIED_BOOST;
	}

	// 4. Time since last recall (longer gap = more urgent)
	if (topic.lastRecallAt !== null) {
		const daysSinceRecall = (now - topic.lastRecallAt) / MS_PER_DAY;
		const recallUrgency = Math.min(daysSinceRecall, MAX_RECALL_GAP_DAYS) / MAX_RECALL_GAP_DAYS;
		score += recallUrgency * 15; // 0-15 range
	}

	// 5. Exam proximity (closer exam = higher urgency for all topics in that subject)
	if (subject?.examDate) {
		const daysUntilExam = (new Date(subject.examDate).getTime() - now) / MS_PER_DAY;
		if (daysUntilExam <= 0) {
			// Exam has passed — slight deprioritisation
			score -= 5;
		} else if (daysUntilExam <= 7) {
			score += 25; // Cramming zone
		} else if (daysUntilExam <= 14) {
			score += 15;
		} else if (daysUntilExam <= 30) {
			score += 8;
		} else {
			score += 3;
		}
	}

	return score;
}

/**
 * Compute session duration based on available time and action type.
 *
 * Time mapping:
 * - 10 min → one focused action only
 * - 20 min → main action + short check
 * - 30 min+ → main action + follow-up check + confidence update prompt
 */
function computeDuration(availableMinutes: number, _actionType: ActionType): number {
	if (availableMinutes <= 10) return Math.min(availableMinutes, 10);
	if (availableMinutes <= 20) return 20;
	if (availableMinutes <= 30) return 30;
	// Cap at 45 for a single recommendation
	return Math.min(availableMinutes, 45);
}

/**
 * Pick the next recommendation, excluding a set of topic IDs (for skip behaviour).
 */
export function computeRecommendationExcluding(
	topics: Topic[],
	subjects: Subject[],
	request: RecommendationRequest,
	excludeTopicIds: Set<string>,
): Recommendation | null {
	const filtered = topics.filter((t) => !excludeTopicIds.has(t.id));
	return computeRecommendation(filtered, subjects, request);
}

/**
 * Filter topics to only include leaf topics (those with no children).
 * A leaf topic is one where no other topic has parentTopicId === topic.id.
 */
export function filterLeafTopics(topics: Topic[]): Topic[] {
	const parentIds = new Set<string>();
	for (const t of topics) {
		if (t.parentTopicId) {
			parentIds.add(t.parentTopicId);
		}
	}
	return topics.filter((t) => !parentIds.has(t.id));
}
