<script lang="ts">
	import { page } from "$app/stores";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import {
		getRepository,
		refreshTopics,
		refreshSubjects,
		getTopicsForSubject,
	} from "$lib/stores/planner-store.svelte.js";
	import { parseTopicOutline, type ParseResult } from "$lib/topic-parser.js";
	import type { Subject, Topic } from "$lib/types.js";
	import PageHeader from "$lib/components/PageHeader.svelte";
	import {
		Pencil,
		Check,
		X,
		Trash2,
		ChevronRight,
	} from "lucide-svelte";

	const subjectId = $derived($page.params.subjectId ?? "");

	let subject = $state<Subject | null>(null);
	let topics = $derived(getTopicsForSubject(subjectId));

	// Subject editing
	let editingSubject = $state(false);
	let subjectName = $state("");
	let examDate = $state("");
	let isSavingSubject = $state(false);
	let subjectError = $state("");

	// Topic editing
	let editingTopicId = $state<string | null>(null);
	let editTopicTitle = $state("");
	let outlineText = $state("");
	let parseResult = $state<ParseResult | null>(null);
	let showImporter = $state(false);
	let isSavingImport = $state(false);
	let saveError = $state("");

	// Drag & drop
	type DropZone = "before" | "inside" | "after";
	type DropTarget = { topicId: string; zone: DropZone } | null;

	let draggedTopicId = $state<string | null>(null);
	let dropTarget = $state<DropTarget>(null);
	let isSaving = $state(false);

	// Delete
	let deletingTopicId = $state<string | null>(null);

	onMount(async () => {
		subject = await getRepository().getSubject(subjectId);
		await refreshTopics(subjectId);
		if (getTopicsForSubject(subjectId).length === 0) {
			showImporter = true;
		}
		if (subject) {
			subjectName = subject.name;
			examDate = subject.examDate ?? "";
		}
	});

	// ── Helpers ──

	const parentIds = $derived(() => {
		const ids = new Set<string>();
		for (const t of topics) {
			if (t.parentTopicId) ids.add(t.parentTopicId);
		}
		return ids;
	});

	const topicMap = $derived(() => {
		const map = new Map<string, Topic>();
		for (const t of topics) map.set(t.id, t);
		return map;
	});

	function isParent(topicId: string): boolean {
		return parentIds().has(topicId);
	}

	/** Collect a topic and all its descendants (in display order). */
	function getSubtree(topicId: string): Topic[] {
		const result: Topic[] = [];
		const startIdx = topics.findIndex((t) => t.id === topicId);
		if (startIdx === -1) return result;
		const root = topics[startIdx];
		result.push(root);
		for (let i = startIdx + 1; i < topics.length; i++) {
			if (topics[i].depth <= root.depth) break;
			result.push(topics[i]);
		}
		return result;
	}

	function getSubtreeIds(topicId: string): Set<string> {
		return new Set(getSubtree(topicId).map((t) => t.id));
	}

	// ── Code recalculation ──

	/**
	 * Walk the flat display-order list and recompute every topic's `code`
	 * based on its position among siblings under the same parent.
	 * Topics must already be in correct pre-order (display) order.
	 */
	function recalculateCodes(
		ordered: Array<{
			id: string;
			depth: number;
			parentTopicId: string | null;
		}>,
	): Map<string, string> {
		const codes = new Map<string, string>(); // topicId -> new code
		const siblingCounter = new Map<string, number>(); // "parentId" -> count
		const parentCode = new Map<string | null, string>(); // parentId -> code
		parentCode.set(null, "");

		for (const t of ordered) {
			const key = t.parentTopicId ?? "__root__";
			const count = (siblingCounter.get(key) ?? 0) + 1;
			siblingCounter.set(key, count);

			const prefix = parentCode.get(t.parentTopicId) ?? "";
			const newCode = prefix ? `${prefix}.${count}` : `${count}`;
			codes.set(t.id, newCode);
			parentCode.set(t.id, newCode);
		}

		return codes;
	}

	// ── Foldable state ──

	function collapsedKey(): string {
		return `planner_collapsed_edit_${subjectId}`;
	}

	function loadCollapsed(): Set<string> {
		try {
			const raw = localStorage.getItem(collapsedKey());
			if (raw) return new Set(JSON.parse(raw));
		} catch {
			/* ignore */
		}
		return new Set();
	}

	function saveCollapsed(ids: Set<string>) {
		try {
			localStorage.setItem(collapsedKey(), JSON.stringify([...ids]));
		} catch {
			/* ignore */
		}
	}

	let collapsedIds = $state<Set<string>>(loadCollapsed());

	function toggleCollapse(topicId: string) {
		const next = new Set(collapsedIds);
		if (next.has(topicId)) next.delete(topicId);
		else next.add(topicId);
		collapsedIds = next;
		saveCollapsed(next);
	}

	function isVisible(topic: Topic): boolean {
		let pid = topic.parentTopicId;
		const map = topicMap();
		while (pid) {
			if (collapsedIds.has(pid)) return false;
			pid = map.get(pid)?.parentTopicId ?? null;
		}
		return true;
	}

	function hasMoreSiblingsAtDepth(
		index: number,
		targetDepth: number,
	): boolean {
		for (let j = index + 1; j < topics.length; j++) {
			if (topics[j].depth < targetDepth) return false;
			if (topics[j].depth === targetDepth) return true;
		}
		return false;
	}

	function handleParse() {
		if (!outlineText.trim()) {
			parseResult = null;
			return;
		}
		parseResult = parseTopicOutline(outlineText);
	}

	async function handleSaveImport() {
		if (!parseResult || parseResult.topics.length === 0) return;

		isSavingImport = true;
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
			isSavingImport = false;
		}
	}

	async function handleDeleteAllTopics() {
		if (!confirm("Delete all topics for this subject?")) return;
		await getRepository().deleteTopicsBySubject(subjectId);
		await refreshTopics(subjectId);
		outlineText = "";
		parseResult = null;
		saveError = "";
		showImporter = true;
	}

	function depthPadding(depth: number): string {
		if (depth <= 1) return "";
		return `padding-left: ${(depth - 1) * 16}px`;
	}

	// ── Subject editing ──

	function startEditSubject() {
		if (subject) {
			subjectName = subject.name;
			examDate = subject.examDate ?? "";
		}
		editingSubject = true;
		subjectError = "";
	}

	function cancelEditSubject() {
		editingSubject = false;
		subjectError = "";
		if (subject) {
			subjectName = subject.name;
			examDate = subject.examDate ?? "";
		}
	}

	async function saveSubject() {
		const trimmed = subjectName.trim();
		if (!trimmed) {
			subjectError = "Subject name is required.";
			return;
		}
		isSavingSubject = true;
		subjectError = "";
		try {
			subject = await getRepository().updateSubject({
				id: subjectId,
				name: trimmed,
				examDate: examDate || null,
			});
			await refreshSubjects();
			editingSubject = false;
		} catch (err) {
			subjectError =
				err instanceof Error ? err.message : "Failed to save.";
		} finally {
			isSavingSubject = false;
		}
	}

	// ── Topic title editing ──

	function startEditTopic(topic: Topic) {
		editingTopicId = topic.id;
		editTopicTitle = topic.title;
	}

	function cancelEditTopic() {
		editingTopicId = null;
		editTopicTitle = "";
	}

	async function saveTopic(topicId: string) {
		const trimmed = editTopicTitle.trim();
		if (!trimmed) return;
		try {
			await getRepository().updateTopic({ topicId, title: trimmed });
			await refreshTopics(subjectId);
		} catch {
			/* ignore */
		}
		editingTopicId = null;
		editTopicTitle = "";
	}

	function handleTopicKeydown(e: KeyboardEvent, topicId: string) {
		if (e.key === "Enter") {
			e.preventDefault();
			saveTopic(topicId);
		} else if (e.key === "Escape") {
			cancelEditTopic();
		}
	}

	// ── Delete topic ──

	async function handleDeleteTopic(topicId: string) {
		deletingTopicId = topicId;
		try {
			await getRepository().deleteTopic(topicId);
			await refreshTopics(subjectId);
		} catch {
			/* ignore */
		} finally {
			deletingTopicId = null;
		}
	}

	// ── Drag & Drop ──

	function handleDragStart(e: DragEvent, topicId: string) {
		draggedTopicId = topicId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", topicId);
		}
	}

	function handleDragOver(e: DragEvent, topicId: string, el: HTMLElement) {
		e.preventDefault();
		if (!draggedTopicId || draggedTopicId === topicId) {
			dropTarget = null;
			return;
		}

		// Don't allow dropping onto own descendants
		const subtreeIds = getSubtreeIds(draggedTopicId);
		if (subtreeIds.has(topicId)) {
			dropTarget = null;
			return;
		}

		// Determine zone from cursor position within the row
		const rect = el.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const ratio = y / rect.height;

		let zone: DropZone;
		if (ratio < 0.25) {
			zone = "before";
		} else if (ratio > 0.75) {
			zone = "after";
		} else {
			zone = "inside";
		}

		dropTarget = { topicId, zone };
		if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
	}

	function handleDragLeave(e: DragEvent, el: HTMLElement) {
		// Only clear if we actually left this element (not entering a child)
		if (!el.contains(e.relatedTarget as Node)) {
			dropTarget = null;
		}
	}

	function handleDragEnd() {
		draggedTopicId = null;
		dropTarget = null;
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		if (!draggedTopicId || !dropTarget) {
			handleDragEnd();
			return;
		}

		const target = dropTarget;
		const dragId = draggedTopicId;
		handleDragEnd();

		await applyMove(dragId, target.topicId, target.zone);
	}

	// ── Move logic (shared by DnD + arrow buttons) ──

	async function applyMove(
		movedTopicId: string,
		targetTopicId: string,
		zone: DropZone,
	) {
		const movedSubtree = getSubtree(movedTopicId);
		if (movedSubtree.length === 0) return;

		const movedIds = new Set(movedSubtree.map((t) => t.id));
		const targetTopic = topicMap().get(targetTopicId);
		if (!targetTopic) return;

		// Remove the moved subtree from the list
		const remaining = topics.filter((t) => !movedIds.has(t.id));

		// Determine new parent and depth for the moved root
		let newParentId: string | null;
		let newDepth: number;
		let insertIndex: number;

		if (zone === "inside") {
			// Nest as first child of target
			newParentId = targetTopicId;
			newDepth = targetTopic.depth + 1;
			// Insert right after target in the flat list
			const targetIdx = remaining.findIndex(
				(t) => t.id === targetTopicId,
			);
			insertIndex = targetIdx + 1;
		} else if (zone === "before") {
			// Sibling of target, inserted before it
			newParentId = targetTopic.parentTopicId;
			newDepth = targetTopic.depth;
			insertIndex = remaining.findIndex((t) => t.id === targetTopicId);
		} else {
			// "after" — sibling of target, inserted after target's subtree
			newParentId = targetTopic.parentTopicId;
			newDepth = targetTopic.depth;
			const targetIdx = remaining.findIndex(
				(t) => t.id === targetTopicId,
			);
			// Skip past the target's children in the remaining list
			let afterIdx = targetIdx + 1;
			while (
				afterIdx < remaining.length &&
				remaining[afterIdx].depth > targetTopic.depth
			) {
				afterIdx++;
			}
			insertIndex = afterIdx;
		}

		// Adjust depths of all moved subtree members
		const depthDelta = newDepth - movedSubtree[0].depth;
		const adjusted = movedSubtree.map((t) => ({
			...t,
			depth: t.depth + depthDelta,
			parentTopicId:
				t.id === movedTopicId ? newParentId : t.parentTopicId,
		}));

		// Insert into position
		const newOrder = [...remaining];
		newOrder.splice(insertIndex, 0, ...adjusted);

		// Recalculate all codes
		const newCodes = recalculateCodes(newOrder);

		// Persist
		isSaving = true;
		try {
			await getRepository().reorganizeTopics({
				subjectId,
				topics: newOrder.map((t) => ({
					topicId: t.id,
					code: newCodes.get(t.id) ?? t.code,
					depth: t.depth,
					parentTopicId: t.parentTopicId,
				})),
			});
			await refreshTopics(subjectId);
		} catch {
			/* ignore */
		} finally {
			isSaving = false;
		}
	}

	// ── Drop indicator style ──

	function dropIndicatorClass(
		topicId: string,
		zone: DropZone,
	): string {
		if (
			!dropTarget ||
			dropTarget.topicId !== topicId ||
			dropTarget.zone !== zone
		)
			return "";

		if (zone === "inside") return "ring-2 ring-blue-400 bg-blue-50";
		return ""; // before/after use the line indicator
	}

	function showLineBefore(topicId: string): boolean {
		return (
			dropTarget?.topicId === topicId && dropTarget?.zone === "before"
		);
	}

	function showLineAfter(topicId: string): boolean {
		return (
			dropTarget?.topicId === topicId && dropTarget?.zone === "after"
		);
	}
