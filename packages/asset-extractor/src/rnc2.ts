import { crc16 } from './rnc1.js';

/**
 * RNC ProPack method 2 (18-byte header, forward MSB-first bitstream).
 * Bit-control bytes and literal/distance bytes share the same input stream.
 * Throws on corrupt input; only CRC-verified output is returned.
 *
 * Algorithm reference: ancient / RNCDecompressor.cpp, Teemu Suutari.
 */
export function unpackRnc2(source: Uint8Array): Uint8Array {
  const data = Buffer.from(source.buffer, source.byteOffset, source.byteLength);
  if (data.length < 18 || data.toString('ascii', 0, 3) !== 'RNC' || data[3] !== 2) {
    throw new Error('Expected RNC method 2');
  }
  const size = data.readUInt32BE(4);
  const packed = data.readUInt32BE(8);
  if (packed + 18 !== data.length) throw new Error('RNC2 packed size mismatch');
  if (crc16(data.subarray(18)) !== data.readUInt16BE(14)) {
    throw new Error('RNC2 packed CRC mismatch');
  }
  if (size > 128 * 1024 * 1024) throw new Error('RNC2 output exceeds safety limit');
  const output = Buffer.alloc(size);
  let pos = 18;
  let out = 0;
  let bits = 0;
  let left = 0;
  const readByte = (): number => {
    if (pos >= data.length) throw new Error('Truncated RNC2 input');
    return data[pos++];
  };
  const bit = (): number => {
    if (left === 0) {
      bits = readByte();
      left = 8;
    }
    const value = (bits >>> 7) & 1;
    bits = (bits << 1) & 255;
    left--;
    return value;
  };
  const readBits = (count: number): number => {
    let value = 0;
    while (count-- > 0) value = (value << 1) | bit();
    return value;
  };
  const literal = (): void => {
    if (out >= size) throw new Error('RNC2 output overflow');
    output[out++] = readByte();
  };
  const copy = (distance: number, count: number): void => {
    if (distance < 1 || distance > out || count < 1 || out + count > size) {
      throw new Error(`Invalid RNC2 back-reference: offset=${out}, distance=${distance}, count=${count}, inputOffset=${pos}, bitsLeft=${left}`);
    }
    for (let i = 0; i < count; i++) {
      output[out] = output[out - distance];
      out++;
    }
  };
  const distanceCodes = new Map<string, number>([
    ['0', 0], ['110', 1], ['1000', 2], ['1001', 3],
    ['10101', 4], ['10111', 5], ['11101', 6], ['11111', 7],
    ['101000', 8], ['101001', 9], ['101100', 10], ['101101', 11],
    ['111000', 12], ['111001', 13], ['111100', 14], ['111101', 15],
  ]);
  const distance = (): number => {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += String(bit());
      const high = distanceCodes.get(code);
      if (high !== undefined) return (high << 8) + readByte() + 1;
    }
    throw new Error('Invalid RNC2 distance code');
  };
  const length = (): number => {
    const a = bit();
    const b = bit();
    if (a === 0) return b === 0 ? 4 : 5;
    const c = bit();
    if (b === 0) return c === 0 ? 6 : 7;
    return c === 0 ? 8 : 9;
  };

  readBits(2); // Two ballast bits.
  const chunks = data[17];
  if (chunks === 0) throw new Error('RNC2 missing chunk count');
  let found = 0;
  let done = false;
  while (!done && found < chunks) {
    if (bit() === 0) {
      literal();
    } else if (bit() === 0) {
      const count = length();
      if (count === 9) {
        const repeat = (readBits(4) + 3) * 4;
        for (let i = 0; i < repeat; i++) literal();
      } else copy(distance(), count);
    } else if (bit() === 0) {
      copy(readByte() + 1, 2);
    } else if (bit() === 0) {
      copy(distance(), 3);
    } else {
      const count = readByte();
      if (count !== 0) copy(distance(), count + 8);
      else {
        found++;
        done = bit() === 0;
      }
    }
  }
  if (out !== size || found !== chunks) throw new Error('Incomplete RNC2 output or chunk count');
  if (crc16(output) !== data.readUInt16BE(12)) {
    throw new Error('RNC2 unpacked CRC mismatch');
  }
  return output;
}
