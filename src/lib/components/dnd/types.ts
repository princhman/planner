import type { Doc, Id } from "$convex/_generated/dataModel";
export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;
export type ConfidenceCounts = Record<ConfidenceLevel, number>;
export type Topic = Doc<"topics"> & {
  id: Id<"topics">;
  depth: number;
  confidenceCounts: ConfidenceCounts;
};
