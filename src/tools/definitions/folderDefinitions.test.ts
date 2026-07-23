import { describe, expect, it } from 'vitest';
import * as createFolder from './createFolder.js';
import * as editFolder from './editFolder.js';
import * as removeFolder from './removeFolder.js';
import * as ensureFolder from './ensureFolder.js';

describe('folder tool definitions', () => {
  it('accepts the folder create and edit contracts', () => {
    expect(createFolder.schema.parse({
      name: 'Archive',
      parentFolderID: 'parent-id',
      status: 'dropped',
    })).toMatchObject({ name: 'Archive', parentFolderID: 'parent-id', status: 'dropped' });
    expect(editFolder.schema.parse({
      id: 'folder-id',
      newParentFolderName: '',
      newStatus: 'active',
    })).toMatchObject({ id: 'folder-id', newParentFolderName: '', newStatus: 'active' });
  });

  it('requires an identifier before edit or removal reaches OmniFocus', async () => {
    const editResponse = await editFolder.handler({} as never, {} as never);
    const removeResponse = await removeFolder.handler({} as never, {} as never);
    expect(editResponse.isError).toBe(true);
    expect(editResponse.content[0].text).toContain('Either id or name');
    expect(removeResponse.isError).toBe(true);
    expect(removeResponse.content[0].text).toContain('Either id or name');
  });

  it('reports invalid ensure paths as a tool error', async () => {
    const response = await ensureFolder.handler({ path: '///' }, {} as never);
    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain('at least one non-blank component');
  });
});
