import { z } from 'zod';
import { ensureFolder, EnsureFolderParams } from '../primitives/ensureFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  path: z.string().describe('Slash-separated folder path to ensure exists, like mkdir -p. Leading, trailing, and repeated slashes are ignored.'),
});

export async function handler(args: z.infer<typeof schema>, extra: RequestHandlerExtra) {
  try {
    const result = await ensureFolder(args as EnsureFolderParams);
    if (!result.success) {
      return {
        content: [{ type: 'text' as const, text: `Failed to ensure folder path: ${result.error}` }],
        isError: true,
      };
    }

    const created = result.createdPaths ?? [];
    const createdText = created.length === 0
      ? 'all components already existed'
      : `created: ${created.join(', ')}`;
    return {
      content: [{
        type: 'text' as const,
        text: `Ensured folder path "${result.path}" (id: ${result.folderId}; ${createdText}).`,
      }],
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text' as const, text: `Error ensuring folder path: ${message}` }],
      isError: true,
    };
  }
}
