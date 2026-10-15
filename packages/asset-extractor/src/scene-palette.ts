import { createHash } from 'node:crypto';

export const executableSha256 = 'f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d';
export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
export type SceneAssociation = {
  resourceId: number;
  tableFileOffset: number;
  map: string;
  sprite: string;
};

export function readSceneAssociations(exe: Buffer): SceneAssociation[] {
  // These offsets have only been traced in this exact local executable revision.
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown CURSE.EXE revision: refusing unverified palette associations');
  const dataBase = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
  const readName = (offset: number, extension: string): string => {
    const start = dataBase + offset;
    const end = exe.indexOf(0, start);
    if (start < dataBase || end < start || end - start > 32)
      throw new Error('Invalid resource name pointer');
    const name = exe.toString('ascii', start, end).toUpperCase();
    if (!new RegExp('^[A-Z0-9_]+\\.' + extension + '$').test(name))
      throw new Error('Unexpected resource name: ' + name);
    return name;
  };
  return Array.from({ length: 78 }, (_, resourceId) => {
    const tableFileOffset = dataBase + 0x784e + resourceId * 8;
    return {
      resourceId,
      tableFileOffset,
      map: readName(exe.readUInt16LE(tableFileOffset), 'MAP'),
      sprite: readName(exe.readUInt16LE(tableFileOffset + 2), 'SPR'),
    };
  });
}

export function composeScenePalette(map: Buffer, shared: Buffer): Buffer {
  if (map.length < 0x242) throw new Error('MAP header is truncated');
  if (shared.length !== 768) throw new Error('SPRITES.PAL must contain 768 bytes');
  const palette = Buffer.concat([map.subarray(0, 0x240), shared.subarray(0x240)]);
  if (palette.some((value) => value > 63))
    throw new Error('Scene palette contains a non-VGA component');
  return palette;
}
