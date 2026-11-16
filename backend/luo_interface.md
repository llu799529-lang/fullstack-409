# 接口记录

> 每次创建或修改接口后，在本文件末尾追加，禁止覆盖已有内容。
> 追加格式：`接口路径 | HTTP 方法 | 请求参数（含示例）| 响应格式（含 JSON 示例）| 修改时间`

---

## GET /api/health

- 接口路径：`/api/health`
- HTTP 方法：`GET`
- 请求参数：无

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": { "service": "luo-fullstack-409", "port": 409, "time": "2026-11-09T05:54:04.930Z" }
}
```

修改时间：2026-11-09 13:55

---

## GET /api/db/info

- 接口路径：`/api/db/info`
- HTTP 方法：`GET`
- 请求参数：无（读取 backend/.env 中的 DB_HOST / DB_PORT / DB_USER / DB_NAME，不含密码）

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "database": "luo_fullstack",
    "connected": true,
    "version": "9.4.0",
    "error": null
  }
}
```

修改时间：2026-11-09 13:55

---

## POST /api/db/test

- 接口路径：`/api/db/test`
- HTTP 方法：`POST`
- 请求参数（JSON Body）：

```json
{
  "host": "127.0.0.1",
  "port": 3306,
  "user": "root",
  "password": "你的密码",
  "database": "luo_fullstack"
}
```

`database` 可留空，表示只验证账号密码、不指定库。

成功响应示例（实测 7 ms）：

```json
{
  "code": 0,
  "msg": "连接成功",
  "data": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "version": "9.4.0",
    "currentUser": "root@localhost",
    "database": "luo_fullstack",
    "databases": ["deepsea_explorer", "hongmeng", "luo_fullstack", "..."],
    "elapsed": 7
  }
}
```

失败响应示例（密码错误）：

```json
{
  "code": 4003,
  "msg": "用户名或密码错误，MySQL 拒绝了这次登录",
  "data": { "errno": 1045, "code": "ER_ACCESS_DENIED_ERROR", "sqlState": "28000", "elapsed": 10 }
}
```

其他失败码：`4001` 用户名为空、`4002` 主机为空、`4003` 连接失败（含库不存在、服务未启动、超时等，`msg` 均为中文说明）。

修改时间：2026-11-09 13:55

---

## POST /api/db/test（补充：fromEnv 方式）

- 接口路径：`/api/db/test`
- HTTP 方法：`POST`
- 请求参数（JSON Body）：`{ "fromEnv": true }`
- 说明：为 `true` 时，后端直接使用 `backend/.env` 里的 `DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME` 发起连接，
  **密码不下发到浏览器**。响应里的 `data.source` 为 `"env"`；用表单提交时为 `"form"`。

响应示例：

```json
{
  "code": 0,
  "msg": "连接成功",
  "data": {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "version": "9.4.0",
    "currentUser": "root@localhost",
    "database": "luo_fullstack",
    "source": "env",
    "elapsed": 5
  }
}
```

修改时间：2026-11-09 14:35

---

## GET /api/news

- 接口路径：`/api/news`
- HTTP 方法：`GET`
- 请求参数（Query）：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 否 | 分类名：校园 / 通知 / 学术 / 活动 / 就业；不传或传「全部」表示不过滤 |
| `page` | number | 否 | 页码，默认 1 |
| `pageSize` | number | 否 | 每页条数，默认 8，最大 50 |

请求示例：

```
GET http://localhost:409/api/news?category=通知&page=1&pageSize=8
```

