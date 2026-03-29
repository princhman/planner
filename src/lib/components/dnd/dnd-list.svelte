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
    import type { Doc } from "$convex/_generated/dataModel";

    interface Props {
        dbTopics: Doc<"topics">[];
        update: (topics: Topic[]) => void;
    }

    const { dbTopics, update }: Props = $props();

    let dragging = $state(false);
    let topics: Topic[] = $state(prepareForRender(dbTopics));
    let oldTopics: Topic[] = [];

    // resync from DB when not dragging (optimistic updates, other clients, etc.)
    //
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
</script>

<DragDropProvider {onDragOver} {onDragEnd} {onDragStart} {onDragMove}>
    <div>
        {#each topics as topic, index (topic._id)}
            <DndItem {topic} {index} />
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
