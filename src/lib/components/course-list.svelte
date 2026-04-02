<script lang="ts">
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { authState } from "$lib/stores/auth-store.svelte";
    import { useConvexClient, useQuery } from "convex-svelte";
    import Button from "./ui/button/button.svelte";
    import { Trash2 } from "lucide-svelte";

    const client = useConvexClient();

    const userId = $derived(authState.userId);
    const courses = useQuery(api.courses.list, () =>
        userId ? { userId } : "skip",
    );

    const deletecourse = (id: Id<"courses">) => {
        if (userId) {
            client.mutation(api.courses.remove, { id, userId });
        }
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
            class="flex items-center justify-between group hover:bg-gray-600 px-2 my-0.5"
        >
            <div class="flex gap-1 items-center">
                <p class="text-md">{course.name}</p>
                {#if course.examDate}
                    <p class="text-sm">in {daysUntil(course.examDate)} days</p>
                {/if}
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
        </a>
    {/each}
</div>
