<script lang="ts">
	import {
		getSubjects,
		getIsLoading,
		getRepository,
		refreshSubjects,
		getTopicsForSubject,
		refreshTopics,
	} from "$lib/stores/planner-store.svelte.js";
	import {
		CONFIDENCE_COLORS,
		CONFIDENCE_LEVELS,
		CONFIDENCE_LABELS,
		ACTION_LABELS,
	} from "$lib/types.js";
	import type { ConfidenceLevel, Recommendation, Topic, Subject } from "$lib/types.js";
	import { nowTimestamp } from "$lib/utils.js";
	import { getIsAuthenticated } from "$lib/stores/auth-store.svelte.js";
	import { Settings, Plus, ChevronRight } from "lucide-svelte";
	import ConfidenceBar from "$lib/components/ConfidenceBar.svelte";

	const subjects = $derived(getSubjects());
	const isLoading = $derived(getIsLoading());
	const isLoggedIn = $derived(getIsAuthenticated());

	// Recommendation state
	let recommendation = $state<Recommendation | null>(null);
	let topicName = $state("");
	let topicCode = $state("");
	let subjectName = $state("");
	let skippedTopicIds = $state<Set<string>>(new Set());
	let isLoadingRec = $state(true);

	// Session completion state
	let showComplete = $state(false);
	let confidenceAfter = $state<ConfidenceLevel | null>(null);
	let isCompleting = $state(false);

	// Up-next state
	type UpNextItem = {
		topicName: string;
		topicCode: string;
		subjectName: string;
		actionLabel: string;
		confidence: ConfidenceLevel;
	};
	let upNextItems = $state<UpNextItem[]>([]);

	// Cached data
	let cachedLeafTopics = $state<Topic[]>([]);
	let cachedAllTopics = $state<Topic[]>([]);
	let cachedSubjects = $state<Subject[]>([]);

	let hasInitialized = false;

	$effect(() => {
		// Re-run when subjects or loading state changes
		const subs = subjects;
		const loading = isLoading;

		if (loading || hasInitialized) return;
		hasInitialized = true;

		(async () => {
			for (const s of subs) {
				await refreshTopics(s.id);
			}
			if (subs.length > 0) {
				await fetchRecommendation();
			} else {
				isLoadingRec = false;
			}
		})();
	});

	function buildCodePath(topic: Topic, allTopics: Topic[]): string {
		return topic.code;
	}

	async function fetchRecommendation() {
		showComplete = false;
		confidenceAfter = null;
		isLoadingRec = true;

		try {
			const { computeRecommendation, filterLeafTopics } = await import("$lib/engine.js");
			const { readTopics, readSubjects } = await import("$lib/stores/local-storage.js");

			const allTopics = readTopics();
			const allSubjects = readSubjects();
			const leafTopics = filterLeafTopics(allTopics);

			cachedLeafTopics = leafTopics;
			cachedAllTopics = allTopics;
			cachedSubjects = allSubjects;

			recommendation = computeRecommendation(
				leafTopics,
				allSubjects,
				{ availableMinutes: 25, now: nowTimestamp() },
			);

			if (recommendation) {
				const repo = getRepository();
				const topic = await repo.getTopic(recommendation.topicId);
				topicName = topic?.title ?? "Unknown topic";
				topicCode = topic ? buildCodePath(topic, allTopics) : "";
				const subject = await repo.getSubject(recommendation.subjectId);
				subjectName = subject?.name ?? "Unknown subject";
			}

			await computeUpNext();
		} finally {
			isLoadingRec = false;
		}
	}

	async function computeUpNext() {
		const { computeRecommendationExcluding } = await import("$lib/engine.js");
		const repo = getRepository();
		const items: UpNextItem[] = [];

		const excludeIds = new Set(skippedTopicIds);
		if (recommendation) {
			excludeIds.add(recommendation.topicId);
		}

		for (let i = 0; i < 3; i++) {
			const rec = computeRecommendationExcluding(
				cachedLeafTopics,
				cachedSubjects,
				{ availableMinutes: 25, now: nowTimestamp() },
				excludeIds,
			);
			if (!rec) break;

			const topic = await repo.getTopic(rec.topicId);
			const subject = await repo.getSubject(rec.subjectId);
			items.push({
				topicName: topic?.title ?? "Unknown topic",
				topicCode: topic ? buildCodePath(topic, cachedAllTopics) : "",
				subjectName: subject?.name ?? "Unknown subject",
				actionLabel: ACTION_LABELS[rec.actionType],
				confidence: rec.rationale.confidence,
			});

			excludeIds.add(rec.topicId);
		}

		upNextItems = items;
	}

	async function handleSkip() {
		if (recommendation) {
			skippedTopicIds = new Set([...skippedTopicIds, recommendation.topicId]);
		}

		const { computeRecommendationExcluding } = await import("$lib/engine.js");

		recommendation = computeRecommendationExcluding(
			cachedLeafTopics,
			cachedSubjects,
			{ availableMinutes: 25, now: nowTimestamp() },
			skippedTopicIds,
		);

		if (recommendation) {
			const repo = getRepository();
			const topic = await repo.getTopic(recommendation.topicId);
			topicName = topic?.title ?? "Unknown topic";
			topicCode = topic ? buildCodePath(topic, cachedAllTopics) : "";
			const subject = await repo.getSubject(recommendation.subjectId);
			subjectName = subject?.name ?? "Unknown subject";
		}

		await computeUpNext();
	}

	function handleStartComplete() {
		showComplete = true;
	}

	async function handleComplete() {
		if (!recommendation) return;
		isCompleting = true;
		try {
			await getRepository().completeStudySession({
				subjectId: recommendation.subjectId,
				topicId: recommendation.topicId,
				actionType: recommendation.actionType,
				plannedMinutes: recommendation.durationMinutes,
				confidenceAfter,
			});
			await refreshTopics(recommendation.subjectId);
			showComplete = false;
			skippedTopicIds = new Set();
			await fetchRecommendation();
		} finally {
			isCompleting = false;
		}
	}

	function topicStats(subjectId: string) {
		const topics = getTopicsForSubject(subjectId);
		const total = topics.length;
		if (total === 0) return null;
		const rated = topics.filter((t) => t.confidence !== "not_started").length;
		const dist = CONFIDENCE_LEVELS.map((level) => ({
			level,
			count: topics.filter((t) => t.confidence === level).length,
			percent: (topics.filter((t) => t.confidence === level).length / total) * 100,
		}));
		return { total, rated, dist };
	}

	function daysUntilExam(examDate: string | null): string | null {
		if (!examDate) return null;
		const diff = Math.ceil(
			(new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
		);
		if (diff < 0) return "passed";
		if (diff === 0) return "today";
		if (diff === 1) return "1 day";
		return `${diff} days`;
	}
</script>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-semibold text-neutral-900">What should I study?</h1>
		<div class="flex items-center gap-1">
			<a
				href="/setup"
				class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
				title="Add subject"
			>
				<Plus size={18} />
			</a>
			<a
				href="/login"
				class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
				title="Account"
			>
				<Settings size={18} />
			</a>
		</div>
	</div>

	{#if isLoading}
		<div class="py-16 text-center text-sm text-neutral-400">Loading...</div>
	{:else if subjects.length === 0}
		<!-- First-time empty state -->
		<div class="space-y-6 py-12 text-center">
			<div>
				<h2 class="text-lg font-semibold text-neutral-800">Start revising</h2>
				<p class="mt-1.5 text-sm text-neutral-500">
					Add a subject, import your topics, rate your confidence, then get told what to study next.
				</p>
			</div>
			<a
				href="/setup"
				class="inline-block rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
			>
				Add your first subject
			</a>
			<p class="text-xs text-neutral-400">
				Everything stays in your browser. No account needed.
			</p>
		</div>
	{:else}
		<!-- Subjects -->
		<div class="space-y-1">
			{#each subjects as subject, i}
				{@const stats = topicStats(subject.id)}
				{@const examInfo = daysUntilExam(subject.examDate)}
				<a href="/subjects/{subject.id}/ratings" class="block py-3 -mx-2 px-2 rounded-lg transition-colors hover:bg-neutral-50 {i < subjects.length - 1 ? 'border-b border-neutral-100' : ''}">
					<div class="flex items-center justify-between gap-3">
						<div class="min-w-0">
							<div class="flex items-baseline gap-2">
								<span class="truncate text-sm font-medium text-neutral-900">{subject.name}</span>
								{#if examInfo}
									<span class="shrink-0 text-xs text-neutral-400">{examInfo}</span>
								{/if}
							</div>
						</div>
						<ChevronRight size={16} class="shrink-0 text-neutral-300" />
					</div>
					{#if stats}
						<div class="mt-2 flex items-center gap-2">
							<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
								{#each stats.dist as seg}
									{#if seg.percent > 0}
										<div
											class="float-left h-full {CONFIDENCE_COLORS[seg.level]}"
											style="width: {seg.percent}%"
											title="{CONFIDENCE_LABELS[seg.level]}: {seg.count}"
										></div>
									{/if}
								{/each}
							</div>
							<span class="shrink-0 text-xs text-neutral-400">{stats.rated}/{stats.total}</span>
						</div>
					{:else}
						<p class="mt-1 text-xs text-neutral-400">No topics</p>
					{/if}
				</a>
			{/each}
		</div>

		<!-- Study card -->
		<div class="space-y-5">
			{#if isLoadingRec}
				<div class="py-12 text-center">
					<p class="text-sm text-neutral-400">Finding your next topic...</p>
				</div>
			{:else if recommendation}
				<div class="rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-neutral-100">
					<span class="text-[11px] font-medium uppercase tracking-wide text-neutral-400">
						{subjectName}
					</span>
					<h2 class="text-base font-semibold text-neutral-900">
						<span class="font-mono text-xs font-normal text-neutral-400">{topicCode}</span>
						{topicName}
					</h2>

					<p class="mt-3 text-sm font-medium text-neutral-700">
						{ACTION_LABELS[recommendation.actionType]}
					</p>
					<p class="mt-1 text-sm text-neutral-500">
						{recommendation.successCriteria}
					</p>

					{#if showComplete}
						<div class="mt-4 space-y-3">
							<p class="text-sm text-neutral-600">How confident do you feel now?</p>
							<div class="flex items-center gap-3">
								<ConfidenceBar
									value={confidenceAfter ?? "not_started"}
									onchange={(level) => (confidenceAfter = level)}
									size="md"
								/>
								<span class="text-xs text-neutral-400">
									{confidenceAfter ? CONFIDENCE_LABELS[confidenceAfter] : "Select level"}
								</span>
							</div>
							<div class="flex items-center justify-between">
								<button
									onclick={() => { showComplete = false; confidenceAfter = null; }}
									class="text-sm text-neutral-400 transition-colors hover:text-neutral-600"
								>
									Cancel
								</button>
								<button
									onclick={handleComplete}
									disabled={isCompleting}
									class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
								>
									{isCompleting ? "Saving..." : "Complete"}
								</button>
							</div>
						</div>
					{:else}
						<div class="mt-4 flex items-center justify-end gap-3">
							<button
								onclick={handleSkip}
								class="text-sm text-neutral-400 transition-colors hover:text-neutral-600"
							>
								Skip
							</button>
							<button
								onclick={handleStartComplete}
								class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
							>
								Mark complete
							</button>
						</div>
					{/if}
				</div>

				<!-- Up Next -->
				{#if upNextItems.length > 0}
					<div class="space-y-2">
						<h3 class="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Up next</h3>
						{#each upNextItems as item}
							<div class="rounded-lg bg-white px-4 py-2.5 ring-1 ring-neutral-100">
								<p class="truncate text-sm text-neutral-700">
									<span class="font-mono text-[11px] text-neutral-400">{item.topicCode}</span>
									{item.topicName}
								</p>
								<p class="text-[11px] text-neutral-400">{item.subjectName} · {item.actionLabel}</p>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<div class="py-8 text-center">
					<p class="text-sm text-neutral-400">
						{skippedTopicIds.size > 0
							? "No more topics to recommend."
							: "No recommendation available. Rate your topics to get started."}
					</p>
					{#if skippedTopicIds.size > 0}
						<button
							onclick={() => { skippedTopicIds = new Set(); fetchRecommendation(); }}
							class="mt-3 text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-700"
						>
							Reset skipped topics
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
