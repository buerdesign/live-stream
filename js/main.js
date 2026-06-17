/**
 * 专家直播页面 - 交互引擎 v2
 * Premium Live Stream with Config Panel & Poster Management
 */
(function () {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    /* ==========================================
       默认配置
       ========================================== */
    const DEFAULT_CONFIG = {
        brandName: '专家直播间',
        eventTitle: '深度解析：AI 时代的技术架构演进',
        pageTitle: '专家直播 - 在线研讨会',
        expertSectionTitle: '专家介绍',
        streamUrl: '',
        posters: [],
        theme: 'dark',
    };

    /* ==========================================
       配置管理
       ========================================== */
    let config = { ...DEFAULT_CONFIG };

    function loadConfig() {
        try {
            const saved = localStorage.getItem('live-config');
            if (saved) {
                const parsed = JSON.parse(saved);
                config = { ...DEFAULT_CONFIG, ...parsed };
            }
        } catch (e) {
            config = { ...DEFAULT_CONFIG };
        }
    }

    function saveConfig() {
        localStorage.setItem('live-config', JSON.stringify(config));
    }

    function applyConfig() {
        document.title = config.pageTitle;
        document.querySelectorAll('[data-config="brandName"]').forEach(el => el.textContent = config.brandName);
        document.querySelectorAll('[data-config="eventTitle"]').forEach(el => el.textContent = config.eventTitle);
        document.querySelectorAll('[data-config="expertSectionTitle"]').forEach(el => el.textContent = config.expertSectionTitle);

        const streamUrlInput = $('#streamUrl');
        if (streamUrlInput && config.streamUrl) {
            streamUrlInput.value = config.streamUrl;
        }

        renderPosters();
    }

    /* ==========================================
       海报管理
       ========================================== */
    function addPoster(title, url) {
        config.posters.push({ title: title || '', url, addedAt: Date.now() });
        saveConfig();
        renderPosters();
        renderPosterManageList();
    }

    function removePoster(index) {
        config.posters.splice(index, 1);
        saveConfig();
        renderPosters();
        renderPosterManageList();
    }

    function updatePosterTitle(index, title) {
        config.posters[index].title = title;
        saveConfig();
        renderPosters();
        renderPosterManageList();
    }

    function renderPosters() {
        const list = $('#expertPosterList');
        const empty = $('#expertEmptyState');
        const countEl = $('#posterCount');
        const actions = $('#expertActions');

        if (!list) return;

        if (config.posters.length === 0) {
            list.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            if (actions) actions.style.display = 'none';
            if (countEl) countEl.innerHTML = '共 <strong>0</strong> 张';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        if (countEl) countEl.innerHTML = `共 <strong>${config.posters.length}</strong> 张`;

        list.innerHTML = config.posters.map((p, i) => `
            <div class="expert-poster-item" data-poster-index="${i}" onclick="window._openPosterPreview(${i})">
                ${p.title ? `<div class="expert-poster-label">${escapeAttr(p.title)}</div>` : ''}
                <img src="${escapeAttr(p.url)}" alt="${escapeAttr(p.title || '海报 ' + (i+1))}" loading="lazy">
            </div>
        `).join('');
    }

    function renderPosterManageList() {
        const list = $('#posterManageList');
        const empty = $('#posterManageEmpty');
        const count = $('#posterManageCount');

        if (!list) return;
        if (count) count.textContent = `${config.posters.length} 张`;

        if (config.posters.length === 0) {
            list.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (empty) empty.style.display = 'none';

        list.innerHTML = config.posters.map((p, i) => `
            <div class="poster-manage-item">
                <img class="poster-manage-thumb" src="${escapeAttr(p.url)}" alt="">
                <div class="poster-manage-info">
                    <div class="poster-manage-name">${escapeHtml(p.title || '海报 ' + (i+1))}</div>
                    <div class="poster-manage-meta">${formatBytes(estimateSize(p.url))}</div>
                </div>
                <div class="poster-manage-actions">
                    <button class="btn-danger-sm" onclick="window._removePoster(${i})" title="删除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    /* ==========================================
       图片预览
       ========================================== */
    let previewIndex = 0;
    window._openPosterPreview = function (index) {
        if (config.posters.length === 0) return;
        previewIndex = index;
        showPreview();
    };

    function showPreview() {
        const modal = $('#imagePreviewModal');
        const img = $('#imagePreviewImg');
        const indexEl = $('#previewIndex');
        if (!modal || !img) return;

        const poster = config.posters[previewIndex];
        if (!poster) return;

        img.src = poster.url;
        img.alt = poster.title || '海报';
        indexEl.textContent = `${previewIndex + 1} / ${config.posters.length}`;
        modal.style.display = 'flex';
    }

    function closePreview() {
        const modal = $('#imagePreviewModal');
        if (modal) modal.style.display = 'none';
    }

    function prevPreview() {
        if (config.posters.length === 0) return;
        previewIndex = (previewIndex - 1 + config.posters.length) % config.posters.length;
        showPreview();
    }

    function nextPreview() {
        if (config.posters.length === 0) return;
        previewIndex = (previewIndex + 1) % config.posters.length;
        showPreview();
    }

    /* ==========================================
       图片上传处理
       ========================================== */
    function handleImageFile(file, title) {
        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast('图片大小不能超过 20MB (localStorage 限制)');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const dataUrl = e.target.result;
            addPoster(title || file.name.replace(/\.[^.]+$/, ''), dataUrl);
            showToast('海报已添加！');
        };
        reader.onerror = function () {
            showToast('图片读取失败，请重试');
        };
        reader.readAsDataURL(file);
    }

    function handleImageUrl(url, title) {
        if (!url.trim()) { showToast('请输入图片链接'); return; }
        // 简单验证
        if (!/^https?:\/\/.+/.test(url.trim()) && !url.startsWith('data:')) {
            showToast('请输入有效的图片链接 (http/https)');
            return;
        }
        addPoster(title, url.trim());
        showToast('海报已添加！');
        $('#newPosterUrl').value = '';
        $('#newPosterTitle').value = '';
    }

    /* ==========================================
       下载全部海报
       ========================================== */
    async function downloadAllPosters() {
        if (config.posters.length === 0) {
            showToast('暂无海报可下载');
            return;
        }

        if (config.posters.length === 1) {
            // 单张直接下载
            downloadSingleImage(config.posters[0].url, config.posters[0].title || 'poster');
            return;
        }

        // 多张用 JSZip 打包
        if (typeof JSZip === 'undefined') {
            showToast('正在加载打包组件...');
            return;
        }

        try {
            showToast('正在打包下载...');
            const zip = new JSZip();

            for (let i = 0; i < config.posters.length; i++) {
                const p = config.posters[i];
                let blob;
                if (p.url.startsWith('data:')) {
                    const resp = await fetch(p.url);
                    blob = await resp.blob();
                } else {
                    const resp = await fetch(p.url);
                    blob = await resp.blob();
                }
                const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
                const name = `${String(i + 1).padStart(2, '0')}_${(p.title || 'poster').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${ext}`;
                zip.file(name, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'expert_posters.zip';
            a.click();
            URL.revokeObjectURL(url);
            showToast('下载完成！');
        } catch (e) {
            showToast('下载失败，请检查网络');
            console.error(e);
        }
    }

    function downloadSingleImage(url, name) {
        const a = document.createElement('a');
        a.href = url;
        a.download = (name || 'poster').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') + '.jpg';
        a.target = '_blank';
        a.click();
    }

    /* ==========================================
       设置面板
       ========================================== */
    function openSettings() {
        // 填充当前值
        $('#cfgBrandName').value = config.brandName;
        $('#cfgEventTitle').value = config.eventTitle;
        $('#cfgPageTitle').value = config.pageTitle;
        $('#cfgExpertTitle').value = config.expertSectionTitle;
        $('#cfgStreamUrl').value = config.streamUrl;
        $('#newPosterUrl').value = '';
        $('#newPosterTitle').value = '';
        $('#newPosterTitle2').value = '';

        renderPosterManageList();
        $('#settingsModal').style.display = 'flex';
    }

    function closeSettings() {
        $('#settingsModal').style.display = 'none';
    }

    function saveSettings() {
        config.brandName = $('#cfgBrandName').value.trim() || DEFAULT_CONFIG.brandName;
        config.eventTitle = $('#cfgEventTitle').value.trim() || DEFAULT_CONFIG.eventTitle;
        config.pageTitle = $('#cfgPageTitle').value.trim() || DEFAULT_CONFIG.pageTitle;
        config.expertSectionTitle = $('#cfgExpertTitle').value.trim() || DEFAULT_CONFIG.expertSectionTitle;
        config.streamUrl = $('#cfgStreamUrl').value.trim();

        saveConfig();
        applyConfig();
        closeSettings();
        showToast('设置已保存！');
    }

    function resetSettings() {
        if (confirm('确定恢复默认设置？这将清除所有自定义内容和海报。')) {
            localStorage.removeItem('live-config');
            config = { ...DEFAULT_CONFIG };
            saveConfig();
            applyConfig();
            renderPosterManageList();
            showToast('已恢复默认设置');
        }
    }

    /* ==========================================
       主题切换
       ========================================== */
    function initTheme() {
        const saved = localStorage.getItem('live-stream-theme');
        if (saved) {
            document.documentElement.setAttribute('data-theme', saved);
            config.theme = saved;
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            config.theme = theme;
        }
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        config.theme = next;
        localStorage.setItem('live-stream-theme', next);
    }

    /* ==========================================
       视频流加载
       ========================================== */
    function loadVideoStream(url) {
        if (!url || !url.trim()) { showToast('请输入直播推流地址'); return; }

        const placeholder = $('#videoPlaceholder');
        const iframeW = $('#videoIframeWrapper');
        const hlsV = $('#hlsVideo');

        if (placeholder) placeholder.style.display = 'none';
        if (iframeW) { iframeW.style.display = 'none'; iframeW.innerHTML = ''; }
        if (hlsV) hlsV.style.display = 'none';

        const u = url.trim();
        if (u.includes('meeting.tencent.com') || u.includes('voovmeeting.com')) {
            embedIframe(u);
        } else if (u.endsWith('.m3u8')) {
            playHLS(u);
        } else if (u.startsWith('rtmp://')) {
            showToast('RTMP 流需要转码为 HLS，请使用 m3u8 地址');
        } else if (u.startsWith('http')) {
            embedIframe(u);
        } else {
            showToast('无法识别的流地址格式');
        }
    }

    function embedIframe(url) {
        const w = $('#videoIframeWrapper');
        if (w) {
            w.innerHTML = `<iframe src="${url}" allow="camera;microphone;fullscreen" allowfullscreen></iframe>`;
            w.style.display = 'block';
        }
    }

    function playHLS(url) {
        if (typeof Hls === 'undefined') { showToast('HLS.js 未加载'); return; }
        const video = $('#hlsVideo');
        if (!video) return;

        if (Hls.isSupported()) {
            if (video._hls) video._hls.destroy();
            const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 90 });
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.style.display = 'block';
                video.play().catch(() => {});
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) { hls.startLoad(); }
                    else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls.recoverMediaError(); }
                    else { showToast('播放失败'); hls.destroy(); }
                }
            });
            video._hls = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url; video.style.display = 'block'; video.play().catch(() => {});
        } else {
            showToast('浏览器不支持 HLS 播放');
        }
    }

    /* ==========================================
       全屏 / PiP / 音量
       ========================================== */
    function toggleFullscreen() {
        const vc = $('#videoContainer');
        if (!document.fullscreenElement) {
            (vc || document.documentElement).requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen();
        }
    }

    /* ==========================================
       分享弹窗
       ========================================== */
    function openShare() {
        const input = $('#shareLinkInput');
        if (input) input.value = window.location.href;
        const modal = $('#shareModal');
        if (modal) modal.style.display = 'flex';
    }
    function closeShare() { const m = $('#shareModal'); if (m) m.style.display = 'none'; }
    function copyShareLink() {
        const input = $('#shareLinkInput');
        if (!input) return;
        navigator.clipboard.writeText(input.value).then(() => showToast('链接已复制')).catch(() => {
            input.select(); document.execCommand('copy'); showToast('链接已复制');
        });
    }

    /* ==========================================
       聊天
       ========================================== */
    function sendChat() {
        const input = $('#chatInput');
        const msgs = $('#chatMessages');
        if (!input || !msgs) return;
        const text = input.value.trim();
        if (!text) return;

        const el = document.createElement('div');
        el.className = 'chat-msg';
        el.innerHTML = `<div class="chat-avatar">我</div><div class="chat-body"><span class="chat-name">我</span><p>${escapeHtml(text)}</p></div>`;
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        input.value = '';
    }

    /* ==========================================
       Toast
       ========================================== */
    let toastTimer = null;
    function showToast(msg, dur = 2500) {
        const t = $('#toast'), tm = $('#toastMsg');
        if (!t || !tm) return;
        if (toastTimer) { clearTimeout(toastTimer); t.classList.remove('hide'); }
        tm.textContent = msg;
        t.style.display = 'block';
        toastTimer = setTimeout(() => {
            t.classList.add('hide');
            toastTimer = setTimeout(() => { t.style.display = 'none'; t.classList.remove('hide'); toastTimer = null; }, 300);
        }, dur);
    }

    /* ==========================================
       工具函数
       ========================================== */
    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function escapeAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function formatBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; }
    function estimateSize(dataUrl) {
        if (dataUrl.startsWith('data:')) {
            const base64 = dataUrl.split(',')[1];
            return base64 ? Math.ceil(base64.length * 0.75) : 0;
        }
        return 0;
    }

    /* ==========================================
       事件绑定
       ========================================== */
    function bindEvents() {
        // 主题
        const tt = $('#themeToggle'); if (tt) tt.addEventListener('click', toggleTheme);

        // 设置面板
        const sb = $('#settingsBtn'); if (sb) sb.addEventListener('click', openSettings);
        const smc = $('#settingsModalClose'); if (smc) smc.addEventListener('click', closeSettings);
        const sm = $('#settingsModal'); if (sm) sm.addEventListener('click', e => { if (e.target === sm) closeSettings(); });
        const ssb = $('#settingsSaveBtn'); if (ssb) ssb.addEventListener('click', saveSettings);
        const srb = $('#settingsResetBtn'); if (srb) srb.addEventListener('click', resetSettings);

        // 海报添加方式切换
        $$('.poster-add-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.poster-add-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const method = tab.dataset.posterMethod;
                $('#posterUrlPanel').style.display = method === 'url' ? 'block' : 'none';
                $('#posterUploadPanel').style.display = method === 'upload' ? 'block' : 'none';
            });
        });

        // 添加海报 (URL)
        const apb = $('#addPosterUrlBtn');
        if (apb) apb.addEventListener('click', () => {
            handleImageUrl($('#newPosterUrl').value, $('#newPosterTitle').value);
        });

        // 添加海报 (上传)
        const dz = $('#settingsDropzone');
        const fi = $('#settingsFileInput');
        if (dz && fi) {
            dz.addEventListener('click', () => fi.click());
            dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
            dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
            dz.addEventListener('drop', e => {
                e.preventDefault(); dz.classList.remove('drag-over');
                const file = e.dataTransfer.files[0];
                if (file) handleImageFile(file, $('#newPosterTitle2').value);
            });
            fi.addEventListener('change', () => {
                const file = fi.files[0];
                if (file) handleImageFile(file, $('#newPosterTitle2').value);
                fi.value = '';
            });
        }

        // 删除海报 (全局函数)
        window._removePoster = removePoster;

        // 空状态上传按钮
        const eub = $('#emptyUploadBtn');
        if (eub) eub.addEventListener('click', openSettings);

        // 下载全部
        const dab = $('#downloadAllBtn');
        if (dab) dab.addEventListener('click', downloadAllPosters);

        // 图片预览
        const ipc = $('#imagePreviewClose');
        const ipm = $('#imagePreviewModal');
        if (ipc) ipc.addEventListener('click', closePreview);
        if (ipm) ipm.addEventListener('click', e => { if (e.target === ipm) closePreview(); });
        const ppb = $('#previewPrevBtn'); if (ppb) ppb.addEventListener('click', prevPreview);
        const pnb = $('#previewNextBtn'); if (pnb) pnb.addEventListener('click', nextPreview);

        // 全屏
        const fb = $('#fullscreenBtn'); if (fb) fb.addEventListener('click', toggleFullscreen);

        // 视频流
        const lsb = $('#loadStream');
        if (lsb) lsb.addEventListener('click', () => loadVideoStream($('#streamUrl').value));
        const su = $('#streamUrl');
        if (su) su.addEventListener('keydown', e => { if (e.key === 'Enter') loadVideoStream(su.value); });

        // 分享
        const shb = $('#shareBtn'); if (shb) shb.addEventListener('click', openShare);
        const smc2 = $('#shareModalClose'); if (smc2) smc2.addEventListener('click', closeShare);
        const sm2 = $('#shareModal'); if (sm2) sm2.addEventListener('click', e => { if (e.target === sm2) closeShare(); });
        const clb = $('#copyLinkBtn'); if (clb) clb.addEventListener('click', copyShareLink);

        // 聊天
        const csb = $('#chatSendBtn'); if (csb) csb.addEventListener('click', sendChat);
        const ci = $('#chatInput');
        if (ci) ci.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

        // 面板 Tab
        $$('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                $$('.panel-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const t = tab.dataset.tab;
                ['panelChat','panelQA','panelDocs'].forEach(id => {
                    const el = $('#' + id); if (el) el.style.display = 'none';
                });
                const el = $('#panel' + t.charAt(0).toUpperCase() + t.slice(1));
                if (el) el.style.display = 'flex';
            });
        });

        // 专家图展开/收起
        let expanded = false;
        const eeb = $('#expertExpandBtn');
        if (eeb) eeb.addEventListener('click', () => {
            expanded = !expanded;
            const w = $('#expertImageWrapper');
            if (w) { w.classList.toggle('expanded', expanded); }
            const span = eeb.querySelector('span');
            const svg = eeb.querySelector('svg');
            if (span) span.textContent = expanded ? '收起' : '展开全图';
            if (svg) svg.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        // PiP
        const pip = $('#pipBtn');
        if (pip) pip.addEventListener('click', async () => {
            const v = $('#hlsVideo');
            if (v && v.style.display !== 'none' && document.pictureInPictureEnabled) {
                try {
                    if (document.pictureInPictureElement) await document.exitPictureInPicture();
                    else await v.requestPictureInPicture();
                } catch (e) { showToast('PiP 失败'); }
            } else { showToast('请先加载视频流'); }
        });

        // 音量
        const vb = $('#volumeBtn');
        if (vb) vb.addEventListener('click', () => {
            const v = $('#hlsVideo');
            if (v && v.style.display !== 'none') { v.muted = !v.muted; showToast(v.muted ? '已静音' : '已取消静音'); }
        });

        // 键盘快捷键
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if ($('#imagePreviewModal').style.display === 'flex') closePreview();
                else if ($('#settingsModal').style.display === 'flex') closeSettings();
                else closeShare();
            }
            if (e.key === 'ArrowLeft' && $('#imagePreviewModal').style.display === 'flex') { e.preventDefault(); prevPreview(); }
            if (e.key === 'ArrowRight' && $('#imagePreviewModal').style.display === 'flex') { e.preventDefault(); nextPreview(); }

            const active = document.activeElement;
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
            if (!isInput) {
                if (e.key === 'f') { e.preventDefault(); toggleFullscreen(); }
                if (e.key === 'm') {
                    const v = $('#hlsVideo');
                    if (v && v.style.display !== 'none') { v.muted = !v.muted; }
                }
            }
        });

        // 系统主题
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem('live-stream-theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });

        // 页面拖放上传
        document.addEventListener('dragover', e => { e.preventDefault(); });
        document.addEventListener('drop', e => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleImageFile(file, '');
            }
        });

        // 模拟观看人数
        setInterval(() => {
            const vn = $('#viewerNumber');
            if (vn) {
                const base = 1283;
                const delta = Math.floor(Math.random() * 30) - 15;
                vn.textContent = Math.max(800, base + delta).toLocaleString();
            }
        }, 5000);
    }

    /* ==========================================
       初始化
       ========================================== */
    function init() {
        loadConfig();
        initTheme();
        applyConfig();

        // 应用流地址
        if (config.streamUrl) {
            const su = $('#streamUrl');
            if (su) su.value = config.streamUrl;
        }

        bindEvents();

        console.log('%c专家直播间 v2 %c已就绪',
            'color:#6366f1;font-weight:bold;font-size:16px;',
            'color:#a0a0b8;');
        console.log('%c功能：%c设置面板 | 海报管理 | 拖放上传 | 视频推流 | 主题切换',
            'color:#22c55e;font-weight:bold;', 'color:#a0a0b8;');
    }

    init();
})();
