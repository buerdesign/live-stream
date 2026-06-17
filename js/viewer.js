/**
 * 直播观众端 - Viewer
 * 无后台权限；只能调音量，不能暂停视频
 * 从 URL hash 读取配置
 */
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }

  let config = null;
  const viewerMsgs = [];
  const viewerColors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#06b6d4'];
  const viewerNames = ['观众A', '观众B', '观众C', '观众D', '观众E', '观众F'];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ========================
  //   PARSE CONFIG
  // ========================
  // UTF-8 safe base64 decode (matching admin b64EncodeUnicode)
  function b64DecodeUnicode(b64) {
    return decodeURIComponent(atob(b64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

  function formatTime(secs) {
    if (!secs || !isFinite(secs)) return '00:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function parseConfig() {
    const hash = location.hash;
    if (!hash || !hash.startsWith('#config=')) {
      showError('缺少配置参数，请使用正确的分享链接访问。');
      return false;
    }
    try {
      const encoded = hash.replace('#config=', '');
      const json = b64DecodeUnicode(encoded);
      config = JSON.parse(json);
      // Restore video dataUrl from localStorage (too large for URL hash)
      restoreVideoData();
      return true;
    } catch (e) {
      showError('配置参数解析失败，链接可能已损坏。');
      return false;
    }
  }

  function restoreVideoData() {
    if (!config || !config.fakeVideos || config.fakeVideos.length === 0) return;
    // Check if dataUrl is missing (stripped from URL hash)
    var needRestore = false;
    for (var i = 0; i < config.fakeVideos.length; i++) {
      if (!config.fakeVideos[i].dataUrl) { needRestore = true; break; }
    }
    if (!needRestore) return;

    try {
      // Try to find video data from channels storage or legacy state storage
      var savedVideos = [];
      // First check channels storage
      var chRaw = localStorage.getItem('live_channels_v1');
      if (chRaw) {
        var chData = JSON.parse(chRaw);
        var channels = chData.channels || [];
        var idx = chData.activeChannelIdx || 0;
        if (channels[idx] && channels[idx].config && channels[idx].config.fakeVideos) {
          savedVideos = channels[idx].config.fakeVideos;
        }
      }
      // Fallback: legacy storage
      if (savedVideos.length === 0) {
        var raw = localStorage.getItem('live_admin_v2');
        if (raw) {
          var saved = JSON.parse(raw);
          if (saved.fakeVideos && Array.isArray(saved.fakeVideos)) {
            savedVideos = saved.fakeVideos;
          }
        }
      }
      if (savedVideos.length === 0) return;

      for (var j = 0; j < config.fakeVideos.length; j++) {
        // Match by name to restore dataUrl
        var cv = config.fakeVideos[j];
        for (var k = 0; k < savedVideos.length; k++) {
            if (saved.fakeVideos[k].name === cv.name && saved.fakeVideos[k].dataUrl) {
              cv.dataUrl = saved.fakeVideos[k].dataUrl;
              break;
            }
          }
          // Fallback: restore by index
          if (!cv.dataUrl && saved.fakeVideos[j] && saved.fakeVideos[j].dataUrl) {
            cv.dataUrl = saved.fakeVideos[j].dataUrl;
          }
        }
      }
      // Also restore active video dataUrl
      if (saved.fakeVideoDataUrl && config.fakeVideos.length > 0) {
        var aidx = config.activeVideoIdx || 0;
        if (!config.fakeVideos[aidx] || !config.fakeVideos[aidx].dataUrl) {
          var av = config.fakeVideos[aidx] || config.fakeVideos[0];
          if (!av.dataUrl) av.dataUrl = saved.fakeVideoDataUrl;
        }
      }
      config.fakeVideoDataUrl = saved.fakeVideoDataUrl || '';
    } catch(e) {}
  }

  function showError(msg) {
    $('#videoPlaceholder').innerHTML = `<p style="color:var(--danger)">⚠ ${escapeHtml(msg)}</p>`;
  }

  // ========================
  //   RENDER
  // ========================
  function render() {
    if (!config) return;
    const c = config;

    // Meta
    document.title = c.shareTitle || c.title || '直播观看';
    $('#metaTitle').setAttribute('content', c.shareTitle || c.title || '');
    $('#metaDesc').setAttribute('content', c.shareDesc || '');
    $('#metaImage').setAttribute('content', c.shareAvatar || c.coverUrl || '');

    // Nav
    $('#brandName').textContent = c.brandName || '直播平台';
    $('#navTitle').textContent = c.title || '直播';

    // Load stream (handles multi-video)
    loadStream(c);

    // Video selector (show if multiple fake videos)
    renderVideoSelector(c);

    // Intro
    if (c.introText && c.introText.trim()) {
      $('#introSection').classList.remove('hidden');
      $('#introContent').textContent = c.introText;
    }

    // Posters
    if (c.posters && c.posters.length > 0) {
      $('#posterSection').classList.remove('hidden');
      $('#posterSectionTitle').textContent = c.posterTitle || '专家介绍';
      $('#posterList').innerHTML = c.posters.map(url =>
        `<img src="${escapeHtml(url)}" alt="海报" onclick="window._viewerLightbox('${escapeHtml(url)}')">`
      ).join('');
    }

    // Text blocks
    if (c.textBlocks && c.textBlocks.length > 0) {
      $('#textSection').classList.remove('hidden');
      $('#textSectionTitle').textContent = c.textTitle || '文本内容';
      $('#textBlockList').innerHTML = c.textBlocks.map(b =>
        `<div class="text-block">
          <div class="tb-title">${escapeHtml(b.title || '')}</div>
          <div class="tb-body">${escapeHtml(b.body || '')}</div>
        </div>`
      ).join('');
    }
  }

  function loadStream(config) {
    const wrapper = $('#videoWrapper');
    const placeholder = $('#videoPlaceholder');
    const video = $('#liveVideo');
    const streamUrl = config.streamUrl;
    const fakeVideos = (config.fakeVideos || []);
    const activeIdx = (config.activeVideoIdx || 0);
    const fakeVideoUrl = (fakeVideos.length > 0 && fakeVideos[activeIdx]) ? fakeVideos[activeIdx].dataUrl : (config.fakeVideoDataUrl || '');

    // Clear
    video.style.display = 'none';
    video.src = '';
    video.classList.remove('fake-live');
    if (wrapper) wrapper.classList.remove('fake-live');
    const oldIframe = wrapper.querySelector('iframe');
    if (oldIframe) oldIframe.remove();
    if (video._hls) { video._hls.destroy(); video._hls = null; }

    // Remove old ended handler (only one at a time)
    if (video._endedHandler) {
      video.removeEventListener('ended', video._endedHandler);
      video._endedHandler = null;
    }

    // Priority: stream URL > fake video
    if (streamUrl) {
      if (streamUrl.includes('.m3u8')) {
        placeholder.style.display = 'none';
        video.style.display = '';
        if (window.Hls && Hls.isSupported()) {
          const hls = new Hls({ autoStartLoad: true });
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          video._hls = hls;
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.volume = parseFloat($('#adminVolume').value) || 0.8;
            setupAntiPause(video);
            video.play().catch(() => {});
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.volume = parseFloat($('#adminVolume').value) || 0.8;
          setupAntiPause(video);
          video.play().catch(() => {});
        }
      } else if (streamUrl.startsWith('http')) {
        placeholder.style.display = 'none';
        const iframe = document.createElement('iframe');
        iframe.src = streamUrl;
        iframe.allow = 'autoplay; fullscreen';
        iframe.allowFullscreen = true;
        wrapper.appendChild(iframe);
      }
    } else if (fakeVideoUrl) {
      // Fake live: always looping in background, "pause" = muted + overlay
      placeholder.style.display = 'none';
      video.style.display = '';

      // Clean old fake-live state
      if (video._flTimer) { clearInterval(video._flTimer); video._flTimer = null; }
      if (video._timeUpdateHandler) { video.removeEventListener('timeupdate', video._timeUpdateHandler); video._timeUpdateHandler = null; }
      if (video._metaHandler) { video.removeEventListener('loadedmetadata', video._metaHandler); video._metaHandler = null; }
      var oldOverlay = wrapper.querySelector('.flpo-overlay');
      if (oldOverlay) oldOverlay.remove();
      wrapper.classList.add('fake-live');

      video.removeAttribute('controls');
      video.classList.add('fake-live');
      video.src = fakeVideoUrl;
      video.loop = true;
      video._flStart = Date.now();
      video._flPaused = false;
      video._flOffset = 0;

      // timeupdate: sync progress bar + time display
      video._timeUpdateHandler = function() {
        if (!video.duration || !isFinite(video.duration)) return;
        var pct = (video.currentTime / video.duration) * 100;
        var bar = $('#vcProgressFilled');
        if (bar) bar.style.width = pct + '%';
        var timeEl = $('#vcTime');
        if (timeEl) timeEl.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
      };
      video.addEventListener('timeupdate', video._timeUpdateHandler);

      // loadedmetadata: show duration
      video._metaHandler = function() {
        var timeEl = $('#vcTime');
        if (timeEl) timeEl.textContent = '00:00 / ' + formatTime(video.duration);
        var prog = $('#vcProgress');
        if (prog) prog.classList.remove('hidden');
      };
      video.addEventListener('loadedmetadata', video._metaHandler);

      video.muted = true;
      video.volume = 0;
      video.play().then(function() {
        video._flPaused = false;
        video._flStart = Date.now();
        video.muted = false;
        video.volume = parseFloat($('#adminVolume').value) || 0.8;
        startViewerFakeLiveTimer(video);
        updateViewerPlayBtn(false);
        var prog = $('#vcProgress');
        if (prog) prog.classList.remove('hidden');
      }).catch(function() {
        updateViewerPlayBtn(true);
        var prog = $('#vcProgress');
        if (prog) prog.classList.remove('hidden');
      });
    }
  }

  function stopViewerFakeLiveTimer(video) {
    if (video._flTimer) { clearInterval(video._flTimer); video._flTimer = null; }
    if (video._timeUpdateHandler) { video.removeEventListener('timeupdate', video._timeUpdateHandler); video._timeUpdateHandler = null; }
    if (video._metaHandler) { video.removeEventListener('loadedmetadata', video._metaHandler); video._metaHandler = null; }
    var wrapper = $('#videoWrapper');
    if (wrapper) wrapper.classList.remove('fake-live');
    video.classList.remove('fake-live');
    var prog = $('#vcProgress');
    if (prog) prog.classList.add('hidden');
  }

  function startViewerFakeLiveTimer(video) {
    stopViewerFakeLiveTimer(video);
    video._flTimer = setInterval(function() {
      if (video.duration && video.duration > 0) {
        var elapsed = video._flOffset + (Date.now() - video._flStart) / 1000;
        var target = elapsed % video.duration;
        if (Math.abs(video.currentTime - target) > 1.5) {
          video.currentTime = target;
        }
      }
    }, 1000);
  }

  function toggleViewerPause() {
    var video = $('#liveVideo');
    var wrapper = $('#videoWrapper');
    if (!video || !video.classList.contains('fake-live')) return;

    if (video._flPaused) {
      // RESUME
      video._flPaused = false;
      video._flOffset += (Date.now() - video._flStart) / 1000;
      video._flStart = Date.now();
      video.muted = false;
      video.volume = parseFloat($('#adminVolume').value) || 0.8;
      if (video.paused) video.play().catch(function(){});
      startViewerFakeLiveTimer(video);
      updateViewerPlayBtn(false);
      var ov = wrapper ? wrapper.querySelector('.flpo-overlay') : null;
      if (ov) ov.remove();
    } else {
      // PAUSE (visual only)
      video._flPaused = true;
      video._flOffset += (Date.now() - video._flStart) / 1000;
      video.muted = true;
      if (video._flTimer) { clearInterval(video._flTimer); video._flTimer = null; }
      updateViewerPlayBtn(true);
      if (wrapper && !wrapper.querySelector('.flpo-overlay')) {
        var overlay = document.createElement('div');
        overlay.className = 'flpo-overlay';
        overlay.innerHTML = '<div class="flpo-inner"><div class="flpo-icon">⏸</div><div class="flpo-text">直播暂停中</div><div class="flpo-hint">点击继续观看</div></div>';
        overlay.addEventListener('click', toggleViewerPause);
        wrapper.appendChild(overlay);
      }
    }
  }

  function updateViewerPlayBtn(isPaused) {
    var btn = $('#btnPlayPause');
    if (btn) btn.textContent = isPaused ? '▶' : '⏸';
  }

  function renderVideoSelector(config) {
    const selector = $('#videoSelector');
    const btn = $('#videoSelectorBtn');
    const label = $('#videoSelectorLabel');
    const dropdown = $('#videoSelectorDropdown');
    if (!selector || !btn || !label || !dropdown) return;

    const fakeVideos = (config.fakeVideos || []);
    const hasMulti = fakeVideos.length > 1;

    if (hasMulti) {
      selector.style.display = '';
      const activeIdx = (config.activeVideoIdx || 0);
      const activeVideo = fakeVideos[activeIdx] || fakeVideos[0];
      label.textContent = (activeVideo.name || '视频' + (activeIdx + 1));

      // Build dropdown
      let html = '';
      for (let i = 0; i < fakeVideos.length; i++) {
        const v = fakeVideos[i];
        const isActive = (i === activeIdx);
        html += `<div class="video-selector-option${isActive ? ' active' : ''}" data-vidx="${i}">
          <span class="vso-dot"></span>
          <span class="vso-name">${escapeHtml(v.name || '视频' + (i + 1))}</span>
        </div>`;
      }
      dropdown.innerHTML = html;

      // Toggle dropdown
      btn.onclick = function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      };

      // Select video
      const options = dropdown.querySelectorAll('.video-selector-option');
      for (let i = 0; i < options.length; i++) {
        options[i].addEventListener('click', function() {
          const idx = parseInt(this.getAttribute('data-vidx'));
          switchVideo(config, idx);
          dropdown.classList.remove('open');
        });
      }
    } else if (fakeVideos.length === 1) {
      selector.style.display = '';
      label.textContent = (fakeVideos[0].name || '伪直播');
      btn.onclick = null;
      dropdown.classList.remove('open');
      dropdown.innerHTML = '';
    } else {
      selector.style.display = 'none';
    }
  }

  function switchVideo(config, idx) {
    const fakeVideos = (config.fakeVideos || []);
    if (idx < 0 || idx >= fakeVideos.length) return;

    config.activeVideoIdx = idx;
    loadStream(config);

    // Update selector UI
    const label = $('#videoSelectorLabel');
    if (label) label.textContent = (fakeVideos[idx].name || '视频' + (idx + 1));

    const options = $('#videoSelectorDropdown').querySelectorAll('.video-selector-option');
    for (let i = 0; i < options.length; i++) {
      options[i].classList.toggle('active', parseInt(options[i].getAttribute('data-vidx')) === idx);
    }
  }

  // Anti-pause: viewer can only control volume, not pause
  // Only set up once per video element (flag-based)
  function setupAntiPause(video) {
    if (video._antiPauseSetup) return; // already set up
    video._antiPauseSetup = true;

    // Remove default controls
    video.removeAttribute('controls');

    // Prevent right-click
    video.addEventListener('contextmenu', (e) => e.preventDefault());

    // Detect pause: if video is paused and not ended, auto-resume
    video.addEventListener('pause', () => {
      if (!video.ended && video.readyState > 0) {
        setTimeout(() => {
          if (video.paused && !video.ended) {
            video.play().catch(() => {});
          }
        }, 200);
      }
    });

    // Block keyboard space (play/pause toggle)
    video.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Block click-to-pause for video element
    video.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  // ========================
  //   CHAT (viewer)
  // ========================
  function sendChatMsg(text) {
    if (!text || !text.trim()) return;
    const idx = viewerMsgs.length % viewerNames.length;
    const name = viewerNames[idx];
    const color = viewerColors[idx % viewerColors.length];
    viewerMsgs.push({ name, text: text.trim(), color });
    renderChat();
    $('#chatInput').value = '';
  }

  function renderChat() {
    const body = $('#chatBody');
    if (viewerMsgs.length === 0) {
      body.innerHTML = '<div class="chat-empty">暂无消息</div>';
      return;
    }
    body.innerHTML = viewerMsgs.map(m => `
      <div class="chat-msg">
        <div class="avatar" style="background:${m.color}22;color:${m.color}">${m.name[0]}</div>
        <div class="msg-content">
          <div class="msg-name">${escapeHtml(m.name)}</div>
          <div class="msg-text">${escapeHtml(m.text)}</div>
        </div>
      </div>
    `).join('');
    body.scrollTop = body.scrollHeight;
  }

  // ========================
  //   VOLUME
  // ========================
  function setupVolume() {
    const vol = $('#adminVolume');
    vol.addEventListener('input', () => {
      const v = parseFloat(vol.value);
      const video = $('#liveVideo');
      if (video) video.volume = v;
    });
  }

  // ========================
  //   INIT
  // ========================
  function init() {
    if (!parseConfig()) return;
    render();
    setupVolume();

    // Play/pause button (fake-live mode)
    var btnPlayPause = $('#btnPlayPause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', toggleViewerPause);
    }

    // Fullscreen
    $('#btnFullscreen').addEventListener('click', () => {
      const wrapper = $('#videoWrapper');
      if (wrapper.requestFullscreen) wrapper.requestFullscreen();
      else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
    });

    // Chat
    $('#btnChatSend').addEventListener('click', () => sendChatMsg($('#chatInput').value));
    $('#chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChatMsg($('#chatInput').value);
    });

    // Close video selector dropdown on outside click
    document.addEventListener('click', () => {
      const dropdown = $('#videoSelectorDropdown');
      if (dropdown) dropdown.classList.remove('open');
    });

    // Lightbox
    $('#btnLightboxClose').addEventListener('click', () => $('#lightbox').classList.remove('open'));
    $('#lightbox').addEventListener('click', (e) => {
      if (e.target === $('#lightbox')) $('#lightbox').classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#lightbox').classList.contains('open')) {
        $('#lightbox').classList.remove('open');
      }
    });
  }

  window._viewerLightbox = function(url) {
    $('#lightboxImg').src = url;
    $('#lightbox').classList.add('open');
  };

  init();
})();
