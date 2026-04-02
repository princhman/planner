import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const getAll = query({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, { query }) => {
    const templates =
      !query || query.trim() === ""
        ? await ctx.db.query("templates").collect()
        : await ctx.db
            .query("templates")
            .withSearchIndex("search_name", (q) =>
              q.search("name", query ?? ""),
            )
            .collect();

    const creatorNameMap = new Map<Id<"users">, string>();

    return Promise.all(
      templates.map(async (template) => {
        if (!creatorNameMap.has(template.creatorId)) {
          const user = await ctx.db.get(template.creatorId);
          if (user) {
            creatorNameMap.set(template.creatorId, user.name ?? "Unknown");
          }
        }
        return {
          ...template,
          creatorName: creatorNameMap.get(template.creatorId) ?? "Unknown",
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    const template = await ctx.db.get(id);
    if (!template) {
      return null;
    }
    const user = await ctx.db.get(template.creatorId);
    return { ...template, creatorName: user ? user.name : "Unknown" };
  },
});

export const getTopics = query({
  args: { id: v.id("templates") },
  handler: async (ctx, { id }) => {
    return ctx.db
      .query("templateTopics")
      .withIndex("by_template", (q) => q.eq("templateId", id))
      .collect();
  },
});

export const createFromCourse = mutation({
  args: { courseId: v.id("courses"), name: v.optional(v.string()) },
  handler: async (ctx, { courseId, name }) => {
    const course = await ctx.db.get(courseId);
    if (!course) {
      throw new Error("Course not found");
    }
    const templateId = await ctx.db.insert("templates", {
      name: name ?? course.name,
      creatorId: course.userId,
      sourceCourseId: course._id,
    });

    const topics = await ctx.db
      .query("topics")
      .withIndex("by_user_course", (q) =>
        q.eq("userId", course.userId).eq("courseId", courseId),
      )
      .collect();
    const templateIdMap = new Map<Id<"topics">, Id<"templateTopics">>();
    let remaining = [...topics];

    while (remaining.length > 0) {
      const stillRemaining = [];
      for (const topic of remaining) {
        if (topic.parentId && !templateIdMap.has(topic.parentId)) {
          stillRemaining.push(topic);
          continue;
        }
        const topicId = await ctx.db.insert("templateTopics", {
          templateId,
          title: topic.title,
          parentId: topic.parentId
            ? templateIdMap.get(topic.parentId)
            : undefined,
          order: topic.order,
        });
        templateIdMap.set(topic._id, topicId);
      }
      if (stillRemaining.length === remaining.length) break; // no progress, avoid infinite loop
      remaining = stillRemaining;
    }

    return templateId;
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, { templateId }) => {
    await ctx.db.delete(templateId);
  },
});

export const createCourseFromTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    userId: v.id("users"),
  },
  handler: async (ctx, { templateId, userId }) => {
    const template = await ctx.db.get(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const topics = await ctx.db
      .query("templateTopics")
      .withIndex("by_template", (q) => q.eq("templateId", templateId))
      .collect();

    const courseId = await ctx.db.insert("courses", {
      name: template.name,
      userId,
      templateId,
    });

    const topicIdMap = new Map<Id<"templateTopics">, Id<"topics">>();
    const parentsSet = new Set<Id<"topics">>();
    let remaining = [...topics];

    while (remaining.length > 0) {
      const stillRemaining = [];
      for (const templateTopic of remaining) {
        if (templateTopic.parentId && !topicIdMap.has(templateTopic.parentId)) {
          stillRemaining.push(templateTopic);
          continue;
        }
        const topicId = await ctx.db.insert("topics", {
          courseId,
          userId,
          title: templateTopic.title,
          parentId: templateTopic.parentId
            ? topicIdMap.get(templateTopic.parentId)
            : undefined,
          order: templateTopic.order,
          isLeaf: true,
          confidence: 1,
          stability: 1,
        });
        topicIdMap.set(templateTopic._id, topicId);
        if (templateTopic.parentId) {
          const topicParentId = topicIdMap.get(templateTopic.parentId);
          if (topicParentId) {
            if (!parentsSet.has(topicParentId)) {
              await ctx.db.patch(topicParentId, { isLeaf: false });
              parentsSet.add(topicParentId);
            }
          }
        }
      }
      if (stillRemaining.length === remaining.length) break; // no progress, avoid infinite loop
      remaining = stillRemaining;
    }

    return courseId;
  },
});
