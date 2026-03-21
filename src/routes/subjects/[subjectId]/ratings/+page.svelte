<script lang="ts">
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import {
        getRepository,
        refreshTopics,
        getTopicsForSubject,
    } from "$lib/stores/planner-store.svelte.js";
    import {
        CONFIDENCE_LEVELS,
        CONFIDENCE_COLORS,
        CONFIDENCE_LABELS,
        CONFIDENCE_DESCRIPTIONS,
    } from "$lib/types.js";
    import type { Subject, ConfidenceLevel, Topic } from "$lib/types.js";
    import { buildTopicConfidenceSummary } from "$lib/topic-confidence.js";
    import PageHeader from "$lib/components/PageHeader.svelte";
    import ConfidenceBar from "$lib/components/ConfidenceBar.svelte";
    import ImportanceDots from "$lib/components/ImportanceDots.svelte";
    import Tooltip from "$lib/components/Tooltip.svelte";
    import { getPlannerSettings } from "$lib/stores/settings-store.svelte.js";
    import { ChevronDown, ChevronRight } from "lucide-svelte";

    const subjectId = $derived($page.params.subjectId ?? "");
    const plannerSettings = $derived(getPlannerSettings());

    let subject = $state<Subject | null>(null);
    let topics = $derived(getTopicsForSubject(subjectId));

    onMount(async () => {
        subject = await getRepository().getSubject(subjectId);
        await refreshTopics(subjectId);
    });

    async function setConfidence(topicId: string, confidence: ConfidenceLevel) {
        await getRepository().updateTopicRating({ topicId, confidence });
        await refreshTopics(subjectId);
    }

    async function setImportance(
        topicId: string,
        importance: 1 | 2 | 3 | 4 | 5,
    ) {
        await getRepository().updateTopicRating({ topicId, importance });
        await refreshTopics(subjectId);
    }

    const topicConfidenceSummary = $derived(
        buildTopicConfidenceSummary(topics),
    );

    function displayConfidence(topic: Topic): ConfidenceLevel {
        return (
            topicConfidenceSummary.effectiveConfidenceByTopicId.get(topic.id) ??
            topic.confidence
        );
    }

    function leafCount(topicId: string): number {
        return topicConfidenceSummary.leafCountByTopicId.get(topicId) ?? 1;
    }

    // Summary: proportion at each confidence level
    const confidenceDistribution = $derived(() => {
        if (topics.length === 0) return [];
        const counts = new Map<ConfidenceLevel, number>();
        for (const level of CONFIDENCE_LEVELS) counts.set(level, 0);
        for (const t of topics) {
            const level = displayConfidence(t);
            counts.set(level, (counts.get(level) ?? 0) + 1);
        }
        return CONFIDENCE_LEVELS.map((level) => ({
            level,
            count: counts.get(level) ?? 0,
            percent: ((counts.get(level) ?? 0) / topics.length) * 100,
        }));
    });

    const ratedCount = $derived(
        topics.filter((t) => displayConfidence(t) !== "not_started").length,
    );

    // ── Foldable state (persisted per subject) ──

    function collapsedKey(): string {
        return `planner_collapsed_topics_${subjectId}`;
    }

    function loadCollapsed(): Set<string> {
        try {
            const raw = localStorage.getItem(collapsedKey());
            if (raw) return new Set(JSON.parse(raw));
        } catch {
            /* ignore */
        }
        return new Set();
    }

    function saveCollapsed(ids: Set<string>) {
        try {
            localStorage.setItem(collapsedKey(), JSON.stringify([...ids]));
        } catch {
            /* ignore */
        }
    }

    let collapsedIds = $state<Set<string>>(loadCollapsed());

    function legendCollapsedKey(): string {
        return `planner_collapsed_ratings_legend_${subjectId}`;
    }

    function loadLegendCollapsed(): boolean {
        try {
            return localStorage.getItem(legendCollapsedKey()) === "true";
        } catch {
            return false;
        }
    }

    function saveLegendCollapsed(value: boolean) {
        try {
            localStorage.setItem(legendCollapsedKey(), String(value));
        } catch {
            /* ignore */
        }
    }

    let legendCollapsed = $state(loadLegendCollapsed());

    function toggleLegendCollapse() {
        legendCollapsed = !legendCollapsed;
        saveLegendCollapsed(legendCollapsed);
    }

    // Which topics have children
    const parentIds = $derived(() => {
        const ids = new Set<string>();
        for (const t of topics) {
            if (t.parentTopicId) {
                ids.add(t.parentTopicId);
            }
        }
        return ids;
    });

    // Quick lookup map
    const topicById = $derived(() => {
        const map = new Map<string, Topic>();
        for (const t of topics) map.set(t.id, t);
        return map;
    });

    function isParent(topicId: string): boolean {
        return parentIds().has(topicId);
    }

    function toggleCollapse(topicId: string) {
        const next = new Set(collapsedIds);
        if (next.has(topicId)) {
            next.delete(topicId);
        } else {
            next.add(topicId);
        }
        collapsedIds = next;
        saveCollapsed(next);
    }

    function isVisible(topic: Topic): boolean {
        let currentParentId = topic.parentTopicId;
        const map = topicById();
        while (currentParentId) {
            if (collapsedIds.has(currentParentId)) return false;
            const parent = map.get(currentParentId);
            currentParentId = parent?.parentTopicId ?? null;
        }
        return true;
    }

    // Check if a topic is the last child of its parent (for tree line rendering)
    function isLastChild(topic: Topic, index: number): boolean {
        for (let j = index + 1; j < topics.length; j++) {
            const next = topics[j];
            if (next.depth < topic.depth) return true; // went up, so we were last
            if (next.depth === topic.depth) return true; // sibling found means we're last before it
            // next.depth > topic.depth means it's our child, continue
        }
        return true; // end of list
    }

    // Check if topic at a given depth level has more siblings below it
    // Used for drawing continuous vertical tree lines
    function hasMoreSiblingsAtDepth(
        index: number,
        targetDepth: number,
    ): boolean {
        for (let j = index + 1; j < topics.length; j++) {
            const t = topics[j];
            if (t.depth < targetDepth) return false; // went above target depth
            if (t.depth === targetDepth) return true; // found a sibling
        }
        return false;
    }
