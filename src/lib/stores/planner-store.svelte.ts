import { browser } from "$app/environment";
import { getConvexApi, getConvexClient } from "$lib/convex-client.js";
import type { PlannerRepository } from "$lib/repository.js";
import { LocalRepository } from "./local-repository.js";
import { ConvexRepository } from "./convex-repository.js";
import { getAuthUserId } from "./auth-store.svelte.js";
import type { Subject, Topic } from "$lib/types.js";

/**
 * Reactive planner store using Svelte 5 runes.
 *
 * Before login: backed by LocalRepository (localStorage).
 * After login: will be swapped to ConvexRepository (Step 7/8).
 */

// The active repository — starts as local, swapped on auth
let repository: PlannerRepository = new LocalRepository();

// Reactive state
let subjects = $state<Subject[]>([]);
let topicsBySubject = $state<Record<string, Topic[]>>({});
let isLoading = $state(true);

async function createRepository(): Promise<PlannerRepository> {
	const userId = getAuthUserId();
	if (!userId) {
		return new LocalRepository();
	}

	const client = getConvexClient();
	if (!client) {
		return new LocalRepository();
	}

	const api = await getConvexApi();
	if (!api) {
		return new LocalRepository();
	}

	return new ConvexRepository(client, userId, api);
}

// Initialize from storage (browser-only)
export async function initializePlannerStore(): Promise<void> {
	if (!browser) return;
	isLoading = true;
	try {
		repository = await createRepository();
		subjects = await repository.listSubjects();
		topicsBySubject = {};
	} catch {
		repository = new LocalRepository();
		subjects = [];
		topicsBySubject = {};
	}
	isLoading = false;
}

// Switch to a different repository (e.g., Convex after login)
export function setRepository(repo: PlannerRepository): void {
	repository = repo;
	topicsBySubject = {};
}

export function getRepository(): PlannerRepository {
	return repository;
}

// Reactive getters
export function getSubjects(): Subject[] {
	return subjects;
}

export function getTopicsForSubject(subjectId: string): Topic[] {
	return topicsBySubject[subjectId] ?? [];
}

export function getIsLoading(): boolean {
	return isLoading;
}

// Actions that update reactive state

export async function refreshSubjects(): Promise<void> {
	subjects = await repository.listSubjects();
}

export async function refreshTopics(subjectId: string): Promise<void> {
	const topics = await repository.listTopics(subjectId);
	topicsBySubject = { ...topicsBySubject, [subjectId]: topics };
}