响应示例（截取前两条）：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 12,
    "page": 1,
    "pageSize": 8,
    "totalPages": 2,
    "category": "全部",
    "list": [
      {
        "id": 1,
        "title": "学校召开 2026 年秋季学期教学工作会",
        "category": "校园",
        "author": "宣传部",
        "source": "校园新闻网",
        "summary": "会议总结了上学期教学运行情况，部署本学期课程建设与课堂质量提升的重点任务。",
        "views": 1286,
        "is_top": 1,
        "publish_time": "2026-11-08 09:20"
      }
    ],
    "categories": [
      { "name": "学术", "count": 3 },
      { "name": "校园", "count": 3 },
      { "name": "通知", "count": 3 },
      { "name": "活动", "count": 2 },
      { "name": "就业", "count": 1 }
    ],
    "sql": "SELECT id, title, ... FROM luo_news ORDER BY is_top DESC, publish_time DESC LIMIT 8 OFFSET 0;",
    "elapsed": 28
  }
}
```

失败响应示例（分类不存在）：

```json
{ "code": 4001, "msg": "分类不存在：abc", "data": null }
```

说明：`publish_time` 在 SQL 里用 `DATE_FORMAT(publish_time, '%Y-%m-%d %H:%i')` 输出为字符串，避免前后端时区换算差异。

修改时间：2026-11-09 14:42

---

## GET /api/gallery

- 接口路径：`/api/gallery`
- HTTP 方法：`GET`
- 请求参数（Query）：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 否 | 分类：校园 / 建筑 / 风景 / 活动 / 实验；不传或「全部」表示不过滤 |
| `page` | number | 否 | 页码，默认 1 |
| `pageSize` | number | 否 | 每页张数，默认 9，最大 48 |

请求示例：

```
GET http://localhost:409/api/gallery?category=风景&page=1&pageSize=9
```

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 12,
    "page": 1,
    "pageSize": 9,
    "totalPages": 2,
    "category": "全部",
    "list": [
      {
        "id": 1,
        "title": "图书馆的清晨",
        "category": "校园",
        "image_url": "images/gallery/g01.jpg",
        "author": "罗亚博",
        "description": "开馆前的半小时，自习区只有翻书声和窗外的光。",
        "likes": 326,
        "created_at": "2026-11-08 07:30"
      }
    ],
    "categories": [
      { "name": "建筑", "count": 3 },
      { "name": "校园", "count": 3 },
      { "name": "实验", "count": 2 },
      { "name": "活动", "count": 2 },
      { "name": "风景", "count": 2 }
    ],
    "sql": "SELECT id, title, ... FROM luo_gallery ORDER BY id ASC LIMIT 9 OFFSET 0;",
    "elapsed": 25
  }
}
```

失败响应示例（分类不存在）：

```json
{ "code": 4001, "msg": "分类不存在：人物", "data": null }
```

修改时间：2026-11-09 14:46

---

## GET /api/gallery（分类调整）

分类白名单改为：`风景` / `动物` / `生活` / `食物`（原「校园/建筑/活动/实验」不再接受，传旧值会返回 4001）。

修改时间：2026-11-09 14:52

---

## POST /api/chat

- 接口路径：`/api/chat`
- HTTP 方法：`POST`
- 说明：代理硅基流动 `https://api.siliconflow.cn/v1/chat/completions`，
  密钥从 `backend/.env` 的 `LLM_API_KEY` 读取，**不会下发到浏览器**。
  后端控制台会打印本次请求的完整 messages 与返回的 JSON。

请求体：

```json
{
  "messages": [
    { "role": "system", "content": "你是一个有用的中文助手" },
    { "role": "user", "content": "用一句话说明什么是全栈开发" }
  ],
  "temperature": 0.7,
  "maxTokens": 1024
}
```

`temperature` / `maxTokens` 可省略，默认 0.7 / 1024。

成功响应：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "reply": "全栈开发是指一名开发者同时掌握前端与后端技术……",
    "model": "deepseek-ai/DeepSeek-V4-Flash",
    "usage": { "prompt_tokens": 36, "completion_tokens": 17, "total_tokens": 53 },
    "elapsed": 6175,
    "raw": { "id": "…", "choices": ["…"] }
  }
}
```

失败响应：

| code | 含义 |
|---|---|
| 4001 | messages 为空 |
| 4002 | 后端没有配置 `LLM_API_KEY` |
| 5003 | LLM 返回非 2xx（401 密钥无效 / 402 余额不足 / 429 限流） |
| 5004 | 请求超时（60 秒）或网络异常 |

修改时间：2026-11-12 13:58

---

## 会话管理接口（2026-11-12）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/chat/sessions` | 会话列表，含每条会话的消息数与最后一条内容 |
| POST | `/api/chat/sessions` | 新建会话，body `{ "title": "新的对话" }` |
| PATCH | `/api/chat/sessions/:id` | 重命名，body `{ "title": "新标题" }` |
| DELETE | `/api/chat/sessions/:id` | 删除会话及其全部消息 |
| GET | `/api/chat/sessions/:id/messages` | 某会话的全部消息（按 id 升序） |

