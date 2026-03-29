import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  subjects: defineTable({
    userId: v.id("users"),
    name: v.string(),
    examDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  topics: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    title: v.string(),
    order: v.number(), // starts at 1
    parentId: v.optional(v.id("topics")),
    importance: v.number(),
    confidence: v.string(),
    lastRecallAt: v.optional(v.number()),
  })
    .index("by_subject", ["subjectId"])
    .index("by_user", ["userId"])
    .index("by_subject_parenId_order", ["subjectId", "parentId", "order"]),

  studySessions: defineTable({
    userId: v.id("users"),
    subjectId: v.id("subjects"),
    topicId: v.id("topics"),
    actionType: v.string(),
    plannedMinutes: v.number(),
    completedAt: v.number(),
    confidenceBefore: v.string(),
    confidenceAfter: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_subject", ["subjectId"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    key: v.string(),
    value: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),
});