</script>

<PageHeader title={subject?.name ?? "Rate Topics"} backHref="/">
    <a
        href="/subjects/{subjectId}/edit"
        class="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
    >
        Edit
    </a>
</PageHeader>

{#if topics.length === 0}
    <div class="py-16 text-center">
        <p class="text-sm text-neutral-400">No topics to rate.</p>
        <a
            href="/subjects/{subjectId}/edit"
            class="mt-4 inline-block rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
        >
            Import topics
        </a>
    </div>
{:else}
    <div class="space-y-5">
        <!-- Summary bar -->
        <div>
            <div
                class="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100"
            >
                {#each confidenceDistribution() as seg}
                    {#if seg.percent > 0}
                        <Tooltip
                            content={`${CONFIDENCE_LABELS[seg.level]}: ${seg.count} topic${seg.count === 1 ? "" : "s"}. ${CONFIDENCE_DESCRIPTIONS[seg.level]}`}
                            class="h-full"
                            style="width: {seg.percent}%"
                        >
                            <div
                                class="h-full w-full {CONFIDENCE_COLORS[
                                    seg.level
                                ]}"
                            ></div>
                        </Tooltip>
                    {/if}
                {/each}
            </div>
            <div
                class="mt-1.5 flex items-center gap-3 text-xs text-neutral-400"
            >
                <span>{ratedCount}/{topics.length} rated</span>
                {#each confidenceDistribution() as seg}
                    {#if seg.count > 0 && seg.level !== "not_started"}
                        <span class="flex items-center gap-1">
                            <span
                                class="inline-block h-1.5 w-1.5 rounded-full {CONFIDENCE_COLORS[
                                    seg.level
                                ]}"
                            ></span>
                            {seg.count}
                        </span>
                    {/if}
                {/each}
            </div>
        </div>

        <!-- Legend -->
        <div class="rounded-xl border border-neutral-200 bg-neutral-50/70">
            <button
                type="button"
                class="flex w-full items-start justify-between gap-3 p-3 text-left"
                onclick={toggleLegendCollapse}
                aria-expanded={!legendCollapsed}
                aria-controls="understanding-legend"
            >
                <div>
                    <p class="text-sm font-medium text-neutral-800">
                        Understanding scale
                    </p>
                </div>
                <ChevronDown
                    size={16}
                    class="mt-0.5 shrink-0 text-neutral-400 transition-transform duration-150 {legendCollapsed
                        ? '-rotate-90'
                        : ''}"
                />
            </button>
            {#if !legendCollapsed}
                <div
                    id="understanding-legend"
                    class="border-t border-neutral-200 px-3 pb-3 pt-3"
                >
                    <div
                        class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500"
                    >
                        <span>Grey = not started yet.</span>
                        <span
                            >Amber/yellow = you know it, but not strongly.</span
                        >
                        <span
                            >Green = you can answer questions with confidence.</span
                        >
                        {#if plannerSettings.importanceEnabled}
                            <span>Dots = importance from 1 to 5.</span>
                        {/if}
                    </div>
                    <div class="grid gap-2 sm:grid-cols-2">
                        {#each CONFIDENCE_LEVELS as level}
                            <Tooltip
                                content={`${CONFIDENCE_LABELS[level]}: ${CONFIDENCE_DESCRIPTIONS[level]}`}
                                class="w-full"
                            >
                                <div
                                    class="flex items-start gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-neutral-200/80"
                                >
                                    <span
                                        class="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full {CONFIDENCE_COLORS[
                                            level
                                        ]}"
                                    ></span>
                                    <div class="min-w-0">
                                        <p
                                            class="text-xs font-medium text-neutral-800"
                                        >
                                            {CONFIDENCE_LABELS[level]}
                                        </p>
                                        <p
                                            class="text-xs leading-5 text-neutral-500"
                                        >
                                            {CONFIDENCE_DESCRIPTIONS[level]}
                                        </p>
                                    </div>
                                </div>
                            </Tooltip>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Topic tree -->
        <div>
            {#each topics as topic, i}
                {@const visible = isVisible(topic)}
                {@const hasChildren = isParent(topic.id)}
                {@const isTopLevel = topic.depth === 1}
                {@const topicConfidence = displayConfidence(topic)}
                {#if visible}
                    {#if isTopLevel && i > 0}
                        <div class="my-2 border-t border-neutral-100"></div>
                    {/if}
                    <div
                        class="group flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                    >
                        <!-- Tree structure + name -->
                        <div class="flex min-w-0 flex-1 items-center">
                            <!-- Tree lines for indentation -->
                            {#if topic.depth > 1}
                                <div
                                    class="flex shrink-0 items-center self-stretch"
                                >
                                    {#each Array(topic.depth - 1) as _, d}
                                        {@const lineDepth = d + 1}
                                        {@const isLastAtThisDepth =
                                            d === topic.depth - 2}
                                        <div
                                            class="relative flex h-full w-5 items-center justify-center"
                                        >
                                            {#if isLastAtThisDepth}
                                                <!-- Branch: ├── or └── -->
                                                <div
                                                    class="absolute left-1/2 top-0 h-1/2 w-px {hasMoreSiblingsAtDepth(
                                                        i,
                                                        topic.depth,
                                                    )
                                                        ? ''
                                                        : ''} bg-neutral-200"
                                                ></div>
                                                <div
                                                    class="absolute left-1/2 top-1/2 h-px w-[10px] bg-neutral-200"
                                                ></div>
                                                {#if hasMoreSiblingsAtDepth(i, topic.depth)}
                                                    <!-- ├── continuing line below -->
                                                    <div
                                                        class="absolute left-1/2 top-1/2 h-1/2 w-px bg-neutral-200"
                                                    ></div>
                                                {/if}
                                            {:else}
                                                <!-- Vertical pass-through: │ -->
                                                {#if hasMoreSiblingsAtDepth(i, lineDepth + 1)}
                                                    <div
                                                        class="absolute left-1/2 top-0 h-full w-px bg-neutral-200"
                                                    ></div>
                                                {/if}
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}

                            <!-- Chevron for parents / spacer for leaves -->
                            {#if hasChildren}
                                <button
                                    onclick={() => toggleCollapse(topic.id)}
                                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                                    aria-label={collapsedIds.has(topic.id)
                                        ? "Expand"
                                        : "Collapse"}
                                >
                                    <ChevronRight
                                        size={14}
                                        class="transition-transform duration-150 {collapsedIds.has(
                                            topic.id,
                                        )
                                            ? ''
                                            : 'rotate-90'}"
                                    />
                                </button>
                            {:else}
                                <div class="w-6 shrink-0"></div>
                            {/if}

                            <!-- Code + title -->
                            <span
                                class="w-5 shrink-0 text-right font-mono text-[11px] text-neutral-300"
                                >{topic.code.split(".").pop()}</span
                            >
                            <div class="ml-1.5 min-w-0">
                                <span
                                    class="truncate text-sm {isTopLevel
                                        ? 'font-semibold text-neutral-900'
                                        : topic.depth === 2
                                          ? 'font-medium text-neutral-700'
                                          : 'text-neutral-600'}"
                                >
                                    {topic.title}
                                </span>
                            </div>
                        </div>

                        <!-- Controls -->
                        <div
                            class="flex shrink-0 items-center gap-3 pl-11 sm:pl-0"
                        >
                            {#if hasChildren}
                                <div>
                                    <ConfidenceBar
                                        value={topicConfidence}
                                        readonly={true}
                                    />
                                </div>
                            {:else}
                                <ConfidenceBar
                                    value={topicConfidence}
                                    onchange={(level) =>
                                        setConfidence(topic.id, level)}
                                />
                            {/if}
                            {#if plannerSettings.importanceEnabled}
                                <ImportanceDots
                                    value={topic.importance}
                                    onchange={(level) =>
                                        setImportance(topic.id, level)}
                                />
                            {/if}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
{/if}
