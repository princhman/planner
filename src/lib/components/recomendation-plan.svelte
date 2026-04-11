<script lang="ts">
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { cn } from "$lib/utils";
    import { useConvexClient, useQuery } from "convex-svelte";
    import {
        confidenceLabels,
        confidenceBgColors,
        confidenceTextColors,
    } from "$lib/confidence";
    import { Brain, Check, Clock, GraduationCap } from "lucide-svelte";
    import { browser } from "$app/environment";
    import RecomendationSettingsPopover from "./recomendation-settings-popover.svelte";
    import MarkDoneResponsive from "./mark-done-responsive.svelte";
    import Button from "./ui/button/button.svelte";
    import type { FunctionReturnType } from "convex/server";

    const client = useConvexClient();

    interface Props {
        initialRecommendations?: FunctionReturnType<
            typeof api.topics.recomendations
        > | null;
        initialCourses?: FunctionReturnType<typeof api.courses.list> | null;
    }

    const { initialRecommendations = null, initialCourses = null }: Props =
        $props();

    function markDone(topicId: Id<"topics">, confidence: number) {
        client.mutation(api.topics.updateConfidence, {
            id: topicId,
            confidence,
            backlogMode: false,
        });
    }

    let includeNotStarted = $state(true);
    let applyThresholds = $state(true);
    let courseId: Id<"courses"> | undefined = $state(undefined);

    const courses = useQuery(api.courses.list, {}, () => ({
        initialData: initialCourses ?? undefined,
    }));

    const recomendations = useQuery(
        api.topics.recomendations,
        () => ({
            includeNotStarted,
            courseId,
            limit: 4,
            applyThresholds,
        }),
        () => ({
            initialData: initialRecommendations ?? undefined,
        }),
    );

    if (browser) {
        try {
            const rawCourse = localStorage.getItem(
                "recomendation-plan-filter-courseId",
            );
            const parsedCourse = rawCourse
                ? (JSON.parse(rawCourse) as Id<"courses">)
                : undefined;
            courseId = parsedCourse;
        } catch (error) {
            courseId = undefined;
        }

        try {
            const rawInclude = localStorage.getItem(
                "recomendation-plan-filter-includeNotStarted",
            );
            const parsedInclude = rawInclude
                ? (JSON.parse(rawInclude) as boolean)
                : undefined;
            includeNotStarted = parsedInclude ?? true;

            const rawThresholds = localStorage.getItem(
                "recomendation-plan-filter-applyThresholds",
            );
            if (rawThresholds !== null) {
                applyThresholds = JSON.parse(rawThresholds) as boolean;
            }
        } catch {
            includeNotStarted = true;
            applyThresholds = true;
        }
    }

    // preserving a state
    $effect(() => {
        localStorage.setItem(
            "recomendation-plan-filter-courseId",
            JSON.stringify(courseId),
        );
    });

    $effect(() => {
        localStorage.setItem(
            "recomendation-plan-filter-includeNotStarted",
            JSON.stringify(includeNotStarted),
        );
    });

    $effect(() => {
        localStorage.setItem(
            "recomendation-plan-filter-applyThresholds",
            JSON.stringify(applyThresholds),
        );
    });

    function formatDays(days: number): string {
        if (days <= 0.05) return "less than 1 hour ago";
        if (days < 1) return `${Math.round(days * 24)}h ago`;
        if (days < 30) return `${Math.round(days)}d ago`;
        return `${Math.round(days / 30)}mo ago`;
    }

    function formatMs(ms: number): string {
        const hours = ms / 3_600_000;
        if (hours < 1) return `${Math.round(hours * 60)}m`;
        if (hours < 24) return `${Math.round(hours)}h`;
        return `${Math.round(hours / 24)}d`;
    }

    function formatExamDays(examDate: string | undefined): string | null {
        if (!examDate) return null;
        const ms = Date.parse(examDate);
        if (Number.isNaN(ms)) return null;
        const days = Math.max(0, Math.ceil((ms - Date.now()) / 86_400_000));
        if (days === 0) return "today";
        if (days === 1) return "tomorrow";
        return `in ${days}d`;
    }
</script>

