// 探测 SnowLuma 的 wsServer（127.0.0.1:3001）能否用 OneBot 的 forward 方式连上
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire('<HOME>/.dsh/profiles/desktop/node_modules/dsh-onebot-qq/package.json');
const WebSocket = require('ws');

const UINS = ['<OWNER_QQ>', '<FISH_QQ>'];
const cfgs = UINS.map((uin) => {
  const j = JSON.parse(fs.readFileSync(`C:/snowluma/config/onebot_${uin}.json`, 'utf8'));
  return { uin, token: j.networks.wsServers[0].accessToken };
});

function probe({ uin, token }, withAuth) {
  return new Promise((resolve) => {
    const opts = withAuth ? { headers: { Authorization: 'Bearer ' + token } } : {};
    const ws = new WebSocket('ws://127.0.0.1:3001/', opts);
    let done = false;
    const finish = (o) => { if (done) return; done = true; clearTimeout(t); try { ws.terminate(); } catch {} resolve({ uin, withAuth, ...o }); };
    const t = setTimeout(() => finish({ ok: false, why: 'timeout 8s' }), 8000);
    ws.on('open', () => ws.send(JSON.stringify({ action: 'get_login_info', echo: 'e1' })));
    ws.on('message', (d) => {
      let j = {}; try { j = JSON.parse(d.toString()); } catch { return finish({ ok: false, why: 'non-json ' + d.toString().slice(0, 80) }); }
      if (j.echo === 'e1') finish({ ok: true, data: j.data, status: j.status });
    });
    ws.on('error', (e) => finish({ ok: false, why: 'error: ' + e.message }));
    ws.on('close', (c, r) => finish({ ok: false, why: 'close ' + c + ' ' + r }));
  });
}

for (const c of cfgs) {
  console.log(JSON.stringify(await probe(c, true)));
  console.log(JSON.stringify(await probe(c, false)));
}
