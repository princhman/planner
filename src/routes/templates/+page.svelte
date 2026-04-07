<!-- Search for templates -->
<script lang="ts">
    import { api } from "$convex/_generated/api";
    import { useQuery } from "convex-svelte";

    import * as Breadcrumb from "$lib/components/ui/breadcrumb";
    import Input from "$lib/components/ui/input/input.svelte";

    let query = $state("");

    const templates = useQuery(api.templates.getAll, () => ({ query }));
</script>

<div class="py-4">
    <Breadcrumb.Root>
        <Breadcrumb.List>
            <Breadcrumb.Item>
                <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
                <Breadcrumb.Page>Templates</Breadcrumb.Page>
            </Breadcrumb.Item>
        </Breadcrumb.List>
    </Breadcrumb.Root>

    <div class="flex flex-col gap-2 pt-2">
        <Input
            type="text"
            bind:value={query}
            placeholder="Search templates..."
            class="border p-2 max-w-72"
        />
        {#if templates.data}
            {#each templates.data as item, i (item)}
                <a
                    href="/templates/{templates.data[i]._id}"
                    class="px-2 py-1 border items-center rounded-md"
                    ><span class="text-md">
                        {templates.data[i].name}
                    </span>
                    <span class="text-sm"
                        >(by {templates.data[i].creatorName})</span
                    >
                </a>
            {/each}
        {:else if templates.isLoading}
            {#each Array(5) as _}
                <div
                    class="px-2 py-1 border rounded-md flex items-center gap-2"
                >
                    <div
                        class="h-4 w-32 bg-muted animate-pulse rounded-md"
                    ></div>
                    <div
                        class="h-3 w-20 bg-muted animate-pulse rounded-md"
                    ></div>
                </div>
            {/each}
        {:else}
            <p>No templates found.</p>
        {/if}
    </div>
</div>
