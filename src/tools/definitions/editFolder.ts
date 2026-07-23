import { z } from 'zod';
import { editFolder, EditFolderParams } from '../primitives/editFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  id: z.string().optional().describe('ID of the folder to edit. Takes precedence over name.'),
  name: z.string().optional().describe('Folder name or slash-separated path to edit when ID is not provided.'),
  newName: z.string().optional().describe('New folder name. A slash is reserved as a path separator.'),
  newParentFolderName: z.string().optional().describe('New parent folder name or path. Pass an empty string to move the folder to the root. Ignored when newParentFolderID is provided.'),
  newParentFolderID: z.string().optional().describe('New parent folder ID. Takes precedence over newParentFolderName.'),
  newStatus: z.enum(['active', 'dropped']).optional().describe('New folder status.'),
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  if (!args.id && !args.name) {
    return {
      content: [{ type: 'text' as const, text: 'Either id or name must be provided to edit a folder.' }],
      isError: true,
    };
  }
  if (
    args.newName === undefined &&
    args.newParentFolderName === undefined &&
    args.newParentFolderID === undefined &&
    args.newStatus === undefined
  ) {
    return {
      content: [{ type: 'text' as const, text: 'Provide at least one folder change.' }],
      isError: true,
    };
  }

  try {
    const result = await editFolder(args as EditFolderParams);
    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Failed to update folder: ${result.error}` }],
        isError: true,
      };
    }

    const changes = result.changedProperties?.join(', ') ?? 'updated';
    const label = result.name ?? result.folderId;
    return {
      content: [{ type: 'text' as const, text: `Updated folder "${label}" (${changes}; id: ${result.folderId}).` }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Error updating folder: ${message}` }],
      isError: true,
    };
  }
}
