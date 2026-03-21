<script lang="ts">
	import type { Topic } from "$lib/types.js";
	import { Pencil, Check, X, Trash2, ChevronRight } from "lucide-svelte";

	type DropZone = "before" | "inside" | "after";
	type DropTarget = { topicId: string; zone: DropZone } | null;

	let {
		topics,
		collapsedIds,
		editingTopicId,
		editTopicTitle,
		draggedTopicId,
		deletingTopicId,
		isSaving,
		isVisible,
		isParent,
		hasMoreSiblingsAtDepth,
		showLineBefore,
		showLineAfter,
		dropIndicatorClass,
		toggleCollapse,
		handleDragStart,
		handleDragOver,
		handleDragLeave,
		handleDragEnd,
		startEditTopic,
		setEditTopicTitle,
		handleTopicKeydown,
		saveTopic,
		cancelEditTopic,
		handleDeleteTopic,
		handleDrop,
	}: {
		topics: Topic[];
		collapsedIds: Set<string>;
		editingTopicId: string | null;
		editTopicTitle: string;
		draggedTopicId: string | null;
		deletingTopicId: string | null;
		isSaving: boolean;
		isVisible: (topic: Topic) => boolean;
		isParent: (topicId: string) => boolean;
		hasMoreSiblingsAtDepth: (index: number, targetDepth: number) => boolean;
		showLineBefore: (topicId: string) => boolean;
		showLineAfter: (topicId: string) => boolean;
		dropIndicatorClass: (topicId: string, zone: DropZone) => string;
		toggleCollapse: (topicId: string) => void;
		handleDragStart: (e: DragEvent, topicId: string) => void;
		handleDragOver: (e: DragEvent, topicId: string, el: HTMLElement) => void;
		handleDragLeave: (e: DragEvent, el: HTMLElement) => void;
		handleDragEnd: () => void;
		startEditTopic: (topic: Topic) => void;
		setEditTopicTitle: (value: string) => void;
		handleTopicKeydown: (e: KeyboardEvent, topicId: string) => void;
		saveTopic: (topicId: string) => void | Promise<void>;
		cancelEditTopic: () => void;
		handleDeleteTopic: (topicId: string) => void | Promise<void>;
		handleDrop: (e: DragEvent) => void | Promise<void>;
	} = $props();
</script>

