import {
  executeFolderScript,
  FolderDeletionSummary,
  FolderResult,
  generateFolderReferenceLookupScript,
  jsonEscapeHelpersScript,
  errorHandlerScript,
} from './folderHelpers.js';

const SUMMARY_LIST_LIMIT = 25;

export interface RemoveFolderParams {
  id?: string;
  name?: string;
  /** Required when the folder has direct child folders or projects. */
  recursive?: boolean;
}

export interface RemoveFolderResult extends FolderResult {
  name?: string;
  deletionSummary?: FolderDeletionSummary;
}

/**
 * Generate AppleScript that removes an empty folder, or a non-empty folder
 * only after the caller explicitly confirms recursive deletion. A blocked
 * removal returns a bounded summary of the direct contents that would be lost.
 */
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
  const recursive = params.recursive === true ? 'true' : 'false';

  return `${jsonEscapeHelpersScript()}

try
  tell application "OmniFocus"
    tell front document
      ${lookup}
      set folderId to id of foundFolder as string
      set directFolders to folders of foundFolder
      set directProjects to projects of foundFolder
      set directFolderCount to count of directFolders
      set directProjectCount to count of directProjects

      if (directFolderCount is greater than 0 or directProjectCount is greater than 0) and not (${recursive}) then
        set folderEntriesJson to ""
        set folderEntriesAdded to 0
        repeat with childFolder in directFolders
          if folderEntriesAdded is less than ${SUMMARY_LIST_LIMIT} then
            if folderEntriesAdded is greater than 0 then set folderEntriesJson to folderEntriesJson & ","
            set folderStatusText to "active"
            if hidden of childFolder then set folderStatusText to "dropped"
            set folderEntriesJson to folderEntriesJson & "{\\\"id\\\":\\\"" & my jsonEscape(id of childFolder as string) & "\\\",\\\"name\\\":\\\"" & my jsonEscape(name of childFolder as string) & "\\\",\\\"status\\\":\\\"" & folderStatusText & "\\\"}"
            set folderEntriesAdded to folderEntriesAdded + 1
          end if
        end repeat

        set projectEntriesJson to ""
        set projectEntriesAdded to 0
        set directTaskCount to 0
        repeat with childProject in directProjects
          set projectTaskCount to count of flattened tasks of root task of childProject
          set directTaskCount to directTaskCount + projectTaskCount
          if projectEntriesAdded is less than ${SUMMARY_LIST_LIMIT} then
            if projectEntriesAdded is greater than 0 then set projectEntriesJson to projectEntriesJson & ","
            set projectStatusText to "unknown"
            set currentProjectStatus to status of childProject
            if currentProjectStatus is active status then
              set projectStatusText to "active"
            else if currentProjectStatus is on hold status then
              set projectStatusText to "onHold"
            else if currentProjectStatus is done status then
              set projectStatusText to "completed"
            else if currentProjectStatus is dropped status then
              set projectStatusText to "dropped"
            end if
            set projectEntriesJson to projectEntriesJson & "{\\\"id\\\":\\\"" & my jsonEscape(id of childProject as string) & "\\\",\\\"name\\\":\\\"" & my jsonEscape(name of childProject as string) & "\\\",\\\"status\\\":\\\"" & projectStatusText & "\\\",\\\"taskCount\\\":" & projectTaskCount & "}"
            set projectEntriesAdded to projectEntriesAdded + 1
          end if
        end repeat

        set foldersTruncatedText to "false"
        if directFolderCount is greater than ${SUMMARY_LIST_LIMIT} then set foldersTruncatedText to "true"
        set projectsTruncatedText to "false"
        if directProjectCount is greater than ${SUMMARY_LIST_LIMIT} then set projectsTruncatedText to "true"
        return "{\\\"success\\\":false,\\\"error\\\":\\\"Folder is not empty. Review its direct contents and retry with recursive: true to delete this hierarchy. Contained projects and all of their tasks will be deleted.\\\",\\\"requiresRecursive\\\":true,\\\"deletionSummary\\\":{\\\"directFolderCount\\\":" & directFolderCount & " ,\\\"directProjectCount\\\":" & directProjectCount & " ,\\\"directTaskCount\\\":" & directTaskCount & " ,\\\"folders\\\":[" & folderEntriesJson & "],\\\"projects\\\":[" & projectEntriesJson & "],\\\"foldersTruncated\\\":" & foldersTruncatedText & ",\\\"projectsTruncated\\\":" & projectsTruncatedText & "}}"
      end if

      delete foundFolder
      return "{\\\"success\\\":true,\\\"folderId\\\":\\\"" & folderId & "\\\"}"
    end tell
  end tell
${errorHandlerScript()}`;
}

/** Remove a folder, requiring explicit confirmation before recursive deletion. */
export async function removeFolder(params: RemoveFolderParams): Promise<RemoveFolderResult> {
  try {
    const result = await executeFolderScript(generateAppleScript(params), 'remove_folder');
    return {
      ...result,
      name: result.success ? params.name : undefined,
      deletionSummary: result.deletionSummary,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unable to remove folder' };
  }
}
