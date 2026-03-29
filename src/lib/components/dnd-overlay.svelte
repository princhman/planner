<script lang="ts">
    interface Props {
        title: string;
        childrenNumber: number;
    }

    const { title, childrenNumber }: Props = $props();
</script>

<div class="flex">
    <p>{title}</p>
    {#if childrenNumber > 1}
        <p>({childrenNumber})</p>
    {/if}
</div>
