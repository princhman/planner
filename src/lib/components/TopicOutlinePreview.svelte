<script lang="ts">
	type PreviewTopic = {
		code: string;
		title: string;
		depth: number;
	};

	let {
		topics,
		hasMoreSiblingsAtDepth,
	}: {
		topics: PreviewTopic[];
		hasMoreSiblingsAtDepth: (index: number, targetDepth: number) => boolean;
	} = $props();
</script>

<div
	class="rounded-lg bg-neutral-50 dark:bg-neutral-700 p-3 ring-1 ring-neutral-100 dark:ring-neutral-700"
>
	<p class="mb-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
		Preview - {topics.length} topic{topics.length === 1 ? "" : "s"}
	</p>
	<div class="space-y-px">
		{#each topics as topic, i}
			<div class="flex min-w-0 items-center leading-5">
				{#if topic.depth > 1}
					<div class="flex shrink-0 items-center self-stretch">
						{#each Array(topic.depth - 1) as _, d}
							{@const lineDepth = d + 1}
							{@const isLastAtThisDepth = d === topic.depth - 2}
							<div class="relative flex h-full w-4 items-center justify-center">
								{#if isLastAtThisDepth}
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
								{:else if hasMoreSiblingsAtDepth(i, lineDepth + 1)}
									<div
										class="absolute left-1/2 top-0 h-full w-px bg-neutral-200 dark:bg-neutral-700"
									></div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<div class="w-3 shrink-0"></div>
				<span
					class="w-4 shrink-0 text-right font-mono text-[11px] text-neutral-300 dark:text-neutral-500"
				>
					{topic.code.split(".").pop()}
				</span>
				<span
					class="ml-1 min-w-0 text-sm {topic.depth === 1
						? 'font-semibold text-neutral-900 dark:text-white'
						: topic.depth === 2
							? 'font-medium text-neutral-700 dark:text-neutral-200'
							: 'text-neutral-600 dark:text-neutral-400'}"
				>
					{topic.title}
				</span>
			</div>
		{/each}
	</div>
</div>
