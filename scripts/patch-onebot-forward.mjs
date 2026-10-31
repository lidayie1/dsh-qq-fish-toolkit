import fs from 'node:fs';

const p = '<HOME>/.dsh/profiles/desktop/cordis.patch.yml';
let t = fs.readFileSync(p, 'utf8');
const token = '<ONEBOT_TOKEN>';

if (!/id: dsh-onebot/.test(t)) throw new Error('onebot block not found');

// 只在 dsh-onebot 块内替换 mode/host/port/accessToken
const out = t.replace(/(- id: dsh-onebot\r?\n[\s\S]*?)(?=\r?\n- id: |\s*$)/, (block) => {
  let b = block
    .replace(/mode:\s*reverse/, 'mode: forward')
    .replace(/(\n\s+host: 127\.0\.0\.1)/, "\n    url: 'ws://127.0.0.1:3001/'$1")
    .replace(/accessToken:\s*'[^']*'/, `accessToken: '${token}'`);
  return b;
});

fs.writeFileSync(p, out, 'utf8');
console.log('written, bytes =', Buffer.byteLength(out));
console.log(out.slice(out.indexOf('# ── QQ')));
