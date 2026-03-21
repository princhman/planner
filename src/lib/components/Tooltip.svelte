<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		content,
		side = "top",
		align = "center",
		class: className = "",
		style = "",
		children,
	}: {
		content: string;
		side?: "top" | "bottom";
		align?: "left" | "center" | "right";
		class?: string;
		style?: string;
		children?: Snippet;
	} = $props();

	let open = $state(false);

	const positionClass = $derived.by(() => {
		const sideClass =
			side === "bottom"
				? "top-full mt-2"
				: "bottom-full mb-2";

		const alignClass =
			align === "left"
				? "left-0"
				: align === "right"
					? "right-0"
					: "left-1/2 -translate-x-1/2";

		return `${sideClass} ${alignClass}`;
	});
</script>

<div
	class="relative {className}"
	style={style}
	role="presentation"
	onmouseenter={() => (open = true)}
	onmouseleave={() => (open = false)}
	onfocusin={() => (open = true)}
	onfocusout={() => (open = false)}
>
	{@render children?.()}

	{#if open}
		<div
			role="tooltip"
			class="pointer-events-none absolute z-50 w-max max-w-80 whitespace-normal rounded-md bg-neutral-900 dark:bg-neutral-100 px-3 py-2 text-xs leading-4 text-white dark:text-neutral-900 shadow-lg {positionClass}"
		>
			{content}
		</div>
	{/if}
</div>
