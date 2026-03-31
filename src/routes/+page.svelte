<script lang="ts">
    import CreateSubjectCard from "$lib/components/create-subject-card.svelte";

    import LoginCard from "$lib/components/login-card.svelte";
    import SubjectList from "$lib/components/subject-list.svelte";
    import Button from "$lib/components/ui/button/button.svelte";
    import { clearAuth, authState } from "$lib/stores/auth-store.svelte";
    import { Check, LogOut, PlusIcon } from "lucide-svelte";

    const isAuthenticated = $derived(authState.isAuthenticated);
    let isAddingSubject = $state(false);
</script>

{#if isAuthenticated}
    <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
            <span class="text-xl">What should i study now?</span>
            <div class="flex gap-2">
                {#if !isAddingSubject}
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onclick={() => (isAddingSubject = !isAddingSubject)}
                        ><PlusIcon /></Button
                    >
                {/if}
                <Button variant="ghost" size="icon-sm" onclick={clearAuth}
                    ><LogOut /></Button
                >
            </div>
        </div>
        {#if isAddingSubject}
            <CreateSubjectCard onDismiss={() => (isAddingSubject = false)} />
        {/if}
        <SubjectList />
    </div>
{:else}
    <span>You need to login</span>
    <LoginCard />
{/if}
