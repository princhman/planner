<!-- Nice preview of the template + a button to create a course from it -->
<script lang="ts">
    // Generated with AI
    import { api } from "$convex/_generated/api";
    import { useConvexClient, useQuery } from "convex-svelte";
    import type { PageProps } from "./$types";
    import type { Id } from "$convex/_generated/dataModel";
    import type { FunctionReturnType } from "convex/server";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb";
    import Button from "$lib/components/ui/button/button.svelte";
    import { Copy, Link, Trash2 } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";
    import type { PageData } from "./$types";

    const { params, data }: PageProps & { data: PageData } = $props();

    type templateTopicQuery = FunctionReturnType<
        typeof api.templates.getTopics
    >[number];
    type withDepth = templateTopicQuery & { depth: number };
    const client = useConvexClient();

    const template = useQuery(api.templates.get, () => ({
        id: params.id as Id<"templates">,
    }));
    const templateTopics = useQuery(api.templates.getTopics, () => ({
        id: params.id as Id<"templates">,
    }));
    function deriveDepth(topics: templateTopicQuery[]) {
        const childrenOf = new Map<
            Id<"templateTopics"> | null,
            templateTopicQuery[]
        >();

        for (const topic of topics) {
            const siblings = childrenOf.get(topic.parentId ?? null) ?? [];

            // sorting during inserstion
            const insertIdx = siblings.findIndex((s) => s.order > topic.order);
            if (insertIdx === -1) siblings.push(topic);
            else siblings.splice(insertIdx, 0, topic);
            childrenOf.set(topic.parentId ?? null, siblings);
        }
        const result: withDepth[] = [];
        function walk(parentId: Id<"templateTopics"> | null, depth: number) {
            for (const topic of childrenOf.get(parentId) ?? []) {
                result.push({
                    ...topic,
                    depth,
                });
                walk(topic._id, depth + 1);
            }
        }
        walk(null, 0);
        return result;
    }
    const renderTopics: withDepth[] = $derived(
        deriveDepth(templateTopics.data ?? []),
    );

    const isAuthenticated = $derived(!!data?.user);
    const isCreator = $derived(!!template.data?.isCreator);

    async function useTemplate() {
        if (isAuthenticated) {
            if (template.data) {
                const courseId = await client.mutation(
                    api.templates.createCourseFromTemplate,
                    {
                        templateId: template.data._id,
                    },
                );
                toast.success(`Course "${template.data.name}" is created!`);
                goto(`/courses/${courseId}`);
            }
        } else {
            toast.error("You need to log in to use a template.", {
                action: {
                    label: "Log in",
                    onClick: () => goto("/auth/login"),
                },
            });
        }
    }

    function deleteTemplate() {
        if (template.data) {
            client.mutation(api.templates.deleteTemplate, {
                templateId: template.data._id,
            });
            toast.success("Template deleted.");
            goto("/templates");
        }
    }
</script>

<div class="flex justify-between items-center py-4">
    <Breadcrumb.Root>
        <Breadcrumb.List>
            <Breadcrumb.Item>
                <Breadcrumb.Link href="/">Home</Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
                <Breadcrumb.Link href="/templates">Templates</Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
                <Breadcrumb.Page
                    >{template.data?.name} (by {template.data
                        ?.creatorName})</Breadcrumb.Page
                >
            </Breadcrumb.Item>
        </Breadcrumb.List>
    </Breadcrumb.Root>
    <div class="flex items-center gap-1">
        <Button size="sm" onclick={useTemplate} variant="outline"
            ><Copy /> Use it</Button
        >
        <Button
            size="icon-sm"
            variant="outline"
            onclick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied!");
            }}><Link /></Button
        >
        {#if isCreator}
            <Button size="icon-sm" variant="outline" onclick={deleteTemplate}
                ><Trash2 class="text-red-500" /></Button
            >
        {/if}
    </div>
</div>

{#if renderTopics}
    {#each renderTopics as item, i (item)}
        <div style:margin-left="{item.depth * 24}px">
            {item.order}. {item.title}
        </div>
    {/each}
{:else}
    <p>No topics there</p>
{/if}
