import { z } from 'zod';
import { createFolder, CreateFolderParams } from '../primitives/createFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  name: z.string().describe('Name of the folder to create. A slash is reserved as a path separator.'),
  parentFolderName: z.string().optional().describe('Existing parent folder name or slash-separated path. Ignored when parentFolderID is provided.'),
  parentFolderID: z.string().optional().describe('Existing parent folder ID. Takes precedence over parentFolderName.'),
  status: z.enum(['active', 'dropped']).optional().describe('Initial folder status (default: active).'),
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    const result = await createFolder(args as CreateFolderParams);
    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Failed to create folder: ${result.error}` }],
        isError: true,
      };
    }

    const parent = args.parentFolderID ?? args.parentFolderName;
    const location = parent ? ` under "${parent}"` : ' at the root level';
    const status = args.status === 'dropped' ? ' (dropped)' : '';
    return {
      content: [{
        type: 'text' as const,
        text: `Created folder "${args.name}"${location}${status} (id: ${result.folderId})`,
      }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Error creating folder: ${message}` }],
      isError: true,
    };
  }
}
