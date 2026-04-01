import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
  }).index("by_email", ["email"]),

  courses: defineTable({
    userId: v.id("users"),
    name: v.string(),
    examDate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  topics: defineTable({
    userId: v.id("users"),
    courseId: v.id("courses"),
    title: v.string(),
    order: v.number(), // starts at 1
    parentId: v.optional(v.id("topics")),
    isLeaf: v.boolean(),
    // importance: v.number(), // 1-5 inclusive
    confidence: v.number(), // 1-5 inclusive (meanings are in confidence-selector)
    stability: v.number(),
    lastRecallAt: v.optional(v.number()),
  })
    .index("by_user_course", ["userId", "courseId"])
    .index("by_user", ["userId"])
    .index("by_parentId", ["parentId"])
    .index("by_user_leaf_confidence", ["userId", "isLeaf", "confidence"])
    .index("by_user_course_leaf_confidence", [
      "userId",
      "courseId",
      "isLeaf",
      "confidence",
    ])
    .index("by_courses_parentId_order", ["courseId", "parentId", "order"]),
});
