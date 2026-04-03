<script>
    import { onMount } from "svelte";
    import Button from "./ui/button/button.svelte";
    import { annotate } from "rough-notation";

    let studyLess = $state();
    let effectively = $state();

    onMount(() => {
        annotate(studyLess, {
            type: "underline",
            color: "#F5C542",
        }).show();

        annotate(effectively, {
            type: "box",
            color: "var(--primary)",
        }).show();
    });
</script>

<!-- maybe highlight study less and circle more effectively? -->
<div
    class="flex h-screen text-center items-center justify-center flex-col pb-32 gap-1"
>
    <span class="text-3xl lg:text-5xl font-black">
        Stop guessing what to study,
    </span>
    <span class="text-xl lg:text-2xl text-gray-400">
        with our spaced repetition planner, <span
            class="font-semibold text-white"
            bind:this={studyLess}>study less</span
        >, but more
        <span class="font-semibold text-white" bind:this={effectively}
            >effectively.</span
        >
    </span>
    <div class="pt-4">
        <Button href="/auth" class="px-8 py-2 text-xl"
            >Get started for free</Button
        >
    </div>
</div>

<div class="flex h-screen text-center flex-col justify-center gap-4">
    <div class="flex flex-col items-center gap-4">
        <span class="text-2xl lg:text-4xl font-bold">How does it work?</span>
        <div class="grid grid-cols-1 gap-4 my-">
            <span class="p-4 border rounded-md">
                <span class="font-bold pr-1">1.</span> Create course with topics from
                scratch or templates
            </span>
            <span class="p-4 border rounded-md"
                ><span class="font-bold pr-1">2.</span> Set your current confidence
                in each topic</span
            >
            <span class="p-4 border rounded-md"
                ><span class="font-bold pr-1">3.</span> Let our spaced repetition
                algorihtm do the rest</span
            >
        </div>
        <div class="pt-4">
            <Button href="/auth" class="px-8 py-2 text-xl"
                >Start planning</Button
            >
        </div>
    </div>
</div>
