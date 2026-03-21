<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { onMount } from "svelte";

	const subjectId = $derived($page.params.subjectId ?? "");

	onMount(() => {
		void goto(`/subjects/${subjectId}/edit`, { replaceState: true });
	});
</script>

<div class="py-16 text-center text-sm text-neutral-400 dark:text-neutral-400">
	Redirecting to edit mode...
</div>
