<script lang="ts">
    import { untrack } from "svelte";
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
    import type {
        ConfidenceLevel,
        Recommendation,
        Topic,
        Subject,
    } from "$lib/types.js";
    import { nowTimestamp } from "$lib/utils.js";
    import { getIsAuthenticated } from "$lib/stores/auth-store.svelte.js";
    import { getPlannerSettings } from "$lib/stores/settings-store.svelte.js";
    import { buildTopicConfidenceSummary } from "$lib/topic-confidence.js";
    import { Settings, Plus, ChevronRight, BookOpen } from "lucide-svelte";
    import ConfidenceBar from "$lib/components/ConfidenceBar.svelte";
    import { slide } from "svelte/transition";
    import { flip } from "svelte/animate";

    const subjects = $derived(getSubjects());
    const isLoading = $derived(getIsLoading());
    const isLoggedIn = $derived(getIsAuthenticated());
    const plannerSettings = $derived(getPlannerSettings());

    // Recommendation state
    let recommendation = $state<Recommendation | null>(null);
    let recommendationTopic = $state<Topic | null>(null);
    let topicName = $state("");
    let topicCode = $state("");
    let subjectName = $state("");
    let skippedTopicIds = $state<Set<string>>(new Set());
    let isLoadingRec = $state(true);

    // Session completion state
    let showComplete = $state(false);
    let confidenceAfter = $state<ConfidenceLevel>(
        recommendationConfidenceLevel(),
    );
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
    let recommendationRequestId = 0;

    $effect(() => {
        const subs = subjects;
        const loading = isLoading;
        const importanceEnabled = plannerSettings.importanceEnabled;

        if (loading) return;

        untrack(() =>
            (async () => {
                if (subs.length > 0) {
                    const existingTopics = subs.flatMap((subject) =>
                        getTopicsForSubject(subject.id),
                    );

                    if (existingTopics.length > 0) {
                        await fetchRecommendation(importanceEnabled, {
                            showSpinner: false,
                        });
                    }

                    await Promise.all(subs.map((s) => refreshTopics(s.id)));
                    await fetchRecommendation(importanceEnabled, {
                        showSpinner: existingTopics.length === 0,
                    });
                } else {
                    recommendation = null;
                    recommendationTopic = null;
                    upNextItems = [];
                    isLoadingRec = false;
                }
            })(),
        );
    });

    function buildCodePath(topic: Topic, allTopics: Topic[]): string {
        return topic.code;
    }

    function recommendationConfidenceLabel(): string {
        if (!recommendationTopic) return "Not started";

        const summary = buildTopicConfidenceSummary(cachedAllTopics);
        const confidence =
            summary.effectiveConfidenceByTopicId.get(recommendationTopic.id) ??
            recommendationTopic.confidence;

        return CONFIDENCE_LABELS[confidence];
    }

    function recommendationConfidenceLevel(): ConfidenceLevel {
        if (!recommendationTopic) return "not_started";

        const summary = buildTopicConfidenceSummary(cachedAllTopics);
        return (
            summary.effectiveConfidenceByTopicId.get(recommendationTopic.id) ??
            recommendationTopic.confidence
        );
    }

    function formatLastReviewed(timestamp: number | null): string {
        if (!timestamp) return "Never reviewed";

        const days = Math.floor(
            (Date.now() - timestamp) / (1000 * 60 * 60 * 24),
        );
        if (days <= 0) return "Reviewed today";
        if (days === 1) return "Reviewed 1 day ago";
        return `Reviewed ${days} days ago`;
    }

    async function fetchRecommendation(
        importanceEnabled = plannerSettings.importanceEnabled,
        options: {
            showSpinner?: boolean;
            excludeTopicIds?: Iterable<string>;
        } = {},
    ) {
        const requestId = ++recommendationRequestId;
        const previousRecommendationTopicId = recommendation?.topicId ?? null;
        if (options.showSpinner ?? true) {
            isLoadingRec = true;
        }

        try {
            const {
                computeRecommendation,
                computeRecommendationExcluding,
                filterLeafTopics,
            } = await import("$lib/engine.js");
            const allSubjects = [...subjects];
            const allTopics = allSubjects.flatMap((subject) =>
                getTopicsForSubject(subject.id),
            );
            const leafTopics = filterLeafTopics(allTopics);
            const excludeTopicIds = new Set(skippedTopicIds);
            for (const topicId of options.excludeTopicIds ?? []) {
                excludeTopicIds.add(topicId);
            }

            cachedLeafTopics = leafTopics;
            cachedAllTopics = allTopics;
            cachedSubjects = allSubjects;

            recommendation =
                excludeTopicIds.size > 0
                    ? computeRecommendationExcluding(
                          leafTopics,
                          allSubjects,
                          {
                              availableMinutes: 25,
                              now: nowTimestamp(),
                              importanceEnabled,
                          },
                          excludeTopicIds,
                      )
                    : computeRecommendation(leafTopics, allSubjects, {
                          availableMinutes: 25,
                          now: nowTimestamp(),
                          importanceEnabled,
                      });

            if (
                (recommendation?.topicId ?? null) !==
                previousRecommendationTopicId
            ) {
                showComplete = false;
                confidenceAfter = null;
            }

            if (recommendation) {
                const topic =
                    allTopics.find((t) => t.id === recommendation?.topicId) ??
                    null;
                recommendationTopic = topic;
                topicName = topic?.title ?? "Unknown topic";
                topicCode = topic ? buildCodePath(topic, allTopics) : "";
                const subject =
                    allSubjects.find(
                        (item) => item.id === recommendation?.subjectId,
                    ) ?? null;
                subjectName = subject?.name ?? "Unknown subject";
            } else {
                recommendationTopic = null;
                topicName = "";
                topicCode = "";
                subjectName = "";
            }

            await computeUpNext(importanceEnabled, excludeTopicIds);
        } finally {
            if (requestId === recommendationRequestId) {
                isLoadingRec = false;
            }
        }
    }

    async function computeUpNext(
        importanceEnabled = plannerSettings.importanceEnabled,
        additionalExcludedTopicIds: Iterable<string> = [],
    ) {
        const { computeRecommendationExcluding } =
            await import("$lib/engine.js");
        const items: UpNextItem[] = [];
        const topicById = new Map(
            cachedAllTopics.map((topic) => [topic.id, topic]),
        );
        const subjectById = new Map(
            cachedSubjects.map((subject) => [subject.id, subject]),
        );

        const excludeIds = new Set(skippedTopicIds);
        for (const topicId of additionalExcludedTopicIds) {
            excludeIds.add(topicId);
        }
        if (recommendation) {
            excludeIds.add(recommendation.topicId);
        }

        for (let i = 0; i < 3; i++) {
            const rec = computeRecommendationExcluding(
                cachedLeafTopics,
                cachedSubjects,
                {
                    availableMinutes: 25,
                    now: nowTimestamp(),
                    importanceEnabled,
                },
                excludeIds,
            );
            if (!rec) break;

            const topic = topicById.get(rec.topicId) ?? null;
            const subject = subjectById.get(rec.subjectId) ?? null;
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
            skippedTopicIds = new Set([
                ...skippedTopicIds,
                recommendation.topicId,
            ]);
        }
        await fetchRecommendation(plannerSettings.importanceEnabled, {
            showSpinner: false,
        });
    }

    function handleStartComplete() {
        showComplete = true;
    }

    async function handleComplete() {
        if (!recommendation) return;
        isCompleting = true;
        const completedTopicId = recommendation.topicId;
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
            await fetchRecommendation(plannerSettings.importanceEnabled, {
                showSpinner: false,
                excludeTopicIds: [completedTopicId],
            });
        } finally {
            isCompleting = false;
        }
    }

    function topicStats(subjectId: string) {
        const topics = getTopicsForSubject(subjectId);
        const total = topics.length;
        if (total === 0) return null;
        const summary = buildTopicConfidenceSummary(topics);
        const rated = topics.filter((t) => {
            const confidence =
                summary.effectiveConfidenceByTopicId.get(t.id) ?? t.confidence;
            return confidence !== "not_started";
        }).length;
        const dist = CONFIDENCE_LEVELS.map((level) => ({
            level,
            count: topics.filter((t) => {
                const confidence =
                    summary.effectiveConfidenceByTopicId.get(t.id) ??
                    t.confidence;
                return confidence === level;
            }).length,
            percent:
                (topics.filter((t) => {
                    const confidence =
                        summary.effectiveConfidenceByTopicId.get(t.id) ??
                        t.confidence;
                    return confidence === level;
                }).length /
                    total) *
                100,
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
        <h1 class="text-xl font-semibold text-neutral-900 dark:text-white">
            What should I study?
        </h1>
        <div class="flex items-center gap-1">
            <a
                href="/setup"
                class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                title="Add subject"
            >
                <Plus size={18} />
            </a>
            <a
                href="/journal"
                class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                title="Journal"
            >
                <BookOpen size={18} />
            </a>
            <a
                href="/login"
                class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                title="Account"
            >
                <Settings size={18} />
            </a>
        </div>
    </div>

    {#if isLoading}
        <div
            class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-400"
        >
            Loading...
        </div>
    {:else if subjects.length === 0}
        <!-- First-time empty state -->
        <div class="space-y-6 py-12 text-center">
            <div>
                <h2
                    class="text-lg font-semibold text-neutral-800 dark:text-white"
                >
                    Start revising
                </h2>
                <p
                    class="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400"
                >
                    Add a subject, import your topics, rate your confidence,
                    then get told what to study next.
                </p>
            </div>
            <a
                href="/setup"
                class="inline-block rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
                Add your first subject
            </a>
            <p class="text-xs text-neutral-400 dark:text-neutral-400">
                Everything stays in your browser. No account needed.
            </p>
        </div>
    {:else}
        <!-- Subjects -->
        <div class="space-y-1">
            {#each subjects as subject, i}
                {@const stats = topicStats(subject.id)}
                {@const examInfo = daysUntilExam(subject.examDate)}
                <a
                    href="/subjects/{subject.id}/ratings"
                    class="block py-3 -mx-2 px-2 rounded-lg transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/50 {i <
                    subjects.length - 1
                        ? 'border-b border-neutral-100 dark:border-neutral-700'
                        : ''}"
                >
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex items-baseline gap-2">
                                <span
                                    class="truncate text-sm font-medium text-neutral-900 dark:text-white"
                                    >{subject.name}</span
                                >
                                {#if examInfo}
                                    <span
                                        class="shrink-0 text-xs text-neutral-400 dark:text-neutral-400"
                                        >{examInfo}</span
                                    >
                                {/if}
                            </div>
                        </div>
                        <ChevronRight
                            size={16}
                            class="shrink-0 text-neutral-300 dark:text-neutral-500"
                        />
                    </div>
                    {#if stats}
                        <div class="mt-2 flex items-center gap-2">
                            <div
                                class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-700"
                            >
                                {#each stats.dist as seg}
                                    {#if seg.percent > 0}
                                        <div
                                            class="float-left h-full {CONFIDENCE_COLORS[
                                                seg.level
                                            ]}"
                                            style="width: {seg.percent}%"
                                            title="{CONFIDENCE_LABELS[
                                                seg.level
                                            ]}: {seg.count}"
                                        ></div>
                                    {/if}
                                {/each}
                            </div>
                            <span
                                class="shrink-0 text-xs text-neutral-400 dark:text-neutral-400"
                                >{stats.rated}/{stats.total}</span
                            >
                        </div>
                    {:else}
                        <p
                            class="mt-1 text-xs text-neutral-400 dark:text-neutral-400"
                        >
                            No topics
                        </p>
                    {/if}
                </a>
            {/each}
        </div>

        <!-- Study card -->
        <div class="space-y-5">
            {#if isLoadingRec}
                <div class="py-12 text-center">
                    <p class="text-sm text-neutral-400 dark:text-neutral-400">
                        Finding your next topic...
                    </p>
                </div>
            {:else if recommendation}
                <div
                    class="rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700"
                >
                    <span
                        class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-400"
                    >
                        {subjectName}
                    </span>
                    <h2
                        class="text-base font-semibold text-neutral-900 dark:text-white"
                    >
                        <span
                            class="font-mono text-xs font-normal text-neutral-400 dark:text-neutral-400"
                            >{topicCode}</span
                        >
                        {topicName}
                    </h2>

                    <p
                        class="mt-3 text-sm font-medium text-neutral-700 dark:text-neutral-200"
                    >
                        {ACTION_LABELS[recommendation.actionType]}
                    </p>
                    <p
                        class="mt-1 text-sm text-neutral-500 dark:text-neutral-400"
                    >
                        {recommendation.successCriteria}
                    </p>
                    <div
                        class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 dark:text-neutral-400"
                    >
                        <span>{recommendationConfidenceLabel()}</span>
                        <span
                            >{formatLastReviewed(
                                recommendationTopic?.lastRecallAt ??
                                    recommendationTopic?.lastStudiedAt ??
                                    null,
                            )}</span
                        >
                    </div>

                    {#if showComplete}
                        <div class="mt-4 space-y-3" transition:slide>
                            <div class="flex items-center gap-3">
                                <ConfidenceBar
                                    value={confidenceAfter ??
                                        recommendationConfidenceLevel()}
                                    onchange={(level) =>
                                        (confidenceAfter = level)}
                                    size="md"
                                />
                                <p class="font-medium text-xs">
                                    {CONFIDENCE_LABELS[confidenceAfter]}
                                </p>
                            </div>
                        </div>
                    {/if}
                    <div class="mt-4 flex items-center justify-end gap-3">
                        <button
                            onclick={() => {
                                showComplete
                                    ? (showComplete = false)
                                    : handleSkip();
                            }}
                            class="text-sm text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
                        >
                            {showComplete ? "Cancel" : "Skip"}
                        </button>
                        <button
                            onclick={() => {
                                showComplete
                                    ? handleComplete()
                                    : (showComplete = true);
                            }}
                            class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                        >
                            {showComplete
                                ? isCompleting
                                    ? "Saving..."
                                    : "Save"
                                : "Mark complete"}
                        </button>
                    </div>
                </div>

                <!-- Up Next -->
                {#if upNextItems.length > 0}
                    <div class="space-y-2">
                        <h3
                            class="text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-400"
                        >
                            Up next
                        </h3>
                        {#each upNextItems as item (item.topicCode)}
                            <div
                                class="rounded-lg bg-white px-4 py-2.5 ring-1 ring-neutral-100 dark:bg-neutral-800 dark:ring-neutral-700"
                                transition:slide
                            >
                                <p
                                    class="truncate text-sm text-neutral-700 dark:text-neutral-200"
                                >
                                    <span
                                        class="font-mono text-[11px] text-neutral-400 dark:text-neutral-400"
                                        >{item.topicCode}</span
                                    >
                                    {item.topicName}
                                </p>
                                <p
                                    class="text-[11px] text-neutral-400 dark:text-neutral-400"
                                >
                                    {item.subjectName} · {item.actionLabel}
                                </p>
                            </div>
                        {/each}
                    </div>
                {/if}
            {:else}
                <div class="py-8 text-center">
                    <p class="text-sm text-neutral-400 dark:text-neutral-400">
                        {skippedTopicIds.size > 0
                            ? "No more topics to recommend."
                            : "No recommendation available. Rate your topics to get started."}
                    </p>
                    {#if skippedTopicIds.size > 0}
                        <button
                            onclick={() => {
                                skippedTopicIds = new Set();
                                fetchRecommendation();
                            }}
                            class="mt-3 text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-700 dark:text-neutral-400 dark:decoration-neutral-500 dark:hover:text-neutral-200"
                        >
                            Reset skipped topics
                        </button>
                    {/if}
                </div>
            {/if}
        </div>
    {/if}
</div>
