/**
 * 姓名：罗亚博 | 学号：409
 * 建立时间：2026-11-16
 * 大模型：DeepSeek-V4.1-Flash
 * 功能：商业评论分析页逻辑（上传 Excel → 调 /api/review/analyze → SVG 饼图 + 精选 + 明细）
 */

(function () {
    'use strict';

    var luoPickedFile = null;
    var luoAnalyzing = false;

    var LUO_COLORS = {
        '好评': '#0b8a5c',
        '中评': '#e8a33d',
        '差评': '#c0392b'
    };

    var luoFilesEl = document.getElementById('luoFiles');
    var luoDrop = document.getElementById('luoDrop');
    var luoFileInput = document.getElementById('luoFileInput');
    var luoDropFile = document.getElementById('luoDropFile');
    var luoAnalyzeBtn = document.getElementById('luoAnalyzeBtn');
    var luoResetBtn = document.getElementById('luoResetBtn');
    var luoStatus = document.getElementById('luoStatus');
    var luoResult = document.getElementById('luoResult');
    var luoResultMeta = document.getElementById('luoResultMeta');
    var luoPieSlices = document.getElementById('luoPieSlices');
    var luoPieTotal = document.getElementById('luoPieTotal');
    var luoLegend = document.getElementById('luoLegend');
    var luoTableBody = document.getElementById('luoTableBody');
    var luoFeaturedEl = document.getElementById('luoFeatured');
    var luoRawEl = document.getElementById('luoRaw');
    var luoRawHint = document.getElementById('luoRawHint');
    var luoRawBox = document.getElementById('luoRawBox');

    function luoEscape(luoStr) {
        return String(luoStr == null ? '' : luoStr)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function luoFmtSize(luoBytes) {
        if (luoBytes < 1024) return luoBytes + ' B';
        if (luoBytes < 1024 * 1024) return (luoBytes / 1024).toFixed(1) + ' KB';
        return (luoBytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    /* ---------------- 文件清单 ---------------- */

    function luoRenderFiles(luoData) {
        var luoItems = [{
            name: luoData.template.file,
            desc: '导入模板 · 表头 + 1 条示例，照它填就行',
            url: luoData.template.url
        }].concat(luoData.samples.map(function (luoSample) {
            return { name: luoSample.file, desc: luoSample.desc, url: luoSample.url };
        }));

        luoFilesEl.innerHTML = luoItems.map(function (luoItem) {
            return '<a class="luo_file" href="' + luoItem.url + '" download>'
                + '<span class="luo_file_icon">XLSX</span>'
                + '<span class="luo_file_body">'
                +   '<span class="luo_file_name">' + luoEscape(luoItem.name) + '</span>'
                +   '<span class="luo_file_desc">' + luoEscape(luoItem.desc) + '</span>'
                + '</span>'
                + '<span class="luo_file_go">下载</span>'
                + '</a>';
        }).join('');
    }

    fetch('/api/review/samples', { cache: 'no-store' })
        .then(function (luoRes) { return luoRes.json(); })
        .then(function (luoJson) {
            if (luoJson.code === 0) {
                luoRenderFiles(luoJson.data);
                console.log('[luo] 可下载文件：', luoJson.data);
            } else {
                throw new Error(luoJson.msg || '文件清单读取失败');
            }
        })
        .catch(function (luoErr) {
            luoFilesEl.innerHTML = '<p class="luo_empty">文件清单读取失败：'
                + luoEscape(luoErr.message)
                + '　（线上没有后端，本地运行 start.bat 后即可下载）</p>';
        });

    /* ---------------- 选择文件 ---------------- */

    function luoSetFile(luoFile) {
        if (!luoFile) return;

        var luoName = luoFile.name.toLowerCase();
        if (!luoName.endsWith('.xlsx') && !luoName.endsWith('.xls')) {
            luoStatus.textContent = '只支持 .xlsx 和 .xls';
            luoStatus.className = 'luo_status err';
            return;
        }

        luoPickedFile = luoFile;
        luoDropFile.textContent = luoFile.name + '　' + luoFmtSize(luoFile.size);
        luoAnalyzeBtn.disabled = false;
        luoStatus.textContent = '已选择文件，点「开始分析」';
        luoStatus.className = 'luo_status';
    }

    luoDrop.addEventListener('click', function () {
        luoFileInput.click();
    });

    luoFileInput.addEventListener('change', function () {
        luoSetFile(luoFileInput.files && luoFileInput.files[0]);
    });

    ['dragenter', 'dragover'].forEach(function (luoEvt) {
        luoDrop.addEventListener(luoEvt, function (luoEv) {
            luoEv.preventDefault();
            luoDrop.classList.add('on');
        });
    });

    ['dragleave', 'drop'].forEach(function (luoEvt) {
        luoDrop.addEventListener(luoEvt, function (luoEv) {
            luoEv.preventDefault();
            luoDrop.classList.remove('on');
        });
    });

    luoDrop.addEventListener('drop', function (luoEv) {
        var luoFiles = luoEv.dataTransfer && luoEv.dataTransfer.files;
        if (luoFiles && luoFiles.length) {
            luoSetFile(luoFiles[0]);
        }
    });

    /* ---------------- 饼图 ---------------- */

    function luoDrawPie(luoSummary) {
        var luoSegments = [
            { label: '好评', value: luoSummary.good, color: LUO_COLORS['好评'] },
            { label: '中评', value: luoSummary.neutral, color: LUO_COLORS['中评'] },
            { label: '差评', value: luoSummary.bad, color: LUO_COLORS['差评'] }
        ].filter(function (luoSeg) { return luoSeg.value > 0; });

        var luoTotal = luoSummary.total || 1;
        var luoR = 82;
        var luoC = 2 * Math.PI * luoR;
        var luoOffset = 0;

        luoPieSlices.innerHTML = '';

        /* 底环，避免某类为 0 时看起来是断的 */
        luoPieSlices.innerHTML += '<circle cx="120" cy="120" r="' + luoR + '" fill="none" '
            + 'stroke="#f0f3f8" stroke-width="30"/>';

        luoSegments.forEach(function (luoSeg) {
            var luoLen = luoC * (luoSeg.value / luoTotal);
            var luoCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');

            luoCircle.setAttribute('cx', '120');
            luoCircle.setAttribute('cy', '120');
            luoCircle.setAttribute('r', String(luoR));
            luoCircle.setAttribute('fill', 'none');
            luoCircle.setAttribute('stroke', luoSeg.color);
            luoCircle.setAttribute('stroke-width', '30');
            luoCircle.setAttribute('stroke-dasharray', luoLen + ' ' + (luoC - luoLen));
            luoCircle.setAttribute('stroke-dashoffset', String(-luoOffset));
            luoCircle.setAttribute('transform', 'rotate(-90 120 120)');
            luoCircle.setAttribute('stroke-linecap', 'butt');

            var luoTitle = document.createElementNS('http://www.w3.org/2000/svg', 'title');
            luoTitle.textContent = luoSeg.label + ' ' + luoSeg.value + ' 条（'
                + Math.round(luoSeg.value / luoTotal * 100) + '%）';
            luoCircle.appendChild(luoTitle);

            luoPieSlices.appendChild(luoCircle);
            luoOffset += luoLen;
        });

        luoPieTotal.textContent = String(luoSummary.total);

        luoLegend.innerHTML = [
            { label: '好评', value: luoSummary.good, color: LUO_COLORS['好评'] },
            { label: '中评', value: luoSummary.neutral, color: LUO_COLORS['中评'] },
            { label: '差评', value: luoSummary.bad, color: LUO_COLORS['差评'] }
        ].map(function (luoItem) {
            var luoPct = luoTotal ? Math.round(luoItem.value / luoTotal * 100) : 0;
            return '<span><i style="background:' + luoItem.color + '"></i>'
                + luoItem.label + ' ' + luoItem.value + '（' + luoPct + '%）</span>';
        }).join('');
    }

    /* ---------------- 结果渲染 ---------------- */

    function luoRenderResult(luoData) {
        var luoSum = luoData.summary;

        document.getElementById('luoStatTotal').textContent = luoSum.total;
        document.getElementById('luoStatGood').textContent = luoSum.good;
        document.getElementById('luoStatNeutral').textContent = luoSum.neutral;
        document.getElementById('luoStatBad').textContent = luoSum.bad;
        document.getElementById('luoStatAvg').textContent = luoSum.avgScore;
        document.getElementById('luoStatFeatured').textContent = luoSum.featured;

        luoDrawPie(luoSum);

        luoResultMeta.textContent = luoData.fileName + '　·　' + luoData.total + ' 条　·　'
            + luoData.batches + ' 批　·　' + luoData.elapsed + ' ms';

        /* 精选 */
        document.getElementById('luoFeaturedHint').textContent =
            luoData.featured.length + ' 条（共标记 ' + luoSum.featured + ' 条，按情感分取前 6）';

        if (!luoData.featured.length) {
            luoFeaturedEl.innerHTML = '<p class="luo_empty">这批评论里没有符合「精选」条件的，可能是都以情绪表达为主。</p>';
        } else {
            luoFeaturedEl.innerHTML = luoData.featured.map(function (luoItem) {
                var luoCls = luoItem.label === '中评' ? 'mid' : (luoItem.label === '差评' ? 'bad' : '');
                var luoBadgeCls = luoCls ? ' ' + luoCls : '';
                return '<article class="luo_fcard ' + luoCls + '">'
                    + '<div class="luo_fcard_top">'
                    +   '<span class="luo_badge' + luoBadgeCls + '">' + luoEscape(luoItem.label) + '</span>'
                    +   (luoItem.user ? '<span style="font-size:11.5px;color:#97a1b2">' + luoEscape(luoItem.user) + '</span>' : '')
                    +   '<span class="luo_fcard_score">情感分 ' + luoItem.score + '</span>'
                    + '</div>'
                    + '<p class="luo_fcard_text">' + luoEscape(luoItem.content) + '</p>'
                    + '<p class="luo_fcard_reason">判断依据：' + luoEscape(luoItem.reason) + '</p>'
                    + '</article>';
            }).join('');
        }

        /* 明细表 */
        document.getElementById('luoAllHint').textContent = luoData.results.length + ' 条';
        luoTableBody.innerHTML = luoData.results.map(function (luoItem) {
            var luoCls = luoItem.label === '中评' ? 'mid' : (luoItem.label === '差评' ? 'bad' : '');
            var luoBadgeCls = luoCls ? ' ' + luoCls : '';
            return '<tr>'
                + '<td class="num">' + luoItem.id + '</td>'
                + '<td>' + luoEscape(luoItem.content) + '</td>'
                + '<td><span class="luo_badge' + luoBadgeCls + '">' + luoEscape(luoItem.label) + '</span></td>'
                + '<td class="num">' + luoItem.score + '</td>'
                + '<td style="color:#97a1b2">' + luoEscape(luoItem.reason) + '</td>'
                + '</tr>';
        }).join('');

        /* 交互数据 */
        var luoRawText = '【发送给大模型的提示词（第 1 批）】\n'
            + (luoData.promptSample || '') + '\n\n'
            + '【大模型返回的原始内容（前 2 批）】\n'
            + (luoData.responseSamples || []).map(function (luoSample) {
                return '— 第 ' + luoSample.batch + ' 批 —\n' + luoSample.content;
            }).join('\n\n')
            + '\n\n【页面收到的 JSON 摘要】\n'
            + JSON.stringify({
                code: 0,
                data: {
                    fileName: luoData.fileName,
                    total: luoData.total,
                    summary: luoData.summary,
                    model: luoData.model,
                    usage: luoData.usage,
                    elapsed: luoData.elapsed,
                    batches: luoData.batches
                }
            }, null, 2);

        luoRawEl.textContent = luoRawText;
        luoRawHint.textContent = luoData.model + '　·　' + (luoData.usage && luoData.usage.total_tokens || 0) + ' tokens';

        luoResult.hidden = false;
        luoResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* ---------------- 分析 ---------------- */

    luoAnalyzeBtn.addEventListener('click', function () {
        if (!luoPickedFile || luoAnalyzing) return;

        luoAnalyzing = true;
        luoAnalyzeBtn.disabled = true;
        luoAnalyzeBtn.textContent = '分析中…';
        luoStatus.textContent = '正在上传并调用大模型，20 条大约 10-25 秒…';
        luoStatus.className = 'luo_status run';

        var luoForm = new FormData();
        luoForm.append('file', luoPickedFile);

        console.log('%c[luo] 上传文件', 'color:#1d6fe0;font-weight:600',
            luoPickedFile.name, luoFmtSize(luoPickedFile.size));

        var luoStartedAt = Date.now();

        fetch('/api/review/analyze', { method: 'POST', body: luoForm })
            .then(function (luoRes) { return luoRes.text(); })
            .then(function (luoTxt) {
                var luoJson;
                try {
                    luoJson = JSON.parse(luoTxt);
                } catch (e) {
                    throw new Error('后端返回的不是 JSON，可能是没有启动服务');
                }

                console.log('%c[luo] 后端返回', 'color:#0b8a5c;font-weight:600', luoJson);

                if (luoJson.code !== 0) {
                    throw new Error(luoJson.msg || '分析失败');
                }

                var luoData = luoJson.data;
                console.log('  文件：' + luoData.fileName + '　共 ' + luoData.total + ' 条，分 '
                    + luoData.batches + ' 批');
                console.log('  汇总：好评 ' + luoData.summary.good + ' / 中评 ' + luoData.summary.neutral
                    + ' / 差评 ' + luoData.summary.bad + '　平均分 ' + luoData.summary.avgScore
                    + '　精选 ' + luoData.summary.featured);
                console.log('  发送给大模型的提示词（第 1 批）：\n' + luoData.promptSample);
                (luoData.responseSamples || []).forEach(function (luoSample) {
                    console.log('  大模型原始返回（第 ' + luoSample.batch + ' 批）：\n' + luoSample.content);
                });
                console.log('  用量：', luoData.usage, '　耗时 ' + luoData.elapsed + ' ms');

                luoRenderResult(luoData);
                luoStatus.textContent = '完成：' + luoData.total + ' 条，'
                    + ((Date.now() - luoStartedAt) / 1000).toFixed(1) + ' 秒';
                luoStatus.className = 'luo_status ok';
            })
            .catch(function (luoErr) {
                console.error('[luo] 分析失败：', luoErr.message);
                luoStatus.textContent = '失败：' + luoErr.message;
                luoStatus.className = 'luo_status err';
            })
            .finally(function () {
                luoAnalyzing = false;
                luoAnalyzeBtn.disabled = false;
                luoAnalyzeBtn.textContent = '开始分析';
            });
    });

    luoResetBtn.addEventListener('click', function () {
        luoPickedFile = null;
        luoFileInput.value = '';
        luoDropFile.textContent = '';
        luoAnalyzeBtn.disabled = true;
        luoResult.hidden = true;
        luoStatus.textContent = '等待选择文件';
        luoStatus.className = 'luo_status';
        luoRawBox.open = false;
    });

    console.log('[luo] 商业评论分析页就绪，接口 POST /api/review/analyze，服务端口 409');
})();
