import { describe, expect, it } from 'vitest';
import {
  generateFolderReferenceLookupScript,
  normalizeFolderPath,
  validateFolderName,
} from './folderHelpers.js';

describe('folder helpers', () => {
  it('normalizes leading, trailing, and repeated path separators', () => {
    expect(normalizeFolderPath('/Work//Engineering/')).toEqual(['Work', 'Engineering']);
  });

  it('rejects paths with no components or blank components', () => {
    expect(() => normalizeFolderPath('///')).toThrow('at least one');
    expect(() => normalizeFolderPath('Work/   /Engineering')).toThrow('non-blank');
  });

  it('rejects blank names and literal path separators in folder names', () => {
    expect(() => validateFolderName('   ')).toThrow('must not be blank');
    expect(() => validateFolderName('Work/Engineering')).toThrow('cannot contain');
  });

  it('uses IDs in preference to names', () => {
    const script = generateFolderReferenceLookupScript(
      { id: 'folder-id', name: 'Ignored/Name' },
      'foundFolder',
      'Not found',
      'Ambiguous'
    );
    expect(script).toContain('first flattened folder whose id is "folder-id"');
    expect(script).not.toContain('Ignored');
  });

  it('resolves names by their full ancestor chain and rejects ambiguity', () => {
    const script = generateFolderReferenceLookupScript(
      { name: 'Work/Engineering' },
      'foundFolder',
      'Not found',
      'Ambiguous'
    );
    expect(script).toContain('set pathComponents to {"Work", "Engineering"}');
    expect(script).toContain('set currentFolder to container of currentFolder');
    expect(script).toContain('count of matchingFolders');
    expect(script).toContain('Ambiguous');
  });
});
