<script lang="ts">
    import { Brain } from "lucide-svelte";
    import { Button } from "../ui/button";
    import * as Popover from "../ui/popover";

    interface Props {
        stability: number;
        lastRecallAt: number | undefined;
        r: number | null;
        nextReview: number | null;
    }
    function formatDuration(ms: number): string {
        const abs = Math.abs(ms);
        const days = Math.floor(abs / 86_400_000);
        const hours = Math.floor((abs % 86_400_000) / 3_600_000);
        if (days > 0) return `${days}d ${hours}h`;
        const minutes = Math.floor((abs % 3_600_000) / 60_000);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
    const { stability, lastRecallAt, r, nextReview }: Props = $props();
</script>

<Popover.Root>
    <Popover.Trigger>
        {#snippet child({ props })}
            <Button
                {...props}
                size="icon-xs"
                variant="ghost"
                class="w-5 h-5 p-0 lg:invisible lg:group-hover:visible"
            >
                <Brain />
            </Button>
        {/snippet}
    </Popover.Trigger>
    <Popover.Content class="w-auto" side="top">
        <div class="grid gap-1 text-xs">
            <div class="flex justify-between gap-4">
                <span class="text-muted-foreground">Stability</span>
                <span>{stability?.toFixed(1) ?? "—"}d</span>
            </div>
            <div class="flex justify-between gap-4">
                <span class="text-muted-foreground">Retrievability</span>
                <span>{r != null ? `${(r * 100).toFixed(0)}%` : "—"}</span>
            </div>
            <div class="flex justify-between gap-4">
                <span class="text-muted-foreground">Last recall</span>
                <span
                    >{lastRecallAt
                        ? new Date(lastRecallAt).toLocaleDateString()
                        : "Never"}</span
                >
            </div>
            <div class="flex justify-between gap-4">
                <span class="text-muted-foreground">Next review</span>
                <span>
                    {#if nextReview == null}
                        —
                    {:else if nextReview <= 0}
                        Now
                    {:else}
                        in {formatDuration(nextReview)}
                    {/if}
                </span>
            </div>
        </div>
    </Popover.Content>
</Popover.Root>
