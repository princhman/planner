<script lang="ts">
    import type { Topic } from "./types";
    import { createSortable } from "@dnd-kit/svelte/sortable";

    const config = {
        alignment: {
            x: "start",
            y: "center",
        },
        transition: {
            idle: true,
        },
    } as const;

    interface Props {
        topic: Topic;
        index: number;
    }
    const { topic, index }: Props = $props();

    const sortable = createSortable({
        ...config,
        get id() {
            return topic.id;
        },
        get index() {
            return index;
        },
        data: {
            title: topic.title,
            order: topic.order,
        },
    });
</script>

<!-- dragging it would drag a different element, so it would flinch when i start drag-->
<div
    {@attach sortable.attach}
    style:margin-left="{topic.depth * 24}px"
    class="w-full max-w-xs box-border {sortable.isDragSource
        ? 'bg-gray-700'
        : ''}"
>
    {topic.order}. {topic.title}
</div>
