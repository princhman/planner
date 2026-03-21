<script lang="ts">
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	// Study flow is now on the dashboard
	onMount(() => {
		goto("/", { replaceState: true });
	});
</script>

<div class="py-16 text-center">
	<p class="text-sm text-neutral-400 dark:text-neutral-400">Redirecting...</p>
</div>
