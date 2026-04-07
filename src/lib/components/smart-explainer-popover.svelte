<script lang="ts">
    import { Info } from "lucide-svelte";
    import * as Popover from "./ui/popover/index";
    import { confidenceTextColors } from "$lib/confidence";
</script>

<Popover.Root>
    <Popover.Trigger>
        <Info
            class="size-3.5 text-muted-foreground hover:text-foreground cursor-pointer"
        />
    </Popover.Trigger>
    <Popover.Content side="bottom" align="end" class="w-80">
        <div class="flex flex-col gap-2 text-sm">
            <p class="font-medium">Smart scheduling</p>
            <p class="text-muted-foreground">
                Uses spaced repetition to only show topics when your memory is
                about to fade. Shows only those where retention is below 90%.
            </p>
            <p class="text-muted-foreground">
                When off, all topics are shown ranked by priority.
            </p>
        </div>
    </Popover.Content>
</Popover.Root>
