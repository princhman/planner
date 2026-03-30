import type { ConfidenceCounts, Topic } from "./types";
import type { Doc, Id } from "$convex/_generated/dataModel";

// finds where by drag the item can be
export function getProjection(
  topics: Topic[],
  targetId: string,
  projectedDepth: number,
): { depth: number; parentId: Id<"topics"> | null } {
  const targetIdx = topics.findIndex((topic) => topic._id === targetId);
  const target = topics[targetIdx];
  const prev = topics[targetIdx - 1];
  const next = topics[targetIdx + 1];
  let depth = projectedDepth;

  const minDepth = next ? next.depth : 0;
  const maxDepth = prev ? Math.min(prev.depth + 1, target.depth + 1) : 0;
  if (projectedDepth < minDepth) {
    depth = minDepth;
  } else if (projectedDepth > maxDepth) {
    depth = maxDepth;
  }
  return { depth, parentId: getParentId() };
  function getParentId(): Id<"topics"> | null {
    if (depth === 0 || !prev) {
      return null;
    }

    if (depth === prev.depth) {
      return prev.parentId ?? null;
    }

    if (depth > prev.depth) {
      return prev._id;
    }

    const newParent = topics
      .slice(0, targetIdx)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;
    return newParent ?? null;
  }
}

// taking next elements until the same depth is found
export function getDescendants(topics: Topic[], index: number): Topic[] {
  const sourceDepth = topics[index].depth;
  const descendants: Topic[] = [];
  for (let i = index + 1; i < topics.length; i++) {
    if (topics[i].depth <= sourceDepth) break;
    descendants.push(topics[i]);
  }
  return descendants;
}

export function prepareForRender(topics: Doc<"topics">[]): Topic[] {
  const childrenOf = new Map<Id<"topics"> | null, Doc<"topics">[]>();

  for (const topic of topics) {
    const siblings = childrenOf.get(topic.parentId ?? null) ?? [];

    // sorting during inserstion
    const insertIdx = siblings.findIndex((s) => s.order > topic.order);
    if (insertIdx === -1) siblings.push(topic);
    else siblings.splice(insertIdx, 0, topic);
    childrenOf.set(topic.parentId ?? null, siblings);
  }
  const result: Topic[] = [];
  function walk(parentId: Id<"topics"> | null, depth: number) {
    for (const topic of childrenOf.get(parentId) ?? []) {
      result.push({
        ...topic,
        depth,
        id: topic._id,
        confidenceCounts: initWithOne(topic.confidence),
      });
      walk(topic._id, depth + 1);
    }
  }
  walk(null, 0);

  const stack: { depth: number; counts: ConfidenceCounts }[] = [];

  // walkback
  for (let i = result.length - 1; i >= 0; i--) {
    const { depth } = result[i];
    // take all the elements that have a bigger depth currently (or maybe just -1)
    // to calculate the current thing
    let total = empty();
    while (stack.length > 0 && stack[stack.length - 1].depth > depth) {
      total = add(total, stack.pop()!.counts);
    }
    stack.push({ depth, counts: result[i].confidenceCounts });
    result[i].confidenceCounts = total;
  }
  return result;
}

// derives parentId + order from the visual flat list (position + depth).
// call this after drag ends to get correct DB values.
// generated with AI
export function finaliseOrder(topics: Topic[]): Topic[] {
  const stack: { id: Id<"topics"> | null; depth: number }[] = [
    { id: null, depth: -1 },
  ];
  const orderCounters = new Map<Id<"topics"> | null, number>();

  return topics.map((topic) => {
    while (stack[stack.length - 1].depth >= topic.depth) {
      stack.pop();
    }
    const parentId = stack[stack.length - 1].id;
    const order = (orderCounters.get(parentId) ?? 0) + 1;
    orderCounters.set(parentId, order);
    stack.push({ id: topic._id, depth: topic.depth });

    return { ...topic, parentId: parentId ?? undefined, order };
  });
}

export function getDiff(oldTopics: Topic[], newTopics: Topic[]): Topic[] {
  const oldMap = new Map<Id<"topics">, Topic>(oldTopics.map((t) => [t.id, t]));
  let diff: Topic[] = [];
  for (const topic of newTopics) {
    const oldTopic = oldMap.get(topic.id);

    if (
      oldTopic?.parentId !== topic.parentId ||
      oldTopic?.order !== topic.order
    ) {
      diff.push(topic);
    }
  }
  return diff;
}

// confidence counts functions
const empty = (): ConfidenceCounts => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const add = (a: ConfidenceCounts, b: ConfidenceCounts): ConfidenceCounts => ({
  1: a[1] + b[1],
  2: a[2] + b[2],
  3: a[3] + b[3],
  4: a[4] + b[4],
  5: a[5] + b[5],
});
export const initWithOne = (a: number): ConfidenceCounts => {
  let result = empty();
  result[a as keyof ConfidenceCounts] = 1;
  return result;
};
