import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

// Simple hash function for MVP (not production-grade)
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hash_${hash.toString(36)}_${password.length}`;
}

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      throw new ConvexError("An account with this email already exists.");
    }

    if (args.password.length < 8) {
      throw new ConvexError("Password must be at least 8 characters.");
    }

    const userId = await ctx.db.insert("users", {
      email,
      passwordHash: simpleHash(args.password),
      name: args.name,
    });

    return userId;
  },
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      throw new ConvexError({
        message: "User with this email does not exist.",
      });
    }

    if (user.passwordHash != simpleHash(args.password)) {
      throw new ConvexError({ message: "The password is incorrect." });
    }
    return user._id;
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return { id: user._id, email: user.email };
  },
});
