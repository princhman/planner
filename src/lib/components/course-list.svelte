<script lang="ts">
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { useConvexClient, useQuery } from "convex-svelte";
    import Button from "./ui/button/button.svelte";
    import { Trash2 } from "lucide-svelte";
    import type { ConfidenceCounts } from "./dnd/types";
    import { confidenceBgColors } from "$lib/confidence";
    import { cn } from "$lib/utils";
    import type { FunctionReturnType } from "convex/server";

    const client = useConvexClient();

    interface Props {
        initialCourses?: FunctionReturnType<typeof api.courses.list> | null;
    }

    const { initialCourses }: Props = $props();

    const courses = useQuery(api.courses.list, {}, () => ({
        initialData: initialCourses ?? undefined,
    }));

    const deletecourse = (id: Id<"courses">) => {
        client.mutation(api.courses.remove, { id });
    };

    const daysUntil = (examDate: string) => {
        const now = new Date();
        const diff = new Date(examDate).getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };
</script>

<div class="flex flex-col gap-1">
    <span class="text-md font-bold">My courses:</span>
    {#each courses.data ?? [] as course}
        <a
            href="/courses/{course._id}"
            class="flex items-center justify-between group hover:bg-gray-600 px-2 my-0.5 rounded-md"
        >
            <div class="flex gap-1 items-center">
                <p class="text-md">{course.name}</p>
                {#if course.examDate}
                    <p class="text-sm">in {daysUntil(course.examDate)} days</p>
                {/if}
            </div>

            <div class="flex gap-2 items-center">
                <div class="flex gap-1 items-center">
                    {#each [5, 4, 3, 2, 1] as level (level)}
                        {#if course.confidenceToCountMap[level as keyof ConfidenceCounts] > 0}
                            <span class="text-white">
                                {course.confidenceToCountMap[
                                    level as keyof ConfidenceCounts
                                ]}
                            </span>
                            <div
                                class={cn(
                                    confidenceBgColors[level - 1],
                                    "w-2 h-2",
                                )}
                            ></div>
                        {/if}
                    {/each}
                </div>
                <!-- <span class="text-sm text-gray-500">({course.leafCount})</span> -->
                <div class="flex h-3 w-35 overflow-hidden rounded-md border">
                    {#each [5, 4, 3, 2, 1] as level (level)}
                        {#if course.confidenceToCountMap[level as keyof ConfidenceCounts] > 0}
                            <div
                                class={confidenceBgColors[level - 1]}
                                style={`flex: ${course.confidenceToCountMap[level as keyof ConfidenceCounts]} 1 0%`}
                                title={`Level ${level}: ${course.confidenceToCountMap[level as keyof ConfidenceCounts]}`}
                            ></div>
                        {/if}
                    {/each}
                </div>
                <div
                    class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 py-1"
                >
                    <Button
                        variant="outline"
                        size="icon-sm"
                        onclick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deletecourse(course._id);
                        }}><Trash2 class="text-red-500" /></Button
                    >
                </div>
            </div>
        </a>
    {/each}
</div>
