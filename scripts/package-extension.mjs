import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const files = (await readdir(resolve(root, "extension"))).filter(
  (name) => /\.(js|json|html|css|md)$/.test(name) && !name.includes(".test."),
);
const table = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (data) => {
  let value = 0xffffffff;
  for (const byte of data) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
};
const blocks = [],
  entries = [];
let offset = 0;
for (const name of files.sort()) {
  const data = await readFile(resolve(root, "extension", name));
  const filename = Buffer.from(name);
  const checksum = crc(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(filename.length, 26);
  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(20, 4);
  record.writeUInt16LE(20, 6);
  record.writeUInt16LE(33, 14);
  record.writeUInt32LE(checksum, 16);
  record.writeUInt32LE(data.length, 20);
  record.writeUInt32LE(data.length, 24);
  record.writeUInt16LE(filename.length, 28);
  record.writeUInt32LE(offset, 42);
  blocks.push(header, filename, data);
  entries.push(record, filename);
  offset += header.length + filename.length + data.length;
}
const directory = Buffer.concat(entries);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
await mkdir(resolve(root, "public"), { recursive: true });
await writeFile(
  resolve(root, "public/watch-together-extension.zip"),
  Buffer.concat([...blocks, directory, end]),
);
console.log(`Packaged ${files.length} extension files.`);
