<script lang="ts">
    import Calendar from "$lib/components/ui/calendar/calendar.svelte";
    import * as Popover from "$lib/components/ui/popover/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
    import {
        getLocalTimeZone,
        today,
        type CalendarDate,
    } from "@internationalized/date";
    import Input from "./ui/input/input.svelte";
    import { useConvexClient } from "convex-svelte";
    import { api } from "$convex/_generated/api";

    let date = $state<CalendarDate | undefined>();
    let name = $state<string>("");
    let isCreating = $state<boolean>(false);

    let open = $state(false);

    const client = useConvexClient();

    async function create() {
        isCreating = true;
        await client.mutation(api.courses.create, {
            examDate: date?.toString() ?? "",
            name,
        });
        isCreating = false;
        date = undefined;
        name = "";
    }
</script>

<div class="flex items-end justify-between px-4 py-2 border rounded-md">
    <div class="flex flex-col max-w-96 gap-2">
        <span class="text-md font-bold">Create course</span>
        <div class="flex gap-2">
            <Label for="name" class="px-1 ">Name</Label>
            <Input id="name" bind:value={name} type="text" class="font-normal"
            ></Input>
        </div>
        <div class="flex gap-3">
            <Label for="date" class="px-1">Exam date</Label>
            <Popover.Root bind:open>
                <Popover.Trigger id="date">
                    <Button
                        variant="outline"
                        class="w-full justify-between font-normal"
                    >
                        {date
                            ? date
                                  .toDate(getLocalTimeZone())
                                  .toLocaleDateString()
                            : "Select date"}
                        <ChevronDownIcon />
                    </Button>
                </Popover.Trigger>
                <Popover.Content
                    class="w-auto overflow-hidden p-0"
                    align="start"
                >
                    <Calendar
                        type="single"
                        bind:value={date}
                        captionLayout="dropdown"
                        onValueChange={() => {
                            open = false;
                        }}
                        minValue={today(getLocalTimeZone())}
                    />
                </Popover.Content>
            </Popover.Root>
        </div>
    </div>
    <div class="flex justify-end gap-2">
        <Button class="px-4 py-2 font-bold" onclick={create}
            >{isCreating ? "Creating..." : "Create"}
        </Button>
    </div>
</div>
