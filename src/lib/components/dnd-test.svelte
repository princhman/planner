<script lang="ts">
    import { DragDropProvider, DragOverlay } from "@dnd-kit/svelte";
    import DndItem from "./dnd-item.svelte";
    import {
        getProjection,
        getDescendants,
        flattenTree,
        buildTree,
    } from "./utils";

    import type { FlatTopic, Topic } from "./types";
    import type {
        DragStartEvent,
        DragOverEvent,
        DragEndEvent,
        DragMoveEvent,
    } from "@dnd-kit/dom";
    import DndOverlay from "./dnd-overlay.svelte";
    import { move } from "@dnd-kit/helpers";

    let topics: Topic[] = [
        {
            id: "1",
            title: "Algebra 1",
            children: [
                {
                    id: "2",
                    title: "Adding",
                    children: [
                        {
                            id: "7",
                            title: "Basic Addition",
                            children: [],
                        },
                    ],
                },
            ],
        },
        {
            id: "4",
            title: "Algebra 2",
            children: [
                {
                    id: "5",
                    title: "Multiplying",
                    children: [],
                },
            ],
        },
    ];

    let flatTopics: FlatTopic[] = $state(flattenTree(topics));

    let descendants: FlatTopic[] = $state([]);
    let initialDepth: number = $state(0);

    function onDragStart(...[event]: Parameters<DragStartEvent>) {
        const source = event.operation.source;
        if (!source) return;

        const index = flatTopics.findIndex(
            (topic) => topic.id === source.id.toString(),
        );
        initialDepth = flatTopics[index].depth;
        descendants = getDescendants(flatTopics, index);

        const descendantsIds = descendants.map((topic) => topic.id);

        // find all descendants
        flatTopics = flatTopics.filter((topic) => {
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

            flatTopics = move(flatTopics, event);

            const sourceIdx = flatTopics.findIndex(
                (topic) => topic.id === source.id.toString(),
            );

            const { depth, parentId } = getProjection(
                flatTopics,
                source.id.toString(),
                projectedDepth,
            );

            flatTopics[sourceIdx] = {
                ...flatTopics[sourceIdx],
                depth,
                parentId,
            };
        }
    }

    // recalculate parentIds from the final depth/order
    function onDragEnd(...[event]: Parameters<DragEndEvent>) {
        if (event.canceled) {
            flatTopics = flattenTree(topics);
            descendants = [];
            return;
        }
        topics = buildTree([...flatTopics, ...descendants]);
        flatTopics = flattenTree(topics);
        descendants = [];
    }

    // horizontal movement to snap between possible projections
    function onDragMove(...[event, manager]: Parameters<DragMoveEvent>) {
        const { source } = event.operation;

        if (source) {
            const offsetLeft = manager.dragOperation.transform.x;
            const dragDepth = Math.round(offsetLeft / 24); // 24 is hardcoded
            const projectedDepth = initialDepth + dragDepth;

            // flatTopics = move(flatTopics, event);

            const sourceIdx = flatTopics.findIndex(
                (topic) => topic.id === source.id.toString(),
            );

            const { depth, parentId } = getProjection(
                flatTopics,
                source.id.toString(),
                projectedDepth,
            );

            flatTopics[sourceIdx] = {
                ...flatTopics[sourceIdx],
                depth,
                parentId,
            };
        }
    }
</script>

<DragDropProvider {onDragOver} {onDragEnd} {onDragStart} {onDragMove}>
    <div>
        {#each flatTopics as topic, index (topic.id)}
            <DndItem {topic} {index} />
        {/each}
    </div>
    <DragOverlay>
        {#snippet children(source)}
            <DndOverlay
                title={source.data.title!}
                childrenNumber={descendants.length + 1}
            />
        {/snippet}
    </DragOverlay>
</DragDropProvider>
