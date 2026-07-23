import { z } from 'zod';
import { removeFolder, RemoveFolderParams } from '../primitives/removeFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  id: z.string().optional().describe('ID of the folder to remove. Takes precedence over name.'),
  name: z.string().optional().describe('Folder name or slash-separated path to remove when ID is not provided.'),
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  if (!args.id && !args.name) {
    return {
      content: [{ type: 'text' as const, text: 'Either id or name must be provided to remove a folder.' }],
      isError: true,
    };
  }

  try {
    const result = await removeFolder(args as RemoveFolderParams);
    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Failed to remove folder: ${result.error}` }],
        isError: true,
      };
    }

    const label = result.name ?? result.folderId;
    return {
      content: [{
        type: 'text' as const,
        text: `Removed folder "${label}" (id: ${result.folderId}). OmniFocus also removes its contained hierarchy.`,
      }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Error removing folder: ${message}` }],
      isError: true,
    };
  }
}
