import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { escapeAppleScriptString } from '../../utils/appleScriptHelpers.js';

const execAsync = promisify(exec);

export type FolderStatus = 'active' | 'dropped';

export interface FolderResult {
  success: boolean;
  folderId?: string;
  createdFolderIds?: string[];
  error?: string;
  errorCode?: number;
}

/**
 * Normalize a slash-separated folder path. Empty segments from leading,
 * trailing, or repeated separators are ignored; every remaining component must
 * contain non-whitespace text.
 */
export function normalizeFolderPath(path: string): string[] {
  const components = path.split('/').filter(component => component.length > 0);
  if (components.length === 0 || components.some(component => component.trim().length === 0)) {
    throw new Error('Folder path must contain at least one non-blank component.');
  }
  return components;
}

export function validateFolderName(name: string): void {
  if (name.trim().length === 0) {
    throw new Error('Folder name must not be blank.');
  }
  if (name.includes('/')) {
    throw new Error('Folder names cannot contain "/"; it is reserved as the path separator.');
  }
}

/**
 * Emit AppleScript that resolves a folder by its AppleScript ID, or by a
 * slash-separated hierarchy. Name/path lookups fail rather than picking an
 * arbitrary folder when multiple folders match.
 *
 * The generated code must be placed inside `tell front document` and may
 * return from the surrounding script on lookup failure.
 */
export function generateFolderReferenceLookupScript(
  options: { id?: string; name?: string },
  variableName: string,
  notFoundError: string,
  ambiguousError: string
): string {
  if (options.id) {
    const id = escapeAppleScriptString(options.id);
    return `set ${variableName} to missing value
        try
          set ${variableName} to first flattened folder whose id is "${id}"
        end try
        if ${variableName} is missing value then
          return "{\\\"success\\\":false,\\\"error\\\":\\\"${notFoundError}\\\"}"
        end if`;
  }

  if (!options.name) {
    return `return "{\\\"success\\\":false,\\\"error\\\":\\\"Folder identifier is required\\\"}"`;
  }

  const components = normalizeFolderPath(options.name);
  const escaped = components.map(component => escapeAppleScriptString(component, { preserveNewlines: true }));
  const leaf = escaped[escaped.length - 1];
  const pathItems = escaped.map(component => `"${component}"`).join(', ');
  const ancestorCheck = components.length > 1
    ? `
            set currentFolder to candidateFolder
            repeat with i from ((count of pathComponents) - 1) to 1 by -1
              try
                set currentFolder to container of currentFolder
                if class of currentFolder is not folder or name of currentFolder is not equal to (item i of pathComponents) then
                  set ancestorMatches to false
                  exit repeat
                end if
              on error
                set ancestorMatches to false
                exit repeat
              end try
            end repeat`
    : '';

  return `set ${variableName} to missing value
        set matchingFolders to {}
        set pathComponents to {${pathItems}}
        repeat with candidateFolder in flattened folders
          if name of candidateFolder is equal to "${leaf}" then
            set ancestorMatches to true${ancestorCheck}
            if ancestorMatches then set end of matchingFolders to candidateFolder
          end if
        end repeat
        if (count of matchingFolders) is 0 then
          return "{\\\"success\\\":false,\\\"error\\\":\\\"${notFoundError}\\\"}"
        else if (count of matchingFolders) is greater than 1 then
          return "{\\\"success\\\":false,\\\"error\\\":\\\"${ambiguousError}\\\"}"
        else
          set ${variableName} to item 1 of matchingFolders
        end if`;
}

/** Execute an AppleScript primitive and parse its deliberately small JSON response. */
export async function executeFolderScript(script: string, operation: string): Promise<FolderResult> {
  let tempFile: string | undefined;

  try {
    tempFile = join(tmpdir(), `${operation}_${crypto.randomUUID()}.applescript`);
    writeFileSync(tempFile, script, { encoding: 'utf8' });
    const { stdout, stderr } = await execAsync(`osascript "${tempFile}"`);
    if (stderr) console.error('AppleScript stderr:', stderr);

    const result = JSON.parse(stdout) as FolderResult;
    return {
      success: result.success,
      folderId: result.folderId,
      createdFolderIds: result.createdFolderIds,
      error: result.error,
      errorCode: result.errorCode,
    };
  } catch (error: any) {
    console.error(`Error in ${operation}:`, error);
    return {
      success: false,
      error: error?.message || `Unknown error in ${operation}`,
    };
  } finally {
    if (tempFile) {
      try { unlinkSync(tempFile); } catch { /* ignore cleanup failures */ }
    }
  }
}

export function folderStatusScript(status: FolderStatus, variableName: string): string {
  // OmniFocus exposes folder status as a writable `hidden` property in
  // AppleScript. A TEST: folder probe confirms hidden=true maps to
  // Folder.Status.Dropped in OmniJS.
  return `set hidden of ${variableName} to ${status === 'dropped'}`;
}

/**
 * AppleScript helpers for producing JSON without corrupting quotes,
 * backslashes, or line breaks in OmniFocus names and error messages.
 */
export function jsonEscapeHelpersScript(): string {
  return `on replaceText(theText, searchString, replacementString)
  set AppleScript's text item delimiters to searchString
  set textItems to every text item of theText
  set AppleScript's text item delimiters to replacementString
  set resultText to textItems as text
  set AppleScript's text item delimiters to ""
  return resultText
end replaceText

on jsonEscape(theText)
  set escapedText to theText as text
  set escapedText to my replaceText(escapedText, "\\\\", "\\\\\\\\")
  set escapedText to my replaceText(escapedText, "\\\"", "\\\\\\\"")
  set escapedText to my replaceText(escapedText, return, "\\\\r")
  set escapedText to my replaceText(escapedText, linefeed, "\\\\n")
  return escapedText
end jsonEscape`;
}

export function errorHandlerScript(): string {
  return `on error errorMessage number errorNumber
    return "{\\\"success\\\":false,\\\"error\\\":\\\"" & my jsonEscape(errorMessage) & "\\\",\\\"errorCode\\\":" & errorNumber & "}"
  end try`;
}
