import { AuthKit, type AuthFunctions } from "@convex-dev/workos-authkit";
import { components, internal } from "./_generated/api";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { DataModel } from "./_generated/dataModel";

const authFunctions: AuthFunctions = internal.auth;

export const authKit = new AuthKit<DataModel>(components.workOSAuthKit, {
  authFunctions,
});

export const { authKitEvent } = authKit.events({
  "user.created": async (ctx, event) => {
    const { id, email, firstName, lastName } = event.data;
    const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;

    // Check for existing user with same email (legacy migration)
    const existing = email
      ? await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        workosId: id,
        name: name ?? existing.name,
      });
    } else {
      await ctx.db.insert("users", {
        workosId: id,
        email: email,
        name,
      });
    }
  },
  "user.updated": async (ctx, event) => {
    const { id, email, firstName, lastName } = event.data;
    const name = [firstName, lastName].filter(Boolean).join(" ") || undefined;

    const user = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", id))
      .unique();

    if (user) {
      await ctx.db.patch(user._id, { email, name: name ?? user.name });
    }
  },
});

export async function getAuthUser(ctx: QueryCtx) {
  const workosUser = await authKit.getAuthUser(ctx);
  if (!workosUser) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", workosUser.id))
    .unique();
}

export async function getAuthUserOrThrow(ctx: MutationCtx) {
  const user = await getAuthUser(ctx);
  if (!user) throw new Error("Not authenticated");
  return user;
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUser(ctx);
  },
});