<div class="flex items-center justify-between">
	<h3
		class="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-400"
	>
		Topics
	</h3>
	<div class="flex items-center gap-3">
		{#if isSaving}
			<span class="text-xs text-neutral-400 dark:text-neutral-400">Saving...</span>
		{/if}
	</div>
</div>

<p class="text-[11px] text-neutral-400 dark:text-neutral-400">
	Drag topics to reorder or nest. Top/bottom edge = sibling, centre = nest inside.
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
			{#if showLineBefore(topic.id)}
				<div
					class="pointer-events-none mx-2 h-0.5 rounded-full bg-blue-400"
					style="margin-left: {(topic.depth - 1) * 16 + 8}px"
				></div>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="group flex items-center rounded-lg transition-all {isDragged
					? 'opacity-30'
					: ''} {dropIndicatorClass(topic.id, 'inside')}"
				draggable={!isEditing}
				ondragstart={(e) => handleDragStart(e, topic.id)}
				ondragover={(e) => handleDragOver(e, topic.id, e.currentTarget as HTMLElement)}
				ondragleave={(e) => handleDragLeave(e, e.currentTarget as HTMLElement)}
				ondragend={handleDragEnd}
				role="listitem"
			>
				<div class="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center">
					<svg
						class="text-neutral-200 dark:text-neutral-700 transition-colors group-hover:text-neutral-400 dark:group-hover:text-neutral-500"
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

				{#if topic.depth > 1}
					<div class="flex shrink-0 items-center self-stretch">
						{#each Array(topic.depth - 1) as _, d}
							{@const isLast = d === topic.depth - 2}
							<div class="relative flex h-full w-4 items-center justify-center">
								{#if isLast}
									<div
										class="absolute left-1/2 top-0 h-1/2 w-px bg-neutral-200 dark:bg-neutral-700"
									></div>
									<div
										class="absolute left-1/2 top-1/2 h-px w-[8px] bg-neutral-200 dark:bg-neutral-700"
									></div>
									{#if hasMoreSiblingsAtDepth(i, topic.depth)}
										<div
											class="absolute left-1/2 top-1/2 h-1/2 w-px bg-neutral-200 dark:bg-neutral-700"
										></div>
									{/if}
								{:else if hasMoreSiblingsAtDepth(i, d + 2)}
									<div
										class="absolute left-1/2 top-0 h-full w-px bg-neutral-200 dark:bg-neutral-700"
									></div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				{#if hasChildren}
					<button
						onclick={() => toggleCollapse(topic.id)}
						class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-300 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-200"
						aria-label={collapsedIds.has(topic.id) ? "Expand" : "Collapse"}
					>
						<ChevronRight
							size={14}
							class="transition-transform duration-150 {collapsedIds.has(topic.id)
								? ''
								: 'rotate-90'}"
						/>
					</button>
				{:else}
					<div class="w-6 shrink-0"></div>
				{/if}

				<span
					class="w-6 shrink-0 text-right font-mono text-[11px] text-neutral-300 dark:text-neutral-500"
				>
					{topic.code.split(".").pop()}
				</span>

				{#if isEditing}
					<div class="ml-1.5 flex min-w-0 flex-1 items-center gap-1">
						<input
							type="text"
							value={editTopicTitle}
							oninput={(e) => setEditTopicTitle((e.currentTarget as HTMLInputElement).value)}
							onkeydown={(e) => handleTopicKeydown(e, topic.id)}
							class="min-w-0 flex-1 rounded border-0 bg-white dark:bg-neutral-800 px-2 py-0.5 text-sm ring-1 ring-neutral-300 dark:ring-neutral-600 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
							autofocus
						/>
						<button
							onclick={() => saveTopic(topic.id)}
							class="rounded p-1 text-green-500 dark:text-green-400 transition-colors hover:bg-green-50 dark:hover:bg-green-950"
							title="Save"
						>
							<Check size={14} />
						</button>
						<button
							onclick={cancelEditTopic}
							class="rounded p-1 text-neutral-400 dark:text-neutral-400 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700"
							title="Cancel"
						>
							<X size={14} />
						</button>
					</div>
				{:else}
					<span
						class="ml-1.5 min-w-0 flex-1 truncate text-sm {isTopLevel
							? 'font-semibold text-neutral-900 dark:text-white'
							: topic.depth === 2
								? 'font-medium text-neutral-700 dark:text-neutral-200'
								: 'text-neutral-600 dark:text-neutral-400'}"
					>
						{topic.title}
					</span>

					<div
						class="flex shrink-0 items-center gap-0.5 pl-2 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100"
					>
						<button
							onclick={() => startEditTopic(topic)}
							onmousedown={(e) => e.stopPropagation()}
							ondragstart={(e) => e.preventDefault()}
							class="rounded p-1 text-neutral-300 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-200"
							title="Rename"
						>
							<Pencil size={14} />
						</button>
						<button
							onclick={() => handleDeleteTopic(topic.id)}
							onmousedown={(e) => e.stopPropagation()}
							ondragstart={(e) => e.preventDefault()}
							disabled={deletingTopicId === topic.id}
							class="rounded p-1 text-neutral-300 dark:text-neutral-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
							title="Delete{hasChildren ? ' (with children)' : ''}"
						>
							<Trash2 size={14} />
						</button>
					</div>
				{/if}
			</div>

			{#if showLineAfter(topic.id)}
				<div
					class="pointer-events-none mx-2 h-0.5 rounded-full bg-blue-400"
					style="margin-left: {(topic.depth - 1) * 16 + 8}px"
				></div>
			{/if}
		{/if}
	{/each}
</div>
