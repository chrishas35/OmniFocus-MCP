import {
  executeFolderScript,
  FolderResult,
  folderStatusScript,
  normalizeFolderPath,
  errorHandlerScript,
} from './folderHelpers.js';
import { escapeAppleScriptString } from '../../utils/appleScriptHelpers.js';

export interface EnsureFolderParams {
  path: string;
}

export interface EnsureFolderResult extends FolderResult {
  path?: string;
  createdFolderIds?: string[];
  createdPaths?: string[];
}

/** Generate AppleScript for idempotently creating a folder hierarchy (`mkdir -p`). */
export function generateAppleScript(params: EnsureFolderParams): string {
  const components = normalizeFolderPath(params.path);
  const pathItems = components
    .map(component => `"${escapeAppleScriptString(component, { preserveNewlines: true })}"`)
    .join(', ');

  return `try
  tell application "OmniFocus"
    tell front document
      set pathComponents to {${pathItems}}
      set currentFolder to missing value
      set isAtRoot to true
      set createdFolderIds to {}

      repeat with pathComponent in pathComponents
        set matchingFolders to {}
        if isAtRoot then
          repeat with candidateFolder in folders
            if name of candidateFolder is equal to (pathComponent as string) then
              set end of matchingFolders to candidateFolder
            end if
          end repeat
        else
          repeat with candidateFolder in folders of currentFolder
            if name of candidateFolder is equal to (pathComponent as string) then
              set end of matchingFolders to candidateFolder
            end if
          end repeat
        end if

        if (count of matchingFolders) is greater than 1 then
          return "{\\\"success\\\":false,\\\"error\\\":\\\"Folder path is ambiguous; use IDs to resolve duplicate folders\\\"}"
        else if (count of matchingFolders) is 1 then
          set currentFolder to item 1 of matchingFolders
        else
          if isAtRoot then
            set currentFolder to make new folder with properties {name:(pathComponent as string)}
          else
            set currentFolder to make new folder with properties {name:(pathComponent as string)} at end of folders of currentFolder
          end if
          ${folderStatusScript('active', 'currentFolder')}
          set end of createdFolderIds to (id of currentFolder as string)
        end if
        set isAtRoot to false
      end repeat

      set createdIdsJson to ""
      repeat with i from 1 to count of createdFolderIds
        set createdIdsJson to createdIdsJson & "\\\"" & item i of createdFolderIds & "\\\""
        if i < count of createdFolderIds then set createdIdsJson to createdIdsJson & ","
      end repeat
      set folderId to id of currentFolder as string
      return "{\\\"success\\\":true,\\\"folderId\\\":\\\"" & folderId & "\\\",\\\"createdFolderIds\\\":[" & createdIdsJson & "]}"
    end tell
  end tell
${errorHandlerScript()}`;
}

/** Ensure every component of a slash-separated path exists, without modifying existing folders. */
export async function ensureFolder(params: EnsureFolderParams): Promise<EnsureFolderResult> {
  try {
    const components = normalizeFolderPath(params.path);
    const result = await executeFolderScript(generateAppleScript(params), 'ensure_folder') as EnsureFolderResult;
    const createdFolderIds = result.createdFolderIds ?? [];
    return {
      ...result,
      path: result.success ? components.join('/') : undefined,
      createdFolderIds: result.success ? createdFolderIds : undefined,
      createdPaths: result.success
        ? components.slice(components.length - createdFolderIds.length).map((_, index) =>
          components.slice(0, components.length - createdFolderIds.length + index + 1).join('/')
        )
        : undefined,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unable to ensure folder path' };
  }
}