<div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
        <span class="text-md font-bold">What should i study now?</span>
        <div class="flex gap-2">
            <select
                class="rounded-md border bg-transparent px-2 py-1 text-sm"
                bind:value={courseId}
            >
                <option class="text-black" value={undefined}>All courses</option
                >
                {#each courses.data ?? [] as course (course._id)}
                    <option class="text-black" value={course._id}
                        >{course.name}</option
                    >
                {/each}
            </select>
            <RecomendationSettingsPopover
                bind:applyThresholds
                bind:includeNotStarted
            />
        </div>
    </div>

    {#if recomendations.data?.items.length === 0}
        <div class="flex flex-col items-center gap-1 py-6 text-center">
            <span class="text-sm font-medium">All caught up!</span>
            {#if recomendations.data?.nextReviewMs}
                <p class="text-sm text-muted-foreground">
                    Next review in ~{formatMs(
                        recomendations.data?.nextReviewMs!,
                    )}
                </p>
            {:else}
                <p class="text-sm text-muted-foreground">
                    No topics to review right now. Check your filters.
                </p>
            {/if}
        </div>
    {:else}
        <div class="flex flex-col gap-1.5">
            {#each recomendations.data?.items ?? [] as rec, i (rec.topic._id)}
                {@const retrieval = Math.round(rec.details.r * 100)}
                {@const conf = rec.topic.confidence}
                {@const examLabel = formatExamDays(rec.examDate)}
                <div
                    class={cn(
                        "flex flex-col gap-1 rounded-md border px-3 py-2",
                        i === 0 && "border-primary/40 bg-primary/5",
                    )}
                >
                    <div class="flex items-start justify-between gap-2 min-w-0">
                        <div
                            class="min-w-0 flex items-center gap-2 text-xs text-muted-foreground"
                        >
                            <span
                                class="text-sm font-medium truncate max-w-[70ch]"
                            >
                                {rec.topic.title}
                            </span>
                            <a
                                href="/courses/{rec.courseId}"
                                class="rounded bg-muted px-1.5 py-0.5 truncate max-w-32 hover:bg-muted/80 shrink-0"
                            >
                                {rec.courseName}
                            </a>
                            {#if examLabel}
                                <span
                                    class="flex items-center gap-0.5"
                                    title="Exam {examLabel}"
                                >
                                    <GraduationCap class="size-3" />
                                    {examLabel}
                                </span>
                            {/if}
                        </div>
                        {#if i === 0}
                            <span
                                class="shrink-0 rounded-md bg-primary/25 border border-primary/40 px-1.5 py-0.5 text-xs font-medium"
                            >
                                Start here
                            </span>
                        {/if}
                    </div>

                    <div
                        class="flex items-center gap-3 text-xs text-muted-foreground"
                    >
                        <!-- Confidence -->
                        <span
                            class="flex items-center gap-1"
                            title="Confidence: {confidenceLabels[conf - 1] ??
                                'Not started'}"
                        >
                            <div
                                class={cn(
                                    "size-2 rounded-full",
                                    confidenceBgColors[conf - 1] ??
                                        confidenceBgColors[0],
                                )}
                            ></div>
                            <span
                                class={cn(
                                    confidenceTextColors[conf - 1] ??
                                        confidenceTextColors[0],
                                )}
                            >
                                {confidenceLabels[conf - 1] ?? "Not started"}
                            </span>
                        </span>

                        <!-- Last reviewed -->
                        <span
                            class="flex items-center gap-1"
                            title="Last reviewed"
                        >
                            <Clock class="size-3" />
                            {rec.topic.lastRecallAt
                                ? formatDays(rec.details.tDays)
                                : "never"}
                        </span>

                        <span class="ml-auto">
                            <MarkDoneResponsive
                                topicTitle={rec.topic.title}
                                currentConfidence={conf}
                                onSelect={(level) =>
                                    markDone(rec.topic._id, level)}
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="h-6 px-2 text-xs gap-1"
                                >
                                    <Check class="size-3" />
                                    Mark reviewed
                                </Button>
                            </MarkDoneResponsive>
                        </span>
                    </div>
                </div>
            {/each}
            {#if recomendations.data?.moreToReview && recomendations.data?.moreToReview > 0}
                <div class="flex items-center">
                    <span class="text-xs text-muted-foreground">
                        And {recomendations.data?.moreToReview} more to review
                    </span>
                </div>
            {/if}
        </div>
    {/if}
</div>
