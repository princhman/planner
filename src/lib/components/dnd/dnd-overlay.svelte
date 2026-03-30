<script lang="ts">
    interface Props {
        order: number;
        title: string;
        childrenNumber: number;
        depth: number;
    }

    const { order, title, childrenNumber, depth }: Props = $props();
</script>

<div class="flex" style:margin-left="{depth * 24}px">
    <span>{order}.</span>
    <span>{title}</span>
    {#if childrenNumber > 1}
        <span>({childrenNumber})</span>
    {/if}
</div>
