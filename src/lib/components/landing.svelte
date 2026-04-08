<script>
    import { onMount } from "svelte";
    import Button from "./ui/button/button.svelte";
    import { annotate } from "rough-notation";

    let studyLess = $state();
    let effectively = $state();

    onMount(() => {
        document.fonts.ready.then(() => {
            annotate(studyLess, {
                type: "underline",
                color: "#F5C542",
            }).show();

            annotate(effectively, {
                type: "box",
                color: "var(--primary)",
            }).show();
        });
    });
</script>

<header class="sticky top-2 z-50">
    <div
        class="flex items-center justify-between py-2 px-2 backdrop-blur-md bg-background/60 border rounded-md"
    >
        <div class="flex items-center gap-2">
            <img src="/logo.png" alt="Quextro Planner" class="h-7 w-7" />
            <span class="font-bold text-xl">Quextro Planner</span>
        </div>
        <div class="flex items-center gap-2">
            <Button
                variant="ghost"
                href="/templates"
                class="text-sm font-medium">Templates</Button
            >
            <Button href="/auth/login" class="text-sm font-medium"
                >Start planning</Button
            >
        </div>
    </div>
</header>

<div
    class="flex h-screen text-center items-center justify-center flex-col pb-32 gap-1"
>
    <span class="text-3xl lg:text-5xl font-black">
        Stop guessing what to study,
    </span>
    <span class="text-md lg:text-xl text-gray-400">
        with our spaced repetition planner, <span
            class="font-semibold text-white"
            bind:this={studyLess}>study less</span
        >, but more
        <span class="font-semibold text-white" bind:this={effectively}
            >effectively.</span
        >
    </span>
    <div class="pt-4">
        <Button href="/auth/login" class="px-8 py-2 text-xl"
            >Get started for free</Button
        >
    </div>
</div>

<div class="flex h-screen text-center flex-col justify-center gap-4">
    <div class="flex flex-col items-center gap-4">
        <span class="text-2xl lg:text-4xl font-bold">How does it work?</span>
        <video
            class="w-full max-w-5xl rounded-md"
            autoplay
            muted
            playsinline
            preload="auto"
            poster="/video-poster.webp"
            controls
        >
            <source src="/planner.mp4" type="video/mp4" />
        </video>
    </div>
</div>
