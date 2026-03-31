<script lang="ts">
    import type { Id, Doc } from "$convex/_generated/dataModel";
    import { Settings } from "lucide-svelte";
    import * as Popover from "./ui/popover/index";
    import Switch from "./ui/switch/switch.svelte";
    import SmartExplainerPopover from "./smart-explainer-popover.svelte";

    interface Props {
        applyThresholds: boolean;
        includeNotStarted: boolean;
        courseId: Id<"courses"> | undefined;
        courses: Doc<"courses">[];
    }

    let {
        applyThresholds = $bindable(),
        includeNotStarted = $bindable(),
        courseId = $bindable(),
        courses,
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
            <div class="flex flex-col gap-1">
                <span>Course</span>
                <select
                    class="rounded-md border bg-transparent px-2 py-1 text-sm"
                    bind:value={courseId}
                >
                    <option value={undefined}>All courses</option>
                    {#each courses as course (course._id)}
                        <option value={course._id}>{course.name}</option>
                    {/each}
                </select>
            </div>
        </div>
    </Popover.Content>
</Popover.Root>
