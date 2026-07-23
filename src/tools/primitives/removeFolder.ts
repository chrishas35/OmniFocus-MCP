import {
  executeFolderScript,
  FolderResult,
  generateFolderReferenceLookupScript,
  errorHandlerScript,
} from './folderHelpers.js';

export interface RemoveFolderParams {
  id?: string;
  name?: string;
}

export interface RemoveFolderResult extends FolderResult {
  name?: string;
}

/** Generate AppleScript that removes a folder using an ID or unambiguous name/path. */
export function generateAppleScript(params: RemoveFolderParams): string {
  if (!params.id && !params.name) {
    return `return "{\\\"success\\\":false,\\\"error\\\":\\\"Folder identifier is required\\\"}"`;
  }

  const lookup = generateFolderReferenceLookupScript(
    { id: params.id, name: params.name },
    'foundFolder',
    'Folder not found',
    'Folder is ambiguous; use its ID or a more specific path'
  );

  return `try
  tell application "OmniFocus"
    tell front document
      ${lookup}
      set folderId to id of foundFolder as string
      delete foundFolder
      return "{\\\"success\\\":true,\\\"folderId\\\":\\\"" & folderId & "\\\"}"
    end tell
  end tell
${errorHandlerScript()}`;
}

/** Remove a folder using OmniFocus's native deletion behavior. */
export async function removeFolder(params: RemoveFolderParams): Promise<RemoveFolderResult> {
  try {
    const result = await executeFolderScript(generateAppleScript(params), 'remove_folder');
    return { ...result, name: result.success ? params.name : undefined };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unable to remove folder' };
  }
}
