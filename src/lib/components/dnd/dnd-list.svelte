<script lang="ts">
    import { DragDropProvider, DragOverlay } from "@dnd-kit/svelte";
    import DndItem from "./dnd-item.svelte";
    import {
        getProjection,
        getDescendants,
        prepareForRender,
        finaliseOrder,
        getDiff,
    } from "./utils";

    import type { Topic } from "./types";
    import type {
        DragStartEvent,
        DragOverEvent,
        DragEndEvent,
        DragMoveEvent,
    } from "@dnd-kit/dom";
    import DndOverlay from "./dnd-overlay.svelte";
    import { move } from "@dnd-kit/helpers";
    import type { Doc, Id } from "$convex/_generated/dataModel";
    import { slide } from "svelte/transition";
    import { browser } from "$app/environment";

    interface Props {
        dbTopics: Doc<"topics">[];
        update: (topics: Topic[]) => void;
        subjectId: string;
    }

    const { dbTopics, update, subjectId }: Props = $props();

    let dragging = $state(false);
    let topics: Topic[] = $state(prepareForRender(dbTopics));

    let oldTopics: Topic[] = [];
    let collapsedIds: Set<Id<"topics">> = $state(new Set<Id<"topics">>());

    // getting the preserved state
    if (browser) {
        try {
            const raw = localStorage.getItem(subjectId + "-topics");
            const parsed = raw ? (JSON.parse(raw) as Id<"topics">[]) : [];
            collapsedIds = new Set(parsed);
        } catch {
            collapsedIds = new Set();
        }
    }

    // preserving a state
    $effect(() => {
        localStorage.setItem(
            subjectId + "-topics",
            JSON.stringify(Array.from(collapsedIds)),
        );
    });

    let hiddenIds = $derived.by(() => {
        const set = new Set<Id<"topics">>();
        topics.forEach((topic) => {
            if (
                topic.parentId &&
                (collapsedIds.has(topic.parentId) || set.has(topic.parentId))
            ) {
                set.add(topic.id);
            }
        });
        return set;
    });

    // resync from DB when not dragging (optimistic updates, other clients, etc.)
    // updates only on change of dragging or dbTopics
    $effect(() => {
        if (dragging) return;
        topics = prepareForRender(dbTopics);
    });

    let descendants: Topic[] = $state([]);
    let initialDepth: number = $state(0);

    function onDragStart(...[event]: Parameters<DragStartEvent>) {
        const source = event.operation.source;
        dragging = true;
        oldTopics = [...topics];
        if (!source) return;

        const index = topics.findIndex(
            (topic) => topic.id === source.id.toString(),
        );
        initialDepth = topics[index].depth;
        descendants = getDescendants(topics, index);

        const descendantsIds = descendants.map((topic) => topic.id);

        // find all descendants
        topics = topics.filter((topic) => {
            return !descendantsIds.includes(topic.id); // not sure exactly how it compares, maybe need to change later
        });
    }

    // reshuffle + project
    function onDragOver(...[event, manager]: Parameters<DragOverEvent>) {
        const { source, target } = event.operation;

        event.preventDefault();

        if (source && target && source.id !== target.id) {
            const offsetLeft = manager.dragOperation.transform.x;
            const dragDepth = Math.round(offsetLeft / 24); // 24 is hardcoded
            const projectedDepth = initialDepth + dragDepth;

            topics = move(topics, event);

            const sourceIdx = topics.findIndex(
                (topic) => topic.id === source.id.toString(),
            );

            const { depth, parentId } = getProjection(
                topics,
                source.id.toString(),
                projectedDepth,
            );

            topics[sourceIdx] = {
                ...topics[sourceIdx],
                depth,
                parentId: parentId ?? undefined,
            };
        }
    }

    // recalculate parentIds from the final depth/order
    function onDragEnd(...[event]: Parameters<DragEndEvent>) {
        dragging = false;
        if (event.canceled) {
            descendants = [];
            return;
        }

        // re-insert descendants right after the dragged item,
        // adjusting their depths by how much the dragged item moved
        const sourceIdx = topics.findIndex(
            (t) => t.id === event.operation.source?.id.toString(),
        );
        const depthDelta = topics[sourceIdx].depth - initialDepth;
        const adjusted = descendants.map((d) => ({
            ...d,
            depth: d.depth + depthDelta,
        }));
        const merged = [
            ...topics.slice(0, sourceIdx + 1),
            ...adjusted,
            ...topics.slice(sourceIdx + 1),
        ];
        descendants = [];

        // fix the order
        const finalised = finaliseOrder(merged);
        const diff = getDiff(oldTopics, finalised);

        if (diff.length > 0) {
            update(diff);
        }
    }

    // horizontal movement to snap between possible projections
    function onDragMove(...[event, manager]: Parameters<DragMoveEvent>) {
        const { source } = event.operation;

        if (source) {
            const offsetLeft = manager.dragOperation.transform.x;
            const dragDepth = Math.round(offsetLeft / 24); // 24 is hardcoded
            const projectedDepth = initialDepth + dragDepth;

            // flatTopics = move(flatTopics, event);

            const sourceIdx = topics.findIndex(
                (topic) => topic.id === source.id.toString(),
            );

            const { depth, parentId } = getProjection(
                topics,
                source.id.toString(),
                projectedDepth,
            );

            topics[sourceIdx] = {
                ...topics[sourceIdx],
                depth,
                parentId: parentId ?? undefined,
            };
        }
    }

    function toggleCollapse(topicId: Id<"topics">) {
        // creating new one because only reassigning will triger the update
        const nextCollapsed = new Set(collapsedIds);
        if (collapsedIds.has(topicId)) {
            nextCollapsed.delete(topicId);
        } else {
            nextCollapsed.add(topicId);
        }
        collapsedIds = nextCollapsed;
    }

    function canCollapse(index: number) {
        const topic = topics[index];
        const next = topics[index + 1];
        if (!next) return false;
        return topic.id === next.parentId;
    }
</script>

<DragDropProvider {onDragOver} {onDragEnd} {onDragStart} {onDragMove}>
    <div>
        {#each topics as topic, index (topic._id)}
            {#if !hiddenIds.has(topic.id)}
                <div
                    transition:slide={dragging ? undefined : { duration: 100 }}
                >
                    <DndItem
                        {topic}
                        {index}
                        isCollapsed={collapsedIds.has(topic.id)}
                        {toggleCollapse}
                        canCollapse={canCollapse(index)}
                    />
                </div>
            {/if}
        {/each}
    </div>
    <DragOverlay>
        {#snippet children(source)}
            <DndOverlay
                order={source.data.order!}
                title={source.data.title!}
                childrenNumber={descendants.length + 1}
            />
        {/snippet}
    </DragOverlay>
</DragDropProvider>
