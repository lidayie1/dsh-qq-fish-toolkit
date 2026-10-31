// 探测 SnowLuma 的 HTTP 端（3000）属于哪个账号，并用它做一次端到端测试
const BASE = 'http://127.0.0.1:3000';
const UINS = { '<OWNER_QQ>': 'ZN41sS72PF3AEi2q0Crevw820vokFSX7iXm0viq0VUw', '<FISH_QQ>': '<ONEBOT_HTTP_TOKEN>' };

async function call(token, action, body = {}) {
  const r = await fetch(`${BASE}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { http: r.status, json };
}

for (const [uin, tok] of Object.entries(UINS)) {
  try {
    const res = await call(tok, 'get_login_info');
    console.log(uin, '=>', JSON.stringify(res));
  } catch (e) {
    console.log(uin, '=> error', e.message);
  }
}