`GET /api/chat/sessions` 响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 8,
    "list": [
      { "id": 8, "title": "帮我润色一段项目总结", "created_at": "11-12 11:00",
        "updated_at": "11-12 11:03", "msg_count": 2, "last_msg": "本项目基于前后端分离架构完成……" }
    ]
  }
}
```

`POST /api/chat` 追加参数：`sessionId`（可选，传入则把用户消息与模型回复写入数据库），
响应新增 `compressed`（被压缩掉的历史条数）与 `sentCount`（实际发给模型的消息条数）。

修改时间：2026-11-12 14:40

---

## GET /api/knowledge

- 接口路径：`/api/knowledge`
- HTTP 方法：`GET`
- 说明：校园知识库列表，支持分类筛选、关键词检索、分页。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `category` | string | 否 | 校园服务 / 教务 / 网络 / 生活 / 就业 / 奖助 / 实验；不传或「全部」不过滤 |
| `q` | string | 否 | 检索关键词，命中后按匹配度降序，只返回命中的条目 |
| `page` | number | 否 | 页码，默认 1 |
| `pageSize` | number | 否 | 每页条数，默认 8，最大 50 |

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 14,
    "allTotal": 14,
    "page": 1,
    "pageSize": 8,
    "totalPages": 2,
    "category": "全部",
    "query": "",
    "port": 409,
    "list": [
      {
        "id": 1,
        "title": "图书馆开放时间",
        "category": "校园服务",
        "keywords": "图书馆,开放时间,几点,闭馆,开馆,自习",
        "content": "图书馆周一至周日 7:30 开馆，22:00 闭馆；期末考试周（12 月 15 日至 31 日）延长至 23:00……",
        "source": "图书馆公告",
        "updated_at": "2026-11-05 10:30"
      }
    ],
    "categories": [{ "name": "教务", "count": 4 }, { "name": "生活", "count": 4 }],
    "sql": "SELECT id, title, ... FROM luo_knowledge ORDER BY id ASC LIMIT 8 OFFSET 0;",
    "elapsed": 56
  }
}
```

`data.port` 是后端实际监听的端口（409），页面顶部的「端口 409」徽章就是读这个字段。

修改时间：2026-11-12 15:00

---

## GET /api/knowledge/search

- 接口路径：`/api/knowledge/search`
- HTTP 方法：`GET`
- 说明：只做检索、不分页，返回 Top 3 命中片段，方便单独验证打分逻辑。

请求示例：`GET /api/knowledge/search?q=图书馆几点关门`

响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "query": "图书馆几点关门",
    "hitCount": 2,
    "hits": [
      {
        "id": 1,
        "title": "图书馆开放时间",
        "category": "校园服务",
        "score": 9.7,
        "matched": ["图书馆", "几点", "标题匹配×2"],
        "content": "图书馆周一至周日 7:30 开馆，22:00 闭馆……"
      }
    ],
    "elapsed": 2
  }
}
```

修改时间：2026-11-12 15:00

---

## POST /api/chat（新增 knowledge 字段）

请求体不变。响应 `data` 新增：

```json
{
  "knowledge": {
    "query": "图书馆几点关门？",
    "injected": true,
    "tookMs": 2,
    "hitCount": 2,
    "hits": [
      { "id": 1, "title": "图书馆开放时间", "score": 9.7, "matched": ["图书馆", "几点"], "content": "……" }
    ]
  }
}
```

后端会在把 messages 发给模型之前，先把命中的知识片段拼到 system 提示词末尾；
未命中时 `injected` 为 `false`，行为与之前一致。

修改时间：2026-11-12 15:00

---

## POST /api/review/analyze

- 接口路径：`/api/review/analyze`
- HTTP 方法：`POST`，`multipart/form-data`
- 参数：`file` 字段，`.xlsx` / `.xls`，上限 5 MB
- 说明：解析第一个工作表 → 按每批 10 条**并发**调用大模型 → 合并结果并汇总。
- 表头需包含「评论内容」；`评分` / `用户昵称` / `评论时间` 可选。

成功响应（截取）：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "fileName": "商业评论-模拟数据1-电商商品.xlsx",
    "sheetName": "评论",
    "total": 20,
    "summary": { "total": 20, "good": 11, "neutral": 4, "bad": 5, "featured": 13, "avgScore": 63 },
    "results": [
      { "id": 1, "label": "好评", "score": 88, "reason": "保温效果具体可验证，有使用时长", "featured": true,
        "content": "保温杯用了两周……", "user": "小满", "rating": "5", "time": "2026-11-02 09:12" }
    ],
    "featured": ["…按情感分排序的前 6 条…"],
    "batches": 2,
    "batchSize": 10,
    "model": "deepseek-ai/DeepSeek-V4-Flash",
    "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 2799 },
    "elapsed": 17009,
    "promptSample": "发送给大模型的提示词（第 1 批）",
    "responseSamples": [{ "batch": 1, "content": "{\"results\":[…]}" }]
  }
}
```

