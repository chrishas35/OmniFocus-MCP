import { describe, expect, it } from 'vitest';
import { queryOmnifocus } from '../../tools/primitives/queryOmnifocus.js';
import { errorHandlerScript, executeFolderScript, jsonEscapeHelpersScript } from '../../tools/primitives/folderHelpers.js';
import { getFolderState, resolveItemName } from './helpers.js';
import {
  createTrackedFolder,
  editFolder,
  ensureFolder,
  registry,
  removeFolder,
  setupIntegration,
} from './setup.js';

describe('Folder Lifecycle (integration)', () => {
  setupIntegration();

  let folderId: string;
  const anchorName = `TEST:Folder Lifecycle Anchor ${Date.now()}`;
  let anchorId: string;

  it('returns parseable details for unexpected AppleScript errors', async () => {
    const result = await executeFolderScript(`${jsonEscapeHelpersScript()}

try
  error ("TEST: quoted " & quote & "error" & quote & linefeed & "second line")
${errorHandlerScript()}`, 'folder_error_test');
    expect(result).toMatchObject({
      success: false,
      error: 'TEST: quoted "error"\nsecond line',
      errorCode: -2700,
    });
  });

  it('creates a dropped folder under a parent found by name', async () => {
    const anchor = await createTrackedFolder({ name: anchorName });
    expect(anchor.success).toBe(true);
    anchorId = anchor.folderId!;

    const result = await createTrackedFolder({
      name: 'TEST:Dropped Folder',
      parentFolderName: anchorName,
      status: 'dropped',
    });
    expect(result.success).toBe(true);
    expect(result.folderId).toBeTruthy();
    folderId = result.folderId!;

    const state = await getFolderState(folderId);
    expect(state).toMatchObject({ parentFolderId: anchorId, hidden: true });
  });

  it('renames, moves, and reactivates a folder', async () => {
    const result = await editFolder({
      id: folderId,
      newName: 'TEST:Active Folder',
      newParentFolderID: anchorId,
      newStatus: 'active',
    });
    expect(result.success).toBe(true);
    expect(result.changedProperties).toEqual(['name', 'parent folder', 'status']);

    const state = await getFolderState(folderId);
    expect(state).toMatchObject({
      name: 'TEST:Active Folder',
      parentFolderId: anchorId,
      hidden: false,
    });

    const query = await queryOmnifocus({
      entity: 'folders',
      fields: ['id', 'status', 'path'],
      includeCompleted: true,
    });
    const folder = query.items?.find(item => item.id === folderId);
    expect(folder).toMatchObject({
      status: 'Active',
      path: `${anchorName}/TEST:Active Folder`,
    });
  });

  it('creates a child with a parent ID and moves it to the root', async () => {
    const child = await createTrackedFolder({
      name: 'TEST:ID Child',
      parentFolderID: folderId,
    });
    expect(child.success).toBe(true);

    const moved = await editFolder({ id: child.folderId, newParentFolderName: '' });
    expect(moved.success).toBe(true);
    expect((await getFolderState(child.folderId!))?.parentFolderId).toBeNull();
  });

  it('ensures missing path components once and reuses them thereafter', async () => {
    const path = `${anchorName}/TEST:Ensured Parent/TEST:Ensured Child`;
    const first = await ensureFolder({ path });
    expect(first.success).toBe(true);
    expect(first.createdFolderIds).toHaveLength(2);
    expect(first.createdPaths).toEqual([
      `${anchorName}/TEST:Ensured Parent`,
      path,
    ]);
    first.createdFolderIds!.forEach((id, index) => {
      registry.track(id, index === 0 ? 'TEST:Ensured Parent' : 'TEST:Ensured Child', 'folder');
    });

    const second = await ensureFolder({ path: `/${path}//` });
    expect(second.success).toBe(true);
    expect(second.folderId).toBe(first.folderId);
    expect(second.createdFolderIds).toEqual([]);
  });

  it('rejects moves into a descendant', async () => {
    const parent = await createTrackedFolder({ name: 'TEST:Cycle Parent', parentFolderID: registry.runFolderId });
    const child = await createTrackedFolder({ name: 'TEST:Cycle Child', parentFolderID: parent.folderId });
    const result = await editFolder({ id: parent.folderId, newParentFolderID: child.folderId });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot move a folder into itself');
    expect((await getFolderState(parent.folderId!))?.parentFolderId).toBe(registry.runFolderId);
  });

  it('removes a non-empty folder and its contained hierarchy by ID', async () => {
    const folder = await createTrackedFolder({ name: 'TEST:Remove Folder', parentFolderID: registry.runFolderId });
    const child = await createTrackedFolder({ name: 'TEST:Remove Child', parentFolderID: folder.folderId });
    const result = await removeFolder({ id: folder.folderId });
    expect(result.success).toBe(true);
    expect(await resolveItemName(folder.folderId!, 'folder')).toBeNull();
    expect(await resolveItemName(child.folderId!, 'folder')).toBeNull();
  });
});
