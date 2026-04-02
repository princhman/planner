<script lang="ts">
    import { goto } from "$app/navigation";
    import { api } from "$convex/_generated/api";
    import type { Id } from "$convex/_generated/dataModel";
    import { useConvexClient } from "convex-svelte";
    import { Button } from "../ui/button";
    import { NotepadTextDashed } from "lucide-svelte";
    import * as Dialog from "../ui/dialog/";
    import Input from "../ui/input/input.svelte";
    import { Label } from "../ui/label";
    import { toast } from "svelte-sonner";

    interface Props {
        courseName: string;
        courseId: Id<"courses">;
    }
    const { courseName, courseId }: Props = $props();

    const client = useConvexClient();
    let templateName = $state(courseName);
    let showDialog = $state(false);

    async function createTemplate() {
        const id = await client.mutation(api.templates.createFromCourse, {
            courseId,
            name: templateName,
        });
        toast.success(`Template "${templateName}" is created!`);
        goto(`/templates/${id}`);
    }
</script>

<Dialog.Root bind:open={showDialog}>
    <Dialog.Trigger>
        <Button variant="outline" size="icon-sm">
            <NotepadTextDashed />
        </Button>
    </Dialog.Trigger>
    <Dialog.Content>
        <Dialog.Title>Create Template</Dialog.Title>
        <Label for="template-name" class="px-1">Name</Label>
        <Input
            id="template-name"
            bind:value={templateName}
            type="text"
            class="font-normal"
        />
        <Dialog.Footer>
            <Button
                variant="ghost"
                onclick={() => {
                    showDialog = false;
                    templateName = courseName;
                }}
            >
                Cancel
            </Button>
            <Button onclick={createTemplate}>Create</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
