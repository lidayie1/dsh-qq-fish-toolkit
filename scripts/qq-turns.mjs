// 打印 QQ 会话里最后一轮的用户消息与助手回复正文
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const starts = [];
for (let i = 0; i + 4 <= buf.length; i++) {
  if (buf[i] === 0x28 && buf[i + 1] === 0xb5 && buf[i + 2] === 0x2f && buf[i + 3] === 0xfd) starts.push(i);
}
let text = '';
for (let k = 0; k < starts.length; k++) {
  const seg = buf.subarray(starts[k], k + 1 < starts.length ? starts[k + 1] : buf.length);
  try { text += zlib.zstdDecompressSync(seg).toString('utf8'); } catch (e) { /* 跳过残缺帧 */ }
}
const lines = text.split('\n').filter(Boolean);
const turns = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

const byTurn = new Map();
for (const ev of turns) {
  const t = ev.data?.turn;
  if (t == null) continue;
  if (!byTurn.has(t)) byTurn.set(t, { user: null, reply: null, at: null });
  const slot = byTurn.get(t);
  const d = ev.data;
  if (ev.type === 'user/message' || ev.type === 'turn/start') {
    const c = d.message?.content ?? d.content;
    const s = JSON.stringify(c ?? '');
    const m = s.match(/<user_message[^>]*>([^<]*)</);
    if (m) slot.user = m[1].replace(/\\n/g, '').trim();
    if (d.time && !slot.at) slot.at = new Date(d.time).toLocaleTimeString('zh-CN', { hour12: false });
  }
  if (ev.type === 'assistant/message') {
    const c = d.message?.content ?? [];
    const tx = (Array.isArray(c) ? c : []).filter((x) => x.type === 'text').map((x) => x.text).join('');
    if (tx) slot.reply = tx;
  }
}
for (const [t, s] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`── turn ${t} ${s.at ?? ''}`);
  if (s.user) console.log('  用户:', s.user);
  if (s.reply) console.log('  回复:', s.reply.slice(0, 400));
}
