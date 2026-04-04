<script lang="ts">
    import { api } from "$convex/_generated/api";
    import { authState } from "$lib/stores/auth-store.svelte";
    import { useConvexClient } from "convex-svelte";
    import { Button } from "../ui/button";
    import { Input } from "../ui/input";
    import { Label } from "../ui/label";
    import { tick } from "svelte";
    import type { Id } from "$convex/_generated/dataModel";
    import * as Tabs from "$lib/components/ui/tabs/index.js";
    import { Textarea } from "../ui/textarea";

    const { courseId }: { courseId: Id<"courses"> } = $props();

    let singleInput = $state("");
    let bulkInput = $state("");
    let tabValue = $state("single");

    const userId = $derived(authState.userId);
    const client = useConvexClient();

    function parseBulkInput(input: string) {
        return input
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => {
                const match = line.match(/^(\t*|\s*)/);
                const indent = match?.[0] ?? "";
                // normalize: 1 tab or 2/4 spaces = 1 depth level
                const depth = indent.includes("\t")
                    ? indent.length
                    : Math.floor(indent.length / 2);
                return { title: line.trim(), depth };
            });
    }

    function validateBulkTopics(
        topics: { title: string; depth: number }[],
    ): string | null {
        if (topics[0].depth !== 0)
            return "First topic must be at root level (no indentation).";
        for (let i = 1; i < topics.length; i++) {
            if (topics[i].depth > topics[i - 1].depth + 1) {
                return `"${topics[i].title}" is indented too deep — max 1 level deeper than the previous topic.`;
            }
        }
        return null;
    }

    let bulkError = $state<string | null>(null);

    const addTopic = () => {
        if (userId) {
            if (tabValue === "bulk") {
                const parsed = parseBulkInput(bulkInput);
                if (parsed.length === 0) return;
                const error = validateBulkTopics(parsed);
                if (error) {
                    bulkError = error;
                    return;
                }
                bulkError = null;
                client.mutation(api.topics.bulkAdd, {
                    userId,
                    courseId,
                    topics: parsed,
                });
                bulkInput = "";
            } else {
                client.mutation(api.topics.add, {
                    userId,
                    courseId,
                    title: singleInput,
                });
                singleInput = "";
            }
        }
    };
</script>

<div class="px-4 py-2 border rounded-md">
    <div class="flex flex-col gap-2">
        <Tabs.Root bind:value={tabValue}>
            <div class="flex items-center justify-between gap-4">
                <span class="text-md font-bold">Add topic</span>
                <Tabs.List>
                    <Tabs.Trigger value="single">Single</Tabs.Trigger>
                    <Tabs.Trigger value="bulk">Bulk</Tabs.Trigger>
                </Tabs.List>
            </div>
            <Tabs.Content value="single" class="flex">
                <Input
                    id="new-topic-title"
                    bind:value={singleInput}
                    type="text"
                    class="font-normal max-w-72"
                    onkeydown={(e) =>
                        e.key === "Enter" &&
                        singleInput.trim() !== "" &&
                        addTopic()}
                />
            </Tabs.Content>
            <Tabs.Content value="bulk"
                ><p></p>
                <Textarea
                    bind:value={bulkInput}
                    placeholder="Paste your topics here, use tabs for identation, eg:
Topic 1
    subtopic 2
    subtopic 3
Topic 2
    suptopic 4
    subtopic 5"
                    onkeydown={(e) => {
                        if (e.key === "Tab") {
                            e.preventDefault();
                            const target = e.currentTarget;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            bulkInput =
                                bulkInput.substring(0, start) +
                                "\t" +
                                bulkInput.substring(end);
                            // restore cursor position after Svelte updates the DOM
                            tick().then(() => {
                                target.selectionStart = target.selectionEnd =
                                    start + 1;
                            });
                        }
                    }}
                />
            </Tabs.Content>
            {#if bulkError}
                <p class="text-sm text-red-500">{bulkError}</p>
            {/if}
            <div class="flex justify-end gap-2">
                <Button
                    disabled={(tabValue === "bulk" && !bulkInput.trim()) ||
                        (tabValue === "single" && !singleInput.trim())}
                    onclick={addTopic}
                    class="px-4 py-2 font-bold"
                >
                    Add
                </Button>
            </div>
        </Tabs.Root>
    </div>
</div>
