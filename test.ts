import { buildTree } from "./src/lib/components/utils";
import type { FlatTopic, Topic } from "./src/lib/components/types";

let topics: FlatTopic[] = [
  { id: "1", title: "Algebra 1", depth: 0, parentId: null },
  { id: "2", title: "Adding", depth: 1, parentId: "1" },
  { id: "7", title: "Basic Addition", depth: 2, parentId: "2" },
  { id: "3", title: "Subtracting", depth: 1, parentId: "1" },
  { id: "4", title: "Algebra 2", depth: 0, parentId: null },
  { id: "5", title: "Multiplying", depth: 1, parentId: "4" },
];

console.log(buildTree(topics)[0]);
