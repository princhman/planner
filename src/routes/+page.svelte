<!-- Generated with AI -->
<script lang="ts">
    import CreatecourseCard from "$lib/components/create-course-card.svelte";
    import CourseList from "$lib/components/course-list.svelte";
    import RecommendationPlan from "$lib/components/recomendation-plan.svelte";

    import Button from "$lib/components/ui/button/button.svelte";
    import { LogOut, NotepadTextDashed, PlusIcon } from "lucide-svelte";
    import Landing from "$lib/components/landing.svelte";
    import type { PageData } from "./$types";

    // `data` comes from the parent +layout.server.ts (flows down to all pages)
    // It contains { user, token } — the auth info from the cookie.
    const { data }: { data: PageData } = $props();

    // Instead of reading localStorage, we check if the server found a valid user
    const isAuthenticated = $derived(!!data.user);
    let isAddingCourse = $state(false);
</script>

{#if isAuthenticated}
    <div class="flex flex-col gap-2 py-4">
        <div class="flex justify-between items-center">
            <span class="text-xl">Planner</span>
            <div class="flex gap-1">
                <Button variant="outline" size="sm" href="/templates">
                    <NotepadTextDashed />
                    Templates</Button
                >
                <Button
                    variant={isAddingCourse ? "default" : "outline"}
                    size="icon-sm"
                    onclick={() => (isAddingCourse = !isAddingCourse)}
                    ><PlusIcon /></Button
                >
                <!-- Logout now hits the server route that clears cookies -->
                <Button variant="outline" size="icon-sm" href="/auth/logout"
                    ><LogOut /></Button
                >
            </div>
        </div>
        {#if isAddingCourse}
            <CreatecourseCard />
        {/if}
        <CourseList />
        <RecommendationPlan />
    </div>
{:else}
    <Landing />
{/if}
