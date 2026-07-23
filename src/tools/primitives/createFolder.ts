import {
  executeFolderScript,
  FolderResult,
  FolderStatus,
  folderStatusScript,
  generateFolderReferenceLookupScript,
  validateFolderName,
  jsonEscapeHelpersScript,
  errorHandlerScript,
} from './folderHelpers.js';
import { escapeAppleScriptString } from '../../utils/appleScriptHelpers.js';

export interface CreateFolderParams {
  name: string;
  parentFolderName?: string;
  parentFolderID?: string;
  status?: FolderStatus;
}

export interface CreateFolderResult extends FolderResult {
  name?: string;
}

/** Generate AppleScript for creating a folder at the root or under a parent. */
export function generateAppleScript(params: CreateFolderParams): string {
  validateFolderName(params.name);
  const name = escapeAppleScriptString(params.name, { preserveNewlines: true });
  const status = params.status ?? 'active';

  const parentLookup = params.parentFolderID || params.parentFolderName
    ? generateFolderReferenceLookupScript(
      { id: params.parentFolderID, name: params.parentFolderName },
      'parentFolder',
      'Parent folder not found',
      'Parent folder is ambiguous; use its ID or a more specific path'
    )
    : '';
  const creation = parentLookup
    ? `set newFolder to make new folder with properties {name:"${name}"} at end of folders of parentFolder`
    : `set newFolder to make new folder with properties {name:"${name}"}`;

  return `${jsonEscapeHelpersScript()}

try
  tell application "OmniFocus"
    tell front document
      ${parentLookup}
      ${creation}
      ${folderStatusScript(status, 'newFolder')}
      set folderId to id of newFolder as string
      return "{\\\"success\\\":true,\\\"folderId\\\":\\\"" & folderId & "\\\"}"
    end tell
  end tell
${errorHandlerScript()}`;
}

/** Create a folder in OmniFocus. Parent ID takes precedence over parent name. */
export async function createFolder(params: CreateFolderParams): Promise<CreateFolderResult> {
  try {
    const result = await executeFolderScript(generateAppleScript(params), 'create_folder');
    return { ...result, name: result.success ? params.name : undefined };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unable to create folder' };
  }
}
