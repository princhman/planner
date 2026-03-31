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
                about to fade. Each confidence level has a different threshold:
            </p>
            <div class="flex flex-col gap-1 text-xs text-muted-foreground">
                <div class="flex justify-between">
                    <span class={confidenceTextColors[1]}>Recognise it</span>
                    <span>review when retention &lt; 95%</span>
                </div>
                <div class="flex justify-between">
                    <span class={confidenceTextColors[2]}>Can explain it</span>
                    <span>review when retention &lt; 85%</span>
                </div>
                <div class="flex justify-between">
                    <span class={confidenceTextColors[3]}>Can do questions</span
                    >
                    <span>review when retention &lt; 70%</span>
                </div>
                <div class="flex justify-between">
                    <span class={confidenceTextColors[4]}>Exam ready</span>
                    <span>review when retention &lt; 50%</span>
                </div>
            </div>
            <p class="text-muted-foreground">
                When off, all topics are shown ranked by priority.
            </p>
        </div>
    </Popover.Content>
</Popover.Root>
