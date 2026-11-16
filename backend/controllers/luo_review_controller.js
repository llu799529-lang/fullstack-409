/**
 * 姓名：罗亚博 | 学号：409
 * 建立时间：2026-11-16
 * 大模型：DeepSeek-V4.1-Flash
 * 功能：商业评论 Excel 上传 → 解析 → 调 LLM 逐条判定好评/中评/差评 → 汇总返回
 */

const https = require('https');
const { URL } = require('url');
const multer = require('multer');
const XLSX = require('xlsx');
const luoDb = require('../config/luo_db');

const LUO_TIMEOUT_MS = 150000;
const LUO_BATCH_SIZE = 10;          // 每批 10 条：20 条只发 2 批，两批并发一次跑完
const LUO_MAX_ROWS = 200;           // 单文件最多处理 200 条

/* 内存存储：文件不落盘，解析完即丢弃 */
const luoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }
});

/* ---------------- 工具 ---------------- */

function luoPostJson(luoUrl, luoPayload, luoApiKey, luoTimeout) {
    return new Promise(function (resolve, reject) {
        const luoTarget = new URL(luoUrl);
        const luoBody = JSON.stringify(luoPayload);

        const luoReq = https.request({
            hostname: luoTarget.hostname,
            port: luoTarget.port || 443,
            path: luoTarget.pathname + luoTarget.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(luoBody),
                Authorization: 'Bearer ' + luoApiKey,
                Connection: 'close'
            },
            timeout: luoTimeout
        }, function (luoRes) {
            let luoText = '';
            luoRes.setEncoding('utf8');
            luoRes.on('data', function (chunk) { luoText += chunk; });
            luoRes.on('end', function () {
                resolve({ status: luoRes.statusCode, text: luoText });
            });
        });

        luoReq.on('timeout', function () { luoReq.destroy(new Error('TIMEOUT')); });
        luoReq.on('error', reject);
        luoReq.write(luoBody);
        luoReq.end();
    });
}

/* 从模型输出里抠出 JSON：兼容 ```json 包裹、前后多余说明 */
function luoExtractJson(luoText) {
    if (!luoText) return null;

    let luoClean = String(luoText).trim();
    luoClean = luoClean.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    try {
        return JSON.parse(luoClean);
    } catch (e) {
        /* 退一步：找第一个 { 到最后一个 } */
        const luoStart = luoClean.indexOf('{');
        const luoEnd = luoClean.lastIndexOf('}');
        if (luoStart >= 0 && luoEnd > luoStart) {
            try {
                return JSON.parse(luoClean.slice(luoStart, luoEnd + 1));
            } catch (e2) {
                return null;
            }
        }
        return null;
    }
}

/* 在表头里找目标列：先精确匹配，再模糊包含 */
function luoPickColumn(luoKeys, luoCandidates) {
    for (const luoCand of luoCandidates) {
        const luoHit = luoKeys.find(function (luoKey) {
            return String(luoKey).trim().toLowerCase() === luoCand.toLowerCase();
        });
        if (luoHit) return luoHit;
    }
    for (const luoCand of luoCandidates) {
        const luoHit = luoKeys.find(function (luoKey) {
            return String(luoKey).indexOf(luoCand) >= 0;
        });
        if (luoHit) return luoHit;
    }
    return null;
}

