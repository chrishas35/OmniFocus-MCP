import { describe, expect, it } from 'vitest';
import { generateAppleScript } from './removeFolder.js';

describe('removeFolder generateAppleScript', () => {
  it('removes an empty folder by ID but blocks non-empty folders without confirmation', () => {
    const script = generateAppleScript({ id: 'folder-id' });
    expect(script).toContain('first flattened folder whose id is "folder-id"');
    expect(script).toContain('set directFolders to folders of foundFolder');
    expect(script).toContain('set directProjects to projects of foundFolder');
    expect(script).toContain('not (false)');
    expect(script).toContain('requiresRecursive');
    expect(script).toContain('delete foundFolder');
  });

  it('permits recursive deletion only when explicitly confirmed', () => {
    const script = generateAppleScript({ id: 'folder-id', recursive: true });
    expect(script).toContain('not (true)');
    expect(script).toContain('recursive: true to delete this hierarchy');
  });

  it('includes bounded direct folder/project summaries and total nested task counts', () => {
    const script = generateAppleScript({ id: 'folder-id' });
    expect(script).toContain('folderEntriesAdded is less than 25');
    expect(script).toContain('projectEntriesAdded is less than 25');
    expect(script).toContain('count of flattened tasks of root task of childProject');
    expect(script).toContain('directTaskCount');
    expect(script).toContain('foldersTruncated');
    expect(script).toContain('projectsTruncated');
    expect(script).toContain('my jsonEscape(name of childFolder as string)');
    expect(script).toContain('my jsonEscape(name of childProject as string)');
  });

  it('removes a folder by unambiguous path', () => {
    const script = generateAppleScript({ name: 'Work/Engineering' });
    expect(script).toContain('set pathComponents to {"Work", "Engineering"}');
    expect(script).toContain('Folder is ambiguous');
  });

  it('returns an error without an identifier', () => {
    expect(generateAppleScript({})).toContain('Folder identifier is required');
  });
});
