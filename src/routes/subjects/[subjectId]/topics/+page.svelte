<script lang="ts">
	import { page } from "$app/stores";
	import { onMount } from "svelte";
	import {
		getRepository,
		refreshTopics,
		getTopicsForSubject,
	} from "$lib/stores/planner-store.svelte.js";
	import { parseTopicOutline, type ParseResult } from "$lib/topic-parser.js";
	import type { Subject, Topic } from "$lib/types.js";
	import PageHeader from "$lib/components/PageHeader.svelte";
	import ConfidenceBar from "$lib/components/ConfidenceBar.svelte";
	import { ChevronRight } from "lucide-svelte";

	const subjectId = $derived($page.params.subjectId ?? "");

	let subject = $state<Subject | null>(null);
	let topics = $derived(getTopicsForSubject(subjectId));

	// Import state
	let outlineText = $state("");
	let parseResult = $state<ParseResult | null>(null);
	let showImporter = $state(false);
	let isSaving = $state(false);
	let saveError = $state("");

	onMount(async () => {
		subject = await getRepository().getSubject(subjectId);
		await refreshTopics(subjectId);
		if (getTopicsForSubject(subjectId).length === 0) {
			showImporter = true;
		}
	});

	function handleParse() {
		if (!outlineText.trim()) {
			parseResult = null;
			return;
		}
		parseResult = parseTopicOutline(outlineText);
	}

	async function handleSave() {
		if (!parseResult || parseResult.topics.length === 0) return;

		isSaving = true;
		saveError = "";
		try {
			await getRepository().importTopics({
				subjectId,
				topics: parseResult.topics.map((t) => ({
					code: t.code,
					title: t.title,
					depth: t.depth,
					parentTopicId: t.parentCode,
				})),
			});
			await refreshTopics(subjectId);
			outlineText = "";
			parseResult = null;
			showImporter = false;
		} catch (err) {
			saveError = err instanceof Error ? err.message : "Failed to save topics.";
		} finally {
			isSaving = false;
		}
	}

	async function handleDeleteAllTopics() {
		if (!confirm("Delete all topics for this subject?")) return;
		await getRepository().deleteTopicsBySubject(subjectId);
		await refreshTopics(subjectId);
		showImporter = true;
	}

	// ── Foldable state (persisted per subject) ──

	const COLLAPSED_KEY = `planner_collapsed_topics_${subjectId}`;

	function loadCollapsed(): Set<string> {
		try {
			const raw = localStorage.getItem(COLLAPSED_KEY);
			if (raw) return new Set(JSON.parse(raw));
		} catch { /* ignore */ }
		return new Set();
	}

	function saveCollapsed(ids: Set<string>) {
		try {
			localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...ids]));
		} catch { /* ignore */ }
	}

	let collapsedIds = $state<Set<string>>(loadCollapsed());

	const parentIds = $derived(() => {
		const ids = new Set<string>();
		for (const t of topics) {
			if (t.parentTopicId) ids.add(t.parentTopicId);
		}
		return ids;
	});

	const topicById = $derived(() => {
		const map = new Map<string, Topic>();
		for (const t of topics) map.set(t.id, t);
		return map;
	});

	function isParent(topicId: string): boolean {
		return parentIds().has(topicId);
	}

	function toggleCollapse(topicId: string) {
		const next = new Set(collapsedIds);
		if (next.has(topicId)) {
			next.delete(topicId);
		} else {
			next.add(topicId);
		}
		collapsedIds = next;
		saveCollapsed(next);
	}

	function isVisible(topic: Topic): boolean {
		let currentParentId = topic.parentTopicId;
		const map = topicById();
		while (currentParentId) {
			if (collapsedIds.has(currentParentId)) return false;
			const parent = map.get(currentParentId);
			currentParentId = parent?.parentTopicId ?? null;
		}
		return true;
	}

	function hasMoreSiblingsAtDepth(index: number, targetDepth: number): boolean {
		for (let j = index + 1; j < topics.length; j++) {
			const t = topics[j];
			if (t.depth < targetDepth) return false;
			if (t.depth === targetDepth) return true;
		}
		return false;
	}

	function depthPadding(depth: number): string {
		if (depth <= 1) return "";
		return `padding-left: ${(depth - 1) * 16}px`;
	}
</script>

<PageHeader title={subject?.name ? `${subject.name} — Topics` : "Topics"}>
	<a
		href="/subjects/{subjectId}/ratings"
		class="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
	>
		Rate topics
	</a>
</PageHeader>

