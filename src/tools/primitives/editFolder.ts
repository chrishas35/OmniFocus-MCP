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

export interface EditFolderParams {
  id?: string;
  name?: string;
  newName?: string;
  newParentFolderName?: string;
  newParentFolderID?: string;
  newStatus?: FolderStatus;
}

export interface EditFolderResult extends FolderResult {
  name?: string;
  changedProperties?: string[];
}

function changedProperties(params: EditFolderParams): string[] {
  const changed: string[] = [];
  if (params.newName !== undefined) changed.push('name');
  if (params.newParentFolderName !== undefined || params.newParentFolderID !== undefined) changed.push('parent folder');
  if (params.newStatus !== undefined) changed.push('status');
  return changed;
}

/** Generate AppleScript for renaming, moving, or changing folder status. */
export function generateAppleScript(params: EditFolderParams): string {
  if (!params.id && !params.name) {
    return `return "{\\\"success\\\":false,\\\"error\\\":\\\"Folder identifier is required\\\"}"`;
  }
  if (params.newName !== undefined) validateFolderName(params.newName);
  if (changedProperties(params).length === 0) {
    return `return "{\\\"success\\\":false,\\\"error\\\":\\\"At least one folder change is required\\\"}"`;
  }

  const sourceLookup = generateFolderReferenceLookupScript(
    { id: params.id, name: params.name },
    'foundFolder',
    'Folder not found',
    'Folder is ambiguous; use its ID or a more specific path'
  );
  const shouldMove = params.newParentFolderName !== undefined || params.newParentFolderID !== undefined;
  const moveToRoot = shouldMove && !params.newParentFolderID && params.newParentFolderName === '';
  const destinationLookup = shouldMove && !moveToRoot
    ? generateFolderReferenceLookupScript(
      { id: params.newParentFolderID, name: params.newParentFolderName },
      'destFolder',
      'Destination folder not found',
      'Destination folder is ambiguous; use its ID or a more specific path'
    )
    : '';

  let updates = '';
  if (params.newName !== undefined) {
    updates += `\n      set name of foundFolder to "${escapeAppleScriptString(params.newName, { preserveNewlines: true })}"`;
  }
  if (shouldMove) {
    updates += `
      ${destinationLookup}
      if not (${moveToRoot ? 'true' : 'false'}) then
        -- A folder cannot be moved into itself or anywhere in its own subtree.
        set folderToCheck to destFolder
        set wouldCreateCycle to false
        repeat while folderToCheck is not missing value
          if (id of folderToCheck as string) is equal to folderId then
            set wouldCreateCycle to true
            exit repeat
          end if
          try
            set parentContainer to container of folderToCheck
            if class of parentContainer is folder then
              set folderToCheck to parentContainer
            else
              set folderToCheck to missing value
            end if
          on error
            set folderToCheck to missing value
          end try
        end repeat
        if wouldCreateCycle then
          return "{\\\"success\\\":false,\\\"error\\\":\\\"Cannot move a folder into itself or one of its descendants\\\"}"
        end if
        move foundFolder to end of folders of destFolder
      else
        -- The current target is already the document; referring to front
        -- document again resolves as document 1 of document 1 in OmniFocus.
        move foundFolder to end of folders
      end if`;
  }
  if (params.newStatus !== undefined) {
    updates += `\n      ${folderStatusScript(params.newStatus, 'foundFolder')}`;
  }

  return `${jsonEscapeHelpersScript()}

try
  tell application "OmniFocus"
    tell front document
      ${sourceLookup}
      set folderId to id of foundFolder as string
      ${updates}
      return "{\\\"success\\\":true,\\\"folderId\\\":\\\"" & folderId & "\\\"}"
    end tell
  end tell
${errorHandlerScript()}`;
}

/** Edit a folder. ID takes precedence over name; parent ID takes precedence over parent name. */
export async function editFolder(params: EditFolderParams): Promise<EditFolderResult> {
  try {
    const result = await executeFolderScript(generateAppleScript(params), 'edit_folder');
    return {
      ...result,
      name: result.success ? (params.newName ?? params.name) : undefined,
      changedProperties: result.success ? changedProperties(params) : undefined,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unable to edit folder' };
  }
}
