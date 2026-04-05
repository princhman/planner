// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
// Generated with AI
// This file tells TypeScript about the shape of data we pass around in SvelteKit.
// When we set event.locals.user in hooks.server.ts, TypeScript needs to know
// what "user" looks like — otherwise it would show red squiggly errors.

declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				email: string;
				name: string | null;
			} | null;
			token: string | null;
		}
	}
}

export {};
