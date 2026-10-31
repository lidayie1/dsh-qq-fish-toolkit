// 会话日志 zstd 多帧：按 magic 切分逐帧解码
import fs from 'node:fs';
import zlib from 'node:zlib';

const f = process.argv[2];
const n = Number(process.argv[3] ?? 8);
const buf = fs.readFileSync(f);

const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const offs = [];
let i = 0;
while ((i = buf.indexOf(MAGIC, i)) !== -1) { offs.push(i); i += 4; }
console.log('文件字节 =', buf.length, ' 帧数 =', offs.length);

let out = '';
for (let k = 0; k < offs.length; k++) {
  const start = offs[k];
  const end = k + 1 < offs.length ? offs[k + 1] : buf.length;
  try {
    out += zlib.zstdDecompressSync(buf.subarray(start, end)).toString('utf8');
  } catch (e) {
    console.log('frame', k, 'fail:', e.message);
  }
}
const lines = out.split('\n').filter(Boolean);
console.log('解压后字节 =', Buffer.byteLength(out), ' 行数 =', lines.length);
for (const l of lines.slice(-n)) {
  let o; try { o = JSON.parse(l); } catch { console.log('RAW', l.slice(0, 200)); continue; }
  const s = JSON.stringify(o);
  console.log('\n' + (s.length > 700 ? s.slice(0, 700) + '…' : s));
}
