/**
 * Re-export the generated Convex API through a stable app-local path.
 *
 * Keeping the generated import behind this module lets the rest of the app
 * avoid depending on Convex's generated directory layout directly.
 */
export { api } from "../convex/_generated/api.js";
