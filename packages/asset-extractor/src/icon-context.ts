import { executableSha256, readSceneAssociations, sha256 } from './scene-palette.js';

export type SceneObject = {
  resourceId: number;
  recordFileOffset: number;
  attributesFileOffset: number;
  objectId: number;
  sceneSpriteIndex: number;
  x: number;
  y: number;
};

/** Records read by the original 0x8CA6/0x8DA0 scene-object loader. */
export function parseSceneObjects(
  data: Buffer,
  dataBase: number,
  pointer: number,
  resourceId: number,
): SceneObject[] {
  const result: SceneObject[] = [];
  let at = dataBase + pointer;
  if (!Number.isInteger(at) || at < 0 || at >= data.length)
    throw new Error('Invalid scene record pointer');
  while (at < data.length) {
    if (data[at] === 255) return result;
    if (at + 9 > data.length) throw new Error('Truncated scene record');
    if (data[at] !== 0) {
      const attributesFileOffset = dataBase + data.readUInt16LE(at + 7);
      if (attributesFileOffset < 0 || attributesFileOffset + 6 > data.length)
        throw new Error('Invalid scene attributes pointer');
      result.push({
        resourceId,
        recordFileOffset: at,
        attributesFileOffset,
        objectId: data.readUInt16LE(attributesFileOffset + 4),
        sceneSpriteIndex: data[at + 2],
        x: data.readUInt16LE(at + 3),
        y: data.readUInt16LE(at + 5),
      });
    }
    at += 9;
  }
  throw new Error('Unterminated scene records');
}

export function readIconContext(exe: Buffer, spriteIndex: number) {
  if (sha256(exe) !== executableSha256)
    throw new Error('Unknown executable revision: unverified icon context');
  if (!Number.isInteger(spriteIndex) || spriteIndex < 0 || spriteIndex >= 163)
    throw new Error('Invalid icon index');
  const dataBase = exe.readUInt16LE(8) * 16 + 0x0f31 * 16;
  const associations = readSceneAssociations(exe);
  // Each entry is flags THEN icon, not icon THEN flags (see 0x8B83/0xE17D).
  const mappedObjects = Array.from({ length: (0x53b1 - 0x524d) / 2 }, (_, objectId) => {
    const flagsFileOffset = dataBase + 0x524d + objectId * 2;
    return {
      objectId,
      initialFlags: exe[flagsFileOffset],
      flagsFileOffset,
      iconFileOffset: flagsFileOffset + 1,
      spriteIndex: exe[flagsFileOffset + 1],
    };
  }).filter((row) => row.spriteIndex === spriteIndex);
  const ids = new Set(mappedObjects.map((row) => row.objectId));
  const sourceContexts = associations.flatMap((association) => {
    const pointer = exe.readUInt16LE(dataBase + 0x53b5 + association.resourceId * 2);
    return parseSceneObjects(exe, dataBase, pointer, association.resourceId)
      .filter((record) => ids.has(record.objectId))
      .map((record) => ({ ...record, map: association.map, sceneSprites: association.sprite }));
  });
  return {
    spriteIndex,
    mappedObjects,
    sourceContexts,
    paletteRule: 'Active MAP indices 0-191 plus SPRITES.PAL indices 192-255',
    inventoryRule:
      'Inventory stores object IDs without a palette or source-room field; its icons use the currently active palette',
    evidence: {
      objectTable: 'DS:524D flags / DS:524E icon, stride 2',
      sceneObjectPointers: 'DS:53B5, stride 2',
      sceneObjectLoader: '0x8CA6-0x8D6E / 0x8DA0-0x8DDF',
      selectorFilter: '0x8B73-0x8BC2',
      inventoryInsert: '0x583A-0x5879 / 0x8AD9-0x8AF2',
      inventorySelector: '0xE1D3-0xE1F9',
      iconLookup: '0xE173-0xE195',
    },
  };
}
