<script lang="ts">
	import { IMPORTANCE_LABELS } from "$lib/types.js";

	let {
		value,
		onchange,
		readonly = false,
	}: {
		value: 1 | 2 | 3 | 4 | 5;
		onchange?: (level: 1 | 2 | 3 | 4 | 5) => void;
		readonly?: boolean;
	} = $props();

	const levels = [1, 2, 3, 4, 5] as const;
</script>

<div
	class="flex items-center gap-1"
	role="radiogroup"
	aria-label="Importance"
>
	{#each levels as level}
		{@const filled = level <= value}
		{#if readonly}
			<div
				class="h-2.5 w-2.5 rounded-full sm:h-2 sm:w-2 {filled ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-neutral-200 dark:bg-neutral-700'}"
				title="{IMPORTANCE_LABELS[level]}"
			></div>
		{:else}
			<button
				onclick={() => onchange?.(level)}
				class="h-3.5 w-3.5 rounded-full transition-colors sm:h-2.5 sm:w-2.5
					{filled ? 'bg-neutral-700 dark:bg-neutral-300' : 'bg-neutral-200 dark:bg-neutral-700'}
					hover:bg-neutral-500 dark:hover:bg-neutral-400
					focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
				title="Importance: {level}/5 ({IMPORTANCE_LABELS[level]})"
				aria-checked={level === value}
				role="radio"
			></button>
		{/if}
	{/each}
</div>
