import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Generated with AI
  // Users table now maps WorkOS users to Convex records.
  // `workosId` is the user's unique ID from WorkOS (the "sub" claim in the JWT).
  // We keep this table so courses/topics can still reference userId via v.id("users").
  users: defineTable({
    workosId: v.optional(v.string()), // optional so old records without it still pass validation
    name: v.optional(v.string()),
    email: v.string(),
    passwordHash: v.optional(v.string()), // legacy — kept so old records don't break, will be empty for new users
  })
    .index("by_workos_id", ["workosId"])
    .index("by_email", ["email"]),

  courses: defineTable({
    userId: v.id("users"),
    name: v.string(),
    examDate: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    templateId: v.optional(v.id("templates")),
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

  templates: defineTable({
    name: v.string(),
    creatorId: v.id("users"),
    sourceCourseId: v.id("courses"),
  }).searchIndex("search_name", { searchField: "name" }),

  templateTopics: defineTable({
    templateId: v.id("templates"),
    title: v.string(),
    parentId: v.optional(v.id("templateTopics")),
    order: v.number(),
  }).index("by_template", ["templateId"]),
});