/* 解析 Excel Buffer → 评论数组 */
function luoParseWorkbook(luoBuffer) {
    const luoWb = XLSX.read(luoBuffer, { type: 'buffer', cellDates: false });
    const luoSheetName = luoWb.SheetNames[0];
    const luoSheet = luoWb.Sheets[luoSheetName];

    if (!luoSheet) {
        throw new Error('Excel 里没有可读的工作表');
    }

    const luoRows = XLSX.utils.sheet_to_json(luoSheet, { defval: '', raw: false });

    if (!luoRows.length) {
        throw new Error('这个工作表是空的，第 1 行应为表头，第 2 行起为评论');
    }

    const luoKeys = Object.keys(luoRows[0]);
    const luoContentCol = luoPickColumn(luoKeys, ['评论内容', '评论', '内容', 'content', 'comment', '评价']);
    const luoUserCol = luoPickColumn(luoKeys, ['用户昵称', '用户', '昵称', 'user', 'name']);
    const luoRatingCol = luoPickColumn(luoKeys, ['评分', '星级', 'rating', 'score']);
    const luoTimeCol = luoPickColumn(luoKeys, ['评论时间', '时间', '日期', 'time', 'date']);

    if (!luoContentCol) {
        throw new Error('没找到「评论内容」列。表头需包含：序号 / 评论内容 / 评分 / 用户昵称 / 评论时间');
    }

    const luoReviews = [];
    luoRows.forEach(function (luoRow, luoIdx) {
        const luoContent = String(luoRow[luoContentCol] || '').trim();
        if (!luoContent) return;
        if (luoReviews.length >= LUO_MAX_ROWS) return;

        luoReviews.push({
            id: luoReviews.length + 1,
            content: luoContent,
            user: luoUserCol ? String(luoRow[luoUserCol] || '').trim() : '',
            rating: luoRatingCol ? String(luoRow[luoRatingCol] || '').trim() : '',
            time: luoTimeCol ? String(luoRow[luoTimeCol] || '').trim() : ''
        });
    });

    if (!luoReviews.length) {
        throw new Error('「评论内容」列没有有效数据');
    }

    return { sheetName: luoSheetName, reviews: luoReviews, columns: { luoContentCol, luoUserCol, luoRatingCol, luoTimeCol } };
}

/* 组装 prompt —— 这是「发送给大模型的数据」的核心 */
function luoBuildPrompt(luoBatch, luoOffset) {
    const luoList = luoBatch.map(function (luoItem) {
        return { id: luoItem.id, content: luoItem.content, rating: luoItem.rating || undefined };
    });

    return '你是商业评论情感分析引擎。对下面每条评论判断情感倾向，只输出 JSON。\n\n'
        + '判定规则：\n'
        + '1. label 只能是「好评」「中评」「差评」之一。\n'
        + '2. score 是 0-100 的情感分：好评 70-100，中评 40-69，差评 0-39。\n'
        + '3. reason 用一句不超过 30 字的中文说明判断依据，要具体，不要套话。\n'
        + '4. featured 表示是否「有价值的精选评论」：只要讲出了具体体验细节'
        + '（时间、型号、用法、分量、价格、售后经历等）或明确点出了具体优缺点，就判 true；'
        + '只有情绪宣泄、只有一句「很好」「不行」、没有任何信息量的判 false。'
        + '按每条评论本身的信息量独立判断，不要为了凑比例而放宽或收紧。\n'
        + '5. 必须为输入里的每个 id 输出一条，不要新增、不要遗漏。\n\n'
        + '输出格式（严格遵守，不要加代码块标记，不要加解释文字）：\n'
        + '{"results":[{"id":1,"label":"好评","score":86,"reason":"...","featured":true}]}\n\n'
        + '评论列表（本批 ' + luoBatch.length + ' 条，id 从 ' + luoOffset + ' 开始）：\n'
        + JSON.stringify(luoList);
}

/* 规范化模型返回的一条结果 */
function luoNormalize(luoItem, luoReview) {
    const luoLabelRaw = String(luoItem.label || '').trim();
    const luoMap = { '好评': '好评', '正面': '好评', 'positive': '好评', '中评': '中评', '中性': '中评', 'neutral': '中评', '差评': '差评', '负面': '差评', 'negative': '差评' };
    let luoLabel = luoMap[luoLabelRaw] || '';

    let luoScore = Number(luoItem.score);
    if (!isFinite(luoScore)) luoScore = null;
    if (luoScore !== null) luoScore = Math.max(0, Math.min(100, Math.round(luoScore)));

    if (!luoLabel) {
        /* 模型没给合法标签就用分数兜底，再不行按评分兜底，最后给中评 */
        if (luoScore !== null) {
            luoLabel = luoScore >= 70 ? '好评' : (luoScore >= 40 ? '中评' : '差评');
        } else {
            const luoRating = Number(luoReview.rating);
            luoLabel = luoRating >= 4 ? '好评' : (luoRating <= 2 ? '差评' : '中评');
        }
    }

    if (luoScore === null) {
        luoScore = luoLabel === '好评' ? 80 : (luoLabel === '中评' ? 55 : 25);
    }

    return {
        id: luoReview.id,
        label: luoLabel,
        score: luoScore,
        reason: String(luoItem.reason || '').trim().slice(0, 80) || '模型未给出具体理由',
        featured: luoItem.featured === true || luoItem.featured === 'true'
    };
}


