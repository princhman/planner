import type { MutationCtx, QueryCtx } from "./_generated/server.js";

export async function getAuthUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
    .unique();

  if (!user) return null;

  return {
    _id: user._id,
    workosId: user.workosId,
    email: user.email,
    name: user.name,
  };
}

export async function getAuthUserOrThrow(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  let user = await ctx.db
    .query("users")
    .withIndex("by_workos_id", (q) => q.eq("workosId", identity.subject))
    .unique();

  if (!user) {
    // Auto-migration: if there's an old user with the same email
    // (from the password-based auth era), upgrade that record
    // instead of creating a new one. This keeps all their
    // courses and topics linked to the same _id.
    const email = identity.email ?? "";
    const existingByEmail = email
      ? await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null;

    if (existingByEmail) {
      // Upgrade the old record: add workosId, remove passwordHash
      await ctx.db.patch(existingByEmail._id, {
        workosId: identity.subject,
        name: identity.name ?? existingByEmail.name,
      });
      user = (await ctx.db.get(existingByEmail._id))!;
    } else {
      // Truly new user — create a fresh record
      const userId = await ctx.db.insert("users", {
        workosId: identity.subject,
        email,
        name: identity.name ?? undefined,
      });
      user = (await ctx.db.get(userId))!;
    }
  }

  return {
    _id: user._id,
    workosId: user.workosId,
    email: user.email,
    name: user.name,
  };
}
