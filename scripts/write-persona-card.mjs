// 把「鱼儿」人格卡写进 profile 的 cordis.patch.yml（soul-md 条目），并校验 YAML 可解析
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('<HOME>/.dsh/profiles/desktop/node_modules/dsh-bili-whale/package.json');
let yaml;
try { yaml = require('js-yaml'); } catch { yaml = null; }
if (!yaml) {
  // 退一步：从 DSH 运行时里找
  const r2 = createRequire('<HOME>/.dsh/profiles/desktop/package.json');
  try { yaml = r2('js-yaml'); } catch { yaml = null; }
}
if (!yaml) throw new Error('js-yaml 不可用，无法校验');

const cardPath = '<WORKSPACE>/tools/persona-yuer.md';
const cfgPath = '<HOME>/.dsh/profiles/desktop/cordis.patch.yml';
const WS = 'C:\\Users\\ASUS\\.dsh\\qq-work';

const card = fs.readFileSync(cardPath, 'utf8').replace(/\r\n/g, '\n').trimEnd();

// 卡片内容缩进 8 空格（cards: 在 4，key 在 6，block scalar 内容在 8）
const body = card.split('\n').map((l) => (l.length ? '        ' + l : '')).join('\n');

const block = [
  '',
  '# ── 人格卡（dsh-soul-md）：只对 QQ 工作区生效 ──',
  '- id: soul-md',
  '  name: dsh-soul-md',
  '  config:',
  '    cards:',
  '      鱼儿: |',
  body,
  '    workspaces:',
  `      '${WS}': 鱼儿`,
  '',
].join('\n');

let text = fs.readFileSync(cfgPath, 'utf8');
if (/^- id: soul-md\r?$/m.test(text)) {
  console.log('已存在 soul-md 条目，改为就地替换');
  text = text.replace(/- id: soul-md[\s\S]*?(?=\r?\n- id: |\s*$)/, block.trim() + '\n');
} else {
  text = text.replace(/\s*$/, '\n') + block;
}

// 校验
const doc = yaml.load(text);
const entry = Array.isArray(doc) ? doc.find((e) => e && e.id === 'soul-md') : null;
if (!entry) throw new Error('写入后解析不到 soul-md 条目，放弃写盘');
const loadedCard = entry.config?.cards?.['鱼儿'];
if (!loadedCard || !loadedCard.includes('我是鱼儿')) throw new Error('卡片内容没有正确落进 YAML');
if (entry.config?.workspaces?.[WS] !== '鱼儿') throw new Error('workspaces 映射不对: ' + JSON.stringify(entry.config?.workspaces));

fs.writeFileSync(cfgPath, text, 'utf8');
console.log('OK 写入成功');
console.log('条目数 =', doc.length, '｜卡片字数 =', loadedCard.length);
console.log('workspaces =', JSON.stringify(entry.config.workspaces));
