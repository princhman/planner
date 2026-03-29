export type FlatTopic = {
  id: string;
  title: string;
  depth: number;
  parentId: string | null;
};

export type Topic = {
  id: string;
  title: string;
  children: Topic[];
};
