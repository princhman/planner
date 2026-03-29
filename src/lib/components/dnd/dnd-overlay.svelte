<script lang="ts">
    interface Props {
        order: number;
        title: string;
        childrenNumber: number;
    }

    const { order, title, childrenNumber }: Props = $props();
</script>

<div class="flex">
    <p>{order}</p>
    <p>{title}</p>
    {#if childrenNumber > 1}
        <p>({childrenNumber})</p>
    {/if}
</div>
