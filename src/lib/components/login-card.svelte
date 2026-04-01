<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { ConvexError } from "convex/values";
    import { setAuthUser } from "$lib/stores/auth-store.svelte";
    import type { Id } from "$convex/_generated/dataModel";

    let inProgress = $state(false);
    let isLogin = $state(true);
    let errorMessage = $state();
    let email = $state("");
    let password = $state("");

    const client = useConvexClient();

    async function proceed() {
        try {
            let userId: Id<"users">;
            if (isLogin) {
                userId = await client.mutation(api.auth.signIn, {
                    email,
                    password,
                });
            } else {
                userId = await client.mutation(api.auth.signUp, {
                    email,
                    password,
                });
            }
            setAuthUser(userId, email);
            console.log("successfull");
        } catch (error) {
            errorMessage =
                error instanceof ConvexError
                    ? (error.data as { message: string }).message
                    : "Unexpected error happened";
        }
    }
</script>

<div class="flex flex-col">
    <span class="text-2xl">{isLogin ? "Log in" : "Sign up"}</span>
    <input bind:value={email} class="p-2" placeholder="Type your email" />
    <input
        bind:value={password}
        class="p-3"
        placeholder="Type your password"
        type="password"
    />
    <button class="text-2xl border m-2" onclick={proceed}
        >{isLogin
            ? inProgress
                ? "Logging in"
                : "Log in"
            : inProgress
              ? "Signing up"
              : "Sign up"}</button
    >
    <button
        onclick={() => {
            isLogin = !isLogin;
        }}>{isLogin ? "Sign up" : "Log in"}</button
    >
    <p>{errorMessage}</p>
</div>
