import { z } from 'zod';
import { removeFolder, RemoveFolderParams, RemoveFolderResult } from '../primitives/removeFolder.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

export const schema = z.object({
  id: z.string().optional().describe('ID of the folder to remove. Takes precedence over name.'),
  name: z.string().optional().describe('Folder name or slash-separated path to remove when ID is not provided.'),
  recursive: z.boolean().optional().describe('Required as true when removing a non-empty folder. The folder, descendant folders, contained projects, and all of those projects\' tasks will be deleted.'),
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
      const details = formatDeletionSummary(result.deletionSummary);
      return {
        content: [{ type: 'text' as const, text: `Failed to remove folder: ${result.error}${details}` }],
        isError: true,
      };
    }

    const label = result.name ?? result.folderId;
    return {
      content: [{
        type: 'text' as const,
        text: `Removed folder "${label}" (id: ${result.folderId}). OmniFocus removed its contained folders, projects, and tasks.`,
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

function formatDeletionSummary(summary: RemoveFolderResult['deletionSummary']): string {
  if (!summary) return '';

  const lines = [
    '',
    `Direct contents: ${summary.directFolderCount} folder(s), ${summary.directProjectCount} project(s), and ${summary.directTaskCount} task(s) in those direct projects.`,
  ];
  if (summary.folders.length > 0) {
    lines.push('Direct folders:');
    lines.push(...summary.folders.map(folder => `- ${folder.name} [${folder.status}] (id: ${folder.id})`));
    if (summary.foldersTruncated) lines.push('- … additional direct folders omitted');
  }
  if (summary.projects.length > 0) {
    lines.push('Direct projects (all tasks in each project will be deleted):');
    lines.push(...summary.projects.map(project => `- ${project.name} [${project.status}] (${project.taskCount} task(s); id: ${project.id})`));
    if (summary.projectsTruncated) lines.push('- … additional direct projects omitted');
  }
  return `\n${lines.join('\n')}`;
}
