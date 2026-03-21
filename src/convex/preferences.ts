import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

// ── Queries ──

export const get = query({
	args: { userId: v.id("users"), key: v.string() },
	handler: async (ctx, args) => {
		const pref = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_key", (q) =>
				q.eq("userId", args.userId).eq("key", args.key),
			)
			.unique();
		return pref?.value ?? null;
	},
});

// ── Mutations ──

export const set = mutation({
	args: {
		userId: v.id("users"),
		key: v.string(),
		value: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("userPreferences")
			.withIndex("by_user_key", (q) =>
				q.eq("userId", args.userId).eq("key", args.key),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, { value: args.value });
		} else {
			await ctx.db.insert("userPreferences", {
				userId: args.userId,
				key: args.key,
				value: args.value,
			});
		}
	},
});
