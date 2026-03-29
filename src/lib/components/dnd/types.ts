import type { Doc, Id } from "$convex/_generated/dataModel";
export type Topic = Doc<"topics"> & {
  id: Id<"topics">;
  depth: number;
};
