import { describe, expect, it } from 'vitest';
import { generateAppleScript } from './removeFolder.js';

describe('removeFolder generateAppleScript', () => {
  it('removes a folder by ID', () => {
    const script = generateAppleScript({ id: 'folder-id' });
    expect(script).toContain('first flattened folder whose id is "folder-id"');
    expect(script).toContain('delete foundFolder');
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
