import { browser } from "$app/environment";
import type { Subject, Topic, StudySession } from "$lib/types.js";

const STORAGE_KEYS = {
	subjects: "planner:subjects",
	topics: "planner:topics",
	sessions: "planner:sessions",
} as const;

function read<T>(key: string): T[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function write<T>(key: string, data: T[]): void {
	if (!browser) return;
	localStorage.setItem(key, JSON.stringify(data));
}

// Subjects

export function readSubjects(): Subject[] {
	return read<Subject>(STORAGE_KEYS.subjects);
}

export function writeSubjects(subjects: Subject[]): void {
	write(STORAGE_KEYS.subjects, subjects);
}

// Topics

export function readTopics(): Topic[] {
	return read<Topic>(STORAGE_KEYS.topics);
}

export function writeTopics(topics: Topic[]): void {
	write(STORAGE_KEYS.topics, topics);
}

// Study Sessions

export function readStudySessions(): StudySession[] {
	return read<StudySession>(STORAGE_KEYS.sessions);
}

export function writeStudySessions(sessions: StudySession[]): void {
	write(STORAGE_KEYS.sessions, sessions);
}

// Check if any local planner data exists (for first-login import)

export function hasLocalPlannerData(): boolean {
	if (!browser) return false;
	return readSubjects().length > 0;
}

// Clear all local planner data (after successful import to Convex)

export function clearLocalPlannerData(): void {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEYS.subjects);
	localStorage.removeItem(STORAGE_KEYS.topics);
	localStorage.removeItem(STORAGE_KEYS.sessions);
}
