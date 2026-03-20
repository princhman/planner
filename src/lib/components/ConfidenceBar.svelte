<script lang="ts">
	import type { ConfidenceLevel } from "$lib/types.js";
	import {
		CONFIDENCE_LABELS,
		CONFIDENCE_COLORS,
		CONFIDENCE_LEVELS,
	} from "$lib/types.js";

	let {
		value,
		onchange,
		readonly = false,
		size = "sm",
	}: {
		value: ConfidenceLevel;
		onchange?: (level: ConfidenceLevel) => void;
		readonly?: boolean;
		size?: "sm" | "md";
	} = $props();

	const currentIndex = $derived(CONFIDENCE_LEVELS.indexOf(value));

	const sizeClass = $derived(
		size === "sm" ? "h-5 w-24" : "h-7 w-32",
	);
</script>

<div
	class="flex overflow-hidden rounded-sm {sizeClass}"
	role="radiogroup"
	aria-label="Confidence level"
>
	{#each CONFIDENCE_LEVELS as level, i}
		{@const filled = i <= currentIndex}
		{@const color = filled ? CONFIDENCE_COLORS[value] : "bg-neutral-100"}
		{#if readonly}
			<div
				class="flex-1 {color} {i > 0 ? 'border-l border-white/20' : ''}"
				title={CONFIDENCE_LABELS[level]}
			></div>
		{:else}
			<button
				onclick={() => onchange?.(level)}
				class="flex-1 cursor-pointer transition-all {color} {i > 0 ? 'border-l border-white/20' : ''} hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-inset"
				title={CONFIDENCE_LABELS[level]}
				aria-checked={level === value}
				role="radio"
			></button>
		{/if}
	{/each}
</div>
