<!-- Nice preview of the template + a button to create a course from it -->
<script lang="ts">
    import { api } from "$convex/_generated/api";
    import { useConvexClient, useQuery } from "convex-svelte";
    import type { PageProps } from "./$types";
    import type { Id } from "$convex/_generated/dataModel";
    import type { FunctionReturnType } from "convex/server";
    import * as Breadcrumb from "$lib/components/ui/breadcrumb";
    import { authState } from "$lib/stores/auth-store.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { Copy, Link, Trash2 } from "lucide-svelte";
    import { goto } from "$app/navigation";
    import { toast } from "svelte-sonner";

    const { params }: PageProps = $props();

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
    const userId = $derived(authState.userId);
    const isCreator = $derived(userId == template.data?.creatorId);

    async function useTemplate() {
        if (userId) {
            if (template.data) {
                const courseId = await client.mutation(
                    api.templates.createCourseFromTemplate,
                    {
                        templateId: template.data._id,
                        userId,
                    },
                );
                toast.success(`Course "${template.data.name}" is created!`);
                goto(`/courses/${courseId}`);
            }
        } else {
            toast.error("You need to log in to use a template.", {
                action: {
                    label: "Log in",
                    onClick: () => goto("/"), // for now just to / but later i will have a login page
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

<div class="flex justify-between items-center">
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
        <Button
            size="sm"
            disabled={isCreator}
            onclick={useTemplate}
            variant="outline"><Copy /> Use it</Button
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

{#if template.data}{/if}
{#if renderTopics}
    {#each renderTopics as item, i (item)}
        <div style:margin-left="{item.depth * 24}px">
            {item.order}.{item.title}
        </div>
    {/each}
{:else}
    <p>No topics there</p>
{/if}
