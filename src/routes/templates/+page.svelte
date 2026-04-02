<!-- Search for templates -->
<script lang="ts">
    import { api } from "$convex/_generated/api";
    import { useQuery } from "convex-svelte";

    import * as Breadcrumb from "$lib/components/ui/breadcrumb";

    let query = $state("");

    const templates = useQuery(api.templates.getAll, () => ({ query }));
</script>

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

<div class="flex flex-col gap-2">
    <input type="text" bind:value={query} placeholder="Search templates..." />
    {#if templates.data}
        {#each templates.data as item, i (item)}
            <a href="/templates/{templates.data[i]._id}"
                >{templates.data[i].name}</a
            >
        {/each}
    {:else}
        <p>No templates found.</p>
    {/if}
</div>