</script>

<PageHeader
	title={subject?.name ? `Edit — ${subject.name}` : "Edit Subject"}
	backHref="/subjects/{subjectId}/ratings"
/>

<div class="space-y-6">
	<!-- Subject details card -->
	<div
		class="rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-neutral-100"
	>
		{#if editingSubject}
			<div class="space-y-4">
				<div>
					<label
						for="subjectName"
						class="block text-xs font-medium text-neutral-500"
					>
						Subject name
					</label>
					<input
						id="subjectName"
						type="text"
						bind:value={subjectName}
						class="mt-1 block w-full rounded-lg border-0 bg-neutral-50 px-3 py-2 text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
					/>
				</div>
				<div>
					<label
						for="examDate"
						class="block text-xs font-medium text-neutral-500"
					>
						Exam date
						<span class="font-normal text-neutral-300"
							>(optional)</span
						>
					</label>
					<input
						id="examDate"
						type="date"
						bind:value={examDate}
						class="mt-1 block w-full rounded-lg border-0 bg-neutral-50 px-3 py-2 text-sm shadow-sm ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
					/>
				</div>
				{#if subjectError}
					<p class="text-xs text-red-500">{subjectError}</p>
				{/if}
				<div class="flex items-center justify-end gap-3">
					<button
						onclick={cancelEditSubject}
						class="text-sm text-neutral-400 transition-colors hover:text-neutral-600"
					>
						Cancel
					</button>
					<button
						onclick={saveSubject}
						disabled={isSavingSubject}
						class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
					>
						{isSavingSubject ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		{:else}
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-base font-semibold text-neutral-900">
						{subject?.name ?? "..."}
					</h2>
					{#if subject?.examDate}
						<p class="mt-0.5 text-xs text-neutral-400">
							Exam: {new Date(
								subject.examDate,
							).toLocaleDateString("en-GB", {
								day: "numeric",
								month: "short",
								year: "numeric",
							})}
						</p>
					{:else}
						<p class="mt-0.5 text-xs text-neutral-400">
							No exam date set
						</p>
					{/if}
				</div>
				<button
					onclick={startEditSubject}
					class="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
					title="Edit subject"
				>
					<Pencil size={16} />
				</button>
			</div>
		{/if}
	</div>

	<!-- Topics section -->
	{#if topics.length > 0}
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h3
					class="text-xs font-medium uppercase tracking-wide text-neutral-400"
				>
					Topics
				</h3>
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
					{#if isSaving}
						<span class="text-xs text-neutral-400">Saving...</span>
					{/if}
				</div>
			</div>

			<p class="text-[11px] text-neutral-400">
				Drag topics to reorder or nest. Top/bottom edge = sibling,
				centre = nest inside.
			</p>

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="space-y-0" ondrop={handleDrop}>
				{#each topics as topic, i}
					{@const visible = isVisible(topic)}
					{@const hasChildren = isParent(topic.id)}
					{@const isTopLevel = topic.depth === 1}
					{@const isEditing = editingTopicId === topic.id}
					{@const isDragged = draggedTopicId === topic.id}
					{#if visible}
						<!-- Drop line BEFORE -->
						{#if showLineBefore(topic.id)}
							<div
								class="pointer-events-none mx-2 h-0.5 rounded-full bg-blue-400"
								style="margin-left: {(topic.depth - 1) * 16 + 8}px"
							></div>
						{/if}

						<!-- Topic row -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="group flex items-center rounded-lg py-1 transition-all {isDragged
								? 'opacity-30'
								: ''} {dropIndicatorClass(topic.id, 'inside')}"
							draggable={!isEditing}
							ondragstart={(e) =>
								handleDragStart(e, topic.id)}
							ondragover={(e) =>
								handleDragOver(
									e,
									topic.id,
									e.currentTarget as HTMLElement,
								)}
							ondragleave={(e) =>
								handleDragLeave(
									e,
									e.currentTarget as HTMLElement,
								)}
							ondragend={handleDragEnd}
							role="listitem"
						>
							<!-- Drag affordance (the whole row is draggable, but the dots hint it) -->
							<div
								class="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center"
							>
								<svg
									class="text-neutral-200 transition-colors group-hover:text-neutral-400"
									width="10"
									height="14"
									viewBox="0 0 10 14"
									fill="currentColor"
								>
									<circle cx="3" cy="2" r="1.2" />
									<circle cx="7" cy="2" r="1.2" />
									<circle cx="3" cy="7" r="1.2" />
									<circle cx="7" cy="7" r="1.2" />
									<circle cx="3" cy="12" r="1.2" />
									<circle cx="7" cy="12" r="1.2" />
								</svg>
							</div>

							<!-- Tree lines -->
							{#if topic.depth > 1}
								<div
									class="flex shrink-0 items-center self-stretch"
								>
									{#each Array(topic.depth - 1) as _, d}
										{@const isLast =
											d === topic.depth - 2}
										<div
											class="relative flex h-full w-4 items-center justify-center"
										>
											{#if isLast}
												<div
													class="absolute left-1/2 top-0 h-1/2 w-px bg-neutral-200"
												></div>
												<div
													class="absolute left-1/2 top-1/2 h-px w-[8px] bg-neutral-200"
												></div>
												{#if hasMoreSiblingsAtDepth(i, topic.depth)}
													<div
														class="absolute left-1/2 top-1/2 h-1/2 w-px bg-neutral-200"
													></div>
												{/if}
											{:else}
												{#if hasMoreSiblingsAtDepth(i, d + 2)}
													<div
														class="absolute left-1/2 top-0 h-full w-px bg-neutral-200"
													></div>
												{/if}
											{/if}
										</div>
									{/each}
								</div>
							{/if}

							<!-- Collapse chevron -->
							{#if hasChildren}
								<button
									onclick={() => toggleCollapse(topic.id)}
									class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
									aria-label={collapsedIds.has(topic.id)
										? "Expand"
										: "Collapse"}
								>
									<ChevronRight
										size={14}
										class="transition-transform duration-150 {collapsedIds.has(
											topic.id,
										)
											? ''
											: 'rotate-90'}"
									/>
								</button>
							{:else}
								<div class="w-6 shrink-0"></div>
							{/if}

							<!-- Code badge -->
							<span
								class="w-6 shrink-0 text-right font-mono text-[11px] text-neutral-300"
							>
								{topic.code.split(".").pop()}
							</span>

							<!-- Title -->
							{#if isEditing}
								<div
									class="ml-1.5 flex min-w-0 flex-1 items-center gap-1"
								>
									<input
										type="text"
										bind:value={editTopicTitle}
										onkeydown={(e) =>
											handleTopicKeydown(e, topic.id)}
										class="min-w-0 flex-1 rounded border-0 bg-white px-2 py-0.5 text-sm ring-1 ring-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
										autofocus
									/>
									<button
										onclick={() => saveTopic(topic.id)}
										class="rounded p-1 text-green-500 transition-colors hover:bg-green-50"
										title="Save"
									>
										<Check size={14} />
									</button>
									<button
										onclick={cancelEditTopic}
										class="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-100"
										title="Cancel"
									>
										<X size={14} />
									</button>
								</div>
							{:else}
								<span
									class="ml-1.5 min-w-0 flex-1 truncate text-sm {isTopLevel
										? 'font-semibold text-neutral-900'
										: topic.depth === 2
											? 'font-medium text-neutral-700'
											: 'text-neutral-600'}"
								>
									{topic.title}
								</span>

								<!-- Hover actions -->
								<div
									class="flex shrink-0 items-center gap-0.5 pl-2 opacity-0 transition-opacity group-hover:opacity-100"
								>
									<button
										onclick={() => startEditTopic(topic)}
										class="rounded p-1 text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
										title="Rename"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() =>
											handleDeleteTopic(topic.id)}
										disabled={deletingTopicId === topic.id}
										class="rounded p-1 text-neutral-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
										title="Delete{hasChildren
											? ' (with children)'
											: ''}"
									>
										<Trash2 size={14} />
									</button>
								</div>
							{/if}
						</div>

						<!-- Drop line AFTER -->
						{#if showLineAfter(topic.id)}
							<div
								class="pointer-events-none mx-2 h-0.5 rounded-full bg-blue-400"
								style="margin-left: {(topic.depth - 1) * 16 + 8}px"
							></div>
						{/if}
					{/if}
				{/each}
			</div>
		</div>
	{:else}
		<div class="py-12 text-center">
			<p class="text-sm text-neutral-400">No topics yet.</p>
			<button
				onclick={() => (showImporter = true)}
				class="mt-3 inline-block text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-2 hover:text-neutral-700"
			>
				Import topics
			</button>
		</div>
	{/if}

	{#if showImporter}
		<div class="space-y-4 rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-neutral-100">
			<div class="flex items-start justify-between gap-4">
				<div>
					<h3 class="text-sm font-medium text-neutral-700">Import from outline</h3>
					<p class="mt-0.5 text-xs text-neutral-400">
						Paste a numbered outline. Each line: <code class="rounded bg-neutral-100 px-1">1.2.3</code> followed by the topic title.
					</p>
				</div>
				{#if topics.length > 0}
					<button
						onclick={() => {
							showImporter = false;
							outlineText = "";
							parseResult = null;
							saveError = "";
						}}
						class="text-xs text-neutral-400 transition-colors hover:text-neutral-700"
					>
						Hide
					</button>
				{/if}
			</div>

			<textarea
				bind:value={outlineText}
				oninput={handleParse}
				placeholder={"1 Photosynthesis\n1.1 Light reactions\n1.2 Calvin cycle\n2 Cell division\n2.1 Mitosis\n2.2 Meiosis"}
				rows={8}
				class="block w-full rounded-lg border-0 bg-neutral-50 px-3 py-2 font-mono text-sm shadow-sm ring-1 ring-neutral-200 placeholder:text-neutral-300 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
			></textarea>

			{#if parseResult && parseResult.errors.length > 0}
				<div class="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
					<p class="text-xs font-medium text-amber-700">
						{parseResult.errors.length} line{parseResult.errors.length === 1 ? "" : "s"} couldn't be parsed:
					</p>
					<ul class="mt-1 space-y-0.5">
						{#each parseResult.errors as err}
							<li class="text-[11px] text-amber-600">
								Line {err.line}: "{err.text}" - {err.reason}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if parseResult && parseResult.topics.length > 0}
				<div class="rounded-lg bg-neutral-50 p-3 ring-1 ring-neutral-100">
					<p class="mb-2 text-xs font-medium text-neutral-500">
						Preview - {parseResult.topics.length} topic{parseResult.topics.length === 1 ? "" : "s"}
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
					onclick={handleSaveImport}
					disabled={isSavingImport}
					class="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
				>
					{isSavingImport ? "Saving..." : `Save ${parseResult.topics.length} topic${parseResult.topics.length === 1 ? "" : "s"}`}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Danger zone -->
	<div class="border-t border-neutral-100 pt-6">
		<h3
			class="text-xs font-medium uppercase tracking-wide text-neutral-400"
		>
			Danger zone
		</h3>
		<div class="mt-3 flex items-center gap-3">
			<button
				onclick={async () => {
					if (
						!confirm(
							"Delete this subject and all its topics? This cannot be undone.",
						)
					)
						return;
					await getRepository().deleteSubject(subjectId);
					await refreshSubjects();
					goto("/");
				}}
				class="rounded-lg px-4 py-2 text-sm font-medium text-red-500 ring-1 ring-red-200 transition-colors hover:bg-red-50 hover:text-red-600"
			>
				Delete subject
			</button>
		</div>
	</div>
</div>
