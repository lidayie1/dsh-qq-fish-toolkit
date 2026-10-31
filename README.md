# dsh-qq-fish-toolkit

把 **DeepSeek Harness（DSH）** 接到 QQ 的一套可复用脚本 + 踩坑笔记，外加一个 B 站「养鱼」插件（dsh-bili-whale）的运维经验。

写完这套东西的过程并不顺利：装插件装了 16 分钟、ffmpeg 折腾了 4 小时、QQ 通道第一次连不上。这份仓库记录的就是「怎么一次走通」，以及**每个坑到底长什么样**。

---

## 1. 架构：四层，但只需三层

```
QQ 客户端（你 / 小号）
    │  NTQQ 协议
    ▼
SnowLuma（协议端，把 QQ 变成标准 OneBot v11 端口）
    │  反向 / 正向 WebSocket
    ▼
dsh-onebot-qq（DSH 插件：把 OneBot 事件转成 DSH 会话）
    │  plugin session
    ▼
DSH（DeepSeek Harness）→ 一个只属于这个 QQ 号的独立工作区
```

原教程（BV1oFnQ6dEG4）在中间还插了一层 `qq-bridge`，**这一层可以省掉**——`dsh-onebot-qq` 本身就是 OneBot v11 客户端。少一层，少一处 token 对不上的地方。

---

## 2. 前置条件

| 需要 | 说明 |
|---|---|
| DSH | 桌面版，能开 Full Access |
| SnowLuma | `SnowLuma-v2.2.1-win-x64.zip`，解压路径**不能含中文**（本仓库用 `C:\snowluma`） |
| 一个 QQ 号 | 建议小号；协议端有封号风险，自己权衡 |
| Node.js | 用 DSH 自带的即可（`tools/git/usr/bin` 之外不用另装） |

---

## 3. 快速开始

### 3.1 启动协议端

```powershell
Set-Location C:\snowluma
$env:SNOWLUMA_ACCEPT_EULA   = '1'
$env:SNOWLUMA_ACCEPT_PRIVACY = '1'
.\node.exe .\index.mjs
```

日志里会打印：

```
WebUI: http://127.0.0.1:5099
账号: admin  密码: <随机>      ← 首次登录会强制改密码
```

> 教程里说的是 5059，那是旧版本；**2.2.1 是 5099**。

进 WebUI 扫码登录 QQ。登录后 SnowLuma 会在 `config/` 下生成 `onebot_<QQ号>.json`，默认模板是：

- `httpServers`: 3000 端口（带 token）
- `wsServers`: 3001 端口（带 token，role = Universal）
- `wsClients`: **空数组**

### 3.2 让 DSH 去连协议端（forward 模式）

**关键抉择：用 forward，不要用 reverse。**

原因见第 5 节「坑一」。改 `~/.dsh/profiles/desktop/cordis.patch.yml`，追加：

```yaml
- id: dsh-onebot
  name: dsh-onebot-qq
  config:
    mode: forward
    url: 'ws://127.0.0.1:3001/'
    accessToken: '<ONEBOT_TOKEN>'      # 抄 onebot_<小号QQ>.json 里 wsServers[0].accessToken
    botQQ: '<FISH_QQ>'
    adminUsers: ['<OWNER_QQ>']
    dmPolicy: open
    groupPolicy: disabled
    requireMention: true
    sttEnabled: false
    interimMessages: true
    workspacePath: 'C:\Users\you\.dsh\qq-work'
```

存盘即热重载（DSH 监听配置文件，**不用重启**）。验证：

```powershell
Get-NetTCPConnection -RemotePort 3001 -State Established   # 应该有一条 127.0.0.1:x → 3001
```

### 3.3 验证链路

在 QQ 里给这个号发「在吗」。DSH 侧会新建会话：

```
~/.dsh/sessions/--C-Users-you-.dsh-qq-work--/onebot-private-<OWNER_QQ>/session.v4.jsonl.zstd
```

用 `scripts/read-session-frames.mjs` 解开看：

```powershell
node scripts/read-session-frames.mjs <上面那个文件> 40
node scripts/qq-turns.mjs            <上面那个文件>      # 只看「谁说了什么 / 回了什么」
```

---

## 4. 脚本清单

| 脚本 | 用法 | 干什么 |
|---|---|---|
| `read-session-frames.mjs` | `node ... <zstd 文件> [行数]` | 解 DSH 会话日志。**多帧 zstd，必须逐帧解**（见坑二） |
| `qq-turns.mjs` | `node ... <zstd 文件>` | 从会话日志里抽 QQ 对话轮次，打印成「谁 → 什么 → 回了什么」 |
| `test-onebot-forward.mjs` | `node ...` | 用每个号的 `wsServers` token 去连 3001，判断端口到底属于哪个 QQ 号 |
| `probe-onebot-http.mjs` | `node ...` | 探 3000 端口归属，并调 `send_private_msg` 发一条联调消息 |
| `patch-onebot-forward.mjs` | `node ...` | 把 `cordis.patch.yml` 里的插件配置从 reverse 改成 forward |
| `set-botqq.mjs` | `node ...` | 写入 `botQQ` 并触发一次热重载 |
| `write-persona-card.mjs` | `node ...` | 把人格卡 md 写成 dsh-soul-md 的 `cards` 条目，**写盘前用 js-yaml 回读校验** |
| `crop_frames.py` | `python ... sheet <idx 逗号列表> [标签] [倍数]` | B 站雪碧图按 10×10 切格放大 / 拼图 |
| `crop_frames.py` | `python ... single <idx> [倍数]` | 单独放大某一格 |
| `fetch-ffmpeg.ps1` | `pwsh -File ...` | ffmpeg 断点续传下载 + 只解 `bin/ffmpeg.exe`（面向中国网络，见第 6 节） |

