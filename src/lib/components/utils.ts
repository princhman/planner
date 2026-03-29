import type { FlatTopic, Topic } from "./types";

// finds where by drag the item can be
export function getProjection(
  topics: FlatTopic[],
  targetId: string,
  projectedDepth: number,
): { depth: number; parentId: string | null } {
  const targetIdx = topics.findIndex((topic) => topic.id === targetId);
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
  function getParentId(): string | null {
    if (depth === 0 || !prev) {
      return null;
    }

    if (depth === prev.depth) {
      return prev.parentId;
    }

    if (depth > prev.depth) {
      return prev.id;
    }

    const newParent = topics
      .slice(0, targetIdx)
      .reverse()
      .find((item) => item.depth === depth)?.parentId;

    return newParent ?? null;
  }
}

// taking next elements until the same depth is found
export function getDescendants(
  topics: FlatTopic[],
  index: number,
): FlatTopic[] {
  const sourceDepth = topics[index].depth;
  const descendants: FlatTopic[] = [];
  for (let i = index + 1; i < topics.length; i++) {
    if (topics[i].depth <= sourceDepth) break;
    descendants.push(topics[i]);
  }
  return descendants;
}

export function buildTree(
  topics: FlatTopic[],
  parentId: string | null = null,
): Topic[] {
  return topics
    .filter((topic) => topic.parentId === parentId)
    .map((topic) => {
      return {
        id: topic.id,
        title: topic.title,
        children: buildTree(topics, topic.id),
      };
    });
}

export function flattenTree(
  topics: Topic[],
  parentId: string | null = null,
  depth: number = 0,
): FlatTopic[] {
  const flatTopics: FlatTopic[] = [];
  topics.forEach((topic) => {
    flatTopics.push({
      id: topic.id,
      title: topic.title,
      depth: depth,
      parentId,
    });

    flatTopics.push(...flattenTree(topic.children, topic.id, depth + 1));
  });
  return flatTopics;
}