失败码：

| code | 含义 |
|---|---|
| 4001 | 没有收到文件 |
| 4002 | 后端未配置 LLM_API_KEY |
| 4003 | Excel 解析失败（空表 / 没有「评论内容」列） |
| 5003 | 大模型返回非 2xx |
| 5004 | 模型返回的不是预期 JSON |
| 5005 | 调用超时（150 秒）或网络异常 |

模型输出约定：`{"results":[{"id":1,"label":"好评|中评|差评","score":0-100,"reason":"…","featured":true}]}`，
后端按 `id` 对齐，缺失或非法标签用分数/评分兜底。

修改时间：2026-11-16 14:00

---

## GET /api/review/samples

返回模板与 3 个模拟数据的下载地址（4 个文件都在项目根目录）。

## GET /api/review/download?file=

按白名单下载根目录的 Excel（模板 / 3 个模拟数据）。白名单外的文件名返回 404。

修改时间：2026-11-16 14:00

---

## POST /api/chat（新增语音、图片、56 种语言）

- 接口路径：`/api/chat`
- HTTP 方法：`POST`，`application/json`
- 请求参数（在原有多轮 messages 基础上新增）：

```json
{
  "sessionId": 12,
  "language": { "code": "en", "name": "English" },
  "image": {
    "dataUrl": "data:image/jpeg;base64,...",
    "name": "photo.jpg"
  },
  "messages": [
    { "role": "system", "content": "你是一个有用的中文助手。" },
    { "role": "user", "content": "这张图里是什么？ [图片]" }
  ]
}
```

- `language`：56 种回答语言之一；中文不额外提示，其它语言会写入 system 提示词。
- `image`：可选，jpg/png/webp/gif 的 base64，上限约 9 MB；有图片时自动切换 `Qwen/Qwen3-VL-32B-Instruct`，超时 90 秒；无图片仍用 `deepseek-ai/DeepSeek-V4-Flash`。
- 响应新增字段：`vision`（是否走了图片模型）、`language`、`languageName`、`sentCount`。

响应示例（截取）：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "reply": "这张图片是……",
    "model": "Qwen/Qwen3-VL-32B-Instruct",
    "vision": true,
    "language": "zh",
    "languageName": "简体中文",
    "elapsed": 8200
  }
}
```

修改时间：2026-11-16 14:40

---

## POST /api/speech

- 接口路径：`/api/speech`
- HTTP 方法：`POST`，`multipart/form-data`
- 请求参数：`audio` 字段，浏览器录音（webm / mp4 / ogg），上限 15 MB
- 说明：调用硅基流动 `FunAudioLLM/SenseVoiceSmall`，`language=auto` 自动识别语言，返回转写文本。

成功响应示例：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "text": "你好，请帮我介绍一下这个页面能做什么。",
    "model": "FunAudioLLM/SenseVoiceSmall",
    "language": "Chinese",
    "elapsed": 1563
  }
}
```

失败码：4001 未收到音频、4002 未配置 LLM_API_KEY、4003 录音太短、5001 ASR 非 2xx、5002 没识别到文字、5003 超时或网络异常。

修改时间：2026-11-16 14:40
