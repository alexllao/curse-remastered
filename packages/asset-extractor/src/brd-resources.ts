import { decode } from './spr-codec.js';
import { indexPalette } from './shared-palette.js';
import { executableSha256, readSceneAssociations, sha256 } from './scene-palette.js';

export function readLogicalRooms(exe: Buffer) {
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown executable revision: unverified room descriptors');
  const base = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
  const scenes = readSceneAssociations(exe);
  return Array.from({ length: (0x757e - 0x7482) / 2 }, (_, roomId) => {
    const resourceId = exe.readUInt16LE(base + 0x7482 + roomId * 2);
    const scene = scenes.find((row) => row.resourceId === resourceId);
    if (!scene) throw new Error('Room references an unverified scene');
    const descriptorFileOffset = base + 0x85ac + roomId * 14;
    const selector = exe[descriptorFileOffset + 13];
    let brd: string | null;
    if (selector === 255) brd = 'STD.BRD';
    else if (selector === 254)
      brd = null; // Original branch uses the scene SPR.
    else {
      if (selector >= 29) throw new Error('Unverified BRD selector');
      const nameAt = base + exe.readUInt16LE(base + 0x918 + selector * 2);
      brd = exe.toString('ascii', nameAt, exe.indexOf(0, nameAt)).toUpperCase();
      if (!/^[A-Z0-9]+\.BRD$/.test(brd)) throw new Error('Invalid BRD name');
    }
    return {
      roomId,
      resourceId,
      map: scene.map,
      sceneSprites: scene.sprite,
      descriptorFileOffset,
      descriptorFlags: exe[descriptorFileOffset],
      descriptorSprite: exe[descriptorFileOffset + 1],
      descriptorX: exe.readInt16LE(descriptorFileOffset + 2),
      descriptorY: exe.readInt16LE(descriptorFileOffset + 4),
      scrollColumn: exe[descriptorFileOffset + 12],
      brdSelector: selector,
      brd,
    };
  });
}

/** Read valid original frame pointers, preserving an invalid tail as an explicit warning. */
export function readBrdIndex(data: Buffer) {
  if (data.length < 16) throw new Error('Truncated BRD');
  const first = data.readUInt16LE(0) * 16;
  if (first < 16 || first >= data.length) throw new Error('Invalid BRD table size');
  const offsets: number[] = [];
  const issues: { index: number; rawParagraph: number; byteOffset: number; reason: string }[] = [];
  for (let at = 0; at < first; at += 2) {
    const rawParagraph = data.readUInt16LE(at);
    if (!rawParagraph) break;
    const offset = rawParagraph * 16;
    if (
      offset < first ||
      offset >= data.length ||
      (offsets.length > 0 && offset <= offsets[offsets.length - 1])
    ) {
      issues.push({
        index: at / 2,
        rawParagraph,
        byteOffset: offset,
        reason:
          'Invalid or non-increasing frame pointer; remaining table entries are not interpreted',
      });
      break;
    }
    offsets.push(offset);
  }
  if (!offsets.length) throw new Error('No valid BRD frame pointers');
  return { offsets, issues, firstFrameOffset: first };
}
export function decodeBrd(data: Buffer, name: string) {
  const table = readBrdIndex(data);
  // A temporary view terminates at the valid pointer prefix. Frame bytes and all
  // original pointers in that prefix remain unchanged. Never repair the source.
  const view = Buffer.from(data);
  view.fill(0, table.offsets.length * 2, table.firstFrameOffset);
  return { ...table, frames: decode(view, indexPalette, name) };
}