/* multer 按 latin1 解码文件名，中文会变乱码，这里转回 UTF-8 */
function luoFixFileName(luoName) {
    const luoRaw = String(luoName || '');
    try {
        const luoUtf8 = Buffer.from(luoRaw, 'latin1').toString('utf8');
        /* 转换后出现替换字符说明原串本来就是正常中文，保留原值 */
        return luoUtf8.indexOf('\uFFFD') >= 0 ? luoRaw : luoUtf8;
    } catch (e) {
        return luoRaw;
    }
}

/* ---------------- 主流程 ---------------- */


async function luoAnalyze(req, res) {
    const luoStartedAt = Date.now();

    if (!req.file) {
        return res.json({ code: 4001, msg: '没有收到文件，请选择 .xlsx 或 .xls', data: null });
    }

    const luoApiKey = process.env.LLM_API_KEY || '';
    if (!luoApiKey) {
        return res.json({ code: 4002, msg: '后端没有配置 LLM_API_KEY', data: null });
    }

    let luoParsed;
    try {
        luoParsed = luoParseWorkbook(req.file.buffer);
    } catch (luoErr) {
        return res.json({ code: 4003, msg: '解析 Excel 失败：' + luoErr.message, data: null });
    }

    const luoReviews = luoParsed.reviews;
    const luoFileName = luoFixFileName(req.file.originalname);
    console.log('\n[luo][评论分析] 文件 ' + luoFileName + '　共 ' + luoReviews.length + ' 条');
    console.log('  识别到的列：', luoParsed.columns);

    /* 分批送模型 */
    const luoBatches = [];
    for (let luoI = 0; luoI < luoReviews.length; luoI += LUO_BATCH_SIZE) {
        luoBatches.push(luoReviews.slice(luoI, luoI + LUO_BATCH_SIZE));
    }

    const luoResults = [];
    const luoUsageTotal = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const luoRawSamples = [];
    let luoModelUsed = '';

    /* 先把所有批次的请求体准备好，再并发发出去：串行 3 批要等 3 次，并发只等最慢的那一批 */
    const luoPayloads = luoBatches.map(function (luoBatch, luoBi) {
        const luoPrompt = luoBuildPrompt(luoBatch, luoBi * LUO_BATCH_SIZE + 1);
        return {
            prompt: luoPrompt,
            body: {
                model: process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V4-Flash',
                messages: [
                    { role: 'system', content: '你是严谨的商业评论情感分析引擎，只输出 JSON，不输出任何解释。' },
                    { role: 'user', content: luoPrompt }
                ],
                stream: false,
                temperature: 0.2,
                max_tokens: 1600,
                response_format: { type: 'json_object' }
            }
        };
    });

    luoPayloads.forEach(function (luoItem, luoBi) {
        console.log('\n[luo][评论分析] 第 ' + (luoBi + 1) + '/' + luoBatches.length + ' 批，'
            + luoBatches[luoBi].length + ' 条');
        console.log('  发送给大模型的提示词：\n' + luoItem.prompt);
    });

    try {
        const luoRespList = await Promise.all(luoPayloads.map(function (luoItem) {
            return luoPostJson(
                process.env.LLM_BASE_URL || 'https://api.siliconflow.cn/v1/chat/completions',
                luoItem.body,
                luoApiKey,
                LUO_TIMEOUT_MS
            );
        }));

        console.log('[luo][评论分析] ' + luoBatches.length + ' 批已并发返回，开始解析');

        for (let luoBi = 0; luoBi < luoBatches.length; luoBi++) {
            const luoBatch = luoBatches[luoBi];
            const luoPayload = luoPayloads[luoBi].body;
            const luoResp = luoRespList[luoBi];

            if (luoResp.status < 200 || luoResp.status >= 300) {
                console.error('[luo][评论分析] LLM HTTP ' + luoResp.status + '：' + luoResp.text.slice(0, 200));
                return res.json({
                    code: 5003,
                    msg: '大模型接口返回 HTTP ' + luoResp.status + '（' + luoResp.text.slice(0, 120) + '）',
                    data: { failedBatch: luoBi + 1 }
                });
            }

            const luoJson = JSON.parse(luoResp.text);
            const luoChoice = luoJson.choices && luoJson.choices[0];
            const luoContent = luoChoice && luoChoice.message ? luoChoice.message.content : '';

            console.log('[luo][评论分析] 第 ' + (luoBi + 1) + ' 批返回原始内容：\n' + luoContent);

            if (luoJson.usage) {
                luoUsageTotal.prompt_tokens += luoJson.usage.prompt_tokens || 0;
                luoUsageTotal.completion_tokens += luoJson.usage.completion_tokens || 0;
                luoUsageTotal.total_tokens += luoJson.usage.total_tokens || 0;
            }
            luoModelUsed = luoJson.model || luoPayload.model;

            const luoParsedJson = luoExtractJson(luoContent);
            if (!luoParsedJson || !Array.isArray(luoParsedJson.results)) {
                console.error('[luo][评论分析] 第 ' + (luoBi + 1) + ' 批 JSON 解析失败');
                return res.json({
                    code: 5004,
                    msg: '模型返回的不是预期的 JSON 结构（第 ' + (luoBi + 1) + ' 批），原始内容：' + String(luoContent).slice(0, 200),
                    data: { failedBatch: luoBi + 1 }
                });
            }

            if (luoRawSamples.length < 2) {
                luoRawSamples.push({ batch: luoBi + 1, content: luoContent });
            }

            /* 按 id 对齐，模型漏掉的用兜底 */
            const luoById = {};
            luoParsedJson.results.forEach(function (luoItem) {
                const luoId = Number(luoItem.id);
                if (luoId) luoById[luoId] = luoItem;
            });

            luoBatch.forEach(function (luoReview) {
                const luoItem = luoById[luoReview.id] || {};
                const luoNormalized = luoNormalize(luoItem, luoReview);
                luoResults.push(Object.assign({
                    content: luoReview.content,
                    user: luoReview.user,
                    rating: luoReview.rating,
                    time: luoReview.time
                }, luoNormalized));
            });
        }
    } catch (luoErr) {
        const luoTimeout = luoErr && luoErr.message === 'TIMEOUT';
        console.error('[luo][评论分析] 异常：', luoErr.message);
        return res.json({
            code: 5005,
            msg: luoTimeout ? ('调用大模型超时（' + Math.round(LUO_TIMEOUT_MS / 1000) + ' 秒），请减少评论条数后重试') : ('调用大模型失败：' + luoErr.message),
            data: { done: luoResults.length }
        });
    }

    /* 汇总 */
    const luoSummary = { total: luoResults.length, good: 0, neutral: 0, bad: 0, featured: 0, avgScore: 0 };
    let luoScoreSum = 0;

    luoResults.forEach(function (luoItem) {
        if (luoItem.label === '好评') luoSummary.good += 1;
        else if (luoItem.label === '中评') luoSummary.neutral += 1;
        else luoSummary.bad += 1;
        if (luoItem.featured) luoSummary.featured += 1;
        luoScoreSum += luoItem.score;
    });
    luoSummary.avgScore = luoResults.length ? Math.round(luoScoreSum / luoResults.length) : 0;

    /* 精选数量上限：模型可能全判 true，这里按「正文 + 理由」长度取前 35%，最少 3 条 */
    const luoFeaturedLimit = Math.max(3, Math.round(luoResults.length * 0.35));
    const luoTrueList = luoResults.filter(function (luoItem) { return luoItem.featured; });

    if (luoTrueList.length > luoFeaturedLimit) {
        const luoKeepIds = {};
        luoTrueList
            .slice()
            .sort(function (luoA, luoB) {
                const luoLenA = String(luoA.content).length + String(luoA.reason).length;
                const luoLenB = String(luoB.content).length + String(luoB.reason).length;
                return luoLenB - luoLenA;
            })
            .slice(0, luoFeaturedLimit)
            .forEach(function (luoItem) { luoKeepIds[luoItem.id] = true; });

        luoResults.forEach(function (luoItem) {
            luoItem.featured = !!luoKeepIds[luoItem.id];
        });
    }

    /* 重新统计精选数（上面的裁剪会改 featured） */
    luoSummary.featured = luoResults.filter(function (luoItem) { return luoItem.featured; }).length;

    /* 精选展示：featured 按 score 降序，取 6 条 */
    const luoFeatured = luoResults
        .filter(function (luoItem) { return luoItem.featured; })
        .sort(function (luoA, luoB) { return luoB.score - luoA.score; })
        .slice(0, 6);

    const luoElapsed = Date.now() - luoStartedAt;

    luoSaveHistory(luoFileName, luoSummary);

    console.log('\n[luo][评论分析] 完成：' + luoSummary.total + ' 条（好评 ' + luoSummary.good
        + ' / 中评 ' + luoSummary.neutral + ' / 差评 ' + luoSummary.bad + '），精选 '
        + luoSummary.featured + ' 条，平均分 ' + luoSummary.avgScore + '，耗时 ' + luoElapsed + ' ms');

    return res.json({
        code: 0,
        msg: 'ok',
        data: {
            fileName: luoFileName,
            sheetName: luoParsed.sheetName,
            total: luoSummary.total,
            summary: luoSummary,
            results: luoResults,
            featured: luoFeatured,
            batches: luoBatches.length,
            batchSize: LUO_BATCH_SIZE,
            model: luoModelUsed,
            usage: luoUsageTotal,
            elapsed: luoElapsed,
            promptSample: luoBuildPrompt(luoBatches[0], 1),
            responseSamples: luoRawSamples
        }
    });
}

