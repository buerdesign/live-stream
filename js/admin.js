/**
 * 直播管理后台 v2 - 极简架构
 * 一个 state → 一个 render → 事件直接绑定
 */
(function() {
  'use strict';

  var $ = function(s) { return document.querySelector(s); };
  var $$ = function(s) { return document.querySelectorAll(s); };

  // ========================================
  //  STATE - 单一数据源
  // ========================================
  var state = {
    brandName: '直播平台',
    title: '直播标题（点击编辑）',
    coverUrl: '',
    streamUrl: '',
    // 多视频支持：fakeVideos = [{name, dataUrl}], activeIdx = 当前播放索引
    fakeVideos: [],
    fakeVideoDataUrl: '',  // 兼容旧数据，指向 active 视频的 dataUrl
    fakeVideoName: '',       // 兼容旧数据
    activeVideoIdx: 0,
    introText: '',
    posterTitle: '专家介绍',
    posters: [],
    textTitle: '文本内容',
    textBlocks: [],
    shareAvatar: '',
    shareTitle: '',
    shareDesc: '',
    // 多频道管理
    channels: [],
    activeChannelIdx: 0
  };

  var STORAGE_KEY = 'live_admin_v2';
  var CHANNELS_KEY = 'live_channels_v1';

  // ========================================
  //  CHANNEL MANAGEMENT
  // ========================================
  function getChannelConfig() {
    // Extract config fields from state (exclude channel meta)
    return {
      brandName: state.brandName, title: state.title, coverUrl: state.coverUrl,
      streamUrl: state.streamUrl, fakeVideos: state.fakeVideos,
      fakeVideoDataUrl: state.fakeVideoDataUrl, fakeVideoName: state.fakeVideoName,
      activeVideoIdx: state.activeVideoIdx, introText: state.introText,
      posterTitle: state.posterTitle, posters: state.posters,
      textTitle: state.textTitle, textBlocks: state.textBlocks,
      shareAvatar: state.shareAvatar, shareTitle: state.shareTitle, shareDesc: state.shareDesc
    };
  }

  function applyChannelConfig(cfg) {
    for (var k in cfg) {
      if (cfg.hasOwnProperty(k) && state.hasOwnProperty(k)) {
        state[k] = cfg[k];
      }
    }
  }

  function loadChannels() {
    try {
      var raw = localStorage.getItem(CHANNELS_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        state.channels = data.channels || [];
        state.activeChannelIdx = data.activeChannelIdx || 0;
        // Validate
        if (!Array.isArray(state.channels) || state.channels.length === 0) {
          state.channels = [{ name: '默认频道', config: getChannelConfig() }];
          state.activeChannelIdx = 0;
        }
        if (state.activeChannelIdx >= state.channels.length) state.activeChannelIdx = 0;
        // Apply current channel config
        var ch = state.channels[state.activeChannelIdx];
        if (ch && ch.config) applyChannelConfig(ch.config);
      } else {
        // First time: create default channel from current state
        state.channels = [{ name: '默认频道', config: getChannelConfig() }];
        state.activeChannelIdx = 0;
        saveChannels();
      }
    } catch(e) {
      state.channels = [{ name: '默认频道', config: getChannelConfig() }];
      state.activeChannelIdx = 0;
    }
  }

  function saveChannels() {
    try {
      var ch = state.channels[state.activeChannelIdx];
      if (ch) ch.config = getChannelConfig();
      localStorage.setItem(CHANNELS_KEY, JSON.stringify({
        channels: state.channels, activeChannelIdx: state.activeChannelIdx
      }));
    } catch(e) {}
  }

  function saveCurrentChannelConfig() {
    var ch = state.channels[state.activeChannelIdx];
    if (ch) ch.config = getChannelConfig();
  }

  function refreshChannelSelector() {
    var sel = $('#channelSelect');
    if (!sel) return;
    sel.innerHTML = '';
    for (var i = 0; i < state.channels.length; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = state.channels[i].name || ('频道' + (i + 1));
      if (i === state.activeChannelIdx) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function switchChannel(idx) {
    if (idx < 0 || idx >= state.channels.length) return;
    // Save current before switching
    saveCurrentChannelConfig();
    // Switch
    state.activeChannelIdx = idx;
    var ch = state.channels[idx];
    if (ch && ch.config) applyChannelConfig(ch.config);
    saveChannels();
    render();
    // Refresh drawer if open
    if ($('#drawerOverlay').classList.contains('open')) {
      openDrawer();
    }
  }

  function newChannel() {
    var name = prompt('请输入新频道名称：', '新频道');
    if (!name) return;
    saveCurrentChannelConfig();
    state.channels.push({ name: name, config: getEmptyConfig() });
    state.activeChannelIdx = state.channels.length - 1;
    applyChannelConfig(getEmptyConfig());
    saveChannels();
    render();
    if ($('#drawerOverlay').classList.contains('open')) {
      openDrawer();
    }
  }

  function deleteChannel() {
    if (state.channels.length <= 1) {
      alert('至少保留一个频道');
      return;
    }
    var ch = state.channels[state.activeChannelIdx];
    if (!confirm('确定删除频道 "' + (ch ? ch.name : '') + '" 吗？')) return;
    state.channels.splice(state.activeChannelIdx, 1);
    state.activeChannelIdx = 0;
    applyChannelConfig(state.channels[0].config);
    saveChannels();
    render();
    if ($('#drawerOverlay').classList.contains('open')) {
      openDrawer();
    }
  }

  function getEmptyConfig() {
    return {
      brandName: '直播平台', title: '直播标题（点击编辑）', coverUrl: '',
      streamUrl: '', fakeVideos: [], fakeVideoDataUrl: '', fakeVideoName: '',
      activeVideoIdx: 0, introText: '', posterTitle: '专家介绍', posters: [],
      textTitle: '文本内容', textBlocks: [], shareAvatar: '', shareTitle: '', shareDesc: ''
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var obj = JSON.parse(raw);
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) state[k] = obj[k];
        }
      }
    } catch(e) {}
    migrateOldVideoData();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch(e) {}
  }

  function esc(s) {
    if (!s) return '';
    s = String(s);
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ========================================
  //  RENDER - 刷新整个页面
  // ========================================
  function render() {
    // Nav
    var brand = $('#brandName');
    if (brand) brand.textContent = state.brandName || '直播平台';
    var navTitle = $('#navTitleInput');
    if (navTitle) navTitle.value = state.title || '';
    document.title = state.title || '直播管理后台';

    // Video: priority = streamUrl(HLS/iframe) > fake video > placeholder
    if (state.streamUrl && state.streamUrl.includes('.m3u8')) {
      loadHLS(state.streamUrl);
    } else if (state.streamUrl && state.streamUrl.startsWith('http')) {
      loadIframe(state.streamUrl);
    } else if (state.fakeVideoDataUrl) {
      loadFakeVideo(state.fakeVideoDataUrl);
    } else {
      showPlaceholder();
    }

    // Intro section
    var introSec = $('#introSection');
    var introCnt = $('#introContent');
    if (state.introText && state.introText.trim()) {
      if (introSec) introSec.classList.remove('hidden');
      if (introCnt) introCnt.textContent = state.introText;
    } else {
      if (introSec) introSec.classList.add('hidden');
    }

    // Poster section
    var posterSec = $('#posterSection');
    var posterTitle = $('#posterSectionTitle');
    var posterList = $('#posterList');
    var postersArr = Array.isArray(state.posters) ? state.posters : [];
    if (postersArr.length > 0) {
      if (posterSec) posterSec.classList.remove('hidden');
      if (posterTitle) posterTitle.textContent = state.posterTitle || '专家介绍';
      if (posterList) {
        var html = '';
        for (var i = 0; i < postersArr.length; i++) {
          var u = String(postersArr[i] || '');
          html += '<img src="' + esc(u) + '" alt="" class="poster-img" data-idx="' + i + '" style="cursor:pointer;width:100%;margin-bottom:16px;border-radius:12px;border:1px solid var(--border)">';
        }
        posterList.innerHTML = html;
      }
    } else {
      if (posterSec) posterSec.classList.add('hidden');
    }

    // Text section
    var textSec = $('#textSection');
    var textTitle = $('#textSectionTitle');
    var textList = $('#textBlockList');
    var blocksArr = Array.isArray(state.textBlocks) ? state.textBlocks : [];
    if (blocksArr.length > 0) {
      if (textSec) textSec.classList.remove('hidden');
      if (textTitle) textTitle.textContent = state.textTitle || '文本内容';
      if (textList) {
        var thtml = '';
        for (var j = 0; j < blocksArr.length; j++) {
          var b = blocksArr[j] || {};
          thtml += '<div class="text-block"><div class="tb-title">' + esc(b.title || '') + '</div><div class="tb-body">' + esc(b.body || '') + '</div></div>';
        }
        textList.innerHTML = thtml;
      }
    } else {
      if (textSec) textSec.classList.add('hidden');
    }

    // Chat init
    initChat();
  }

  function showPlaceholder() {
    var video = $('#liveVideo');
    var ph = $('#videoPlaceholder');
    var wrapper = $('#videoWrapper');
    if (video) { video.style.display = 'none'; video.src = ''; video.classList.remove('fake-live'); stopFakeLiveTimer(video); }
    if (ph) ph.style.display = '';
    // Clean up fake-live UI
    if (wrapper) wrapper.classList.remove('fake-live');
    var overlay = wrapper ? wrapper.querySelector('.flpo-overlay') : null;
    if (overlay) overlay.remove();
    updatePlayBtn(true);
    var prog = $('#vcProgress');
    if (prog) prog.classList.add('hidden');
  }

  function loadHLS(url) {
    var video = $('#liveVideo');
    var ph = $('#videoPlaceholder');
    var wrapper = $('#videoWrapper');
    if (!video || !ph) return;

    // Clear old
    video.style.display = 'none';
    video.src = '';
    if (video._hls) { video._hls.destroy(); video._hls = null; }
    stopFakeLiveTimer(video);
    if (wrapper) wrapper.classList.remove('fake-live');
    if (video) video.classList.remove('fake-live');
    var oldOverlay = wrapper ? wrapper.querySelector('.flpo-overlay') : null;
    if (oldOverlay) oldOverlay.remove();
    var oldIframe = wrapper ? wrapper.querySelector('iframe') : null;
    if (oldIframe) oldIframe.remove();

    if (window.Hls && Hls.isSupported()) {
      ph.style.display = 'none';
      video.style.display = '';
      var hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      video._hls = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, function() {
        video.volume = 0.8;
        video.play().catch(function(){});
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      ph.style.display = 'none';
      video.style.display = '';
      video.src = url;
      video.volume = 0.8;
      video.play().catch(function(){});
    }
  }

  function loadIframe(url) {
    var video = $('#liveVideo');
    var ph = $('#videoPlaceholder');
    var wrapper = $('#videoWrapper');
    if (!ph || !wrapper) return;
    if (video) { video.style.display = 'none'; video.src = ''; video.classList.remove('fake-live'); stopFakeLiveTimer(video); }
    if (wrapper) wrapper.classList.remove('fake-live');
    var old = wrapper.querySelector('iframe');
    if (old) old.remove();
    var oldOverlay = wrapper.querySelector('.flpo-overlay');
    if (oldOverlay) oldOverlay.remove();
    updatePlayBtn(true);
    var prog = $('#vcProgress');
    if (prog) prog.classList.add('hidden');
    ph.style.display = 'none';
    var ifr = document.createElement('iframe');
    ifr.src = url;
    ifr.allow = 'autoplay; fullscreen';
    ifr.allowFullscreen = true;
    ifr.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
    wrapper.appendChild(ifr);
  }

  // ========================================
  //  FAKE LIVE VIDEO (pseudo-live)
  //  Video always loops in background; "pause" only mutes + overlay
  //  "play" jumps to current "live" time point
  // ========================================
  function formatTime(secs) {
    if (!secs || !isFinite(secs)) return '00:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function loadFakeVideo(dataUrl) {
    var video = $('#liveVideo');
    var ph = $('#videoPlaceholder');
    var wrapper = $('#videoWrapper');
    var vcBar = $('#vcBar');
    var vcTime = $('#vcTime');
    if (!video || !ph) return;

    // Clean up old fake-live state
    stopFakeLiveTimer(video);
    var oldIframe = wrapper ? wrapper.querySelector('iframe') : null;
    if (oldIframe) oldIframe.remove();
    var oldOverlay = wrapper ? wrapper.querySelector('.flpo-overlay') : null;
    if (oldOverlay) oldOverlay.remove();

    // Mark wrapper + video as fake-live (CSS shows control bar always)
    if (wrapper) wrapper.classList.add('fake-live');
    video.classList.add('fake-live');

    ph.style.display = 'none';
    video.style.display = '';
    video.src = dataUrl;
    video.loop = true;
    video.removeAttribute('controls');

    // Track fake live state
    video._flStart = Date.now();
    video._flPaused = true;
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

    // loadedmetadata: update duration display
    video._metaHandler = function() {
      var timeEl = $('#vcTime');
      if (timeEl) timeEl.textContent = '00:00 / ' + formatTime(video.duration);
    };
    video.addEventListener('loadedmetadata', video._metaHandler);

    video.muted = true;
    video.volume = 0;
    video.play().then(function() {
      video._flPaused = false;
      video._flStart = Date.now();
      video.muted = false;
      video.volume = parseFloat($('#adminVolume')?.value) || 0.8;
      startFakeLiveTimer(video);
      updatePlayBtn(false);
      var prog = $('#vcProgress');
      if (prog) prog.classList.remove('hidden');
    }).catch(function() {
      updatePlayBtn(true);
      var prog = $('#vcProgress');
      if (prog) prog.classList.remove('hidden');
    });
  }

  function stopFakeLiveTimer(video) {
    if (video._flTimer) { clearInterval(video._flTimer); video._flTimer = null; }
    if (video._timeUpdateHandler) { video.removeEventListener('timeupdate', video._timeUpdateHandler); video._timeUpdateHandler = null; }
    if (video._metaHandler) { video.removeEventListener('loadedmetadata', video._metaHandler); video._metaHandler = null; }
    var wrapper = $('#videoWrapper');
    if (wrapper) wrapper.classList.remove('fake-live');
    video.classList.remove('fake-live');
    var prog = $('#vcProgress');
    if (prog) prog.classList.add('hidden');
  }

  function startFakeLiveTimer(video) {
    stopFakeLiveTimer(video);
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

  function toggleFakeLivePause() {
    var video = $('#liveVideo');
    if (!video || !video.classList.contains('fake-live')) return;
    var wrapper = $('#videoWrapper');

    if (video._flPaused) {
      // RESUME
      video._flPaused = false;
      video._flOffset += (Date.now() - video._flStart) / 1000;
      video._flStart = Date.now();
      video.muted = false;
      video.volume = parseFloat($('#adminVolume')?.value) || 0.8;
      if (video.paused) video.play().catch(function(){});
      startFakeLiveTimer(video);
      updatePlayBtn(false);
      // Remove overlay
      var ov = wrapper ? wrapper.querySelector('.flpo-overlay') : null;
      if (ov) ov.remove();
    } else {
      // PAUSE (visual only)
      video._flPaused = true;
      video._flOffset += (Date.now() - video._flStart) / 1000;
      video.muted = true;
      if (video._flTimer) { clearInterval(video._flTimer); video._flTimer = null; }
      updatePlayBtn(true);
      // Show pause overlay
      if (wrapper && !wrapper.querySelector('.flpo-overlay')) {
        var overlay = document.createElement('div');
        overlay.className = 'flpo-overlay';
        overlay.innerHTML = '<div class="flpo-inner"><div class="flpo-icon">⏸</div><div class="flpo-text">直播暂停中</div><div class="flpo-hint">点击继续观看</div></div>';
        overlay.addEventListener('click', toggleFakeLivePause);
        wrapper.appendChild(overlay);
      }
    }
  }

  function updatePlayBtn(isPaused) {
    var btn = $('#btnPlayPause');
    if (btn) btn.textContent = isPaused ? '▶' : '⏸';
  }


  // ========================================
  //  CHAT
  // ========================================
  var chatMsgs = [];

  function initChat() {
    var body = $('#chatBody');
    if (!body) return;
    if (chatMsgs.length === 0) {
      body.innerHTML = '<div class="chat-empty">暂无消息，发送第一条吧~</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < chatMsgs.length; i++) {
      var m = chatMsgs[i];
      html += '<div class="chat-msg"><div class="avatar" style="background:rgba(249,115,22,0.15);color:#f97316">' + esc(m.name[0]) + '</div><div class="msg-content"><div class="msg-name">' + esc(m.name) + '</div><div class="msg-text">' + esc(m.text) + '</div></div></div>';
    }
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  }

  function sendChat(text) {
    if (!text || !text.trim()) return;
    chatMsgs.push({ name: '管理员', text: text.trim() });
    initChat();
    var inp = $('#chatInput');
    if (inp) inp.value = '';
  }

  // ========================================
  //  SETTINGS DRAWER
  // ========================================
  function openDrawer() {
    // Refresh channel selector
    refreshChannelSelector();

    // Populate form from current state
    var el;
    el = $('#settingTitle'); if (el) el.value = state.title || '';
    el = $('#settingBrand'); if (el) el.value = state.brandName || '';
    el = $('#settingStreamUrl'); if (el) el.value = state.streamUrl || '';
    el = $('#settingIntro'); if (el) el.value = state.introText || '';
    el = $('#settingPosterTitle'); if (el) el.value = state.posterTitle || '专家介绍';
    el = $('#settingTextTitle'); if (el) el.value = state.textTitle || '文本内容';

    // Fake video name
    updateFakeVideoHint();

    // Cover preview
    renderCoverInDrawer();

    // Poster list in drawer
    renderPostersInDrawer();

    // Text blocks in drawer
    renderTextsInDrawer();

    // Video list in drawer
    renderVideoListInDrawer();

    // Switch to basic tab
    switchDrawerTab('basic');

    // Show
    var overlay = $('#drawerOverlay');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    var overlay = $('#drawerOverlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  function switchDrawerTab(tab) {
    var tabs = $$('.drawer-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tab);
    }
    var panels = $$('.tab-panel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].getAttribute('data-panel') === tab);
    }
  }

  function saveSettings() {
    // Read form values into state
    var el;
    el = $('#settingTitle'); if (el) state.title = el.value;
    el = $('#settingBrand'); if (el) state.brandName = el.value;
    el = $('#settingStreamUrl'); if (el) state.streamUrl = el.value;
    el = $('#settingIntro'); if (el) state.introText = el.value;
    el = $('#settingPosterTitle'); if (el) state.posterTitle = el.value || '专家介绍';
    el = $('#settingTextTitle'); if (el) state.textTitle = el.value || '文本内容';

    // Sync active video data url
    if (Array.isArray(state.fakeVideos) && state.fakeVideos.length > 0) {
      var active = state.fakeVideos[state.activeVideoIdx] || state.fakeVideos[0];
      state.fakeVideoDataUrl = active.dataUrl;
      state.fakeVideoName = active.name;
    } else {
      state.fakeVideoDataUrl = '';
      state.fakeVideoName = '';
    }

    // Sync text block data from drawer
    syncTextBlockData();

    saveState();
    saveChannels();
    render();
    closeDrawer();
  }

  function syncTextBlockData() {
    var container = $('#textBlockSettings');
    if (!container) return;
    var titles = container.querySelectorAll('.text-block-title');
    var bodies = container.querySelectorAll('.text-block-body');
    for (var i = 0; i < state.textBlocks.length; i++) {
      if (titles[i]) state.textBlocks[i].title = titles[i].value;
      if (bodies[i]) state.textBlocks[i].body = bodies[i].value;
    }
  }

  // Cover in drawer
  function renderCoverInDrawer() {
    var upload = $('#coverUpload');
    var placeholder = $('#coverPlaceholder');
    if (!upload || !placeholder) return;

    // Clean old img/overlay
    var oldImg = upload.querySelector('img');
    if (oldImg) oldImg.remove();
    var oldOverlay = upload.querySelector('.cover-overlay');
    if (oldOverlay) oldOverlay.remove();

    if (state.coverUrl) {
      upload.classList.add('has-image');
      placeholder.style.display = 'none';
      var img = document.createElement('img');
      img.src = state.coverUrl;
      img.alt = '封面';
      upload.appendChild(img);

      var overlay = document.createElement('div');
      overlay.className = 'cover-overlay';
      overlay.innerHTML = '<div class="cover-actions"><button class="btn-change">更换</button><button class="btn-remove">删除</button></div>';
      upload.appendChild(overlay);

      overlay.querySelector('.btn-change').addEventListener('click', function(e) {
        e.stopPropagation();
        var inp = $('#coverInput');
        if (inp) inp.click();
      });
      overlay.querySelector('.btn-remove').addEventListener('click', function(e) {
        e.stopPropagation();
        state.coverUrl = '';
        renderCoverInDrawer();
      });
    } else {
      upload.classList.remove('has-image');
      placeholder.style.display = '';
    }
  }

  // Posters in drawer
  function renderPostersInDrawer() {
    var list = $('#posterImgList');
    if (!list) return;
    var posters = Array.isArray(state.posters) ? state.posters : [];
    var html = '';
    for (var i = 0; i < posters.length; i++) {
      html += '<div class="img-item"><img class="img-thumb" src="' + esc(posters[i]) + '" alt=""><span class="img-url">' + esc(posters[i]) + '</span><button class="btn-xs" data-rm="' + i + '">删除</button></div>';
    }
    list.innerHTML = html;

    var btns = list.querySelectorAll('[data-rm]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-rm'));
        state.posters.splice(idx, 1);
        renderPostersInDrawer();
      });
    }
  }

  // Text blocks in drawer
  function renderTextsInDrawer() {
    var container = $('#textBlockSettings');
    if (!container) return;
    var blocks = Array.isArray(state.textBlocks) ? state.textBlocks : [];
    var html = '';
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i] || {};
      html += '<div class="text-block-item">';
      html += '<div class="tb-header"><span class="tb-label">模块 ' + (i + 1) + '</span><div class="tb-actions">';
      if (i > 0) html += '<button data-move="up-' + i + '">↑</button>';
      if (i < blocks.length - 1) html += '<button data-move="down-' + i + '">↓</button>';
      html += '<button class="btn-danger" data-del="' + i + '">✕ 删除</button>';
      html += '</div></div>';
      html += '<div class="form-group"><label class="form-label">标题</label><input type="text" class="form-input text-block-title" value="' + esc(b.title || '') + '" placeholder="模块标题"></div>';
      html += '<div class="form-group"><label class="form-label">内容</label><textarea class="form-textarea text-block-body" placeholder="模块内容" rows="3">' + esc(b.body || '') + '</textarea></div>';
      html += '</div>';
    }
    container.innerHTML = html;

    // Delete buttons
    var delBtns = container.querySelectorAll('[data-del]');
    for (var d = 0; d < delBtns.length; d++) {
      delBtns[d].addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-del'));
        state.textBlocks.splice(idx, 1);
        renderTextsInDrawer();
      });
    }
    // Move buttons
    var moveBtns = container.querySelectorAll('[data-move]');
    for (var m = 0; m < moveBtns.length; m++) {
      moveBtns[m].addEventListener('click', function() {
        var parts = this.getAttribute('data-move').split('-');
        var dir = parts[0];
        var idx = parseInt(parts[1]);
        var blocks = state.textBlocks;
        if (dir === 'up' && idx > 0) {
          var tmp = blocks[idx]; blocks[idx] = blocks[idx - 1]; blocks[idx - 1] = tmp;
        } else if (dir === 'down' && idx < blocks.length - 1) {
          var tmp2 = blocks[idx]; blocks[idx] = blocks[idx + 1]; blocks[idx + 1] = tmp2;
        }
        renderTextsInDrawer();
      });
    }
  }

  // ========================================
  //  SHARE
  // ========================================
  function openShareModal() {
    var el;
    el = $('#inputShareTitle'); if (el) el.value = state.shareTitle || state.title || '';
    el = $('#inputShareDesc'); if (el) el.value = state.shareDesc || '';
    el = $('#shareAvatarUrl'); if (el) el.value = state.shareAvatar || '';
    el = $('#shareLink'); if (el) el.value = '';
    var modal = $('#shareModal');
    if (modal) modal.classList.add('open');
  }

  function closeShareModal() {
    var modal = $('#shareModal');
    if (modal) modal.classList.remove('open');
  }

  function generateShareLink() {
    // Sync share fields
    var el;
    el = $('#inputShareTitle'); if (el) state.shareTitle = el.value;
    el = $('#inputShareDesc'); if (el) state.shareDesc = el.value;
    el = $('#shareAvatarUrl'); if (el) { var u = el.value.trim(); if (u) state.shareAvatar = u; }
    saveState();
    saveChannels();

    var shareUrl = buildViewerUrl();
    var linkEl = $('#shareLink');
    if (linkEl) linkEl.value = shareUrl;
  }

  // Video list in drawer
  function renderVideoListInDrawer() {
    var list = $('#videoList');
    if (!list) return;
    var videos = Array.isArray(state.fakeVideos) ? state.fakeVideos : [];
    if (videos.length === 0) {
      list.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted)">暂无视频，点击上方区域上传</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i] || {};
      var isActive = (i === state.activeVideoIdx);
      html += '<div class="video-item' + (isActive ? ' active' : '') + '" data-idx="' + i + '">';
      html += '<span class="vi-icon">🎬</span>';
      html += '<div class="vi-info"><div class="vi-name">' + esc(v.name || '未命名') + '</div>';
      html += '<div class="vi-badge">' + (isActive ? '✓ 当前播放' : '') + '</div></div>';
      html += '<div class="vi-actions">';
      if (!isActive) {
        html += '<button class="vi-set-main" data-set="' + i + '">设为主播</button>';
      }
      html += '<button data-del-video="' + i + '">删除</button>';
      html += '</div></div>';
    }
    list.innerHTML = html;

    // Bind set-main buttons
    var setBtns = list.querySelectorAll('[data-set]');
    for (var s = 0; s < setBtns.length; s++) {
      setBtns[s].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-set'));
        setActiveVideo(idx);
      });
    }

    // Bind delete buttons
    var delBtns = list.querySelectorAll('[data-del-video]');
    for (var d = 0; d < delBtns.length; d++) {
      delBtns[d].addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.getAttribute('data-del-video'));
        deleteVideo(idx);
      });
    }
  }

  function setActiveVideo(idx) {
    if (!Array.isArray(state.fakeVideos)) return;
    if (idx < 0 || idx >= state.fakeVideos.length) return;
    state.activeVideoIdx = idx;
    var v = state.fakeVideos[idx];
    state.fakeVideoDataUrl = v.dataUrl;
    state.fakeVideoName = v.name;
    renderVideoListInDrawer();
    updateFakeVideoHint();
    saveState();
    saveChannels();
    render();
  }

  function deleteVideo(idx) {
    if (!Array.isArray(state.fakeVideos)) return;
    if (idx < 0 || idx >= state.fakeVideos.length) return;
    state.fakeVideos.splice(idx, 1);
    // Adjust active index
    if (state.fakeVideos.length === 0) {
      state.activeVideoIdx = 0;
      state.fakeVideoDataUrl = '';
      state.fakeVideoName = '';
    } else if (state.activeVideoIdx >= state.fakeVideos.length) {
      state.activeVideoIdx = 0;
      var v = state.fakeVideos[0];
      state.fakeVideoDataUrl = v.dataUrl;
      state.fakeVideoName = v.name;
    }
    renderVideoListInDrawer();
    updateFakeVideoHint();
    saveState();
    saveChannels();
    render();
  }

  function updateFakeVideoHint() {
    var hint = $('#fakeVideoName');
    if (!hint) return;
    if (state.fakeVideos.length === 0) {
      hint.textContent = '';
    } else {
      var v = state.fakeVideos[state.activeVideoIdx] || state.fakeVideos[0];
      hint.textContent = '当前播放: ' + (v.name || '');
    }
  }

  function migrateOldVideoData() {
    // Migrate old single video to new array format
    if (state.fakeVideoDataUrl && (!Array.isArray(state.fakeVideos) || state.fakeVideos.length === 0)) {
      state.fakeVideos = [{
        name: state.fakeVideoName || '视频1',
        dataUrl: state.fakeVideoDataUrl
      }];
      state.activeVideoIdx = 0;
    }
  }

  // UTF-8 safe base64 encode
  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(m, p) {
      return String.fromCharCode('0x' + p);
    }));
  }

  function buildViewerUrl() {
    var base = location.origin + location.pathname.replace(/index\.html$/, 'view.html');
    // Only include current channel config (not all channels)
    var viewerState = JSON.parse(JSON.stringify(getChannelConfig()));
    // Include share meta
    viewerState.shareAvatar = state.shareAvatar;
    viewerState.shareTitle = state.shareTitle;
    viewerState.shareDesc = state.shareDesc;
    // Strip video dataUrl (too large for URL hash)
    if (Array.isArray(viewerState.fakeVideos)) {
      for (var i = 0; i < viewerState.fakeVideos.length; i++) {
        delete viewerState.fakeVideos[i].dataUrl;
      }
    }
    delete viewerState.fakeVideoDataUrl;
    var payload = b64EncodeUnicode(JSON.stringify(viewerState));
    return base + '#config=' + payload;
  }

  function openPreview() {
    window.open(buildViewerUrl(), '_blank');
  }

  function copyShareLink() {
    var link = $('#shareLink');
    if (!link) return;
    link.select();
    try {
      document.execCommand('copy');
      alert('链接已复制到剪贴板！');
    } catch(e) {
      alert('复制失败，请手动复制。');
    }
  }

  // ========================================
  //  LIGHTBOX
  // ========================================
  function openLightbox(url) {
    var el = $('#lightboxImg');
    var lb = $('#lightbox');
    if (el) el.src = url;
    if (lb) lb.classList.add('open');
  }

  function closeLightbox() {
    var lb = $('#lightbox');
    if (lb) lb.classList.remove('open');
  }

  // ========================================
  //  INIT - 所有事件绑定 + 首次渲染
  // ========================================
  function init() {
    console.log('[admin] init start');

    // --- Settings button ---
    var btnSettings = $('#btnSettings');
    if (btnSettings) {
      btnSettings.addEventListener('click', function() {
        console.log('[admin] settings clicked');
        openDrawer();
      });
    } else { console.error('[admin] btnSettings NOT FOUND'); }

    // --- Preview button ---
    var btnPreview = $('#btnPreview');
    if (btnPreview) {
      btnPreview.addEventListener('click', function() {
        console.log('[admin] preview clicked');
        openPreview();
      });
    } else { console.error('[admin] btnPreview NOT FOUND'); }

    // --- Share button ---
    var btnShare = $('#btnShare');
    if (btnShare) {
      btnShare.addEventListener('click', function() {
        console.log('[admin] share clicked');
        openShareModal();
      });
    } else { console.error('[admin] btnShare NOT FOUND'); }

    // --- Chat send ---
    var btnChat = $('#btnChatSend');
    var chatInput = $('#chatInput');
    if (btnChat) {
      btnChat.addEventListener('click', function() {
        console.log('[admin] chat send clicked');
        sendChat(chatInput ? chatInput.value : '');
      });
    } else { console.error('[admin] btnChatSend NOT FOUND'); }
    if (chatInput) {
      chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendChat(this.value);
      });
    }

    // --- Drawer close ---
    var btnDrawerClose = $('#btnDrawerClose');
    if (btnDrawerClose) {
      btnDrawerClose.addEventListener('click', closeDrawer);
    }

    // --- Drawer overlay click ---
    var drawerOverlay = $('#drawerOverlay');
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', function(e) {
        if (e.target === drawerOverlay) closeDrawer();
      });
    }

    // --- Drawer tabs ---
    var drawerTabs = $$('.drawer-tab');
    for (var ti = 0; ti < drawerTabs.length; ti++) {
      drawerTabs[ti].addEventListener('click', function() {
        switchDrawerTab(this.getAttribute('data-tab'));
      });
    }

    // --- Channel management ---
    var channelSelect = $('#channelSelect');
    if (channelSelect) {
      channelSelect.addEventListener('change', function() {
        switchChannel(parseInt(this.value));
      });
    }
    var btnChannelNew = $('#btnChannelNew');
    if (btnChannelNew) {
      btnChannelNew.addEventListener('click', newChannel);
    }
    var btnChannelDel = $('#btnChannelDel');
    if (btnChannelDel) {
      btnChannelDel.addEventListener('click', deleteChannel);
    }

    // --- Save button ---
    var btnSave = $('#btnSaveSettings');
    if (btnSave) {
      btnSave.addEventListener('click', saveSettings);
    }

    // --- Reset button ---
    var btnReset = $('#btnResetSettings');
    if (btnReset) {
      btnReset.addEventListener('click', function() {
        if (!confirm('确定恢复默认？')) return;
        var fresh = getEmptyConfig();
        for (var k in fresh) { if (fresh.hasOwnProperty(k)) state[k] = fresh[k]; }
        saveState();
        saveChannels();
        render();
        openDrawer();
      });
    }

    // --- Cover upload ---
    var coverUpload = $('#coverUpload');
    var coverInput = $('#coverInput');
    if (coverUpload && coverInput) {
      coverUpload.addEventListener('click', function() { coverInput.click(); });
      coverInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
          state.coverUrl = ev.target.result;
          renderCoverInDrawer();
        };
        reader.readAsDataURL(file);
      });
    }

    // --- Fake video upload (multi-video support + progress) ---
    var fvUpload = $('#fakeVideoUpload');
    var fvInput = $('#fakeVideoInput');
    var uploadProgress = $('#uploadProgress');
    var uploadProgressBar = $('#uploadProgressBar');
    var uploadProgressText = $('#uploadProgressText');
    if (fvUpload && fvInput) {
      fvUpload.addEventListener('click', function() { fvInput.click(); });
      fvInput.addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (!file) return;

        // Show progress bar
        if (uploadProgress) uploadProgress.classList.remove('hidden');
        if (uploadProgressBar) uploadProgressBar.style.width = '0%';
        if (uploadProgressText) uploadProgressText.textContent = '0%';

        var reader = new FileReader();

        reader.onprogress = function(ev) {
          if (ev.lengthComputable) {
            var pct = Math.round((ev.loaded / ev.total) * 100);
            if (uploadProgressBar) uploadProgressBar.style.width = pct + '%';
            if (uploadProgressText) uploadProgressText.textContent = pct + '%';
          }
        };

        reader.onload = function(ev) {
          // Hide progress bar when done
          setTimeout(function() {
            if (uploadProgress) uploadProgress.classList.add('hidden');
          }, 500);

          var dataUrl = ev.target.result;
          var name = file.name;

          if (!Array.isArray(state.fakeVideos)) state.fakeVideos = [];
          state.fakeVideos.push({ name: name, dataUrl: dataUrl });

          // If this is the first video, set as active
          if (state.fakeVideos.length === 1) {
            state.activeVideoIdx = 0;
            state.fakeVideoDataUrl = dataUrl;
            state.fakeVideoName = name;
          }

          renderVideoListInDrawer();
          updateFakeVideoHint();

          // Auto-save and render so video plays immediately on main page
          saveState();
          saveChannels();
          render();
        };

        reader.onerror = function() {
          if (uploadProgress) uploadProgress.classList.add('hidden');
          alert('视频读取失败，请重试');
        };

        reader.readAsDataURL(file);
      });
    }

    // --- Add poster (file upload) ---
    var btnAddPoster = $('#btnAddPoster');
    var posterFileInput = $('#posterFileInput');
    if (btnAddPoster && posterFileInput) {
      btnAddPoster.addEventListener('click', function() {
        posterFileInput.click();
      });
      posterFileInput.addEventListener('change', function(e) {
        var files = e.target.files;
        if (!files || !files.length) return;
        if (!Array.isArray(state.posters)) state.posters = [];
        var total = files.length;
        var loaded = 0;
        for (var i = 0; i < files.length; i++) {
          (function(file) {
            var reader = new FileReader();
            reader.onload = function(ev) {
              state.posters.push(ev.target.result);
              loaded++;
              if (loaded === total) renderPostersInDrawer();
            };
            reader.readAsDataURL(file);
          })(files[i]);
        }
      });
    }
    // --- Add poster (URL) ---
    var btnPosterUrl = $('#btnPosterUrl');
    if (btnPosterUrl) {
      btnPosterUrl.addEventListener('click', function() {
        var url = prompt('请输入海报图片URL：');
        if (!url || !url.trim()) return;
        if (!Array.isArray(state.posters)) state.posters = [];
        state.posters.push(url.trim());
        renderPostersInDrawer();
      });
    }

    // --- Add text block ---
    var btnAddText = $('#btnAddText');
    if (btnAddText) {
      btnAddText.addEventListener('click', function() {
        if (!Array.isArray(state.textBlocks)) state.textBlocks = [];
        state.textBlocks.push({ title: '新模块', body: '' });
        renderTextsInDrawer();
      });
    }

    // --- Nav title ---
    var navTitle = $('#navTitleInput');
    if (navTitle) {
      navTitle.addEventListener('focus', function() { navTitle.classList.add('editing'); });
      navTitle.addEventListener('blur', function() {
        navTitle.classList.remove('editing');
        state.title = navTitle.value;
        document.title = state.title || '直播管理后台';
        saveState();
        saveChannels();
        render();
      });
      navTitle.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') navTitle.blur();
      });
    }

    // --- Share modal buttons ---
    var btnShareClose = $('#btnShareClose');
    var btnShareCancel = $('#btnShareCancel');
    if (btnShareClose) btnShareClose.addEventListener('click', closeShareModal);
    if (btnShareCancel) btnShareCancel.addEventListener('click', closeShareModal);
    var shareModal = $('#shareModal');
    if (shareModal) {
      shareModal.addEventListener('click', function(e) {
        if (e.target === shareModal) closeShareModal();
      });
    }
    var btnGenLink = $('#btnGenerateLink');
    if (btnGenLink) btnGenLink.addEventListener('click', generateShareLink);
    var btnCopyLink = $('#btnCopyLink');
    if (btnCopyLink) btnCopyLink.addEventListener('click', copyShareLink);

    // --- Lightbox ---
    var btnLbClose = $('#btnLightboxClose');
    var lightbox = $('#lightbox');
    if (btnLbClose) btnLbClose.addEventListener('click', closeLightbox);
    if (lightbox) {
      lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) closeLightbox();
      });
    }

    // --- Keyboard ---
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        var dOverlay = $('#drawerOverlay');
        var sModal = $('#shareModal');
        var lb = $('#lightbox');
        if (dOverlay && dOverlay.classList.contains('open')) closeDrawer();
        else if (sModal && sModal.classList.contains('open')) closeShareModal();
        else if (lb && lb.classList.contains('open')) closeLightbox();
      }
    });

    // --- Poster click (delegated) ---
    var posterList = $('#posterList');
    if (posterList) {
      posterList.addEventListener('click', function(e) {
        var img = e.target.closest('.poster-img');
        if (img) openLightbox(img.src);
      });
    }

    // --- Volume control ---
    var volSlider = $('#adminVolume');
    var volPct = $('#adminVolPct');
    if (volSlider) {
      volSlider.addEventListener('input', function() {
        var v = parseFloat(this.value);
        if (volPct) volPct.textContent = Math.round(v * 100) + '%';
        var video = $('#liveVideo');
        if (video) video.volume = v;
      });
    }

    // --- Fullscreen ---
    var btnFull = $('#btnFullscreen');
    if (btnFull) {
      btnFull.addEventListener('click', function() {
        var wrapper = $('#videoWrapper');
        if (!wrapper) return;
        if (wrapper.requestFullscreen) wrapper.requestFullscreen();
        else if (wrapper.webkitRequestFullscreen) wrapper.webkitRequestFullscreen();
      });
    }

    // --- Fake-live pause/play ---
    var btnPlayPause = $('#btnPlayPause');
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', toggleFakeLivePause);
    }

    // --- Drag & drop ---
    document.addEventListener('dragover', function(e) { e.preventDefault(); });
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      var files = e.dataTransfer.files;
      if (!files || !files.length) return;
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!f.type.match(/^image\//)) continue;
        (function(file) {
          var reader = new FileReader();
          reader.onload = function(ev) {
            if (!Array.isArray(state.posters)) state.posters = [];
            state.posters.push(ev.target.result);
            renderPostersInDrawer();
          };
          reader.readAsDataURL(file);
        })(f);
      }
    });

    // --- Drawer inputs → auto-sync (save=persist to state) ---
    var drawerInputs = ['#settingTitle','#settingBrand','#settingStreamUrl','#settingIntro','#settingPosterTitle','#settingTextTitle'];
    for (var di = 0; di < drawerInputs.length; di++) {
      var inp = $(drawerInputs[di]);
      if (!inp) continue;
      inp.addEventListener('input', function() {
        // Just mark as editable - save() reads values
      });
    }

    // --- Help tooltips ---
    var helpIcons = $$('.help-icon');
    for (var hi = 0; hi < helpIcons.length; hi++) {
      helpIcons[hi].addEventListener('click', function(e) {
        e.stopPropagation();
        var tip = document.querySelector('[data-tip="' + this.getAttribute('data-help') + '"]');
        if (tip) tip.classList.toggle('visible');
      });
    }
    document.addEventListener('click', function() {
      var tips = $$('.help-tip');
      for (var t = 0; t < tips.length; t++) tips[t].classList.remove('visible');
    });

    // --- LOAD & RENDER ---
    loadState();
    loadChannels();
    render();

    console.log('[admin] init complete - all listeners registered');
    console.log('[admin] Quick check: btnSettings=', !!$('#btnSettings'), ' btnShare=', !!$('#btnShare'), ' btnChatSend=', !!$('#btnChatSend'));
  }

  // ========================================
  //  START
  // ========================================
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 1);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 1);
    });
  }

})();
