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
    import TopicList from "$lib/components/TopicList.svelte";
    import TopicOutlinePreview from "$lib/components/TopicOutlinePreview.svelte";
    import { Pencil } from "lucide-svelte";

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
        return `planner_collapsed_topics_${subjectId}`;
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
            saveError =
                err instanceof Error ? err.message : "Failed to save topics.";
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

    async function normalizeTopicStructure() {
        const currentTopics = await getRepository().listTopics(subjectId);
        if (currentTopics.length === 0) return;

        const newCodes = recalculateCodes(
            currentTopics.map((topic) => ({
                id: topic.id,
                depth: topic.depth,
                parentTopicId: topic.parentTopicId,
            })),
        );

        await getRepository().reorganizeTopics({
            subjectId,
            topics: currentTopics.map((topic) => ({
                topicId: topic.id,
                code: newCodes.get(topic.id) ?? topic.code,
                depth: topic.depth,
                parentTopicId: topic.parentTopicId,
            })),
        });
        await refreshTopics(subjectId);

        const validIds = new Set(currentTopics.map((topic) => topic.id));
        const nextCollapsed = new Set(
            [...collapsedIds].filter((id) => validIds.has(id)),
        );
        collapsedIds = nextCollapsed;
        saveCollapsed(nextCollapsed);
    }

    function previewHasMoreSiblingsAtDepth(
        index: number,
        targetDepth: number,
    ): boolean {
        if (!parseResult) return false;
        for (let j = index + 1; j < parseResult.topics.length; j++) {
            const topic = parseResult.topics[j];
            if (topic.depth < targetDepth) return false;
            if (topic.depth === targetDepth) return true;
        }
        return false;
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

    function setEditTopicTitle(value: string) {
        editTopicTitle = value;
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
        saveError = "";
        try {
            await getRepository().deleteTopic(topicId);
            await normalizeTopicStructure();
        } catch (err) {
            saveError =
                err instanceof Error ? err.message : "Failed to delete topic.";
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

    function dropIndicatorClass(topicId: string, zone: DropZone): string {
        if (
            !dropTarget ||
            dropTarget.topicId !== topicId ||
            dropTarget.zone !== zone
        )
            return "";

        if (zone === "inside") return "ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-950";
        return ""; // before/after use the line indicator
    }

    function showLineBefore(topicId: string): boolean {
        return dropTarget?.topicId === topicId && dropTarget?.zone === "before";
    }

    function showLineAfter(topicId: string): boolean {
        return dropTarget?.topicId === topicId && dropTarget?.zone === "after";
    }
</script>

<PageHeader
    title={subject?.name ? `Edit — ${subject.name}` : "Edit Subject"}
    backHref="/subjects/{subjectId}/ratings"
/>

<div class="space-y-6">
    <!-- Subject details card -->
    <div
        class="rounded-xl bg-white dark:bg-neutral-800 px-5 py-4 shadow-sm ring-1 ring-neutral-100 dark:ring-neutral-700"
    >
        {#if editingSubject}
            <div class="space-y-4">
                <div>
                    <label
                        for="subjectName"
                        class="block text-xs font-medium text-neutral-500 dark:text-neutral-400"
                    >
                        Subject name
                    </label>
                    <input
                        id="subjectName"
                        type="text"
                        bind:value={subjectName}
                        class="mt-1 block w-full rounded-lg border-0 bg-neutral-50 dark:bg-neutral-700 px-3 py-2 text-sm shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
                    />
                </div>
                <div>
                    <label
                        for="examDate"
                        class="block text-xs font-medium text-neutral-500 dark:text-neutral-400"
                    >
                        Exam date
                        <span class="font-normal text-neutral-300 dark:text-neutral-500"
                            >(optional)</span
                        >
                    </label>
                    <input
                        id="examDate"
                        type="date"
                        bind:value={examDate}
                        class="mt-1 block w-full rounded-lg border-0 bg-neutral-50 dark:bg-neutral-700 px-3 py-2 text-sm shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-600 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
                    />
                </div>
                {#if subjectError}
                    <p class="text-xs text-red-500 dark:text-red-400">{subjectError}</p>
                {/if}
                <div class="flex items-center justify-end gap-3">
                    <button
                        onclick={cancelEditSubject}
                        class="text-sm text-neutral-400 dark:text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                        Cancel
                    </button>
                    <button
                        onclick={saveSubject}
                        disabled={isSavingSubject}
                        class="rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-50"
                    >
                        {isSavingSubject ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        {:else}
            <div class="flex items-start justify-between">
                <div>
                    <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
                        {subject?.name ?? "..."}
                    </h2>
                    {#if subject?.examDate}
                        <p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-400">
                            Exam: {new Date(
                                subject.examDate,
                            ).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                            })}
                        </p>
                    {:else}
                        <p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-400">
                            No exam date set
                        </p>
                    {/if}
                </div>
                <button
                    onclick={startEditSubject}
                    class="rounded-lg p-1.5 text-neutral-300 dark:text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-600 dark:hover:text-neutral-200"
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
                <div class="flex items-center gap-3">
                    <button
                        onclick={() => (showImporter = !showImporter)}
                        class="text-xs text-neutral-400 dark:text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
                    >
                        {showImporter ? "Hide importer" : "+ Import more"}
                    </button>
                    <button
                        onclick={handleDeleteAllTopics}
                        class="text-xs text-red-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                        Delete all
                    </button>
                </div>
            </div>

            <TopicList
                {topics}
                {collapsedIds}
                {editingTopicId}
                {editTopicTitle}
                {draggedTopicId}
                {deletingTopicId}
                {isSaving}
                {isVisible}
                {isParent}
                {hasMoreSiblingsAtDepth}
                {showLineBefore}
                {showLineAfter}
                {dropIndicatorClass}
                {toggleCollapse}
                {handleDragStart}
                {handleDragOver}
                {handleDragLeave}
                {handleDragEnd}
                {startEditTopic}
                {setEditTopicTitle}
                {handleTopicKeydown}
                {saveTopic}
                {cancelEditTopic}
                {handleDeleteTopic}
                {handleDrop}
            />
        </div>
    {:else}
        <div class="py-12 text-center">
            <p class="text-sm text-neutral-400 dark:text-neutral-400">No topics yet.</p>
            <button
                onclick={() => (showImporter = true)}
                class="mt-3 inline-block text-sm text-neutral-500 dark:text-neutral-400 underline decoration-neutral-300 dark:decoration-neutral-500 underline-offset-2 hover:text-neutral-700 dark:hover:text-neutral-200"
            >
                Import topics
            </button>
        </div>
    {/if}

    {#if showImporter}
        <div
            class="space-y-4 rounded-xl bg-white dark:bg-neutral-800 px-5 py-4 shadow-sm ring-1 ring-neutral-100 dark:ring-neutral-700"
        >
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                        Import from outline
                    </h3>
                    <p class="mt-0.5 text-xs text-neutral-400 dark:text-neutral-400">
                        Paste a numbered outline. Each line: <code
                            class="rounded bg-neutral-100 dark:bg-neutral-700 px-1">1.2.3</code
                        > followed by the topic title.
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
                        class="text-xs text-neutral-400 dark:text-neutral-400 transition-colors hover:text-neutral-700 dark:hover:text-neutral-200"
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
                class="block w-full rounded-lg border-0 bg-neutral-50 dark:bg-neutral-700 px-3 py-2 font-mono text-sm shadow-sm ring-1 ring-neutral-200 dark:ring-neutral-600 placeholder:text-neutral-300 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-neutral-400 focus:outline-none"
            ></textarea>

            {#if parseResult && parseResult.errors.length > 0}
                <div class="rounded-lg bg-amber-50 dark:bg-amber-950 p-3 ring-1 ring-amber-200 dark:ring-amber-800">
                    <p class="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {parseResult.errors.length} line{parseResult.errors
                            .length === 1
                            ? ""
                            : "s"} couldn't be parsed:
                    </p>
                    <ul class="mt-1 space-y-0.5">
                        {#each parseResult.errors as err}
                            <li class="text-[11px] text-amber-600 dark:text-amber-400">
                                Line {err.line}: "{err.text}" - {err.reason}
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}

            {#if parseResult && parseResult.topics.length > 0}
                <TopicOutlinePreview
                    topics={parseResult.topics}
                    hasMoreSiblingsAtDepth={previewHasMoreSiblingsAtDepth}
                />

                {#if saveError}
                    <p class="text-xs text-red-500 dark:text-red-400">{saveError}</p>
                {/if}

                <button
                    onclick={handleSaveImport}
                    disabled={isSavingImport}
                    class="rounded-lg bg-neutral-900 dark:bg-white dark:text-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-50"
                >
                    {isSavingImport
                        ? "Saving..."
                        : `Save ${parseResult.topics.length} topic${parseResult.topics.length === 1 ? "" : "s"}`}
                </button>
            {/if}
        </div>
    {/if}

    <!-- Danger zone -->
    <div class="border-t border-neutral-100 dark:border-neutral-700 pt-6">
        <h3
            class="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-400"
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
                class="rounded-lg px-4 py-2 text-sm font-medium text-red-500 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800 transition-colors hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
            >
                Delete subject
            </button>
        </div>
    </div>
</div>
