/**
 * 姓名：罗亚博 | 学号：409
 * 建立时间：2026-11-16
 * 大模型：DeepSeek-V4.1-Flash
 * 功能：全站顶部导航（各页面共用，自动高亮当前页）
 */

(function () {
    'use strict';

    var LUO_LINKS = [
        { href: 'index.html', text: '首页' },
        { href: 'news.html', text: '新闻' },
        { href: 'gallery.html', text: '图片' },
        { href: 'knowledge.html', text: '知识库' },
        { href: 'review.html', text: '评论分析' },
        { href: 'chat.html', text: 'AI 聊天' },
        { href: 'database.html', text: '数据库' }
    ];

    /* 当前文件名，兼容 / 与 /index.html 两种访问 */
    var luoPath = window.location.pathname.split('/').pop() || 'index.html';
    if (!luoPath || luoPath === '') luoPath = 'index.html';

    var luoBar = document.createElement('header');
    luoBar.className = 'luo_topbar';

    var luoInner = document.createElement('div');
    luoInner.className = 'luo_topbar_in';

    var luoBrand = document.createElement('a');
    luoBrand.className = 'luo_brand';
    luoBrand.href = 'index.html';
    luoBrand.innerHTML = '<span class="luo_brand_mark">L</span>'
        + '<span class="luo_brand_text">罗亚博 · 全栈项目</span>';

    var luoMenu = document.createElement('nav');
    luoMenu.className = 'luo_menu';

    LUO_LINKS.forEach(function (luoLink) {
        var luoA = document.createElement('a');
        luoA.href = luoLink.href;
        luoA.textContent = luoLink.text;
        if (luoLink.href === luoPath) {
            luoA.className = 'on';
            luoA.setAttribute('aria-current', 'page');
        }
        luoMenu.appendChild(luoA);
    });

    luoInner.appendChild(luoBrand);
    luoInner.appendChild(luoMenu);
    luoBar.appendChild(luoInner);

    document.body.insertBefore(luoBar, document.body.firstChild);
    document.body.classList.add('luo_has_topbar');
})();
