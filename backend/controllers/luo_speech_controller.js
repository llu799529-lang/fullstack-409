/*
 * 姓名：罗亚博 | 学号：409
 * 时间：2026-11-16 | 大模型：DeepSeek-V4.1-Flash
 * 功能名称：语音转文字接口（浏览器录音 → 硅基流动 SenseVoiceSmall）
 */

const multer = require('multer');

const LUO_ASR_URL = process.env.LLM_ASR_URL || 'https://api.siliconflow.cn/v1/audio/transcriptions';
const LUO_ASR_MODEL = process.env.LLM_ASR_MODEL || 'FunAudioLLM/SenseVoiceSmall';
const LUO_ASR_TIMEOUT_MS = 90000;

const luoSpeechUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 }
});

/* 从响应里尽量取到转写文本 */
function luoPickText(luoJson) {
    if (!luoJson) {
        return '';
    }
    if (typeof luoJson.text === 'string') {
        return luoJson.text;
    }
    if (luoJson.data && typeof luoJson.data.text === 'string') {
        return luoJson.data.text;
    }
    return '';
}

async function luoSpeech(req, res) {
    const luoApiKey = process.env.LLM_API_KEY || '';
    if (!luoApiKey) {
        return res.json({ code: 4002, msg: '后端没有配置 LLM_API_KEY', data: null });
    }

    if (!req.file || !req.file.buffer) {
        return res.json({ code: 4001, msg: '没有收到音频文件', data: null });
    }

    if (req.file.buffer.length < 800) {
        return res.json({ code: 4003, msg: '录音太短，请再说一遍', data: null });
    }

    const luoMime = req.file.mimetype || 'audio/webm';
    const luoExt = luoMime.indexOf('mp4') >= 0 ? 'm4a' : (luoMime.indexOf('ogg') >= 0 ? 'ogg' : 'webm');
    const luoStartedAt = Date.now();
    const luoController = new AbortController();
    const luoTimer = setTimeout(function () { luoController.abort(); }, LUO_ASR_TIMEOUT_MS);

    console.log('\n[luo][语音] 收到录音 ' + Math.round(req.file.buffer.length / 1024) + ' KB，类型 ' + luoMime);

    try {
        const luoForm = new FormData();
        luoForm.append('file', new Blob([req.file.buffer], { type: luoMime }), 'luo_voice.' + luoExt);
        luoForm.append('model', LUO_ASR_MODEL);
        luoForm.append('language', 'auto');

        const luoResp = await fetch(LUO_ASR_URL, {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + luoApiKey },
            body: luoForm,
            signal: luoController.signal
        });

        const luoText = await luoResp.text();
        let luoJson = null;
        try { luoJson = JSON.parse(luoText); } catch (e) { luoJson = null; }

        if (luoResp.status < 200 || luoResp.status >= 300) {
            console.error('[luo][语音] 识别失败 HTTP ' + luoResp.status + '：' + luoText.slice(0, 300));
            return res.json({
                code: 5001,
                msg: '语音识别失败 HTTP ' + luoResp.status,
                data: { raw: luoText.slice(0, 500) }
            });
        }

        const luoResult = String(luoPickText(luoJson) || '').trim();
        if (!luoResult) {
            return res.json({ code: 5002, msg: '没有识别到文字，请再说一遍', data: { raw: luoJson } });
        }

        console.log('[luo][语音] 识别完成，耗时 ' + (Date.now() - luoStartedAt) + ' ms：' + luoResult.slice(0, 120));

        return res.json({
            code: 0,
            msg: 'ok',
            data: {
                text: luoResult,
                model: LUO_ASR_MODEL,
                language: (luoJson && luoJson.language) || 'auto',
                elapsed: Date.now() - luoStartedAt
            }
        });
    } catch (luoErr) {
        const luoAborted = luoErr && (luoErr.name === 'AbortError' || luoErr.message === 'TIMEOUT');
        console.error('[luo][语音] 异常：' + (luoAborted ? '超时' : luoErr.message));
        return res.json({
            code: 5003,
            msg: luoAborted ? '语音识别超时，请重试' : ('语音识别失败：' + luoErr.message),
            data: { elapsed: Date.now() - luoStartedAt }
        });
    } finally {
        clearTimeout(luoTimer);
    }
}

module.exports = {
    luoSpeechUpload: luoSpeechUpload,
    luoSpeech: luoSpeech
};