{#if topics.length > 0}
	<div class="space-y-4">
		<!-- Toolbar -->
		<div class="flex items-center justify-between">
			<span class="text-xs text-neutral-400">
				{topics.length} topic{topics.length === 1 ? "" : "s"}
			</span>
			<div class="flex items-center gap-3">
				<button
					onclick={() => (showImporter = !showImporter)}
					class="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
				>
					{showImporter ? "Hide importer" : "+ Import more"}
				</button>
				<button
					onclick={handleDeleteAllTopics}
					class="text-xs text-red-400 transition-colors hover:text-red-600"
				>
					Delete all
				</button>
			</div>
		</div>

		<!-- Topic tree -->
		<div>
			{#each topics as topic, i}
				{@const visible = isVisible(topic)}
				{@const hasChildren = isParent(topic.id)}
				{@const isTopLevel = topic.depth === 1}
				{#if visible}
					{#if isTopLevel && i > 0}
						<div class="my-2 border-t border-neutral-100"></div>
					{/if}
					<div class="flex items-center">
						<!-- Tree lines -->
						{#if topic.depth > 1}
							<div class="flex shrink-0 items-center self-stretch">
								{#each Array(topic.depth - 1) as _, d}
									{@const isLastAtThisDepth = d === topic.depth - 2}
									<div class="relative flex h-full w-5 items-center justify-center">
										{#if isLastAtThisDepth}
											<div class="absolute left-1/2 top-0 h-1/2 w-px bg-neutral-200"></div>
											<div class="absolute left-1/2 top-1/2 h-px w-[10px] bg-neutral-200"></div>
											{#if hasMoreSiblingsAtDepth(i, topic.depth)}
												<div class="absolute left-1/2 top-1/2 h-1/2 w-px bg-neutral-200"></div>
											{/if}
										{:else}
											{#if hasMoreSiblingsAtDepth(i, d + 2)}
												<div class="absolute left-1/2 top-0 h-full w-px bg-neutral-200"></div>
											{/if}
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<!-- Chevron / spacer -->
						{#if hasChildren}
							<button
								onclick={() => toggleCollapse(topic.id)}
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
								aria-label={collapsedIds.has(topic.id) ? "Expand" : "Collapse"}
							>
								<ChevronRight
									size={14}
									class="transition-transform duration-150 {collapsedIds.has(topic.id) ? '' : 'rotate-90'}"
								/>
							</button>
						{:else}
							<div class="w-6 shrink-0"></div>
						{/if}

						<!-- Code + title + confidence -->
						<span class="w-5 shrink-0 text-right font-mono text-[11px] text-neutral-300">{topic.code.split('.').pop()}</span>
						<span class="ml-1.5 min-w-0 flex-1 truncate text-sm {isTopLevel ? 'font-semibold text-neutral-900' : topic.depth === 2 ? 'font-medium text-neutral-700' : 'text-neutral-600'}">
							{topic.title}
						</span>
						<div class="shrink-0 pl-2">
							<ConfidenceBar value={topic.confidence} readonly size="sm" />
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<!-- Topic importer -->
{#if showImporter}
	<div class="mt-6 space-y-4">
		<div>
			<h2 class="text-sm font-medium text-neutral-700">Import from outline</h2>
			<p class="mt-0.5 text-xs text-neutral-400">
				Paste a numbered outline. Each line: <code class="rounded bg-neutral-100 px-1">1.2.3</code> followed by the topic title.
			</p>
		</div>

		<textarea
			bind:value={outlineText}
			oninput={handleParse}
			placeholder={"1 Photosynthesis\n1.1 Light reactions\n1.2 Calvin cycle\n2 Cell division\n2.1 Mitosis\n2.2 Meiosis"}
			rows={8}
			class="block w-full rounded-lg border-0 bg-white px-3 py-2 font-mono text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
		></textarea>

		<!-- Parse errors -->
		{#if parseResult && parseResult.errors.length > 0}
			<div class="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
				<p class="text-xs font-medium text-amber-700">
					{parseResult.errors.length} line{parseResult.errors.length === 1 ? "" : "s"} couldn't be parsed:
				</p>
				<ul class="mt-1 space-y-0.5">
					{#each parseResult.errors as err}
						<li class="text-[11px] text-amber-600">
							Line {err.line}: "{err.text}" — {err.reason}
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<!-- Parse preview -->
		{#if parseResult && parseResult.topics.length > 0}
			<div class="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-100">
				<p class="mb-2 text-xs font-medium text-neutral-500">
					Preview — {parseResult.topics.length} topic{parseResult.topics.length === 1 ? "" : "s"}
				</p>
				<div class="space-y-0.5">
					{#each parseResult.topics as topic}
						<div class="flex items-center gap-2" style={depthPadding(topic.depth)}>
							<span class="font-mono text-[11px] text-neutral-400">{topic.code}</span>
							<span class="text-sm text-neutral-600">{topic.title}</span>
						</div>
					{/each}
				</div>
			</div>

			{#if saveError}
				<p class="text-xs text-red-500">{saveError}</p>
			{/if}

			<button
				onclick={handleSave}
				disabled={isSaving}
				class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
			>
				{isSaving ? "Saving..." : `Save ${parseResult.topics.length} topic${parseResult.topics.length === 1 ? "" : "s"}`}
			</button>
		{/if}
	</div>
{/if}

<!-- Empty state -->
{#if topics.length === 0 && !showImporter}
	<div class="py-16 text-center">
		<p class="text-sm text-neutral-400">No topics imported yet.</p>
		<button
			onclick={() => (showImporter = true)}
			class="mt-4 inline-block rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700"
		>
			Import topics
		</button>
	</div>
{/if}
