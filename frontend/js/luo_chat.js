/*
 * 姓名：罗亚博 | 学号：409
 * 时间：2026-11-16 | 大模型：DeepSeek-V4.1-Flash
 * 功能名称：AI 聊天页脚本（Claude 风格；会话、语音输入、图片识别、56 种回答语言）
 */

(function () {
    'use strict';

    /* ---------------- 56 种语言 ---------------- */

    var LUO_LANGS = [
        ['zh', '简体中文', 'Chinese'], ['en', 'English', 'English'], ['ja', '日本語', 'Japanese'],
        ['ko', '한국어', 'Korean'], ['fr', 'Français', 'French'], ['de', 'Deutsch', 'German'],
        ['es', 'Español', 'Spanish'], ['pt', 'Português', 'Portuguese'], ['ru', 'Русский', 'Russian'],
        ['it', 'Italiano', 'Italian'], ['ar', 'العربية', 'Arabic'], ['hi', 'हिन्दी', 'Hindi'],
        ['bn', 'বাংলা', 'Bengali'], ['ur', 'اردو', 'Urdu'], ['fa', 'فارسی', 'Persian'],
        ['tr', 'Türkçe', 'Turkish'], ['th', 'ไทย', 'Thai'], ['vi', 'Tiếng Việt', 'Vietnamese'],
        ['id', 'Bahasa Indonesia', 'Indonesian'], ['ms', 'Bahasa Melayu', 'Malay'],
        ['tl', 'Filipino', 'Filipino'], ['my', 'မြန်မာ', 'Burmese'], ['km', 'ខ្មែរ', 'Khmer'],
        ['lo', 'ລາວ', 'Lao'], ['ne', 'नेपाली', 'Nepali'], ['si', 'සිංහල', 'Sinhala'],
        ['ta', 'தமிழ்', 'Tamil'], ['te', 'తెలుగు', 'Telugu'], ['ml', 'മലയാളം', 'Malayalam'],
        ['kn', 'ಕನ್ನಡ', 'Kannada'], ['mr', 'मराठी', 'Marathi'], ['gu', 'ગુજરાતી', 'Gujarati'],
        ['pa', 'ਪੰਜਾਬੀ', 'Punjabi'], ['he', 'עברית', 'Hebrew'], ['el', 'Ελληνικά', 'Greek'],
        ['pl', 'Polski', 'Polish'], ['cs', 'Čeština', 'Czech'], ['sk', 'Slovenčina', 'Slovak'],
        ['hu', 'Magyar', 'Hungarian'], ['ro', 'Română', 'Romanian'], ['bg', 'Български', 'Bulgarian'],
        ['uk', 'Українська', 'Ukrainian'], ['sr', 'Српски', 'Serbian'], ['hr', 'Hrvatski', 'Croatian'],
        ['sl', 'Slovenščina', 'Slovenian'], ['sv', 'Svenska', 'Swedish'], ['no', 'Norsk', 'Norwegian'],
        ['da', 'Dansk', 'Danish'], ['fi', 'Suomi', 'Finnish'], ['nl', 'Nederlands', 'Dutch'],
        ['is', 'Íslenska', 'Icelandic'], ['sw', 'Kiswahili', 'Swahili'], ['am', 'አማርኛ', 'Amharic'],
        ['ha', 'Hausa', 'Hausa'], ['yo', 'Yorùbá', 'Yoruba'], ['zu', 'isiZulu', 'Zulu']
    ];

    var LUO_SYSTEM = '你是一个有用的中文助手，回答准确、简洁；涉及代码时用 Markdown 代码块。';
    var LUO_MAX_RECORD_MS = 60000;

    /* ---------------- DOM ---------------- */

    var luoSide = document.getElementById('luoSide');
    var luoSideMask = document.getElementById('luoSideMask');
    var luoMenuBtn = document.getElementById('luoMenuBtn');
    var luoSessionsEl = document.getElementById('luoSessions');
    var luoNewBtn = document.getElementById('luoNewBtn');
    var luoChatTitle = document.getElementById('luoChatTitle');
    var luoChatMeta = document.getElementById('luoChatMeta');
    var luoLang = document.getElementById('luoLang');
    var luoMsgs = document.getElementById('luoMsgs');
    var luoInput = document.getElementById('luoInput');
    var luoSendBtn = document.getElementById('luoSendBtn');
    var luoStopBtn = document.getElementById('luoStopBtn');
    var luoAttachBtn = document.getElementById('luoAttachBtn');
    var luoFile = document.getElementById('luoFile');
    var luoAttachPreview = document.getElementById('luoAttachPreview');
    var luoAttachImg = document.getElementById('luoAttachImg');
    var luoAttachName = document.getElementById('luoAttachName');
    var luoAttachSize = document.getElementById('luoAttachSize');
    var luoAttachDel = document.getElementById('luoAttachDel');
    var luoVoiceBtn = document.getElementById('luoVoiceBtn');
    var luoVoiceLabel = document.getElementById('luoVoiceLabel');
    var luoAutoSend = document.getElementById('luoAutoSend');
    var luoVoiceState = document.getElementById('luoVoiceState');
    var luoVoiceText = document.getElementById('luoVoiceText');
    var luoVoiceTime = document.getElementById('luoVoiceTime');

    /* ---------------- 状态 ---------------- */

    var luoSessions = [];
    var luoCurrentId = 0;
    var luoHistory = [];
    var luoBusy = false;
    var luoAbort = null;
    var luoOpenToken = 0;
    var luoImage = null;            /* { dataUrl, name } 待发送图片 */
    var luoRecorder = null;
    var luoStream = null;
    var luoChunks = [];
    var luoRecording = false;
    var luoVoiceBusy = false;
    var luoVoiceTimer = null;
    var luoVoiceStartedAt = 0;
    var luoAutoStopTimer = null;

    /* ---------------- 语言 ---------------- */

    LUO_LANGS.forEach(function (luoItem) {
        var luoOpt = document.createElement('option');
        luoOpt.value = luoItem[0];
        luoOpt.textContent = luoItem[1];
        luoLang.appendChild(luoOpt);
    });

    var luoSavedLang = '';
    try { luoSavedLang = localStorage.getItem('luo_chat_lang') || ''; } catch (e) { luoSavedLang = ''; }
    luoLang.value = luoSavedLang && LUO_LANGS.some(function (x) { return x[0] === luoSavedLang; })
        ? luoSavedLang : 'zh';

    function luoCurrentLang() {
        var luoCode = luoLang.value;
        var luoHit = LUO_LANGS.filter(function (x) { return x[0] === luoCode; })[0];
        return luoHit ? { code: luoHit[0], name: luoHit[1], en: luoHit[2] } : { code: 'zh', name: '简体中文', en: 'Chinese' };
    }

    luoLang.addEventListener('change', function () {
        try { localStorage.setItem('luo_chat_lang', luoLang.value); } catch (e) { /* 忽略 */ }
        console.log('[luo] 回答语言切换为：', luoCurrentLang().name);
    });

    /* ---------------- 基础工具 ---------------- */

    function luoEscape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function luoTime() {
        var d = new Date();
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }

    function luoApi(url, options) {
        return fetch(url, options)
            .then(function (r) { return r.text(); })
            .then(function (txt) {
                try { return JSON.parse(txt); } catch (e) {
                    throw new Error('接口返回的不是 JSON（后端没启动时会出现）');
                }
            });
    }

    function luoScroll() {
        luoMsgs.scrollTop = luoMsgs.scrollHeight;
    }

    /* ---------------- Markdown ---------------- */

    function luoInline(text) {
        var s = luoEscape(text);
        s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
        s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
        s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    function luoFormat(text) {
        var luoLines = String(text || '').replace(/\r\n/g, '\n').split('\n');
        var luoHtml = [];
        var luoList = '';
        var luoCode = [];
        var luoInCode = false;

        function luoCloseList() {
            if (luoList) {
                luoHtml.push('</' + luoList + '>');
                luoList = '';
            }
        }

        luoLines.forEach(function (luoLine) {
            if (/^```/.test(luoLine)) {
                if (luoInCode) {
                    luoHtml.push('<pre><code>' + luoEscape(luoCode.join('\n')) + '</code></pre>');
                    luoCode = [];
                    luoInCode = false;
                } else {
                    luoCloseList();
                    luoInCode = true;
                }
                return;
            }
            if (luoInCode) {
                luoCode.push(luoLine);
                return;
            }

            if (/^\s*$/.test(luoLine)) {
                luoCloseList();
                return;
            }

            var luoH = luoLine.match(/^(#{1,3})\s+(.+)$/);
            if (luoH) {
                luoCloseList();
                luoHtml.push('<h' + luoH[1].length + '>' + luoInline(luoH[2]) + '</h' + luoH[1].length + '>');
                return;
            }

            if (/^\s*([-*_])\1{2,}\s*$/.test(luoLine)) {
                luoCloseList();
                luoHtml.push('<hr>');
                return;
            }

            if (/^&gt;\s?/.test(luoEscape(luoLine)) || /^>\s?/.test(luoLine)) {
                luoCloseList();
                luoHtml.push('<blockquote>' + luoInline(luoLine.replace(/^&gt;\s?/, '').replace(/^>\s?/, '')) + '</blockquote>');
                return;
            }

            var luoUl = luoLine.match(/^\s*[-*]\s+(.+)$/);
            if (luoUl) {
                if (luoList !== 'ul') {
                    luoCloseList();
                    luoHtml.push('<ul>');
                    luoList = 'ul';
                }
                luoHtml.push('<li>' + luoInline(luoUl[1]) + '</li>');
                return;
            }

            var luoOl = luoLine.match(/^\s*\d+[.)]\s+(.+)$/);
            if (luoOl) {
                if (luoList !== 'ol') {
                    luoCloseList();
                    luoHtml.push('<ol>');
                    luoList = 'ol';
                }
                luoHtml.push('<li>' + luoInline(luoOl[1]) + '</li>');
                return;
            }

            luoCloseList();
            luoHtml.push('<p>' + luoInline(luoLine) + '</p>');
        });

        luoCloseList();
        if (luoInCode) {
            luoHtml.push('<pre><code>' + luoEscape(luoCode.join('\n')) + '</code></pre>');
        }
        return luoHtml.join('');
    }

    /* ---------------- 消息渲染 ---------------- */

    function luoAiMark() {
        return '<span class="luo_ai_mark" aria-hidden="true">' +
            '<svg viewBox="0 0 24 24"><path d="M12 2.4c.5 3.6 1.2 5.9 2.5 7.2 1.3 1.3 3.6 2 7.1 2.4-3.5.5-5.8 1.2-7.1 2.5-1.3 1.3-2 3.6-2.5 7.1-.5-3.5-1.2-5.8-2.5-7.1-1.3-1.3-3.6-2-7.1-2.5 3.5-.4 5.8-1.1 7.1-2.4 1.3-1.3 2-3.6 2.5-7.2Z"/></svg>' +
            '</span>';
    }

    function luoBubble(role, text, time, imageUrl) {
        var luoIsMe = role === 'user';
        var luoWrap = document.createElement('div');
        luoWrap.className = 'luo_msg' + (luoIsMe ? ' luo_me' : '') + (role === 'err' ? ' luo_err' : '');

        if (luoIsMe) {
            var luoBubbleEl = document.createElement('div');
            luoBubbleEl.className = 'luo_bubble';
            luoBubbleEl.innerHTML = luoEscape(text).replace(/\n/g, '<br>') +
                (imageUrl ? '<img class="luo_msg_img" src="' + imageUrl + '" alt="发送的图片">' : '') +
                '<div class="luo_time">' + luoEscape(time || luoTime()) + '</div>';
            luoWrap.appendChild(luoBubbleEl);
        } else {
            var luoBody = document.createElement('div');
            luoBody.className = 'luo_msg_body luo_md';
            luoBody.innerHTML = luoFormat(text) + '<div class="luo_time">' + luoEscape(time || luoTime()) + '</div>';
            luoWrap.innerHTML = luoAiMark();
            luoWrap.appendChild(luoBody);
        }

        luoMsgs.appendChild(luoWrap);
        luoScroll();
        return luoWrap;
    }

    function luoTyping() {
        var luoWrap = document.createElement('div');
        luoWrap.className = 'luo_msg';
        luoWrap.innerHTML = luoAiMark() +
            '<div class="luo_msg_body"><span class="luo_typing"><i></i><i></i><i></i></span></div>';
        luoMsgs.appendChild(luoWrap);
        luoScroll();
        return luoWrap;
    }

    function luoRenderSessions() {
        if (!luoSessions.length) {
            luoSessionsEl.innerHTML = '<p class="luo_side_empty">还没有会话，点上面新建</p>';
            return;
        }
        luoSessionsEl.innerHTML = luoSessions.map(function (s) {
            return '<div class="luo_session' + (s.id === luoCurrentId ? ' on' : '') + '" data-id="' + s.id + '">' +
                '<b title="' + luoEscape(s.title) + '">' + luoEscape(s.title) + '</b>' +
                '<i>' + (s.msg_count || 0) + ' 条 · ' + luoEscape(String(s.updated_at).slice(5, 16)) + '</i>' +
                '<button type="button" class="luo_del" data-del="' + s.id + '" title="删除会话">×</button>' +
                '</div>';
        }).join('');
    }

    /* ---------------- 会话 ---------------- */

    function luoLoadSessions(luoSelectId) {
        return luoApi('/api/chat/sessions')
            .then(function (json) {
                if (json.code !== 0) throw new Error(json.msg);
                luoSessions = json.data.list || [];
                console.log('[luo] 会话列表：', luoSessions);

                if (luoSelectId) luoCurrentId = luoSelectId;
                else if (!luoCurrentId && luoSessions.length) luoCurrentId = luoSessions[0].id;

                luoRenderSessions();
                if (luoCurrentId) return luoOpenSession(luoCurrentId);

                luoChatTitle.textContent = '新的对话';
                luoChatMeta.textContent = '';
                luoMsgs.innerHTML = '';
                return null;
            })
            .catch(function (err) {
                console.error('[luo] 读取会话失败：', err.message);
                luoSessionsEl.innerHTML = '<p class="luo_side_empty">读取失败：' + luoEscape(err.message) + '</p>';
            });
    }

    function luoRefreshSessions() {
        return luoApi('/api/chat/sessions').then(function (json) {
            if (json.code !== 0) return;
            luoSessions = json.data.list || [];
            luoRenderSessions();
        }).catch(function () { /* 列表刷新失败不影响聊天 */ });
    }

    function luoOpenSession(id) {
        var luoToken = ++luoOpenToken;
        return luoApi('/api/chat/sessions/' + id + '/messages').then(function (json) {
            if (luoToken !== luoOpenToken) return null;
            if (json.code !== 0) throw new Error(json.msg);

            luoCurrentId = id;
            var luoList = json.data.list || [];
            luoHistory = luoList.map(function (m) { return { role: m.role, content: m.content }; });

            var luoSession = luoSessions.filter(function (s) { return s.id === id; })[0];
            luoChatTitle.textContent = luoSession ? luoSession.title : ('会话 #' + id);
            luoChatMeta.textContent = luoList.length + ' 条消息';
            luoMsgs.innerHTML = '';
            luoList.forEach(function (m) {
                luoBubble(m.role, m.content, String(m.created_at).slice(11, 16));
            });

            luoRenderSessions();
            console.log('[luo] 打开会话 #' + id + '，历史 ' + luoList.length + ' 条');
            return luoList;
        });
    }

    function luoNewSession(title) {
        return luoApi('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || '新的对话' })
        }).then(function (json) {
            if (json.code !== 0) throw new Error(json.msg);
            console.log('[luo] 新建会话 #' + json.data.id);
            return luoLoadSessions(json.data.id);
        });
    }

    /* ---------------- 图片 ---------------- */

    function luoReadFile(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result)); };
            reader.onerror = function () { reject(new Error('读取图片失败')); };
            reader.readAsDataURL(file);
        });
    }

    function luoCompress(file) {
        return luoReadFile(file).then(function (dataUrl) {
            return new Promise(function (resolve) {
                var img = new Image();
                img.onload = function () {
                    var max = 1400;
                    var w = img.width;
                    var h = img.height;
                    if (w > max || h > max) {
                        var r = Math.min(max / w, max / h);
                        w = Math.round(w * r);
                        h = Math.round(h * r);
                    }
                    var canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.82));
                };
                img.onerror = function () { resolve(dataUrl); };
                img.src = dataUrl;
            });
        });
    }

    function luoSetImage(dataUrl, name) {
        luoImage = { dataUrl: dataUrl, name: name || '图片' };
        luoAttachImg.src = dataUrl;
        luoAttachName.textContent = luoImage.name;
        luoAttachSize.textContent = Math.round(dataUrl.length * 0.75 / 1024) + ' KB';
        luoAttachPreview.hidden = false;
    }

    function luoClearImage() {
        luoImage = null;
        luoFile.value = '';
        luoAttachPreview.hidden = true;
        luoAttachImg.removeAttribute('src');
    }

    luoAttachBtn.addEventListener('click', function () { luoFile.click(); });

    luoFile.addEventListener('change', function () {
        var file = luoFile.files && luoFile.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) {
            alert('请选择图片文件');
            return;
        }
        if (file.size > 12 * 1024 * 1024) {
            alert('图片不要超过 12MB');
            return;
        }
        luoCompress(file).then(function (dataUrl) {
            luoSetImage(dataUrl, file.name);
            console.log('[luo] 已选择图片：', file.name, Math.round(dataUrl.length / 1024) + ' KB');
        }).catch(function (err) {
            alert(err.message);
        });
    });

    luoAttachDel.addEventListener('click', luoClearImage);

    /* ---------------- 语音输入 ---------------- */

    function luoSetVoiceState(show, text, cls) {
        luoVoiceState.hidden = !show;
        if (text) luoVoiceText.textContent = text;
        luoVoiceState.className = 'luo_voice_state' + (cls ? ' ' + cls : '');
    }

    function luoVoiceClock() {
        var sec = Math.floor((Date.now() - luoVoiceStartedAt) / 1000);
        luoVoiceTime.textContent = ('0' + Math.floor(sec / 60)).slice(-2) + ':' + ('0' + (sec % 60)).slice(-2);
    }

    function luoStopTracks() {
        if (luoStream) {
            luoStream.getTracks().forEach(function (t) { t.stop(); });
            luoStream = null;
        }
    }

    function luoStartVoice() {
        if (luoVoiceBusy || luoBusy) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
            alert('当前浏览器不支持录音，请换 Chrome / Edge，或直接用文字输入');
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
            luoStream = stream;
            luoChunks = [];

            var mime = '';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
            else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';

            luoRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
            luoRecorder.ondataavailable = function (ev) {
                if (ev.data && ev.data.size) luoChunks.push(ev.data);
            };
            luoRecorder.onstop = luoFinishVoice;
            luoRecorder.start();

            luoRecording = true;
            luoVoiceStartedAt = Date.now();
            luoVoiceBtn.classList.add('recording');
            luoVoiceLabel.textContent = '结束';
            luoVoiceClock();
            luoSetVoiceState(true, '正在录音，再点一次结束…', '');
            luoVoiceTimer = setInterval(luoVoiceClock, 500);
            luoAutoStopTimer = setTimeout(function () {
                if (luoRecording) luoStopVoice();
            }, LUO_MAX_RECORD_MS);

            console.log('[luo] 开始录音');
        }).catch(function (err) {
            console.error('[luo] 麦克风不可用：', err.message);
            alert('拿不到麦克风权限。请允许浏览器使用麦克风，或直接用文字输入。');
        });
    }

    function luoStopVoice() {
        if (!luoRecording || !luoRecorder) return;
        luoRecording = false;
        clearInterval(luoVoiceTimer);
        clearTimeout(luoAutoStopTimer);
        luoVoiceTimer = null;
        luoAutoStopTimer = null;

        try { luoRecorder.stop(); } catch (e) { /* 忽略 */ }
        luoVoiceBtn.classList.remove('recording');
        luoVoiceLabel.textContent = '识别中';
        luoVoiceBtn.classList.add('busy');
        luoStopTracks();
    }

    function luoFinishVoice() {
        var blob = new Blob(luoChunks, { type: (luoRecorder && luoRecorder.mimeType) || 'audio/webm' });
        luoChunks = [];
        luoRecorder = null;

        if (blob.size < 800) {
            luoVoiceBusy = false;
            luoVoiceBtn.classList.remove('busy');
            luoVoiceLabel.textContent = '说话';
            luoSetVoiceState(false);
            alert('录音太短了，请再说一遍');
            return;
        }

        luoVoiceBusy = true;
        luoSetVoiceState(true, '正在识别语音（自动识别语言）…', 'recognizing');

        var form = new FormData();
        form.append('audio', blob, 'voice.webm');

        console.log('[luo] 上传语音：', Math.round(blob.size / 1024) + ' KB');

        fetch('/api/speech', { method: 'POST', body: form })
            .then(function (r) { return r.text(); })
            .then(function (txt) {
                var json;
                try { json = JSON.parse(txt); } catch (e) { throw new Error('语音接口返回的不是 JSON'); }
                console.log('[luo] 语音识别结果：', json);

                if (json.code !== 0 || !json.data || !json.data.text) {
                    throw new Error(json.msg || '没有识别到文字');
                }

                var text = String(json.data.text).trim();
                luoInput.value = text;
                luoAutoResize();
                luoSetVoiceState(false);
                luoVoiceBusy = false;
                luoVoiceBtn.classList.remove('busy');
                luoVoiceLabel.textContent = '说话';

                if (luoAutoSend.checked && text) {
                    luoSend();
                } else {
                    luoInput.focus();
                }
            })
            .catch(function (err) {
                console.error('[luo] 语音识别失败：', err.message);
                luoSetVoiceState(true, '识别失败：' + err.message, '');
                setTimeout(function () { luoSetVoiceState(false); }, 4000);
                luoVoiceBusy = false;
                luoVoiceBtn.classList.remove('busy');
                luoVoiceLabel.textContent = '说话';
            });
    }

    luoVoiceBtn.addEventListener('click', function () {
        if (luoRecording) luoStopVoice();
        else luoStartVoice();
    });

    /* ---------------- 发送 ---------------- */

    function luoAutoResize() {
        luoInput.style.height = 'auto';
        luoInput.style.height = Math.min(luoInput.scrollHeight, 180) + 'px';
    }

    function luoSend() {
        if (luoBusy) return;

        var text = luoInput.value.trim();
        if (!text && !luoImage) {
            luoInput.focus();
            return;
        }

        var image = luoImage;
        var displayText = text || '请识别这张图片。';
        var lang = luoCurrentLang();

        var doSend = luoCurrentId ? Promise.resolve() : luoNewSession(displayText.slice(0, 20));

        doSend.then(function () {
            luoInput.value = '';
            luoAutoResize();
            luoClearImage();

            luoBubble('user', displayText, luoTime(), image ? image.dataUrl : '');
            luoHistory.push({ role: 'user', content: displayText + (image ? ' [图片]' : '') });

            luoBusy = true;
            luoSendBtn.disabled = true;
            luoStopBtn.hidden = false;
            var typing = luoTyping();

            var payload = {
                sessionId: luoCurrentId,
                language: lang,
                image: image ? { dataUrl: image.dataUrl, name: image.name } : null,
                messages: [{ role: 'system', content: LUO_SYSTEM }].concat(luoHistory)
            };

            var logPayload = JSON.parse(JSON.stringify(payload));
            if (logPayload.image) logPayload.image.dataUrl = '（base64 已省略，' + Math.round(image.dataUrl.length / 1024) + ' KB）';
            console.log('%c[luo] 发送给 LLM 的请求', 'color:#d97757;font-weight:600', logPayload);

            luoAbort = new AbortController();

            luoApi('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: luoAbort.signal
            }).then(function (json) {
                console.log('%c[luo] 收到的 LLM 数据', 'color:#0b8a5c;font-weight:600', json);

                if (json.code !== 0) throw new Error(json.msg || '接口返回失败');
                var d = json.data;

                luoHistory.push({ role: 'assistant', content: d.reply });
                var wrap = luoBubble('assistant', d.reply);
                var meta = document.createElement('div');
                meta.className = 'luo_msg_meta';
                meta.innerHTML = '<i>' + luoEscape(d.model || 'LLM') + '</i> · ' +
                    (d.vision ? '图片识别 · ' : '') +
                    (d.languageName || lang.name) + ' · ' +
                    (d.elapsed || 0) + ' ms' +
                    (d.knowledge && d.knowledge.injected ? ' · 知识库 ' + d.knowledge.hitCount + ' 条' : '');
                wrap.querySelector('.luo_msg_body').appendChild(meta);

                luoChatMeta.textContent = luoHistory.length + ' 条消息';
                luoRefreshSessions();
            }).catch(function (err) {
                if (err.name === 'AbortError') {
                    luoBubble('err', '已中断本次请求。');
                } else {
                    console.error('[luo] 聊天失败：', err.message);
                    luoBubble('err', '请求失败：' + err.message + '\n请确认 backend/.env 的 LLM_API_KEY 有效。');
                }
            }).finally(function () {
                if (typing.parentNode) typing.parentNode.removeChild(typing);
                luoBusy = false;
                luoAbort = null;
                luoSendBtn.disabled = false;
                luoStopBtn.hidden = true;
                luoInput.focus();
            });
        }).catch(function (err) {
            console.error('[luo] 新建会话失败：', err.message);
        });
    }

    /* ---------------- 事件 ---------------- */

    luoSendBtn.addEventListener('click', luoSend);
    luoStopBtn.addEventListener('click', function () { if (luoAbort) luoAbort.abort(); });

    luoInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
            ev.preventDefault();
            luoSend();
        }
    });

    luoInput.addEventListener('input', luoAutoResize);

    luoNewBtn.addEventListener('click', function () {
        luoCurrentId = 0;
        luoHistory = [];
        luoMsgs.innerHTML = '';
        luoChatTitle.textContent = '新的对话';
        luoChatMeta.textContent = '';
        luoInput.focus();
        luoCloseSide();
    });

    luoMenuBtn.addEventListener('click', function () {
        luoSide.classList.add('side_open');
        luoSideMask.hidden = false;
    });

    function luoCloseSide() {
        luoSide.classList.remove('side_open');
        luoSideMask.hidden = true;
    }

    luoSideMask.addEventListener('click', luoCloseSide);

    luoSessionsEl.addEventListener('click', function (ev) {
        var delBtn = ev.target.closest('.luo_del');
        if (delBtn) {
            ev.stopPropagation();
            var delId = Number(delBtn.getAttribute('data-del'));
            if (!confirm('删除这个会话及全部消息？')) return;

            luoApi('/api/chat/sessions/' + delId, { method: 'DELETE' })
                .then(function (json) {
                    console.log('[luo] 删除会话 #' + delId, json);
                    if (delId === luoCurrentId) {
                        luoCurrentId = 0;
                        luoHistory = [];
                        luoMsgs.innerHTML = '';
                        luoChatTitle.textContent = '新的对话';
                        luoChatMeta.textContent = '';
                    }
                    return luoLoadSessions();
                })
                .catch(function (err) { console.error('[luo] 删除失败：', err.message); });
            return;
        }

        var item = ev.target.closest('.luo_session');
        if (item) {
            luoOpenSession(Number(item.getAttribute('data-id')))
                .then(luoCloseSide)
                .catch(function (err) { console.error('[luo] 打开会话失败：', err.message); });
        }
    });

    luoSessionsEl.addEventListener('dblclick', function (ev) {
        var item = ev.target.closest('.luo_session');
        if (!item) return;

        var id = Number(item.getAttribute('data-id'));
        var session = luoSessions.filter(function (s) { return s.id === id; })[0];
        var newTitle = prompt('重命名会话', session ? session.title : '');
        if (!newTitle || !newTitle.trim()) return;

        luoApi('/api/chat/sessions/' + id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
        }).then(function (json) {
            console.log('[luo] 重命名结果：', json);
            return luoLoadSessions(id);
        }).catch(function (err) { console.error('[luo] 重命名失败：', err.message); });
    });

    console.log('[luo] AI 聊天页就绪；语音输入会自动识别语言，回答语言：', luoCurrentLang().name);
    luoAutoResize();
    luoLoadSessions();
})();
