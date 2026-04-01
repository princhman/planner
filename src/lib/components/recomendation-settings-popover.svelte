<script lang="ts">
    import type { Id, Doc } from "$convex/_generated/dataModel";
    import { Settings } from "lucide-svelte";
    import * as Popover from "./ui/popover/index";
    import Switch from "./ui/switch/switch.svelte";
    import SmartExplainerPopover from "./smart-explainer-popover.svelte";

    interface Props {
        applyThresholds: boolean;
        includeNotStarted: boolean;
    }

    let {
        applyThresholds = $bindable(),
        includeNotStarted = $bindable(),
    }: Props = $props();
</script>

<Popover.Root>
    <Popover.Trigger>
        <Settings
            class="size-4 text-muted-foreground hover:text-foreground cursor-pointer"
        />
    </Popover.Trigger>
    <Popover.Content side="bottom" align="end" class="w-64">
        <div class="flex flex-col gap-3 text-sm">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                    <span>Smart scheduling</span>
                    <SmartExplainerPopover />
                </div>
                <Switch bind:checked={applyThresholds} />
            </div>
            <div class="flex items-center justify-between">
                <span>Include not started</span>
                <Switch bind:checked={includeNotStarted} />
            </div>
        </div>
    </Popover.Content>
</Popover.Root>
