<script lang="ts">
    import {
        getRepository,
        getIsLoading,
        getSubjects,
        getTopicsForSubject,
        refreshTopics,
    } from "$lib/stores/planner-store.svelte.js";
    import {
        CONFIDENCE_LABELS,
        CONFIDENCE_COLORS,
        ACTION_LABELS,
    } from "$lib/types.js";
    import type { StudySession, Topic, Subject } from "$lib/types.js";
    import PageHeader from "$lib/components/PageHeader.svelte";
    import { ArrowRight } from "lucide-svelte";

    const isLoading = $derived(getIsLoading());
    const subjects = $derived(getSubjects());

    type ResolvedSession = StudySession & {
        topicTitle: string;
        topicCode: string;
        subjectName: string;
    };

    type DateGroup = {
        label: string;
        sessions: ResolvedSession[];
    };

    let groups = $state<DateGroup[]>([]);
    let isLoadingSessions = $state(true);

    $effect(() => {
        const loading = isLoading;
        const subs = subjects;
        if (loading) return;

        (async () => {
            isLoadingSessions = true;
            try {
                const repo = getRepository();

                // Ensure topics are loaded
                await Promise.all(subs.map((s) => refreshTopics(s.id)));

                // Build lookup maps
                const topicById = new Map<string, Topic>();
                const subjectById = new Map<string, Subject>();
                for (const s of subs) {
                    subjectById.set(s.id, s);
                    for (const t of getTopicsForSubject(s.id)) {
                        topicById.set(t.id, t);
                    }
                }

                const sessions = await repo.listStudySessions();

                // Resolve and sort newest-first
                const resolved: ResolvedSession[] = sessions
                    .map((session) => {
                        const topic = topicById.get(session.topicId);
                        const subject = subjectById.get(session.subjectId);
                        return {
                            ...session,
                            topicTitle: topic?.title ?? "Unknown topic",
                            topicCode: topic?.code ?? "",
                            subjectName: subject?.name ?? "Unknown subject",
                        };
                    })
                    .sort((a, b) => b.completedAt - a.completedAt);

                // Group by date
                groups = groupByDate(resolved);
            } finally {
                isLoadingSessions = false;
            }
        })();
    });

    function groupByDate(sessions: ResolvedSession[]): DateGroup[] {
        const map = new Map<string, ResolvedSession[]>();

        for (const session of sessions) {
            const label = formatDateLabel(session.completedAt);
            if (!map.has(label)) {
                map.set(label, []);
            }
            map.get(label)!.push(session);
        }

        return Array.from(map.entries()).map(([label, sessions]) => ({
            label,
            sessions,
        }));
    }

    function formatDateLabel(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();

        const dateOnly = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
        );
        const todayOnly = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
        );
        const diffDays = Math.round(
            (todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";

        return date.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
        });
    }

    function formatTime(timestamp: number): string {
        return new Date(timestamp).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function confidenceDotClass(level: string): string {
        const colors: Record<string, string> = CONFIDENCE_COLORS;
        return colors[level] ?? "bg-neutral-300";
    }
</script>

<PageHeader title="Journal" />

{#if isLoading || isLoadingSessions}
    <div class="py-16 text-center text-sm text-neutral-400">Loading...</div>
{:else if groups.length === 0}
    <div class="space-y-2 py-16 text-center">
        <p class="text-sm text-neutral-500">No study sessions yet.</p>
        <p class="text-xs text-neutral-400">
            Complete a study session to see your progress here.
        </p>
    </div>
{:else}
    <div class="space-y-6">
        {#each groups as group}
            <div class="space-y-1.5">
                <h2
                    class="text-[11px] font-medium uppercase tracking-wide text-neutral-400"
                >
                    {group.label}
                </h2>
                <div class="space-y-1">
                    {#each group.sessions as session}
                        <div
                            class="rounded-lg bg-white px-4 py-3 ring-1 ring-neutral-100"
                        >
                            <div
                                class="flex items-start justify-between gap-3"
                            >
                                <div class="min-w-0">
                                    <p
                                        class="truncate text-sm font-medium text-neutral-900"
                                    >
                                        <span
                                            class="font-mono text-[11px] font-normal text-neutral-400"
                                            >{session.topicCode}</span
                                        >
                                        {session.topicTitle}
                                    </p>
                                    <p
                                        class="mt-0.5 text-[11px] text-neutral-400"
                                    >
                                        {session.subjectName} · {ACTION_LABELS[
                                            session.actionType
                                        ]}
                                    </p>
                                </div>
                                <span
                                    class="shrink-0 text-[11px] text-neutral-300"
                                    >{formatTime(session.completedAt)}</span
                                >
                            </div>

                            <!-- Before → After -->
                            <div
                                class="mt-2 flex items-center gap-2 text-xs text-neutral-500"
                            >
                                <span
                                    class="inline-flex items-center gap-1.5"
                                >
                                    <span
                                        class="inline-block h-2 w-2 rounded-full {confidenceDotClass(session.confidenceBefore)}"
                                    ></span>
                                    {CONFIDENCE_LABELS[
                                        session.confidenceBefore
                                    ]}
                                </span>
                                <ArrowRight
                                    size={12}
                                    class="shrink-0 text-neutral-300"
                                />
                                {#if session.confidenceAfter}
                                    <span
                                        class="inline-flex items-center gap-1.5"
                                    >
                                        <span
                                            class="inline-block h-2 w-2 rounded-full {confidenceDotClass(session.confidenceAfter)}"
                                        ></span>
                                        {CONFIDENCE_LABELS[
                                            session.confidenceAfter
                                        ]}
                                    </span>
                                {:else}
                                    <span class="text-neutral-300"
                                        >Not rated</span
                                    >
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
{/if}
