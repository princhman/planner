<script lang="ts">
    import { slide } from "svelte/transition";
    import type { ConfidenceCounts, ConfidenceLevel } from "./dnd/types";
    import { cn } from "$lib/utils";

    interface Props {
        value: number;
        onChange: (value: number) => void;
        readOnly: boolean;
        confidenceCounts: ConfidenceCounts;
    }

    let { value, onChange, readOnly, confidenceCounts }: Props = $props();

    const confidenceDescriptions = [
        "Not started",
        "Recognise it",
        "Can explain it",
        "Can do some questions",
        "Exam ready!",
    ];

    const confidenceColors = [
        "bg-gray-500",
        "bg-red-500",
        "bg-orange-500",
        "bg-yellow-500",
        "bg-green-500",
    ];

    const total = $derived(
        Object.values(confidenceCounts).reduce((a, b) => a + b, 0),
    );
</script>

{#if readOnly}
    <div class="flex items-center gap-2">
        <div class="flex gap-1 items-center">
            {#each [5, 4, 3, 2, 1] as level (level)}
                {#if confidenceCounts[level as keyof ConfidenceCounts] > 0}
                    <span class="text-white">
                        {confidenceCounts[level as keyof ConfidenceCounts]}
                    </span>
                    <div
                        class={cn(confidenceColors[level - 1], "w-2 h-2")}
                    ></div>
                {/if}
            {/each}
        </div>
        <div class="flex h-3 w-22.5 overflow-hidden rounded-sm border">
            {#each [5, 4, 3, 2, 1] as level (level)}
                {#if confidenceCounts[level as keyof ConfidenceCounts] > 0}
                    <div
                        class={confidenceColors[level - 1]}
                        style={`flex: ${confidenceCounts[level as keyof ConfidenceCounts]} 1 0%`}
                        title={`Level ${level}: ${confidenceCounts[level as keyof ConfidenceCounts]}`}
                    ></div>
                {/if}
            {/each}
        </div>
    </div>
{:else}
    <div transition:slide>
        {#each [1, 2, 3, 4, 5] as item, i (item)}
            <button
                class={cn(
                    "w-4.5 h-4.5 border",

                    item <= value ? confidenceColors[value - 1] : "bg-gray-400",
                )}
                onclick={() => onChange(item)}
                aria-label={confidenceDescriptions[i - 1]}
            ></button>
        {/each}
    </div>
{/if}
