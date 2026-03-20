import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

/**
 * Simple email/password auth for MVP.
 *
 * NOTE: This is a minimal auth implementation for the MVP.
 * Passwords are hashed using a simple approach.
 * For production, use a proper auth library.
 */

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
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		// Check if email already exists
		const existing = await ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", email))
			.first();

		if (existing) {
			throw new Error("An account with this email already exists.");
		}

		if (args.password.length < 8) {
			throw new Error("Password must be at least 8 characters.");
		}

		const userId = await ctx.db.insert("users", {
			email,
			passwordHash: simpleHash(args.password),
			createdAt: Date.now(),
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

		if (!user || user.passwordHash !== simpleHash(args.password)) {
			throw new Error("Invalid email or password.");
		}

		return user._id;
	},
});

export const getUser = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) return null;
		return { id: user._id, email: user.email, createdAt: user.createdAt };
	},
});

// Check if user has any data (for first-login import decision)
export const hasData = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const firstSubject = await ctx.db
			.query("subjects")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();
		return firstSubject !== null;
	},
});
