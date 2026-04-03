<script lang="ts">
    import CreatecourseCard from "$lib/components/create-course-card.svelte";

    import LoginCard from "$lib/components/login-card.svelte";
    import CourseList from "$lib/components/course-list.svelte";
    import RecommendationPlan from "$lib/components/recomendation-plan.svelte";

    import Button from "$lib/components/ui/button/button.svelte";
    import { clearAuth, authState } from "$lib/stores/auth-store.svelte";
    import { Check, LogOut, NotepadTextDashed, PlusIcon } from "lucide-svelte";
    import Landing from "$lib/components/landing.svelte";

    const isAuthenticated = $derived(authState.isAuthenticated);
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
                <Button variant="outline" size="icon-sm" onclick={clearAuth}
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
