/**
 * This module re-exports the Convex generated API.
 *
 * It exists as a separate file so that the dynamic import in
 * convex-client.ts doesn't cause build failures when the
 * _generated directory doesn't exist yet.
 *
 * After running `npx convex dev`, the _generated directory
 * will be created and this module will work correctly.
 *
 * If _generated doesn't exist, the import will throw at runtime
 * and the caller handles it gracefully.
 */

// @ts-ignore - This import only resolves after `npx convex dev`
export { api } from "$convex/_generated/api.js";
