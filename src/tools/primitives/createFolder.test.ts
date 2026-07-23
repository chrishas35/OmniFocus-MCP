import { describe, expect, it } from 'vitest';
import { generateAppleScript } from './createFolder.js';

describe('createFolder generateAppleScript', () => {
  it('creates an active root folder by default', () => {
    const script = generateAppleScript({ name: 'Work' });
    expect(script).toContain('make new folder with properties {name:"Work"}');
    expect(script).toContain('set hidden of newFolder to false');
    expect(script).not.toContain('parentFolder');
  });

  it('creates a dropped folder under a parent resolved by ID', () => {
    const script = generateAppleScript({
      name: 'Archive',
      parentFolderID: 'parent-id',
      parentFolderName: 'Ignored Parent',
      status: 'dropped',
    });
    expect(script).toContain('first flattened folder whose id is "parent-id"');
    expect(script).not.toContain('Ignored Parent');
    expect(script).toContain('at end of folders of parentFolder');
    expect(script).toContain('set hidden of newFolder to true');
  });

  it('resolves a parent name as a path', () => {
    const script = generateAppleScript({ name: 'Child', parentFolderName: 'Work/Engineering' });
    expect(script).toContain('set pathComponents to {"Work", "Engineering"}');
    expect(script).toContain('Parent folder is ambiguous');
  });

  it('escapes quotes in a folder name', () => {
    const script = generateAppleScript({ name: 'My "Folder"' });
    expect(script).toContain('My \\"Folder\\"');
  });

  it('rejects blank names and slash-containing names', () => {
    expect(() => generateAppleScript({ name: ' ' })).toThrow('must not be blank');
    expect(() => generateAppleScript({ name: 'Work/Child' })).toThrow('cannot contain');
  });
});
