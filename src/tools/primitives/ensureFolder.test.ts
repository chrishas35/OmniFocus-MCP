import { describe, expect, it } from 'vitest';
import { generateAppleScript } from './ensureFolder.js';

describe('ensureFolder generateAppleScript', () => {
  it('walks direct children and creates missing components', () => {
    const script = generateAppleScript({ path: 'Work/Engineering/Platform' });
    expect(script).toContain('set pathComponents to {"Work", "Engineering", "Platform"}');
    expect(script).toContain('repeat with candidateFolder in folders of currentFolder');
    expect(script).toContain('make new folder with properties {name:(pathComponent as string)}');
    expect(script).toContain('at end of folders of currentFolder');
    expect(script).toContain('set hidden of currentFolder to false');
  });

  it('normalizes path separators before generating the path', () => {
    const script = generateAppleScript({ path: '/Work//Engineering/' });
    expect(script).toContain('set pathComponents to {"Work", "Engineering"}');
  });

  it('does not overwrite the status of existing folders', () => {
    const script = generateAppleScript({ path: 'Work/Engineering' });
    const existingBranch = script.slice(script.indexOf('else if (count of matchingFolders) is 1'));
    const nextCreation = existingBranch.indexOf('else\n          if isAtRoot');
    expect(existingBranch.slice(0, nextCreation)).not.toContain('set hidden');
  });

  it('rejects ambiguous path components and empty paths', () => {
    expect(generateAppleScript({ path: 'Work/Engineering' })).toContain('Folder path is ambiguous');
    expect(() => generateAppleScript({ path: '///' })).toThrow('at least one');
  });
});