/* 下载模板 / 模拟数据（从项目根目录读，不放进 frontend 避免被 static 直接暴露） */
const LUO_TEMPLATE_FILE = '商业评论-导入模板.xlsx';
const LUO_SAMPLES = [
    { file: '商业评论-模拟数据1-电商商品.xlsx', label: '模拟数据 1 · 电商商品评论', desc: '保温杯的 20 条真实感评论' },
    { file: '商业评论-模拟数据2-餐饮服务.xlsx', label: '模拟数据 2 · 餐饮服务评论', desc: '火锅店的 20 条到店体验评论' },
    { file: '商业评论-模拟数据3-应用软件.xlsx', label: '模拟数据 3 · 应用软件评论', desc: '记账 App 的 20 条商店评论' }
];

function luoListSamples(req, res) {
    return res.json({
        code: 0,
        msg: 'ok',
        data: {
            template: { file: LUO_TEMPLATE_FILE, url: '/api/review/download?file=' + encodeURIComponent(LUO_TEMPLATE_FILE) },
            samples: LUO_SAMPLES.map(function (luoItem) {
                return Object.assign({}, luoItem, {
                    url: '/api/review/download?file=' + encodeURIComponent(luoItem.file)
                });
            })
        }
    });
}

function luoDownload(req, res) {
    const path = require('path');
    const luoFile = String(req.query.file || '');

    const luoAllowed = [LUO_TEMPLATE_FILE].concat(LUO_SAMPLES.map(function (luoItem) { return luoItem.file; }));
    if (luoAllowed.indexOf(luoFile) === -1) {
        return res.status(404).json({ code: 4041, msg: '文件不在可下载清单里' });
    }

    const luoPath = path.join(__dirname, '..', '..', luoFile);
    res.download(luoPath, luoFile, function (luoErr) {
        if (luoErr && !res.headersSent) {
            console.error('[luo] 下载失败：', luoErr.message);
            res.status(500).json({ code: 5001, msg: '文件读取失败，请确认根目录下存在 ' + luoFile });
        }
    });
}

/* 历史记录：把每次分析结果落库，可选 */
async function luoSaveHistory(luoFile, luoSummary) {
    try {
        await luoDb.luoPool.query(
            'INSERT INTO luo_review_batch (file_name, total, good, neutral, bad, featured, avg_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
            [luoFile, luoSummary.total, luoSummary.good, luoSummary.neutral, luoSummary.bad, luoSummary.featured, luoSummary.avgScore]
        );
    } catch (luoErr) {
        console.warn('[luo] 评论批次落库失败（可忽略）：', luoErr.message);
    }
}

module.exports = {
    luoUpload,
    luoAnalyze,
    luoListSamples,
    luoDownload,
    luoSaveHistory
};
