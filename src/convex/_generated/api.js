/**
 * Stub file — will be overwritten by `npx convex dev`.
 *
 * This placeholder allows the SvelteKit build to succeed
 * before a Convex deployment is configured.
 */

/* eslint-disable */
// @ts-nocheck

export const api = new Proxy(
	{},
	{
		get(_target, prop) {
			return new Proxy(
				{},
				{
					get(_t, method) {
						return `${String(prop)}.${String(method)}`;
					},
				},
			);
		},
	},
);