> 脚本里的路径都是占位符（`<HOME>`、`<WORKSPACE>` 等），用前改成你自己的。

---

## 5. 三个坑，每个都值一小时

### 坑一：SnowLuma 的反向 WS 发不出 Bearer token

`dsh-onebot-qq` 的 reverse 模式是 fail-closed 的：

```js
// node_modules/dsh-onebot-qq/lib/connection.js:249-250
if (this.config.accessToken === '') throw new Error('reverse mode requires a non-empty accessToken');

// :266-270
const expected = Buffer.from('Bearer ' + this.config.accessToken);
if (!timingSafeEq(request.headers.authorization, expected)) socket.close(4401, 'unauthorized');
```

而 SnowLuma 的 `wsClients`（反向连接）表单里**根本没有 token 输入框**——反查编译后的前端 `client/assets/config-page-*.js`，字段只有：

```
name / url / role / reconnectIntervalMs / messageFormat / reportSelfMessage
```

token 字段只在 `httpServers` / `wsServers` 分支渲染。

**结论**：让 DSH 当客户端（forward），去连 SnowLuma 的 `wsServers`，token 由 DSH 主动发出去。方向一转，通。

### 坑二：DSH 会话日志是多帧 zstd

`zlib.zstdDecompressSync()` 只解**第一帧**（约 191 字节），看起来像「日志是空的」。

正确做法是按 zstd magic `28 B5 2F FD` 把 buffer 切开，逐帧解压再拼起来。`read-session-frames.mjs` 就是这么干的：

```
37,874 B 压缩 → 7 帧 → 137,941 B / 20 行
```

### 坑三：竖屏视频的「字幕在画面底部」

自己写抽帧工具时，习惯性裁掉底部 17% 去字幕——竖屏 vlog 那 17% 是**真人胸口**，真正的字幕压在屏录区底部。

判断方法：先用 `watch-video` 出等间隔骨架图（4×4 / 6×6），肉眼看字幕在画面的哪个纵向区间，再按比例裁。

---

## 6. 关于 ffmpeg：别从 gyan.dev 下

国内直连 `gyan.dev` 的 115 MB 安装包，实测 **3–4 KB/s**，ETA 9 小时，而且会中途 reset。

**三分钟装法**：从 PyPI 镜像拿 `imageio_ffmpeg` 的 wheel，里面直接就是一个完整 ffmpeg 二进制。

```powershell
# 阿里云镜像，实测 0.3s 通、620 KB/s
curl.exe -sSL -o imageio_ffmpeg.whl `
  https://mirrors.aliyun.com/pypi/packages/.../imageio_ffmpeg-0.7.0-py3-none-win_amd64.whl
```

解开 wheel（就是个 zip），取 `imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`，改名为 `ffmpeg.exe`，放到下面任一位置：

| 位置 | 优先级 |
|---|---|
| `$FFMPEG` 环境变量 | 1 |
| `PATH` | 2 |
| `<插件仓库>/bin/` | 3 |
| `~/.dsh/bili-whale/bin/` | 4（**放这里免重启**） |
| 剪映自带 | 5 |

`dsh-bili-whale` 的 `tools/bili.mjs deps --json` 会检查它，全绿后再跑 `watch-video` 就能真看画面了。

---

## 7. 脱敏说明

仓库里所有个人标识都已替换：

| 占位符 | 原值含义 |
|---|---|
| `<HOME>` / `<WORKSPACE>` | 本机用户目录 / DSH 工作区路径 |
| `<OWNER_BILI_UID>` / `<FISH_BILI_MID>` | 主人 B 站 UID / 小号 mid |
| `<OWNER_QQ>` / `<FISH_QQ>` | 主人 QQ / 机器人 QQ |
| `<ONEBOT_TOKEN>` / `<ONEBOT_HTTP_TOKEN>` | SnowLuma 的 WS / HTTP token |
| `<SNOWLUMA_WEBUI_PASSWORD>` | WebUI 初始密码 |

---

## 8. 免责

- QQ 协议端（SnowLuma 一类）**不是官方客户端**，有被风控/封号的先例，用小号。
- 把 B 站账号交给 LLM 自动操作（评论/私信）同样有风控风险，`dsh-bili-whale` 默认值已经是保守的，别急着调大。
- 本仓库只做「让 LLM 能收发消息」，不包含任何刷量、批量互动逻辑。

MIT.
