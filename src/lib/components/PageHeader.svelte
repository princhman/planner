<script lang="ts">
	import { ArrowLeft } from "lucide-svelte";

	let {
		title,
		backHref = "/",
		children,
	}: {
		title: string;
		backHref?: string;
		children?: import("svelte").Snippet;
	} = $props();
</script>

<div class="mb-6 flex items-center justify-between">
	<div class="flex min-w-0 items-center gap-3">
		<a
			href={backHref}
			class="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
		>
			<ArrowLeft size={20} />
		</a>
		<h1 class="truncate text-lg font-semibold text-neutral-900">{title}</h1>
	</div>
	{#if children}
		<div class="flex shrink-0 items-center gap-2">
			{@render children()}
		</div>
	{/if}
</div>
