# 全栈项目 · 罗亚博

**学号**：409　|　**姓名**：罗亚博　|　**班级**：计算机 24004
**项目类别**：自选　|　**运行端口**：409

原生 HTML / CSS / JavaScript 前端 + Node.js + Express 后端 + MySQL 数据库，不使用任何第三方前端库、框架或 CDN。

---

## 一、快速开始

1. 确认本机 MySQL 已启动（本项目使用本机已有的 MySQL，不额外安装）。
2. 双击根目录的 **`start.bat`**（旧的 `run.bat` 会自动转调它），脚本会检查 Node、`.env`、409 端口占用，按需安装依赖并启动服务。
3. 浏览器打开 **http://localhost:409**。

关闭服务：在运行窗口按 `Ctrl + C`。

> 首次运行如果 `backend/node_modules` 不存在，`run.bat` 会自动执行 `npm i`；国内网络下也可手动进 `backend/` 执行 `cnpm i`（本项目实测 cnpm 在本机 Node 22 下会崩溃，已回退 npm）。

---

## 二、目录结构

```
fullstack-409/
├─ AGENTS.md                 开发规则（本项目的唯一规则来源）
├─ README.md                 本文件
├─ run.bat                   启动后端的批处理
├─ start.bat                 一键启动（检查环境 + 安装依赖 + 启动）
├─ luoyabo_prompt.md         提示词记录（追加写入）
├─ .gitignore                已排除 node_modules 与 backend/.env
├─ frontend/                 前端（express.static 托管）
│  ├─ index.html             首页：项目信息 + 页面导航 + canvas 背景动画
│  ├─ news.html              新闻列表（MySQL）
│  ├─ gallery.html           图片列表（MySQL）
│  ├─ knowledge.html         校园知识库（供 AI 聊天检索）
│  ├─ review.html            商业评论 Excel 上传 + LLM 判定 + 饼图
│  ├─ chat.html              AI 聊天（Claude 风格 / 语音 / 图片 / 56 种语言）
│  ├─ database.html          数据库连接测试
│  ├─ css/                   luo_base.css / luo_index.css / luo_chat.css 等
│  ├─ js/                    luo_canvas.js / luo_chat.js / luo_nav.js 等
│  ├─ fonts/                 图标字体
│  └─ images/                页面配图
└─ backend/
   ├─ app.js                 服务入口（端口 409、跨域、静态托管）
   ├─ config/luo_db.js       MySQL 连接池
   ├─ routes/luo_api.js      API 路由表（全部 /api 前缀）
   ├─ controllers/           数据库 / 新闻 / 图片 / 知识库 / 评论 / 聊天 / 语音
   ├─ .env                   数据库与 LLM 凭据（已被 git 忽略）
   ├─ luo_interface.md       接口记录（追加写入）
   └─ luo_database.md        数据库记录（追加写入）
```

---

## 三、接口

所有接口以 `/api` 为前缀，统一返回：

```json
{ "code": 0, "msg": "提示信息", "data": {} }
```

`code = 0` 表示成功，非 0 表示失败。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查，返回服务名与端口 |
| GET | `/api/db/info` | 读取 `.env` 指向的数据库概况（不含密码），并探一次连接 |
| POST | `/api/db/test` | 用传入的账号密码真实连接 MySQL，成功返回版本与库列表，失败返回中文原因 |

详细参数与响应示例见 `backend/luo_interface.md`。

---

## 四、数据库

- 类型：MySQL（本机已安装的 9.4 实例）
- 库名：`luo_fullstack`（utf8mb4）
- 连接凭据写在 `backend/.env`，变量为 `DB_USER`、`DB_PASSWORD`、`DB_HOST`、`DB_PORT`、`DB_NAME`；该文件已在 `.gitignore` 中，不会进仓库
- 建表语句与测试数据统一记录在 `backend/luo_database.md`

---

## 五、页面

| 页面 | 说明 |
|---|---|
| `index.html` | 项目名称、姓名、学号、项目类别，全部页面的超链接导航，canvas 粒子背景 |
| `news.html` | 新闻列表，数据来自 MySQL `luo_news` |
| `gallery.html` | 图片列表，数据来自 MySQL `luo_gallery` |
| `knowledge.html` | 校园知识库，显示 409 端口，供 AI 聊天检索 |
| `review.html` | 上传商业评论 Excel，LLM 逐条判定好评/中评/差评，SVG 饼图 |
| `chat.html` | Claude 风格 AI 聊天：语音输入、图片识别、56 种回答语言、会话入库 |
| `database.html` | 输入用户名密码测试 MySQL 连接，成功显示版本与库列表，失败显示中文原因与错误码 |

新增页面后，会在 `frontend/index.html` 的导航列表里追加一行（文件名含 `detail` 的页面除外）。

---

## 六、AI 聊天

- 页面：`frontend/chat.html`，整体仿 Claude 皮肤（暖米色侧栏、陶土强调色、衬线标题）
- 语音输入：浏览器录音 → `POST /api/speech` → 硅基流动 `FunAudioLLM/SenseVoiceSmall` 自动识别语言
- 图片识别：前端压缩后随聊天请求发送 → 后端切换 `Qwen/Qwen3-VL-32B-Instruct`
- 文字聊天：`deepseek-ai/DeepSeek-V4-Flash`
- 回答语言：56 种可选，写入 system 提示词；语音识别主要覆盖中/英/粤/日/韩
- 会话与消息存 MySQL，早期对话自动压成摘要；提示词与模型返回都打印在浏览器控制台

---

## 七、开发约定摘要

完整规则见 `AGENTS.md`，要点：

- CSS 类名、JS 变量/函数名、数据库表名统一以 `luo_` 开头
- 每个文件头部写注释块：姓名、学号、时间、大模型
- 记录文件一律追加写入，禁止覆盖：`luoyabo_prompt.md`、`backend/luo_interface.md`、`backend/luo_database.md`
- 服务器返回的数据和错误信息输出到浏览器控制台
