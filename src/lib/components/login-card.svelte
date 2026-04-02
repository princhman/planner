<script lang="ts">
    import { useConvexClient, useQuery } from "convex-svelte";
    import { api } from "$convex/_generated/api";
    import { ConvexError } from "convex/values";
    import { setAuthUser } from "$lib/stores/auth-store.svelte";
    import type { Id } from "$convex/_generated/dataModel";
    import { Button } from "./ui/button";
    import { Input } from "./ui/input";
    import { toast } from "svelte-sonner";
    import Label from "./ui/label/label.svelte";

    let inProgress = $state(false);
    let isLogin = $state(true);
    let email = $state("");
    let password = $state("");
    let name = $state("");

    const client = useConvexClient();

    async function proceed() {
        try {
            let userId: Id<"users">;
            if (isLogin) {
                userId = await client.mutation(api.auth.signIn, {
                    email,
                    password,
                });
                toast.success("You signed in successfully!");
            } else {
                userId = await client.mutation(api.auth.signUp, {
                    email,
                    password,
                    name,
                });
                toast.success("You signed up successfully!");
            }
            setAuthUser(userId, email);
        } catch (error) {
            const errorMessage =
                error instanceof ConvexError
                    ? (error.data as { message: string }).message
                    : "Unexpected error happened";
            toast.error(errorMessage);
            console.error(error);
        }
    }
</script>

<div class="flex justify-center items-center h-full">
    <div class="flex flex-col gap-2 items-center w-96">
        <span class="text-2xl">{isLogin ? "Log in" : "Sign up"}</span>
        {#if !isLogin}
            <div class="flex flex-col gap-2 w-full">
                <Label for="name">Name</Label>
                <Input
                    id="name"
                    bind:value={name}
                    class="p-2"
                    placeholder="Type your name"
                />
            </div>
        {/if}
        <div class="flex flex-col gap-2 w-full">
            <Label for="email">Email</Label>
            <Input
                id="email"
                bind:value={email}
                class="p-2"
                placeholder="Type your email"
            />
        </div>
        <div class="flex flex-col gap-2 w-full">
            <Label for="password">Password</Label>
            <Input
                id="password"
                bind:value={password}
                class="p-2"
                placeholder="Type your password"
                type="password"
            />
        </div>
        <div class="flex flex-col gap-2 w-full">
            <Button class="text-2xl border w-full" onclick={proceed}
                >{isLogin
                    ? inProgress
                        ? "Logging in"
                        : "Log in"
                    : inProgress
                      ? "Signing up"
                      : "Sign up"}</Button
            >
            <Button
                variant="ghost"
                onclick={() => {
                    isLogin = !isLogin;
                }}>{isLogin ? "Sign up" : "Log in"}</Button
            >
        </div>
    </div>
</div>
