<script lang="ts">
	import { goto } from "$app/navigation";
	import { getRepository, refreshSubjects } from "$lib/stores/planner-store.svelte.js";
	import PageHeader from "$lib/components/PageHeader.svelte";

	let name = $state("");
	let examDate = $state("");
	let error = $state("");
	let isSubmitting = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = "";

		const trimmedName = name.trim();
		if (!trimmedName) {
			error = "Subject name is required.";
			return;
		}

		isSubmitting = true;
		try {
			const subject = await getRepository().createSubject({
				name: trimmedName,
				examDate: examDate || null,
				defaultSessionMinutes: 25,
			});
			await refreshSubjects();
			goto(`/subjects/${subject.id}/topics`);
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to create subject.";
		} finally {
			isSubmitting = false;
		}
	}
</script>

<PageHeader title="Add Subject" />

<form onsubmit={handleSubmit} class="space-y-5">
	<!-- Subject name -->
	<div>
		<label for="name" class="block text-xs font-medium text-neutral-500">
			Subject name
		</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			placeholder="e.g. Biology, Mathematics"
			class="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
		/>
	</div>

	<!-- Exam date -->
	<div>
		<label for="examDate" class="block text-xs font-medium text-neutral-500">
			Exam date
			<span class="font-normal text-neutral-300">(optional)</span>
		</label>
		<input
			id="examDate"
			type="date"
			bind:value={examDate}
			class="mt-1 block w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
		/>
	</div>

	<!-- Error message -->
	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{/if}

	<!-- Submit -->
	<div class="flex items-center gap-3 pt-1">
		<button
			type="submit"
			disabled={isSubmitting}
			class="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
		>
			{isSubmitting ? "Creating..." : "Create subject"}
		</button>
		<a href="/" class="text-sm text-neutral-400 hover:text-neutral-600">Cancel</a>
	</div>
</form>
