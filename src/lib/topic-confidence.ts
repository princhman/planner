import { CONFIDENCE_LEVELS } from "$lib/types.js";
import type { ConfidenceLevel, Topic } from "$lib/types.js";

type TopicConfidenceSummary = {
	effectiveConfidenceByTopicId: Map<string, ConfidenceLevel>;
	leafCountByTopicId: Map<string, number>;
};

const CONFIDENCE_INDEX = new Map<ConfidenceLevel, number>(
	CONFIDENCE_LEVELS.map((level, index) => [level, index]),
);

export function buildTopicConfidenceSummary(topics: Topic[]): TopicConfidenceSummary {
	const childrenByParentId = new Map<string, Topic[]>();

	for (const topic of topics) {
		if (!topic.parentTopicId) continue;
		const siblings = childrenByParentId.get(topic.parentTopicId) ?? [];
		siblings.push(topic);
		childrenByParentId.set(topic.parentTopicId, siblings);
	}

	const effectiveConfidenceByTopicId = new Map<string, ConfidenceLevel>();
	const leafCountByTopicId = new Map<string, number>();

	function visit(topic: Topic): { leafCount: number; weakestIndex: number } {
		const children = childrenByParentId.get(topic.id) ?? [];
		if (children.length === 0) {
			const weakestIndex = CONFIDENCE_INDEX.get(topic.confidence) ?? 0;
			effectiveConfidenceByTopicId.set(topic.id, topic.confidence);
			leafCountByTopicId.set(topic.id, 1);
			return { leafCount: 1, weakestIndex };
		}

		let leafCount = 0;
		let weakestIndex = CONFIDENCE_LEVELS.length - 1;

		for (const child of children) {
			const childSummary = visit(child);
			leafCount += childSummary.leafCount;
			weakestIndex = Math.min(weakestIndex, childSummary.weakestIndex);
		}

		const effectiveConfidence = CONFIDENCE_LEVELS[weakestIndex] ?? "not_started";
		effectiveConfidenceByTopicId.set(topic.id, effectiveConfidence);
		leafCountByTopicId.set(topic.id, leafCount);
		return { leafCount, weakestIndex };
	}

	for (const topic of topics) {
		if (!effectiveConfidenceByTopicId.has(topic.id)) {
			visit(topic);
		}
	}

	return {
		effectiveConfidenceByTopicId,
		leafCountByTopicId,
	};
}
