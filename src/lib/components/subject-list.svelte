<script lang="ts">
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { authState } from "$lib/stores/auth-store.svelte";
    import { useQuery } from "convex-svelte";
    import Button from "./ui/button/button.svelte";
    import { Trash2 } from "lucide-svelte";

    const userId = $derived(authState.userId);
    const subjects = useQuery(api.subjects.list, () =>
        userId ? { userId } : "skip",
    );

    const daysUntil = (examDate: string) => {
        const now = new Date();
        const diff = new Date(examDate).getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };
</script>

<div class="flex flex-col gap-1">
    {#each subjects.data ?? [] as subject}
        <a
            href="/subjects/{subject._id}"
            class="flex items-center justify-between group hover:bg-gray-600 px-2 my-0.5"
        >
            <div class="flex gap-2 items-center">
                <p class="font-medium text-xl">{subject.name}</p>
                {#if subject.examDate}
                    <p class="text-sm">in {daysUntil(subject.examDate)} days</p>
                {/if}
            </div>

            <div
                class="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => {
                        console.log("delete");
                    }}><Trash2 /></Button
                >
            </div>
        </a>
    {/each}
</div>
