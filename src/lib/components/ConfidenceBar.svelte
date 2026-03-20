<script lang="ts">
	import type { ConfidenceLevel } from "$lib/types.js";
	import {
		CONFIDENCE_LABELS,
		CONFIDENCE_DESCRIPTIONS,
		CONFIDENCE_COLORS,
		CONFIDENCE_LEVELS,
	} from "$lib/types.js";
	import Tooltip from "$lib/components/Tooltip.svelte";

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

	const currentLabel = $derived(CONFIDENCE_LABELS[value]);
	const currentDescription = $derived(CONFIDENCE_DESCRIPTIONS[value]);
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
			<Tooltip
				content={`${currentLabel}: ${currentDescription}`}
				class="flex-1"
			>
				<div
					class="h-full w-full {color} {i > 0 ? 'border-l border-white/20' : ''}"
				></div>
			</Tooltip>
		{:else}
			<Tooltip
				content={`Current: ${currentLabel}. Click to set: ${CONFIDENCE_LABELS[level]}. ${CONFIDENCE_DESCRIPTIONS[level]}`}
				class="flex-1"
			>
				<button
					onclick={() => onchange?.(level)}
					class="h-full w-full cursor-pointer transition-all {color} {i > 0 ? 'border-l border-white/20' : ''} hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-inset"
					aria-label={`Set confidence to ${CONFIDENCE_LABELS[level]}`}
					aria-checked={level === value}
					role="radio"
				></button>
			</Tooltip>
		{/if}
	{/each}
</div>
