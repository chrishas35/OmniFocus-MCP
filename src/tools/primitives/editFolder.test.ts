import { describe, expect, it } from 'vitest';
import { generateAppleScript } from './editFolder.js';

describe('editFolder generateAppleScript', () => {
  it('returns an error when no identifier or changes are provided', () => {
    expect(generateAppleScript({ newName: 'X' })).toContain('Folder identifier is required');
    expect(generateAppleScript({ name: 'X' })).toContain('At least one folder change is required');
  });

  it('renames a folder resolved by ID', () => {
    const script = generateAppleScript({ id: 'folder-id', newName: 'Renamed' });
    expect(script).toContain('first flattened folder whose id is "folder-id"');
    expect(script).toContain('set name of foundFolder to "Renamed"');
  });

  it('moves a folder to a named parent and prevents cycles', () => {
    const script = generateAppleScript({ name: 'Work/Engineering', newParentFolderName: 'Personal' });
    expect(script).toContain('set pathComponents to {"Work", "Engineering"}');
    expect(script).toContain('set destFolder to item 1 of matchingFolders');
    expect(script).toContain('Cannot move a folder into itself or one of its descendants');
    expect(script).toContain('move foundFolder to end of folders of destFolder');
  });

  it('moves a folder to the root when the new parent name is empty', () => {
    const script = generateAppleScript({ name: 'Child', newParentFolderName: '' });
    expect(script).toContain('move foundFolder to end of folders');
    expect(script).not.toContain('Destination folder not found');
  });

  it('uses parent IDs in preference to parent names', () => {
    const script = generateAppleScript({
      name: 'Child',
      newParentFolderID: 'dest-id',
      newParentFolderName: 'Ignored',
    });
    expect(script).toContain('first flattened folder whose id is "dest-id"');
    expect(script).not.toContain('Ignored');
  });

  it('maps status changes to the folder hidden property', () => {
    expect(generateAppleScript({ name: 'Child', newStatus: 'active' })).toContain('set hidden of foundFolder to false');
    expect(generateAppleScript({ name: 'Child', newStatus: 'dropped' })).toContain('set hidden of foundFolder to true');
  });
});
