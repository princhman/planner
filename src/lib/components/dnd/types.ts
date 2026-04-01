import { api } from "$convex/_generated/api";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;
export type ConfidenceCounts = Record<ConfidenceLevel, number>;
export type QueryTopic = FunctionReturnType<
  typeof api.topics.listByCourse
>[number];
export type Topic = QueryTopic & {
  id: Id<"topics">;
  depth: number;
  confidenceCounts: ConfidenceCounts;
};
