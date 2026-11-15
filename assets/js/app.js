/* ============================================================
   应用层 · 直接访问 / 路由 / 总览大屏 / 成员成长 / 活动 / 作品
   初始数据为空，成员与活动由使用者在本机登记。
   ============================================================ */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = TV.esc;

  const BRAND_LOGO = 'assets/img/brand/turing-mark.png';
  const IDLE_MS = 10 * 60 * 1000;
  const STAGE_MS = 9000;

  const VIEW_LABELS = {
    overview: 'OVERVIEW / 社区总览',
    ladder: 'GROWTH LADDER / 成员成长天梯',
    events: 'EVENTS / 活动打卡',
    works: 'WORKS / 作品现场'
  };

  const STAGE_MODES = [
    ['auto', '自动'],
    ['members', '成员'],
    ['pulse', '数据'],
    ['works', '作品']
  ];

  const state = {
    entered: false,
    view: 'overview',
    members: { sort: 'active', filter: 'all', level: null, query: '', limit: 9, focus: null },
    works: { type: 'ALL', theme: 'ALL', query: '' },
    checkin: { event: null, tab: 'new', query: '', photo: null, color: 0 },
    eventForm: { fromCheckin: false },
    screen: { mode: 'auto', index: 0, playing: true, timer: null },
    command: { open: false, query: '', index: 0, items: [] }
  };

  let lastFocused = null;
  let stageClickTimer = null;
  let idleTimer = null;
  let coverHideTimer = null;
  let lastActivityAt = Date.now();
  const revealedViews = new Set();

  /* ---------------- utilities ---------------- */
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function fmtDate(date) { return String(date || '').replace(/-/g, '.'); }

  function md(date) { return String(date || '').slice(5).replace('-', '.'); }

  function todayValue() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function memberInfo(id) {
    const raw = TD.memberById(id);
    return raw ? TD.memberInfo(raw) : null;
  }

  function eventById(id) {
    return TD.allEvents().find(event => event.id === Number(id)) || null;
  }

  function workById(id) {
    return TD.works.find(work => work.id === Number(id)) || null;
  }

  function latestEvent() {
    const events = TD.allEvents();
    return events[events.length - 1] || null;
  }

  function levelCounts() {
    const counts = new Map(TD.LEVELS.map(level => [level.n, 0]));
    TD.allMembers().forEach(member => counts.set(member.level.n, (counts.get(member.level.n) || 0) + 1));
    return counts;
  }

  function memberWorkCount(member) {
    return TD.authoredWorks(member.id).length + TD.coauthoredWorks(member.id).length;
  }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function clearIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  }

  function scheduleIdleReturn() {
    clearIdleTimer();
    if (!state.entered) return;
    lastActivityAt = Date.now();
    idleTimer = window.setTimeout(returnToCover, IDLE_MS);
  }

  function markActivity() {
    const now = Date.now();
    if (state.entered && now - lastActivityAt < 750) return;
    lastActivityAt = Date.now();
    if (state.entered) scheduleIdleReturn();
  }

  function returnToCover() {
    if (!state.entered) return;
    state.entered = false;
    clearIdleTimer();
    clearTimeout(coverHideTimer);
    stopStageTimer();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if ($('#modal')?.classList.contains('open')) closeModal();
    if ($('#checkin')?.classList.contains('open')) closeCheckin();
    if ($('#command')?.classList.contains('open')) closeCommand();
    document.body.classList.remove('modal-open');
    document.body.classList.add('is-locked');

    const app = $('#app');
    if (app) {
      app.classList.remove('is-in');
      app.setAttribute('aria-hidden', 'true');
    }

    const cover = $('#cover');
    if (cover) {
      cover.style.display = '';
      cover.classList.remove('is-open');
      cover.setAttribute('aria-hidden', 'false');
      window.setTimeout(() => cover.focus({ preventScroll: true }), 80);
    }

    $('#route-transition')?.classList.remove('is-running');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function confetti() {
    const layer = $('#confetti');
    if (!layer) return;
    const colors = ['#1c46e8', '#ffc400', '#f4511e', '#0e1a2c'];
    for (let i = 0; i < 44; i += 1) {
      const piece = document.createElement('i');
      piece.className = 'confetti-piece';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * .35}s`;
      piece.style.animationDuration = `${1.3 + Math.random() * .9}s`;
      piece.style.transform = `rotate(${Math.random() * 180}deg)`;
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 2700);
    }
  }

  function animateCounts(root) {
    $$('[data-count]', root).forEach(el => {
      const target = Number(el.dataset.count) || 0;
      const start = performance.now();
      const duration = 850;
      function tick(now) {
        const progress = clamp((now - start) / duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toString();
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toString();
      }
      requestAnimationFrame(tick);
    });
  }

  function emptySlab(title, text, action = '') {
    return `<div class="empty-slab">
      <span class="empty-radar" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
      <strong>${esc(title)}</strong>
      <p>${esc(text)}</p>
      ${action}
    </div>`;
  }

  function stageBrand() {
    return `<div class="stage-brand"><span class="stage-brand-mark"><img src="${BRAND_LOGO}" alt=""></span><div><strong>图灵研究院</strong><small>TURING AI / COMMUNITY</small></div></div>`;
  }

  /* ---------------- direct entry ---------------- */
  function enterApp() {
    if (state.entered) return;
    state.entered = true;

    const cover = $('#cover');
    if (cover) {
      cover.classList.add('is-open');
      cover.setAttribute('aria-hidden', 'true');
      coverHideTimer = setTimeout(() => { cover.style.display = 'none'; }, 700);
    }

    const app = $('#app');
    if (app) {
      app.classList.add('is-in');
      app.setAttribute('aria-hidden', 'false');
    }

    document.body.classList.remove('is-locked');
    scheduleIdleReturn();
    if (state.view === 'overview') startStageTimer();
  }

  function bindCover() {
    const cover = $('#cover');
    cover?.addEventListener('click', enterApp);
    cover?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        enterApp();
      }
    });
  }

  /* ---------------- routing ---------------- */
  function navigate(view, options = {}) {
    if (!VIEW_LABELS[view]) view = 'overview';
    if (!state.entered) return;
    const changed = state.view !== view;
    state.view = view;
    if (view !== 'overview') stopStageTimer();
    $$('.view').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === view));
    $$('.rail-item').forEach(item => item.classList.toggle('active', item.dataset.nav === view));
    const label = $('#page-label');
    if (label) label.textContent = VIEW_LABELS[view];
    document.body.dataset.view = view;
    if (changed) playRouteTransition(view);
    if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    render();
    if (view === 'overview') {
      startStageTimer();
      if (options.fullscreen) requestStageFullscreen();
    }
    if (changed) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function playRouteTransition(view) {
    const overlay = $('#route-transition');
    if (!overlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const label = $('#route-transition-label');
    if (label) label.textContent = String(view || 'overview').toUpperCase();
    overlay.classList.remove('is-running');
    void overlay.offsetWidth;
    overlay.classList.add('is-running');
    window.setTimeout(() => overlay.classList.remove('is-running'), 720);
  }

  function render() {
    const map = {
      overview: renderOverview,
      ladder: renderMembers,
      events: renderEvents,
      works: renderWorks
    };
    const renderer = map[state.view];
    if (renderer) renderer();
  }

  function setView(view, html) {
    const panel = $(`[data-view-panel="${view}"]`);
    if (!panel) return;
    panel.innerHTML = html;
    panel.classList.add('active');
    $$('.panel, .stage-console, .level-node, .member-row, .work-card', panel).forEach(el => {
      el.classList.add('scan-surface');
    });
    $$('.metric-card, .work-card, .kpi', panel).forEach(el => el.setAttribute('data-tilt', ''));
    if (revealedViews.has(view)) return;
    revealedViews.add(view);
    const blocks = [...panel.children];
    blocks.forEach(block => block.classList.add('reveal-item'));
    requestAnimationFrame(() => {
      blocks.forEach((block, index) => {
        window.setTimeout(() => block.classList.add('is-revealed'), Math.min(index * 55, 220));
      });
    });
  }

  function refreshCurrentView() {
    const map = {
      overview: renderOverview,
      ladder: renderMembers,
      events: renderEvents,
      works: renderWorks
    };
    const renderer = map[state.view];
    if (renderer) renderer();
  }

  /* ---------------- embedded big screen ---------------- */
  function stageScenes() {
    const members = TD.allMembers();
    const events = TD.allEvents();
    const works = [...TD.works].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const mode = state.screen.mode;

    if (mode === 'members') {
      return members.length ? [{ type: 'members' }] : [{ type: 'idle', label: 'MEMBERS / 成员', note: '还没有成员登记' }];
    }
    if (mode === 'pulse') {
      return events.length ? [{ type: 'pulse' }] : [{ type: 'idle', label: 'ACTIVITY / 数据', note: '还没有活动数据' }];
    }
    if (mode === 'works') {
      return works.length
        ? works.slice(0, 6).map(work => ({ type: 'work', id: work.id }))
        : [{ type: 'idle', label: 'WORKS / 作品', note: '作品接入后将在这里轮播' }];
    }

    const scenes = [];
    if (members.length) scenes.push({ type: 'members' });
    works.slice(0, 4).forEach(work => scenes.push({ type: 'work', id: work.id }));
    if (events.length) scenes.push({ type: 'pulse' });
    if (members.length >= 4) scenes.push({ type: 'growth' });
    if (!scenes.length) scenes.push({ type: 'idle', label: 'AUTO / 等待数据', note: '登记成员或创建活动后，数据会实时汇入' });
    return scenes;
  }

  function stageTimeline(sequence) {
    return `<div class="stage-timeline" aria-hidden="true">${sequence.map((_, index) => {
      const cls = index < state.screen.index ? 'done' : index === state.screen.index ? 'active' : '';
      return `<i class="${cls}"></i>`;
    }).join('')}</div>`;
  }

  function stageKicker(text) {
    return `<span class="stage-kicker"><i></i>${esc(text)}</span>`;
  }

  function slideWork(work, sequence) {
    const author = work.author != null ? memberInfo(work.author) : null;
    const coauthors = Array.isArray(work.co) ? work.co.map(id => memberInfo(id)).filter(Boolean) : [];
    return `<div class="stage-slide stage-work">
      ${stageBrand()}
      <span class="stage-counter">FEATURED WORK / ${String((work.id || 0) + 1).padStart(2, '0')}</span>
      <div class="stage-work-body">
        <div class="stage-work-art">${TV.artHTML(work)}</div>
        <div class="stage-work-copy">
          ${stageKicker(`${work.theme || '社区创作'} / ${work.type || '数字'}作品`)}
          <h2>${esc(work.cn || work.title || '未命名作品')}</h2>
          <p class="stage-cn-title">${esc(work.title || '')}${work.year ? ` · ${esc(work.year)}` : ''}</p>
          <p class="stage-description">${esc(work.desc || '')}</p>
          ${author ? `<div class="stage-author">${TV.avatar(author)}<div><strong>${esc(author.name)} / ${esc(author.en)}</strong><span>${esc(author.role)}${coauthors.length ? ` · 联合 ${coauthors.map(item => item.name).join('、')}` : ''}</span></div><span class="stage-project-link"><svg class="icon"><use href="#i-arrow-up"/></svg></span></div>` : ''}
        </div>
      </div>
      ${stageTimeline(sequence)}
    </div>`;
  }

  function slideMembers(sequence) {
    const members = TD.allMembers();
    const top = members.slice(0, 3);
    const rest = members.slice(3, 9);
    return `<div class="stage-slide stage-members">
      ${stageBrand()}
      <span class="stage-counter">COMMUNITY INDEX / LIVE</span>
      <div class="stage-heading">
        <div>${stageKicker('MEMBERS / 成员天梯')}<h2>思想在这里相遇，<em>成长在这里发生。</em></h2></div>
        <div class="stage-heading-stat"><strong>${members.length}</strong><span>REGISTERED<br>MEMBERS</span></div>
      </div>
      <div class="stage-members-body">
        <div class="stage-top-members" style="grid-template-columns:repeat(${Math.max(1, top.length)},minmax(0,1fr))">
          ${top.map((member, index) => `<div class="stage-member-card">
            <span class="stage-rank">RANK / 0${index + 1}</span>
            <div class="stage-member-avatar">${TV.avatar(member, { size: 'lg' })}<span>${TV.mascot(member.level)}</span></div>
            <h3>${esc(member.name)}</h3>
            <p>${esc(member.en)} · Lv.${member.level.n} ${esc(member.level.name)}</p>
            <div class="stage-member-score"><strong>${member.score}</strong><span>ACTIVITY</span></div>
            <div class="stage-member-meta"><span>${member.visits} 场到场</span><span>${memberWorkCount(member)} 件作品</span></div>
          </div>`).join('')}
        </div>
        ${rest.length ? `<div class="stage-rank-list">
          ${rest.map((member, index) => `<div class="stage-rank-row">
            <span class="stage-rank-no">0${index + 4}</span>
            ${TV.avatar(member, { size: 'sm' })}
            <h4>${esc(member.name)}<small>${esc(member.en)}</small></h4>
            <span class="stage-rank-level">Lv.${member.level.n}</span>
            <strong>${member.score}</strong>
          </div>`).join('')}
        </div>` : ''}
      </div>
      ${stageTimeline(sequence)}
    </div>`;
  }

  function slidePulse(sequence) {
    const events = TD.allEvents();
    const latest = events[events.length - 1];
    const retention = TD.retention();
    return `<div class="stage-slide stage-pulse">
      ${stageBrand()}
      <span class="stage-counter">ATTENDANCE / ${esc(String(latest.date || '').slice(0, 4) || '2026')}</span>
      <div class="stage-heading">
        <div>${stageKicker('ACTIVITY PULSE / 到场数据')}<h2>人气不是偶然，<em>是持续到场。</em></h2></div>
        <div class="stage-heading-stat"><strong>${Math.round(retention.returnRate * 100)}<small>%</small></strong><span>RETURN<br>RATE</span></div>
      </div>
      <div class="stage-pulse-body">
        <div class="stage-pulse-stats">
          <div><strong>${latest.total}</strong><span>本场实到 / ${md(latest.date)}</span></div>
          <div><strong>${retention.returning}</strong><span>回访成员 / ${retention.total} 人</span></div>
          <div><strong>${events.length}</strong><span>累计活动场次</span></div>
          <p>${esc(latest.note || `最近一场「${latest.title}」实到 ${latest.total} 人，新面孔 ${latest.fresh} 人。`)}</p>
        </div>
        <div class="stage-pulse-chart">${TC.attendanceChart(events)}</div>
      </div>
      ${stageTimeline(sequence)}
    </div>`;
  }

  function slideGrowth(sequence) {
    const members = TD.allMembers();
    const counts = levelCounts();
    return `<div class="stage-slide stage-growth">
      ${stageBrand()}
      <span class="stage-counter">NAILONG GROWTH / L1 → L7</span>
      <div class="stage-heading">
        <div>${stageKicker('GROWTH SYSTEM / 奶龙成长轨道')}<h2>常来的人，<em>会慢慢长大。</em></h2></div>
        <div class="stage-heading-stat"><strong>${members.length}</strong><span>MEMBERS<br>IN ORBIT</span></div>
      </div>
      <div class="stage-growth-grid">
        ${TD.LEVELS.map(level => `<div class="stage-growth-node">
          <span class="stage-growth-no">L${String(level.n).padStart(2, '0')}</span>
          ${TV.mascot(level)}
          <strong>${esc(level.name)}</strong>
          <small>${esc(level.en)}</small>
          <b>${counts.get(level.n) || 0}<i>人</i></b>
        </div>`).join('')}
      </div>
      <div class="stage-growth-rule"><span>活跃指数 = 到场 58%</span><span>作品 26%</span><span>连续参与 16%</span><span>LV.01 → LV.07</span></div>
      ${stageTimeline(sequence)}
    </div>`;
  }

  function slideIdle(scene, sequence) {
    return `<div class="stage-slide stage-idle">
      ${stageBrand()}
      <span class="stage-counter">${esc(scene.label || 'STANDBY')}</span>
      <div class="stage-idle-core">
        <div class="stage-idle-radar" aria-hidden="true"><i></i><i></i><i></i><strong><img src="${BRAND_LOGO}" alt=""></strong></div>
        ${stageKicker('COMMUNITY AWAITING SIGNAL')}
        <h2>等待第一位成员，<br><em>点亮这块屏幕。</em></h2>
        <p>${esc(scene.note || '登记成员或创建活动后，数据会实时汇入')}。所有内容仅保存在本机浏览器。</p>
        <div class="stage-idle-mascots" aria-hidden="true">
          ${TD.LEVELS.map(level => TV.mascot(level)).join('')}
        </div>
        <span class="stage-idle-today mono">TODAY / ${fmtDate(todayValue())} · LOCAL NODE 01</span>
      </div>
      ${stageTimeline(sequence)}
    </div>`;
  }

  function renderStage() {
    const stage = $('#stage');
    if (!stage) return;
    const sequence = stageScenes();
    if (!sequence.length) return;
    state.screen.index = clamp(state.screen.index, 0, sequence.length - 1);
    const scene = sequence[state.screen.index];
    let html = '';
    if (scene.type === 'work') {
      const work = workById(scene.id);
      if (work) html = slideWork(work, sequence);
    } else if (scene.type === 'members') html = slideMembers(sequence);
    else if (scene.type === 'pulse') html = slidePulse(sequence);
    else if (scene.type === 'growth') html = slideGrowth(sequence);
    if (!html) {
      const fallback = { type: 'idle', label: 'AUTO / 等待数据', note: '登记成员或创建活动后，数据会实时汇入' };
      html = slideIdle(fallback, sequence);
    }
    stage.innerHTML = html;

    const frame = $('#stage-frame');
    if (frame) frame.classList.toggle('is-paused', !state.screen.playing);

    const progress = $('#playback-progress');
    if (progress) {
      progress.innerHTML = sequence.map((_, index) => {
        const cls = index < state.screen.index ? 'done' : index === state.screen.index ? 'active' : '';
        return `<button class="${cls}" data-stage-index="${index}" aria-label="第 ${index + 1} 幕"><i></i></button>`;
      }).join('');
    }

    const status = $('#playback-status');
    if (status) status.innerHTML = `<i></i> ${state.screen.playing ? 'AUTO PLAYING' : 'PAUSED'}`;

    const playIcon = $('#stage-play use');
    if (playIcon) playIcon.setAttribute('href', state.screen.playing ? '#i-pause' : '#i-play');
    const playBtn = $('#stage-play');
    if (playBtn) playBtn.setAttribute('aria-label', state.screen.playing ? '暂停轮播' : '播放轮播');

    $$('#stage-tabs button').forEach(button => {
      button.classList.toggle('active', button.dataset.stageMode === state.screen.mode);
    });
  }

  function startStageTimer() {
    stopStageTimer();
    if (!state.entered || state.view !== 'overview' || !state.screen.playing) return;
    state.screen.timer = setInterval(() => {
      const sequence = stageScenes();
      if (!sequence.length) return;
      state.screen.index = (state.screen.index + 1) % sequence.length;
      renderStage();
    }, STAGE_MS);
  }

  function stopStageTimer() {
    if (state.screen.timer) clearInterval(state.screen.timer);
    state.screen.timer = null;
  }

  function restartStageTimer() {
    if (state.screen.playing) startStageTimer();
    else stopStageTimer();
  }

  function stepStage(direction) {
    const sequence = stageScenes();
    if (!sequence.length) return;
    const next = (state.screen.index + direction + sequence.length) % sequence.length;
    state.screen.index = next;
    renderStage();
    restartStageTimer();
  }

  function toggleStagePlayback() {
    state.screen.playing = !state.screen.playing;
    renderStage();
    restartStageTimer();
  }

  function requestStageFullscreen() {
    const frame = $('#stage-frame');
    if (!frame) return;
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (!frame.requestFullscreen) { toast('当前浏览器不支持全屏'); return; }
    frame.requestFullscreen().catch(() => toast('当前浏览器不支持全屏'));
  }

  /* ---------------- overview ---------------- */
  function metricCard(index, label, value, en, hint) {
    const target = index === 1 ? 'ladder' : index === 2 || index === 3 ? 'events' : 'works';
    return `<button class="metric-card" data-tilt data-nav="${target}" aria-label="查看${esc(label)}">
      <div class="metric-top"><span class="mono">${String(index).padStart(2, '0')} / ${en}</span><i></i></div>
      <strong data-count="${value}">0</strong>
      <div class="metric-label"><span>${esc(label)}</span><small>${esc(hint)}</small></div>
      <span class="metric-go mono" aria-hidden="true">OPEN <svg class="icon"><use href="#i-arrow-up"/></svg></span>
    </button>`;
  }

  function nextActionPanel(totals, latest, members) {
    let eyebrow = 'NEXT MOVE / 下一步';
    let title = '建立第一个社区节点。';
    let copy = '先创建活动，或直接登记成员。所有数据都在本机生成，不需要后台。';
    let actions = `<button class="btn btn-primary btn-sm" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>
      <button class="btn btn-ghost btn-sm" data-new-member><svg class="icon"><use href="#i-podium"/></svg> 登记成员</button>`;
    let meter = '';
    if (members.length && !latest) {
      title = '为社区创建第一场活动。';
      copy = `已经有 ${members.length} 位成员建档。创建活动后，现场打卡与到场数据会开始积累。`;
      actions = `<button class="btn btn-primary btn-sm" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建第一场活动</button>
        <button class="btn btn-ghost btn-sm" data-nav="ladder">成长天梯 <svg class="icon"><use href="#i-arrow"/></svg></button>`;
    } else if (latest && !members.length) {
      title = '登记第一位现场成员。';
      copy = `「${latest.title}」已经建立，但还没有成员档案。登记后即可为本场活动打卡。`;
      actions = `<button class="btn btn-primary btn-sm" data-new-member><svg class="icon"><use href="#i-podium"/></svg> 登记成员</button>
        <button class="btn btn-ghost btn-sm" data-checkin-event="${latest.id}">现场打卡 <svg class="icon"><use href="#i-arrow"/></svg></button>`;
    } else if (latest) {
      eyebrow = 'LIVE SESSION / 最近一场';
      title = latest.title;
      copy = `${fmtDate(latest.date)} · ${latest.venue}。当前实到 ${latest.total} 人，新面孔 ${latest.fresh} 人。`;
      actions = `<button class="btn btn-primary btn-sm" data-checkin-event="${latest.id}"><svg class="icon"><use href="#i-check"/></svg> 继续打卡</button>
        <button class="btn btn-ghost btn-sm" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 新建活动</button>`;
      const expected = latest.expected || Math.max(latest.total, 1);
      const percent = clamp(Math.round(latest.total / expected * 100), 0, 100);
      meter = `<div class="next-meter"><div><span>CHECK-IN PROGRESS</span><b>${latest.total} / ${latest.expected || '—'}</b></div><span class="next-meter-track"><i style="width:${percent}%"></i></span></div>`;
    }
    return `<article class="panel next-panel">
      <div class="panel-topline"><span>${eyebrow}</span><span class="status-pill"><i></i> READY</span></div>
      <div class="next-scan" aria-hidden="true"><span></span><i></i></div>
      <div class="next-copy"><h3>${esc(title)}</h3><p>${esc(copy)}</p></div>
      ${meter}
      <div class="next-actions">${actions}</div>
    </article>`;
  }

  function renderOverview() {
    const totals = TD.totals();
    const members = TD.allMembers();
    const events = TD.allEvents();
    const latest = events[events.length - 1] || null;
    const previous = events[events.length - 2] || null;
    const works = TD.works;
    const headline = members.length
      ? `让每一次到场，<br><span>进入社区记忆。</span>`
      : `系统已就绪，<br><span>等待第一位成员。</span>`;
    const lead = members.length
      ? `${members.length} 位成员已经建档，${totals.events} 场活动记录了 ${totals.checkins} 次真实到场。所有数据在本机实时写入。`
      : '系统已就绪。登记成员、创建活动后，成长轨道、到场曲线与大屏内容会自动生成，不预置任何虚构人物或作品。';

    const up = latest && previous ? latest.total - previous.total : null;
    const pulsePanel = events.length ? `
      <article class="panel pulse-panel">
        <div class="panel-topline"><span><i class="live-dot"></i> ACTIVITY PULSE / 到场脉冲</span><button class="panel-link" data-nav="events">活动面板 <svg class="icon"><use href="#i-arrow"/></svg></button></div>
        <div class="pulse-main">
          <div class="pulse-big">
            <span class="mono">LATEST / ${md(latest.date)}</span>
            <strong>${latest.total}</strong>
            <em>人实到</em>
            <div class="pulse-delta ${up === null || up > 0 ? 'is-up' : up < 0 ? 'is-down' : ''}">${up === null ? '首场记录' : up === 0 ? '与上场持平' : `${up > 0 ? '↗' : '↘'} 较上场 ${up > 0 ? '+' : ''}${up} 人`}</div>
          </div>
          <div class="pulse-graph">
            <div class="pulse-chart">${TC.sparkline(events.map(event => event.total), { height: 96, color: '#1c46e8' })}</div>
            <div class="pulse-axis">${events.slice(-7).map(event => `<span>${md(event.date)}</span>`).join('')}</div>
          </div>
        </div>
        <div class="pulse-stats">
          <div><strong>${latest.fresh}</strong><span>本场新面孔</span></div>
          <div><strong>${Math.round(TD.retention().returnRate * 100)}%</strong><span>成员回访率</span></div>
          <div><strong>${events.length}</strong><span>累计活动</span></div>
          <div><strong>${totals.avg.toFixed(1)}</strong><span>场均到场</span></div>
        </div>
      </article>` : `
      <article class="panel pulse-panel">
        <div class="panel-topline"><span><i class="live-dot"></i> ACTIVITY PULSE / 到场脉冲</span><span class="mono">STANDBY</span></div>
        ${emptySlab('还没有活动数据', '创建第一场活动后，到场人数、新面孔与回访曲线会实时生成。', '<button class="btn btn-sm btn-primary" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>')}
      </article>`;

    const html = `
      <div class="dash-head" data-reveal>
        <div class="dash-title-wrap">
          <div class="eyebrow"><span class="live-dot"></span> TURING COMMUNITY / OPERATIONS DECK</div>
          <h1 class="dash-title">${headline}</h1>
        </div>
        <div class="dash-brief">
          <p>${esc(lead)}</p>
          <div class="dash-actions">
            <button class="btn btn-primary" data-checkin-open><svg class="icon"><use href="#i-check"/></svg> 登记 / 打卡</button>
            <button class="btn btn-ghost" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>
          </div>
          <div class="dash-readout mono">
            <span><i></i> DIRECT ACCESS</span>
            <span>LOCAL NODE / 01</span>
            <span>SYNC / REALTIME</span>
          </div>
        </div>
      </div>

      <div class="deck-grid">
        <section class="stage-console" data-reveal>
          <div class="console-top">
            <div class="console-title"><span class="console-live"><i></i></span><div><strong>LIVE OUTPUT / 现场大屏</strong><span class="mono">16:9 · 点击画面暂停 · F 全屏</span></div></div>
            <div class="stage-tabs" id="stage-tabs">
              ${STAGE_MODES.map(([mode, label]) => `<button class="${state.screen.mode === mode ? 'active' : ''}" data-stage-mode="${mode}">${label}</button>`).join('')}
            </div>
            <div class="console-tools">
              <button class="console-icon" id="stage-play" aria-label="暂停轮播"><svg class="icon"><use href="#i-pause"/></svg></button>
              <button class="console-full" data-stage-fullscreen><svg class="icon"><use href="#i-expand"/></svg> 全屏</button>
            </div>
          </div>
          <div class="stage-frame" id="stage-frame" tabindex="0" role="button" aria-label="现场大屏，点击暂停或继续轮播">
            <div class="stage" id="stage"></div>
            <span class="stage-scan" aria-hidden="true"></span>
            <span class="stage-corner tl" aria-hidden="true"></span>
            <span class="stage-corner tr" aria-hidden="true"></span>
            <span class="stage-corner bl" aria-hidden="true"></span>
            <span class="stage-corner br" aria-hidden="true"></span>
            <span class="stage-interaction-hint mono" aria-hidden="true">CLICK / PAUSE · DOUBLE CLICK / FULLSCREEN</span>
          </div>
          <div class="console-bottom">
            <button class="stage-skip" data-stage-prev aria-label="上一幕">PREV</button>
            <div class="stage-progress" id="playback-progress"></div>
            <span class="stage-status" id="playback-status"><i></i> AUTO PLAYING</span>
            <button class="stage-skip" data-stage-next aria-label="下一幕">NEXT</button>
          </div>
        </section>

        <aside class="deck-side" data-reveal>
          <div class="metric-stack">
            ${metricCard(1, '社区成员', totals.members, 'MEMBERS', '已登记')}
            ${metricCard(2, '累计打卡', totals.checkins, 'CHECK-INS', '真实到场')}
            ${metricCard(3, '共创活动', totals.events, 'EVENTS', '已建立')}
            ${metricCard(4, '数字作品', totals.works, 'WORKS', '内容位')}
          </div>
          ${nextActionPanel(totals, latest, members)}
        </aside>
      </div>

      <div class="overview-intel" data-reveal>
        ${pulsePanel}
      </div>

      <section class="institute-strip" data-reveal>
        <div class="institute-copy">
          <div class="eyebrow">THE INSTITUTE / 关于研究院</div>
          <p>温州市图灵人工智能高等研究院由温州大学牵头，11 所在温高校共同建设。这块屏幕连接研究、产业与创作者，让每一次到场与每一件作品都被看见。</p>
        </div>
        <div class="institute-meta">
          <span class="mono">11 UNIVERSITIES</span>
          <span class="mono">AI RESEARCH</span>
          <span class="mono">HUMAN + MACHINE</span>
          <span class="mono">WENZHOU / CN</span>
        </div>
      </section>
    `;

    setView('overview', html);
    renderStage();
    animateCounts($('#view-overview'));
  }

  /* ---------------- members + growth ---------------- */
  function memberList() {
    const { sort, filter, level, query } = state.members;
    let list = TD.allMembers();
    if (level) list = list.filter(member => member.level.n === Number(level));
    if (filter === 'active') list = list.filter(member => member.visits >= 2);
    if (filter === 'new') list = list.filter(member => member.visits <= 1);
    if (filter === 'works') list = list.filter(member => memberWorkCount(member) > 0);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(member => `${member.name} ${member.en} ${member.role} ${member.org}`.toLowerCase().includes(q));
    }
    if (sort === 'long') list.sort((a, b) => b.visits - a.visits || b.score - a.score);
    else if (sort === 'works') list.sort((a, b) => memberWorkCount(b) - memberWorkCount(a) || b.score - a.score);
    else list.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'));
    return list;
  }

  function memberRow(member, rank, active) {
    return `<button class="member-row ${active ? 'is-active' : ''}" data-focus-member="${member.id}" aria-pressed="${active}">
      <span class="member-rank mono">${String(rank).padStart(2, '0')}</span>
      <span class="member-ident">${TV.avatar(member, { size: 'sm' })}<span><strong>${esc(member.name)}</strong><small>${esc(member.en)} · <span class="member-level-inline">Lv.${member.level.n} ${esc(member.level.name)} · </span>${esc(member.role)}</small></span></span>
      <span class="member-level"><i style="--tone:${member.level.tone}"></i>Lv.${member.level.n} ${esc(member.level.name)}</span>
      <span class="member-score"><b>${member.score}</b><span class="member-score-track"><i style="width:${clamp(member.score, 0, 100)}%"></i></span></span>
      <span class="member-stat member-stat-visits"><b>${member.visits}</b><small>到场</small></span>
      <span class="member-stat member-stat-works"><b>${memberWorkCount(member)}</b><small>作品</small></span>
      <span class="member-trend ${member.trend > 0 ? 'up' : ''}">${member.trend > 0 ? `↗ ${member.trend}` : '—'}</span>
    </button>`;
  }

  function dossierHTML(member) {
    if (!member) {
      return `<div class="dossier-empty">
        <span class="empty-radar" aria-hidden="true"><i></i><i></i><i></i><b></b></span>
        <strong>选择一位成员</strong>
        <p>点击左侧成员，查看成长等级、到场记录与作品档案。</p>
      </div>`;
    }
    const all = TD.allMembers();
    const rank = all.findIndex(item => item.id === member.id) + 1;
    const events = TD.allEvents();
    const nextLevel = TD.LEVELS[member.level.n] || null;
    const progress = nextLevel
      ? clamp((member.score - member.level.min) / Math.max(nextLevel.min - member.level.min, 1) * 100, 0, 100)
      : 100;
    const latest = events[events.length - 1] || null;

    return `<div class="dossier">
      <div class="dossier-head"><span class="mono">MEMBER FILE / ${String(member.id + 1).padStart(3, '0')}</span><span class="dossier-state mono"><i></i> ACTIVE</span></div>
      <div class="dossier-identity">
        <div class="dossier-mascot">${TV.mascot(member.level)}<span class="mono">LV.${String(member.level.n).padStart(2, '0')}</span></div>
        <div class="dossier-name">${TV.avatar(member, { size: 'lg' })}<div><h2>${esc(member.name)}</h2><p>${esc(member.en)}</p><span>${esc(member.role)} · ${esc(member.org)}</span></div></div>
      </div>
      <div class="dossier-level">
        <div class="dossier-level-top"><span>Lv.${member.level.n} ${esc(member.level.name)} <em>${esc(member.level.en)}</em></span><strong>${member.score}<small>INDEX</small></strong></div>
        <div class="dossier-track"><i style="width:${progress}%"></i></div>
        <div class="dossier-level-foot"><span>${nextLevel ? `距 Lv.${nextLevel.n} ${esc(nextLevel.name)} 还差 ${Math.max(0, nextLevel.min - member.score)} 指数` : '已达到当前最高等级'}</span><span class="mono">${nextLevel ? `${Math.round(progress)}%` : 'MAX'}</span></div>
      </div>
      <div class="dossier-stats">
        <div><span>ATTENDED</span><strong>${member.visits}</strong><small>场到场</small></div>
        <div><span>STREAK</span><strong>${member.streak}</strong><small>场连续</small></div>
        <div><span>WORKS</span><strong>${memberWorkCount(member)}</strong><small>件作品</small></div>
        <div><span>RANK</span><strong>${rank}</strong><small>/ ${all.length} 位</small></div>
      </div>
      <div class="dossier-attendance">
        <div class="dossier-subhead"><span>ATTENDANCE / 到场记录</span><span class="mono">${events.length} EVENTS</span></div>
        ${events.length ? `<div class="att-matrix">${events.slice(-12).map(event => {
          const on = member.att[event.id] === '1';
          const first = on && member.first === event.id;
          return `<span class="att-cell ${on ? 'on' : ''} ${first ? 'first' : ''}" title="${fmtDate(event.date)} ${esc(event.title)}">
            <b>${on ? (first ? 'NEW' : '✓') : '·'}</b><i>${md(event.date)}</i>
          </span>`;
        }).join('')}</div>` : '<p class="dossier-note">尚未创建活动场次，到场记录将在打卡后出现。</p>'}
      </div>
      <div class="dossier-quote">“${esc(member.tagline || '第一次到场，故事从这里开始。')}”</div>
      <div class="dossier-actions">
        ${latest ? `<button class="btn btn-primary btn-sm" data-checkin-member="${member.id}"><svg class="icon"><use href="#i-check"/></svg> 本场打卡</button>` : `<button class="btn btn-primary btn-sm" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动后打卡</button>`}
        <button class="btn btn-ghost btn-sm" data-nav="overview"><svg class="icon"><use href="#i-screen"/></svg> 返回总览</button>
      </div>
    </div>`;
  }

  function renderMembers() {
    const all = TD.allMembers();
    const counts = levelCounts();
    const filtered = memberList();
    const visible = filtered.slice(0, state.members.limit);
    if (state.members.focus && !visible.some(member => member.id === state.members.focus)) {
      state.members.focus = null;
    }
    if (!state.members.focus && visible.length) state.members.focus = visible[0].id;
    const selected = visible.find(member => member.id === state.members.focus) || visible[0] || null;
    const topLevel = all.reduce((max, member) => Math.max(max, member.level.n), 0);
    const stable = all.filter(member => member.visits >= 2).length;
    const newcomer = all.filter(member => member.visits <= 1).length;

    const levelRail = TD.LEVELS.map(level => `<button class="level-node ${state.members.level === level.n ? 'is-active' : ''}" data-level-jump="${level.n}" data-level-name="${esc(level.name)}" aria-pressed="${state.members.level === level.n}" style="--level-tone:${level.tone};--level-fill:${all.length ? (counts.get(level.n) || 0) / all.length * 100 : 0}%">
      <span class="level-no mono">L${String(level.n).padStart(2, '0')}</span>
      <span class="level-signal" aria-hidden="true"></span>
      <span class="level-mascot">${TV.mascot(level)}</span>
      <span class="level-body"><strong>${esc(level.name)}</strong><small>${esc(level.en)}</small></span>
      <span class="level-count"><b>${counts.get(level.n) || 0}</b><i>人</i></span>
      <span class="level-meter"><i style="width:${all.length ? (counts.get(level.n) || 0) / all.length * 100 : 0}%"></i></span>
    </button>`).join('');

    const selectedLevel = state.members.level ? TD.LEVELS[state.members.level - 1] : null;
    const scopedMembers = selectedLevel ? all.filter(member => member.level.n === selectedLevel.n) : all;
    const scopedLeader = [...scopedMembers].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'))[0] || null;
    const scopedAverage = scopedMembers.length
      ? Math.round(scopedMembers.reduce((sum, member) => sum + member.score, 0) / scopedMembers.length)
      : 0;
    const readoutTitle = selectedLevel ? `Lv.${String(selectedLevel.n).padStart(2, '0')} ${selectedLevel.name}` : '全等级成员';
    const readoutCopy = selectedLevel
      ? `${selectedLevel.rule}。当前筛选会同步作用于下方天梯与个人档案。`
      : '点选上方任一级别，即可锁定该层成员、均值与当前领跑者。';

    const head = `
      <div class="page-head" data-reveal>
        <div class="eyebrow"><span class="live-dot"></span> LADDER × NAILONG / 天梯与奶龙成长</div>
        <div class="head-grid">
          <div><h1 class="display">${all.length ? '从奶蛋，<br><span class="hl">到高阶共创者。</span>' : '第一位成员，<br><span class="hl">从一次登记开始。</span>'}</h1></div>
          <div class="head-aside">
            <p>奶龙等级就是天梯层级。选择一个等级，会同步筛选成员榜、活跃指数与右侧成长档案；到场、作品和连续参与共同推动晋升。</p>
            <div class="head-actions">
              <button class="btn btn-primary" data-new-member><svg class="icon"><use href="#i-plus"/></svg> 登记成员</button>
              <button class="btn btn-ghost" data-new-event><svg class="icon"><use href="#i-calendar"/></svg> 创建活动</button>
            </div>
          </div>
        </div>
      </div>`;

    if (!all.length) {
      const html = `${head}
        <section class="panel growth-system" data-reveal>
          <div class="growth-system-head">
            <div><span class="mono">LADDER MATRIX / L1 → L7</span><h2>奶龙 × 成员天梯</h2></div>
            <div class="growth-system-meta"><span><b>0</b> 位成员</span><span class="mono">AWAITING SIGNAL</span></div>
          </div>
          <div class="level-rail">${levelRail}</div>
          <p class="growth-rule">活跃指数 = 到场 58% + 作品 26% + 连续参与 16%。首次登记进入 Lv.01 奶蛋，之后随真实记录晋升。</p>
        </section>
        <section class="panel member-empty-shell" data-reveal>
          <div class="member-empty-copy">
            <span class="eyebrow"><span class="live-dot"></span> NO MEMBERS / READY TO RECEIVE</span>
            <h2>天梯已就绪，<br>等待第一位成员。</h2>
            <p>登记真实成员后，奶龙等级、活跃排名与个人档案会在同一套数据里同步生长。</p>
            <div class="member-empty-actions">
              <button class="btn btn-primary" data-new-member><svg class="icon"><use href="#i-plus"/></svg> 登记第一位成员</button>
              <button class="btn btn-ghost" data-new-event><svg class="icon"><use href="#i-calendar"/></svg> 先创建活动</button>
            </div>
          </div>
          <div class="member-empty-flow" aria-label="成长流程">
            <div><span class="mono">01 / BUILD</span><strong>登记成员</strong></div>
            <i aria-hidden="true"></i>
            <div><span class="mono">02 / SIGNAL</span><strong>现场打卡</strong></div>
            <i aria-hidden="true"></i>
            <div><span class="mono">03 / GROW</span><strong>自动晋升</strong></div>
          </div>
        </section>`;
      setView('ladder', html);
      return;
    }

    const html = `${head}
      <section class="panel growth-system" data-reveal>
        <div class="growth-system-head">
          <div><span class="mono">LADDER MATRIX / L1 → L7</span><h2>奶龙 × 成员天梯</h2></div>
          <div class="growth-system-meta">
            <span><b>${all.length}</b> 位成员</span>
            <span><b>${stable}</b> 位稳定到场</span>
            <span>最高 Lv.${String(topLevel).padStart(2, '0')}</span>
            <span class="mono">${TD.LEVELS[topLevel - 1] ? esc(TD.LEVELS[topLevel - 1].name) : ''}</span>
          </div>
        </div>
        <div class="level-rail">${levelRail}</div>
        <div class="growth-readout" role="status" aria-live="polite">
          <div class="growth-readout-main">
            <span class="growth-readout-signal"><i></i> LEVEL LINK / ${selectedLevel ? 'LOCKED' : 'ALL'}</span>
            <strong>${esc(readoutTitle)}</strong>
            <p>${esc(readoutCopy)}</p>
          </div>
          <div class="growth-readout-stats">
            <span><small>MEMBERS</small><b>${scopedMembers.length}</b></span>
            <span><small>AVG INDEX</small><b>${scopedAverage}</b></span>
            <span><small>LEADER</small><b>${scopedLeader ? esc(scopedLeader.name) : '—'}</b></span>
          </div>
          ${selectedLevel ? '<button class="growth-readout-reset mono" data-level-clear>RESET LINK <svg class="icon"><use href="#i-close"/></svg></button>' : '<span class="growth-readout-hint mono">SELECT A LEVEL NODE</span>'}
        </div>
        <p class="growth-rule">活跃指数 = 到场 58% + 作品 26% + 连续参与 16%。等级控制与成员榜单共享同一筛选状态。</p>
      </section>

      <div class="member-workbench" data-reveal>
        <section class="panel roster-panel">
          <div class="roster-toolbar">
            <div class="search-box"><svg class="icon"><use href="#i-search"/></svg><input id="member-search" type="search" placeholder="搜索姓名 / 角色 / 单位" value="${esc(state.members.query)}" autocomplete="off"></div>
            <div class="segmented" id="member-sort">
              <button class="${state.members.sort === 'active' ? 'active' : ''}" data-member-sort="active">活跃</button>
              <button class="${state.members.sort === 'long' ? 'active' : ''}" data-member-sort="long">长期</button>
              <button class="${state.members.sort === 'works' ? 'active' : ''}" data-member-sort="works">作品</button>
            </div>
            <div class="chip-row" id="member-filter">
              <button class="chip ${state.members.filter === 'all' ? 'active' : ''}" data-member-filter="all">全部 <sup>${all.length}</sup></button>
              <button class="chip ${state.members.filter === 'active' ? 'active' : ''}" data-member-filter="active">稳定 <sup>${stable}</sup></button>
              <button class="chip ${state.members.filter === 'new' ? 'active' : ''}" data-member-filter="new">新成员 <sup>${newcomer}</sup></button>
              <button class="chip ${state.members.filter === 'works' ? 'active' : ''}" data-member-filter="works">有作品 <sup>${all.filter(member => memberWorkCount(member) > 0).length}</sup></button>
            </div>
            ${state.members.level ? `<button class="chip chip-clear active" data-level-clear>Lv.${String(state.members.level).padStart(2, '0')} 筛选 <svg class="icon"><use href="#i-close"/></svg></button>` : ''}
          </div>
          <div class="rank-head">
            <span>RANK</span><span>成员 / MEMBER</span><span>成长等级</span><span>活跃指数</span><span>到场</span><span>作品</span><span>趋势</span>
          </div>
          <div class="rank-list">
            ${visible.length ? visible.map((member, index) => memberRow(member, filtered.indexOf(member) + 1, selected && selected.id === member.id)).join('') : `<div class="roster-empty">没有匹配的成员。<button class="text-link" data-member-reset>清除筛选</button></div>`}
          </div>
          ${filtered.length > visible.length ? `<div class="roster-more"><button class="btn btn-sm btn-ghost" id="member-more">展开全部 ${filtered.length} 位 <svg class="icon"><use href="#i-arrow"/></svg></button></div>` : ''}
        </section>
        <aside class="dossier-shell" id="member-dossier">${dossierHTML(selected)}</aside>
      </div>`;

    setView('ladder', html);

    const search = $('#member-search');
    if (search) {
      search.addEventListener('input', event => {
        state.members.query = event.target.value;
        state.members.limit = 9;
        state.members.focus = null;
        const position = event.target.selectionStart;
        renderMembers();
        const next = $('#member-search');
        if (next) { next.focus(); next.setSelectionRange(position, position); }
      });
    }
    $('#member-more')?.addEventListener('click', () => { state.members.limit = 999; renderMembers(); });
  }

  /* ---------------- events ---------------- */
  function renderEvents() {
    const events = TD.allEvents();
    const totals = TD.totals();
    const allMembers = TD.allMembers();
    const head = `
      <div class="page-head">
        <div class="eyebrow"><span class="live-dot"></span> CHECK-IN & INSIGHT / 活动打卡</div>
        <div class="head-grid">
          <div><h1 class="display">每一次到场，<br><span class="hl">都算数。</span></h1></div>
          <div class="head-aside">
            <p>创建活动、现场打卡、回看数据。到场率与回访只在有真实记录后计算，不做预置，也不推测未填写的原因。</p>
            <div class="head-actions">
              <button class="btn btn-primary" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>
              <button class="btn btn-ghost" data-checkin-open><svg class="icon"><use href="#i-check"/></svg> 现场打卡</button>
            </div>
          </div>
        </div>
      </div>`;

    if (!events.length) {
      const html = `${head}
        <div class="event-empty-grid">
          <section class="panel event-launch">
            <div class="event-launch-visual" aria-hidden="true">
              <div class="launch-ring ring-a"></div><div class="launch-ring ring-b"></div><div class="launch-ring ring-c"></div>
              <span class="launch-core"><svg class="icon"><use href="#i-calendar"/></svg></span>
            </div>
            <div class="event-launch-copy">
              <span class="eyebrow"><span class="live-dot"></span> EVENT ENGINE / STANDBY</span>
              <h2>还没有活动场次。</h2>
              <p>创建第一场活动后，现场打卡、到场曲线、回访率与主题热度会从真实记录开始生成。</p>
              <div class="head-actions">
                <button class="btn btn-primary" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建第一场活动</button>
                ${allMembers.length ? `<button class="btn btn-ghost" data-checkin-open>先登记成员</button>` : `<button class="btn btn-ghost" data-new-member>先登记成员</button>`}
              </div>
            </div>
            <div class="launch-steps">
              <div><span class="mono">01 / BUILD</span><strong>创建活动</strong><p>填写日期、主题与本场预期。</p></div>
              <div><span class="mono">02 / CHECK-IN</span><strong>现场打卡</strong><p>选择成员，或登记新朋友。</p></div>
              <div><span class="mono">03 / READOUT</span><strong>自动汇总</strong><p>到场、新面孔、回访与热度。</p></div>
            </div>
          </section>
          <aside class="event-empty-side">
            <article class="panel mini-status">
              <div class="panel-topline"><span>SYSTEM STATUS</span><span class="status-pill"><i></i> READY</span></div>
              <div class="mini-status-row"><span>成员档案</span><strong>${allMembers.length}</strong></div>
              <div class="mini-status-row"><span>活动场次</span><strong>0</strong></div>
              <div class="mini-status-row"><span>累计打卡</span><strong>${totals.checkins}</strong></div>
              <p>先把真实的人登记进来，再为下一场活动开放打卡。</p>
              <button class="btn btn-sm btn-ghost btn-block" data-new-member><svg class="icon"><use href="#i-podium"/></svg> 登记成员</button>
            </article>
            <article class="panel mini-status">
              <div class="panel-topline"><span>RULE / 打卡规则</span><span class="mono">LOCAL</span></div>
              <div class="rule-list">
                <div><b>01</b><p>一场活动一人只计一次打卡。</p></div>
                <div><b>02</b><p>首次到场计为新面孔，再次到场计为回访。</p></div>
                <div><b>03</b><p>所有数据保存在本机浏览器，可随时清空。</p></div>
              </div>
            </article>
          </aside>
        </div>`;
      setView('events', html);
      return;
    }

    const latest = events[events.length - 1];
    const previous = events[events.length - 2] || null;
    const peak = [...events].sort((a, b) => b.total - a.total)[0];
    const low = [...events].sort((a, b) => a.total - b.total)[0];
    const themes = TD.themeStats();
    const retention = TD.retention();
    const once = retention.buckets[0];
    const core = retention.buckets[3];
    const change = previous ? latest.total - previous.total : null;
    const topTheme = themes[0] || null;
    const heatValues = events.map(event => event.heat);
    const avgHeat = heatValues.reduce((sum, value) => sum + value, 0) / heatValues.length;

    const html = `${head}
      <div class="kpi-row">
        <div class="kpi" data-tilt><span>CUMULATIVE / 累计</span><strong>${totals.checkins}</strong><small>人次真实到场</small></div>
        <div class="kpi" data-tilt><span>AVERAGE / 场均</span><strong>${totals.avg.toFixed(1)}</strong><small>每场平均到场</small></div>
        <div class="kpi" data-tilt><span>RETURNING / 回访</span><strong>${Math.round(retention.returnRate * 100)}%</strong><small>${retention.returning} 人来了不止一次</small></div>
        <div class="kpi" data-tilt><span>TOP THEME / 最热</span><strong class="kpi-text">${topTheme ? esc(topTheme.theme) : '—'}</strong><small>${topTheme ? `热度指数 ${topTheme.heat.toFixed(0)}` : '等待记录'}</small></div>
      </div>

      <div class="events-grid">
        <article class="panel chart-panel">
          <div class="panel-topline"><span>ATTENDANCE CURVE / 每场人数</span><span class="chart-legend"><span><i class="new"></i>新面孔</span><span><i class="back"></i>回访</span><span><i class="total"></i>实到</span></span></div>
          ${TC.attendanceChart(events)}
          <div class="chart-foot">
            <span>峰值：<strong>${esc(peak.short || peak.title)} ${peak.total} 人</strong>（${md(peak.date)}）</span>
            <span>最近一场较上场 <strong class="${change >= 0 ? 'is-up' : 'is-down'}">${change === null ? '首场记录' : `${change >= 0 ? '+' : ''}${change} 人`}</strong></span>
          </div>
        </article>

        <article class="panel retention-panel">
          <div class="panel-topline"><span>RETENTION / 参与画像</span><span>${retention.total} 位成员</span></div>
          <div class="retention-body">
            ${TC.donut(retention)}
            <div class="retention-legend">
              ${retention.buckets.map(bucket => `<div><i style="background:${bucket.color}"></i>${bucket.label}<span>${bucket.people.length} 人</span></div>`).join('')}
            </div>
          </div>
          <p class="retention-note"><strong>${once.people.length} 位</strong>只来过一次；<strong>${core.people.length} 位</strong>已经来到 7 次以上。回访率按已登记成员计算。</p>
          <button class="btn btn-sm btn-ghost btn-block" data-nav="ladder">进入成长天梯 <svg class="icon"><use href="#i-arrow"/></svg></button>
        </article>
      </div>

      <div class="events-grid events-grid-even">
        <article class="panel">
          <div class="panel-topline"><span>THEME PERFORMANCE / 主题热度</span><span class="mono">AVG HEAT ${avgHeat.toFixed(0)}</span></div>
          ${TC.themeBars(themes)}
        </article>
        <article class="panel">
          <div class="panel-topline"><span>READOUT / 数据解读</span><span class="tick">FACT ONLY</span></div>
          <div class="insight-list">
            <div class="insight"><i>01</i><p><b>${esc(peak.theme)}</b> 的最高到场记录是 ${md(peak.date)} 的「${esc(peak.short || peak.title)}」，实到 ${peak.total} 人，预期 ${peak.expected || '未填写'} 人。</p></div>
            <div class="insight"><i>02</i><p>到场最低的一场是「${esc(low.short || low.title)}」（${low.total} 人）。${low.note ? `现场记录：${esc(low.note)}` : '本场未填写原因记录。'}</p></div>
            <div class="insight"><i>03</i><p>当前最热主题为 <b>${topTheme ? esc(topTheme.theme) : '—'}</b>，共 ${topTheme ? topTheme.count : 0} 场，主题热度 ${topTheme ? topTheme.heat.toFixed(0) : 0}。热度只由到场率与满意度计算。</p></div>
            <div class="insight"><i>04</i><p>最近一场「${esc(latest.short || latest.title)}」实到 ${latest.total} 人，新面孔 ${latest.fresh} 人；${change === null ? '这是第一场记录' : `较上场 ${change >= 0 ? '增加' : '减少'} ${Math.abs(change)} 人`}。</p></div>
          </div>
        </article>
      </div>

      <div class="panel event-table">
        <div class="event-table-head"><span>日期</span><span>活动 / 主题</span><span>主题</span><span>实到 / 预期</span><span>新面孔</span><span>回访</span><span>热度</span><span>操作</span></div>
        ${events.map(event => `
          <div class="event-row">
            <span class="date mono">${fmtDate(event.date)}</span>
            <div class="title"><strong>${esc(event.title)}</strong><span>${esc(event.venue)}</span></div>
            <span><span class="theme-tag">${esc(event.theme)}</span></span>
            <span class="nums"><b>${event.total}</b> / ${event.expected || '—'}</span>
            <span class="nums is-orange">+${event.fresh}</span>
            <span class="nums is-blue">${event.returning}</span>
            <div class="heat"><div class="heat-bar"><i style="width:${event.heat}%"></i></div><span class="mono">${event.heat}</span></div>
            <span><button class="btn btn-sm btn-line" data-checkin-event="${event.id}">打卡</button></span>
          </div>`).join('')}
      </div>`;

    setView('events', html);
  }

  /* ---------------- works ---------------- */
  function filteredWorks() {
    const { type, theme, query } = state.works;
    let list = [...TD.works];
    if (type !== 'ALL') list = list.filter(work => work.type === type);
    if (theme !== 'ALL') list = list.filter(work => work.theme === theme);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(work => {
        const author = work.author != null ? memberInfo(work.author) : null;
        return `${work.cn || ''} ${work.title || ''} ${work.theme || ''} ${work.desc || ''} ${author ? author.name : ''}`.toLowerCase().includes(q);
      });
    }
    list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    return list;
  }

  function workCard(work, index) {
    const author = work.author != null ? memberInfo(work.author) : null;
    const span = index % 4 === 0 ? 'span-8' : 'span-4';
    return `<article class="work-card ${span}" data-work="${work.id}" data-tilt tabindex="0" role="button" aria-label="查看作品 ${esc(work.cn || work.title || '')}">
      <div class="work-visual">${TV.artHTML(work)}<span class="work-open"><svg class="icon"><use href="#i-arrow-up"/></svg></span></div>
      <div class="work-body">
        <div><h3>${esc(work.cn || work.title || '未命名作品')}</h3><p class="work-cn">${esc(work.title || '')}</p><div class="work-author">${author ? TV.avatar(author, { size: 'sm' }) : ''}${author ? esc(author.name) : '未署名'} · ${esc(work.type || '数字')}作品 · ${esc(work.theme || '')}</div></div>
        <span class="work-idx mono">/${String((work.id || 0) + 1).padStart(2, '0')}</span>
      </div>
    </article>`;
  }

  function renderWorks() {
    const all = TD.works;
    const head = `
      <div class="page-head">
        <div class="eyebrow"><span class="live-dot"></span> RESEARCH & CREATION / 作品现场</div>
        <div class="head-grid">
          <div><h1 class="display">让研究成果，<br><span class="hl">走向真实世界。</span></h1></div>
          <div class="head-aside">
            <p>作品区展示社区真实接入的内容。加入作品时可以关联主创与联合创作者，系统会自动生成封面并同步到大屏轮播。</p>
            <div class="head-actions">
              <button class="btn btn-primary" data-new-work><svg class="icon"><use href="#i-plus"/></svg> 加入作品</button>
              <button class="btn btn-ghost" data-nav="overview"><svg class="icon"><use href="#i-screen"/></svg> 返回总览</button>
              ${all.length ? `<button class="btn btn-ghost" data-nav="events">活动记录 <svg class="icon"><use href="#i-arrow"/></svg></button>` : ''}
            </div>
          </div>
        </div>
      </div>`;

    if (!all.length) {
      const html = `${head}
        <section class="panel works-intake">
          <div class="works-intake-copy">
            <span class="eyebrow"><span class="live-dot"></span> WORKS / SLOTS RESERVED</span>
            <h2>作品位已预留，<br>等待真实内容。</h2>
            <p>点击“加入作品”填写作品信息、创作者与视觉主题。提交后会立即生成作品卡，并进入总览大屏轮播。</p>
            <button class="btn btn-primary" data-new-work><svg class="icon"><use href="#i-plus"/></svg> 加入第一件作品</button>
            <div class="intake-meta">
              <div><span class="mono">CAPACITY</span><strong>06</strong><small>轮播槽位</small></div>
              <div><span class="mono">CURRENT</span><strong>00</strong><small>已接入作品</small></div>
              <div><span class="mono">MODE</span><strong>READY</strong><small>等待数据</small></div>
            </div>
          </div>
          <div class="works-slots" aria-hidden="true">
            ${Array.from({ length: 6 }, (_, index) => `<div class="work-slot"><span class="mono">SLOT / ${String(index + 1).padStart(2, '0')}</span><i></i><b>NO SIGNAL</b></div>`).join('')}
          </div>
        </section>
        <div class="works-note-grid">
          <article class="panel"><div class="panel-topline"><span>WHY EMPTY / 为什么是空的</span><span class="mono">NO MOCK DATA</span></div><p>这个项目不凭空创造人物、作品或作者关系。所有展示内容都应来自真实登记或后续内容接入。</p></article>
          <article class="panel"><div class="panel-topline"><span>NEXT / 现在可以做什么</span><span class="mono">LOCAL</span></div><p>已有成员档案时可直接关联主创与联合创作者；尚未登记成员也可以先加入作品，之后再补充作者关系。</p></article>
        </div>`;
      setView('works', html);
      return;
    }

    const types = ['ALL', ...new Set(all.map(work => work.type).filter(Boolean))];
    const themes = TD.themesOfWorks();
    const list = filteredWorks();
    let grid = '';
    if (!list.length) {
      grid = `<div class="empty-state">这个筛选条件下暂时没有作品。<button class="text-link" data-work-reset>清除筛选</button></div>`;
    } else {
      grid = list.map((work, index) => workCard(work, index)).join('');
    }

    const html = `${head}
      <div class="filterbar">
        <div class="filter-left">
          <div class="segmented" id="work-type">
            ${types.map(type => `<button class="${state.works.type === type ? 'active' : ''}" data-work-type="${esc(type)}">${type === 'ALL' ? '全部' : esc(type)} <sup>${type === 'ALL' ? all.length : all.filter(work => work.type === type).length}</sup></button>`).join('')}
          </div>
          <div class="chip-row" id="work-theme">
            <button class="chip ${state.works.theme === 'ALL' ? 'active' : ''}" data-work-theme="ALL">全部主题</button>
            ${themes.map(theme => `<button class="chip ${state.works.theme === theme ? 'active' : ''}" data-work-theme="${esc(theme)}">${esc(theme)}</button>`).join('')}
          </div>
        </div>
        <div class="search-box work-search"><svg class="icon"><use href="#i-search"/></svg><input id="work-search" type="search" placeholder="搜索作品 / 作者" value="${esc(state.works.query)}" autocomplete="off"></div>
      </div>
      <div class="works-grid">${grid}</div>`;

    setView('works', html);
    const search = $('#work-search');
    if (search) {
      search.addEventListener('input', event => {
        state.works.query = event.target.value;
        const position = event.target.selectionStart;
        renderWorks();
        const next = $('#work-search');
        if (next) { next.focus(); next.setSelectionRange(position, position); }
      });
    }
  }

  /* ---------------- modals ---------------- */
  function syncModalState() {
    const open = $('#modal')?.classList.contains('open')
      || $('#checkin')?.classList.contains('open')
      || $('#command')?.classList.contains('open');
    document.body.classList.toggle('modal-open', Boolean(open));
  }

  function openModal(html) {
    const modal = $('#modal');
    if (!modal) return;
    $('#modal-content').innerHTML = html;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalState();
    $('#modal-close')?.focus({ preventScroll: true });
  }

  function closeModal() {
    const modal = $('#modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    syncModalState();
  }

  function openWork(id) {
    const work = workById(id);
    if (!work) return;
    const author = work.author != null ? memberInfo(work.author) : null;
    const coauthors = Array.isArray(work.co) ? work.co.map(item => memberInfo(item)).filter(Boolean) : [];
    const same = TD.works.filter(item => item.theme === work.theme && item.id !== work.id).slice(0, 5);
    const html = `<div class="modal-work">
      <div class="modal-art">${TV.artHTML(work)}</div>
      <div class="modal-copy">
        <span class="mono-label">${esc(work.theme || '社区创作')} / ${esc(work.type || '数字')}作品 / ${esc(work.year || '')}</span>
        <h2 id="modal-title">${esc(work.cn || work.title || '未命名作品')}</h2>
        <p class="modal-cn">${esc(work.title || '')}</p>
        <p class="modal-desc">${esc(work.desc || '')}</p>
        ${Array.isArray(work.tags) ? `<div class="modal-tags">${work.tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
        <div class="modal-specs">
          <div><span>RECOMMEND / 推荐值</span><strong>${work.likes || 0} 次</strong></div>
          <div><span>FORMAT / 形态</span><strong>${esc(work.type || '数字')} · ${esc(work.theme || '')}</strong></div>
        </div>
        ${author ? `<div class="modal-authors">
          <button class="author-chip" data-member="${author.id}">${TV.avatar(author, { size: 'sm' })}${esc(author.name)} · 主创</button>
          ${coauthors.map(member => `<button class="author-chip" data-member="${member.id}">${TV.avatar(member, { size: 'sm' })}${esc(member.name)}</button>`).join('')}
        </div>` : ''}
        <div class="modal-actions">
          <button class="btn btn-primary" data-screen-work="${work.id}"><svg class="icon"><use href="#i-play"/></svg> 在大屏播放</button>
          ${author ? `<button class="btn btn-ghost" data-member="${author.id}">作者档案 <svg class="icon"><use href="#i-arrow-up"/></svg></button>` : ''}
        </div>
        ${same.length ? `<div class="modal-same"><h4>SAME THEME / 同主题作品</h4><div class="modal-same-list">${same.map(item => `<button data-work="${item.id}">${esc(item.cn || item.title)} <span class="mono">${item.likes || 0}</span></button>`).join('')}</div></div>` : ''}
      </div>
    </div>`;
    openModal(html);
  }

  function openMember(id) {
    const member = memberInfo(id);
    if (!member) return;
    const authored = TD.authoredWorks(member.id);
    const coauthored = TD.coauthoredWorks(member.id);
    const events = TD.allEvents();
    const works = [...authored, ...coauthored];
    const all = TD.allMembers();
    const rank = all.findIndex(item => item.id === member.id) + 1;
    const nextLevel = TD.LEVELS[member.level.n] || null;
    const progress = nextLevel
      ? clamp((member.score - member.level.min) / Math.max(nextLevel.min - member.level.min, 1) * 100, 0, 100)
      : 100;
    const html = `
      <div class="member-modal-head">
        <div class="member-modal-portrait">
          ${TV.mascot(member.level)}
          ${TV.avatar(member, { size: 'lg' })}
          <span class="mono">TURING DIGITAL ID / ${String(member.id + 1).padStart(3, '0')}</span>
        </div>
        <div class="member-modal-copy">
          <span class="mono-label">MEMBER FILE / ${esc(member.level.en)}</span>
          <h2 id="modal-title">${esc(member.name)}</h2>
          <div class="member-en">${esc(member.en)} · ${esc(member.role)} · ${esc(member.org)}</div>
          <p class="member-tagline">“${esc(member.tagline || '第一次到场，故事从这里开始。')}”</p>
          <div class="member-level-bar">
            <span class="level-pill"><i style="background:${member.level.tone}"></i>Lv.${member.level.n} ${esc(member.level.name)}</span>
            <div class="track"><i style="width:${progress}%"></i></div><strong>${member.score}</strong>
          </div>
        </div>
      </div>
      <div class="member-modal-body">
        <div class="member-stat-grid">
          <div class="member-stat"><span>ATTENDED / 到场</span><strong>${member.visits}</strong><small>场活动</small></div>
          <div class="member-stat"><span>STREAK / 连续</span><strong>${member.streak}</strong><small>场连续参与</small></div>
          <div class="member-stat"><span>WORKS / 作品</span><strong>${works.length}</strong><small>件（含联合）</small></div>
          <div class="member-stat"><span>RANK / 排名</span><strong>${rank}</strong><small>/ ${all.length} 位成员</small></div>
        </div>
        <div class="attendance-line"><h4>ATTENDANCE / 到场记录</h4>
          ${events.length ? `<div class="attendance-dots">
            ${events.map(event => {
              const on = member.att[event.id] === '1';
              const isNew = on && member.first === event.id;
              return `<div class="att-dot ${on ? 'on' : ''} ${isNew ? 'new' : ''}"><i>${md(event.date)}</i><strong>${on ? (isNew ? 'NEW' : '✓') : '—'}</strong></div>`;
            }).join('')}
          </div>` : '<p class="dossier-note">尚未创建活动场次。</p>'}
        </div>
        <div class="member-works"><h4>WORKS / 作品档案</h4>
          ${works.length ? `<div class="member-work-grid">${works.map(work => `<article class="member-work" data-work="${work.id}"><div>${TV.artHTML(work)}</div><div class="mw-body"><strong>${esc(work.cn || work.title)}</strong><span>${esc(work.theme || '')} · ${work.author === member.id ? '主创' : '联合'}</span></div></article>`).join('')}</div>` : '<p class="dossier-note">还没有作品档案。</p>'}
        </div>
        <div class="member-modal-actions">
          <button class="btn btn-primary" data-open-profile="${member.id}">在成员页查看 <svg class="icon"><use href="#i-arrow-up"/></svg></button>
          ${events.length ? `<button class="btn btn-ghost" data-checkin-member="${member.id}">本场打卡 <svg class="icon"><use href="#i-check"/></svg></button>` : `<button class="btn btn-ghost" data-new-event>创建活动 <svg class="icon"><use href="#i-plus"/></svg></button>`}
        </div>
      </div>`;
    openModal(html);
  }

  function openWorkForm() {
    const members = TD.allMembers();
    const themes = [...new Set([
      ...TD.themesOfWorks(),
      ...TD.themeStats().map(theme => theme.theme)
    ].filter(Boolean))];
    const motifs = ['几何网络', '光场粒子', '模块结构', '字体档案', '角色界面', '关系节点', '智能流程', '放射信号', '情绪矩阵', '数据节律', '空间曲线', '轨道叠层'];
    const authorOptions = members.length
      ? members.map((member, index) => `<option value="${member.id}" ${index === 0 ? 'selected' : ''}>${esc(member.name)} · ${esc(member.role)}</option>`).join('')
      : '<option value="">未关联成员</option>';
    const coauthors = members.length ? `
      <div class="coauthor-grid">
        ${members.map(member => `<label class="check-option">
          <input type="checkbox" name="co" value="${member.id}">
          <span>${esc(member.name)}<small>${esc(member.en)}</small></span>
        </label>`).join('')}
      </div>` : '<p class="form-hint">目前还没有成员档案，可以先加入作品；登记成员后再关联主创与联合创作者。</p>';

    const html = `<div class="form-modal">
      <div class="form-modal-head">
        <span class="eyebrow"><span class="live-dot"></span> WORK INTAKE / 加入作品</span>
        <h2 id="modal-title">让一件真实作品进入现场。</h2>
        <p>填写作品标题、创作者和主题后，系统会自动生成作品封面，并同步到作品页与总览大屏。</p>
      </div>
      <form id="work-form" class="work-form">
        <div class="form-grid">
          <div class="field"><label>中文标题 *</label><input name="cn" required maxlength="30" placeholder="如：共创力场" autocomplete="off"></div>
          <div class="field"><label>ENGLISH TITLE</label><input name="title" maxlength="54" placeholder="如：CO-CREATIVE FIELD" autocomplete="off"></div>
          <div class="field"><label>AUTHOR / 主创</label><select name="author">${authorOptions}</select></div>
          <div class="field"><label>TYPE / 作品类型</label><select name="type"><option>个人</option><option>综合</option><option>同主题</option></select></div>
          <div class="field"><label>THEME / 主题</label><input name="theme" maxlength="16" placeholder="如：人机共创" list="work-theme-options" autocomplete="off"><datalist id="work-theme-options">${themes.map(theme => `<option value="${esc(theme)}"></option>`).join('')}</datalist></div>
          <div class="field"><label>MOTIF / 封面视觉</label><select name="motif">${motifs.map((label, index) => `<option value="${index}">${String(index + 1).padStart(2, '0')} · ${label}</option>`).join('')}</select></div>
          <div class="field"><label>YEAR / 年份</label><input name="year" type="number" min="2000" max="2100" step="1" value="${new Date().getFullYear()}" inputmode="numeric"></div>
          <div class="field"><label>RECOMMEND / 推荐值</label><input name="likes" type="number" min="0" max="99999" step="1" value="0" inputmode="numeric"></div>
          <div class="field full"><label>CO-AUTHORS / 联合创作者</label>${coauthors}</div>
          <div class="field full"><label>DESCRIPTION / 作品说明</label><textarea name="desc" rows="3" maxlength="180" placeholder="说明作品解决的问题、方法或现场背景。"></textarea></div>
          <div class="field full"><label>TAGS / 标签</label><input name="tags" maxlength="70" placeholder="用逗号分隔，如：关系网络，实时生成，交互装置" autocomplete="off"></div>
        </div>
        <div class="form-actions">
          <span class="form-hint">作品保存在本机浏览器中；关联时仅可选择已登记成员，也可以先不关联。</span>
          <button class="btn btn-primary" type="submit"><svg class="icon"><use href="#i-check"/></svg> 加入作品</button>
        </div>
      </form>
    </div>`;
    openModal(html);
    $('#work-form')?.addEventListener('submit', handleNewWork);
  }

  function handleNewWork(event) {
    event.preventDefault();
    const data = new FormData(event.target);
    const created = TD.addWork({
      cn: String(data.get('cn') || '').trim(),
      title: String(data.get('title') || '').trim(),
      author: String(data.get('author') || '').trim(),
      co: data.getAll('co'),
      type: String(data.get('type') || '').trim(),
      theme: String(data.get('theme') || '').trim(),
      motif: data.get('motif'),
      year: data.get('year'),
      likes: data.get('likes'),
      desc: String(data.get('desc') || '').trim(),
      tags: String(data.get('tags') || '').trim()
    });
    if (!created) { toast('作品加入失败，请检查中文标题'); return; }
    state.works = { type: 'ALL', theme: 'ALL', query: '' };
    closeModal();
    toast(`「${created.cn}」已加入作品现场`);
    if (state.view === 'works') refreshCurrentView();
    else navigate('works');
  }

  function openEventForm() {
    state.eventForm.fromCheckin = Boolean($('#checkin')?.classList.contains('open'));
    const themes = TD.themeStats().map(theme => theme.theme);
    const html = `<div class="form-modal">
      <div class="form-modal-head">
        <span class="eyebrow"><span class="live-dot"></span> EVENT BUILDER / 新建活动</span>
        <h2 id="modal-title">创建一场真实活动。</h2>
        <p>填写已知信息即可。到场人数、新面孔与回访会在打卡后自动计算，不需要手工填写。</p>
      </div>
      <form id="event-form" class="event-form">
        <div class="form-grid">
          <div class="field"><label>DATE / 日期 *</label><input name="date" type="date" value="${todayValue()}" required></div>
          <div class="field"><label>TITLE / 活动名称 *</label><input name="title" required maxlength="30" placeholder="如：AI 共创工作坊" autocomplete="off"></div>
          <div class="field"><label>SHORT / 大屏短名</label><input name="short" maxlength="14" placeholder="不填则使用活动名称" autocomplete="off"></div>
          <div class="field"><label>THEME / 主题</label><input name="theme" maxlength="16" placeholder="如：人机协作" list="theme-options" autocomplete="off"><datalist id="theme-options">${themes.map(theme => `<option value="${esc(theme)}"></option>`).join('')}</datalist></div>
          <div class="field"><label>VENUE / 地点</label><input name="venue" maxlength="30" placeholder="图灵研究院" autocomplete="off"></div>
          <div class="field"><label>EXPECTED / 预期人数</label><input name="expected" type="number" min="0" max="999" step="1" placeholder="0" inputmode="numeric"></div>
          <div class="field"><label>SATISFACTION / 满意度（0–5）</label><input name="satisfaction" type="number" min="0" max="5" step="0.1" placeholder="活动结束后填写" inputmode="decimal"></div>
          <div class="field full"><label>NOTE / 现场记录</label><textarea name="note" rows="3" maxlength="160" placeholder="可记录本场实际发生了什么；数据解读只使用这里填写的内容，不做自动推断。"></textarea></div>
        </div>
        <div class="form-actions">
          <span class="form-hint">活动创建后会立即出现在打卡与活动数据中。</span>
          <button class="btn btn-primary" type="submit"><svg class="icon"><use href="#i-check"/></svg> 创建活动</button>
        </div>
      </form>
    </div>`;
    openModal(html);
    $('#event-form')?.addEventListener('submit', handleNewEvent);
  }

  function handleNewEvent(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    if (!title) { toast('请填写活动名称'); return; }
    const created = TD.addEvent({
      date: String(data.get('date') || '').trim() || todayValue(),
      title,
      short: String(data.get('short') || '').trim(),
      theme: String(data.get('theme') || '').trim(),
      venue: String(data.get('venue') || '').trim(),
      expected: data.get('expected'),
      satisfaction: data.get('satisfaction'),
      note: String(data.get('note') || '').trim()
    });
    if (!created) { toast('活动创建失败，请检查名称'); return; }
    const fromCheckin = state.eventForm.fromCheckin;
    closeModal();
    state.screen.index = 0;
    toast(`「${created.title}」已创建${fromCheckin ? '，可以开始打卡' : ''}`);
    refreshCurrentView();
    if (fromCheckin) openCheckin(created.id, 'member');
  }

  /* ---------------- check-in ---------------- */
  function currentCheckinEvent() {
    if (!TD.events.length) return null;
    return eventById(state.checkin.event) || latestEvent();
  }

  function openCheckin(eventId, tab) {
    const events = TD.allEvents();
    const event = eventId != null ? events.find(item => item.id === Number(eventId)) : events[events.length - 1];
    state.checkin.event = event ? event.id : null;
    state.checkin.tab = event ? (tab || 'member') : 'new';
    state.checkin.query = '';
    state.checkin.photo = null;
    renderCheckin();
    const modal = $('#checkin');
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    syncModalState();
    $('#checkin-close')?.focus({ preventScroll: true });
  }

  function closeCheckin() {
    const modal = $('#checkin');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    syncModalState();
  }

  function renderCheckin() {
    const events = TD.allEvents();
    const event = currentCheckinEvent();
    const hasEvent = Boolean(event);
    const totals = TD.totals();
    const already = new Set(event ? event.attendees.map(member => String(member.id)) : []);
    const recent = event ? [...event.attendees].slice(-6).reverse() : [];
    let list = TD.allMembers();
    if (state.checkin.query) {
      const q = state.checkin.query.toLowerCase();
      list = list.filter(member => `${member.name} ${member.en} ${member.role} ${member.org}`.toLowerCase().includes(q));
    }
    list.sort((a, b) => (already.has(String(a.id)) ? 1 : 0) - (already.has(String(b.id)) ? 1 : 0) || b.score - a.score);

    const memberTab = `
      <div class="search-box checkin-search"><svg class="icon"><use href="#i-search"/></svg><input id="checkin-search" type="search" placeholder="输入姓名 / 拼音 / 单位快速找到自己" value="${esc(state.checkin.query)}" autocomplete="off"></div>
      <div class="checkin-list-meta mono"><span>未打卡成员优先</span><span>已签到 ${already.size} / 预期 ${hasEvent ? event.expected || '—' : '—'}</span></div>
      <div class="member-pick-list">
        ${list.length ? list.map(member => {
          const done = already.has(String(member.id));
          return `<button class="member-pick" data-pick="${member.id}" ${done ? 'disabled' : ''}>
            ${TV.avatar(member, { size: 'sm' })}
            <span class="mp-name"><strong>${esc(member.name)}</strong><span>${esc(member.en)} · ${esc(member.org)} · 已来 ${member.visits} 场</span></span>
            <span class="mp-state ${done ? 'done' : ''}">${done ? '已打卡' : `Lv.${member.level.n}`}</span>
            ${done ? '' : '<span class="mp-plus"><svg class="icon"><use href="#i-plus"/></svg></span>'}
          </button>`;
        }).join('') : `<div class="checkin-empty">还没有成员档案。<button class="text-link" id="checkin-go-new">先登记新成员</button></div>`}
      </div>`;

    const formTab = `
      <form id="new-member-form" class="member-form">
        <div class="form-grid">
          <div class="field"><label>NAME / 姓名 *</label><input name="name" required maxlength="12" placeholder="你的名字" autocomplete="off"></div>
          <div class="field"><label>ROLE / 身份</label><input name="role" maxlength="20" placeholder="如：AI 研究创作者" autocomplete="off"></div>
          <div class="field"><label>ORG / 学校或单位</label><input name="org" maxlength="24" placeholder="如：温州大学" autocomplete="off"></div>
          <div class="field"><label>TAGLINE / 一句话</label><input name="tagline" maxlength="40" placeholder="可选，用于成员档案" autocomplete="off"></div>
          <div class="field full"><label>AVATAR / 头像采集</label>
            <div class="avatar-pick">
              <div class="avatar-preview" id="avatar-preview"><span>?</span></div>
              <div class="avatar-tools">
                <label class="upload-btn"><svg class="icon"><use href="#i-camera"/></svg> 拍照 / 上传<input id="photo-input" type="file" accept="image/*" capture="user" hidden></label>
                <div class="swatches" id="swatches">${TD.MEMBER_COLORS.map((colors, index) => `<button type="button" class="swatch ${index === state.checkin.color ? 'on' : ''}" data-color="${index}" style="background:linear-gradient(135deg,${colors[0]},${colors[1]})" aria-label="配色 ${index + 1}"></button>`).join('')}</div>
              </div>
            </div>
          </div>
          <div class="consent field full"><input type="checkbox" id="consent" name="consent" required><label for="consent">我同意姓名与头像仅用于图灵研究院社区大屏展示，数据保存在本机浏览器，可随时清除。</label></div>
        </div>
        <div class="form-actions">
          <span class="form-hint">${hasEvent ? '登记后自动完成本场打卡，并进入 Lv.01 奶蛋。' : '登记后进入 Lv.01 奶蛋；创建活动后即可开始打卡。'}</span>
          <button class="btn btn-primary" type="submit"><svg class="icon"><use href="#i-check"/></svg> ${hasEvent ? '完成登记并打卡' : '完成登记'}</button>
        </div>
      </form>`;

    const eventSelect = hasEvent ? `<div class="event-select">
      <label>EVENT / 本场活动</label>
      <select id="checkin-event">${events.map(item => `<option value="${item.id}" ${item.id === event.id ? 'selected' : ''}>${fmtDate(item.date)} · ${esc(item.title)}</option>`).join('')}</select>
      <span class="mono">${totals.checkins} CHECK-INS TOTAL</span>
    </div>` : `<div class="inline-callout">
      <div><strong>当前没有活动场次</strong><span>成员登记仍然可用；创建活动后即可开放现场打卡。</span></div>
      <button class="btn btn-sm btn-primary" data-new-event><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>
    </div>`;

    const side = hasEvent ? `
      <div class="side-card">
        <h4>NOW / 本场</h4>
        <div class="side-event">${esc(event.title)}</div>
        <div class="side-meta">${fmtDate(event.date)}<br>${esc(event.venue)}<br>主题：${esc(event.theme)}</div>
        <div class="side-count"><strong id="side-total">${event.total}</strong><span>人已到场 / 预期 ${event.expected || '—'}</span></div>
        <div class="side-meter"><i style="width:${event.expected ? clamp(event.total / event.expected * 100, 0, 100) : 0}%"></i></div>
      </div>
      <div class="side-card">
        <h4>RECENT / 最近签到</h4>
        <div class="recent-checkin" id="recent-list">
          ${recent.length ? recent.map(member => `<div>${TV.avatar(member, { size: 'sm' })}${esc(member.name)}<em>+1</em></div>`).join('') : '<span class="side-empty">还没有人签到，你可以是第一个。</span>'}
        </div>
      </div>
      <div class="side-card accent-card">
        <h4>RULE / 计数规则</h4>
        <p>每场活动一人只计一次打卡。首次到场计为新面孔，之后计为回访。数据仅保存在本机。</p>
      </div>` : `
      <div class="side-card">
        <h4>STANDBY / 等待活动</h4>
        <div class="side-event">还没有活动场次</div>
        <div class="side-meta">先登记成员，或创建一场活动后开放打卡。</div>
        <button class="btn btn-sm btn-primary btn-block" data-new-event style="margin-top:14px"><svg class="icon"><use href="#i-plus"/></svg> 创建活动</button>
      </div>
      <div class="side-card accent-card">
        <h4>REGISTER / 成员登记</h4>
        <p>登记不需要活动场次。姓名、身份与头像仅保存在本机浏览器，可随时清空。</p>
      </div>`;

    const html = `
      <div class="checkin-header">
        <div class="eyebrow"><span class="live-dot"></span> CHECK-IN STATION / ${hasEvent ? '现场打卡' : '成员登记'}</div>
        <h2 id="checkin-title">${hasEvent ? '来了，就留下一个记录。' : '先登记，再开始。'}</h2>
        <p>${hasEvent ? '选择自己完成签到，或登记一位新朋友。每次打卡都会实时进入成长轨道、到场曲线与大屏。' : '当前没有活动场次。你可以先登记真实成员；创建活动后，现场打卡会立即开放。'}</p>
        ${eventSelect}
      </div>
      <div class="checkin-body-grid">
        <div class="checkin-main">
          ${hasEvent ? `<div class="tabs" id="checkin-tabs">
            <button class="${state.checkin.tab === 'member' ? 'active' : ''}" data-checkin-tab="member">我是老成员</button>
            <button class="${state.checkin.tab === 'new' ? 'active' : ''}" data-checkin-tab="new">我是新朋友</button>
          </div>` : ''}
          <div id="checkin-tab-body">${hasEvent && state.checkin.tab === 'member' ? memberTab : formTab}</div>
        </div>
        <aside class="checkin-side">${side}</aside>
      </div>`;

    const content = $('#checkin-content');
    if (!content) return;
    content.innerHTML = html;

    $('#checkin-event')?.addEventListener('change', changeEvent => {
      state.checkin.event = Number(changeEvent.target.value);
      state.checkin.query = '';
      state.checkin.photo = null;
      renderCheckin();
    });
    $$('#checkin-tabs [data-checkin-tab]').forEach(button => button.addEventListener('click', () => {
      state.checkin.tab = button.dataset.checkinTab;
      state.checkin.photo = null;
      renderCheckin();
    }));
    const search = $('#checkin-search');
    if (search) {
      search.addEventListener('input', changeEvent => {
        state.checkin.query = changeEvent.target.value;
        const position = changeEvent.target.selectionStart;
        renderCheckin();
        const next = $('#checkin-search');
        if (next) { next.focus(); next.setSelectionRange(position, position); }
      });
    }
    $('#checkin-go-new')?.addEventListener('click', () => {
      state.checkin.tab = 'new';
      state.checkin.query = '';
      renderCheckin();
    });
    $$('[data-pick]').forEach(button => button.addEventListener('click', () => checkInMember(Number(button.dataset.pick))));
    const photo = $('#photo-input');
    if (photo) photo.addEventListener('change', handlePhoto);
    $$('[data-color]').forEach(button => button.addEventListener('click', () => {
      state.checkin.color = Number(button.dataset.color);
      $$('[data-color]').forEach(item => item.classList.toggle('on', item === button));
      paintPreview();
    }));
    const form = $('#new-member-form');
    if (form) form.addEventListener('submit', handleNewMember);
    paintPreview();
  }

  function paintPreview() {
    const preview = $('#avatar-preview');
    if (!preview) return;
    if (state.checkin.photo) {
      preview.innerHTML = `<img src="${state.checkin.photo}" alt="头像预览">`;
      preview.style.background = '#0b1526';
      return;
    }
    const colors = TD.MEMBER_COLORS[state.checkin.color % TD.MEMBER_COLORS.length];
    preview.style.background = colors[0];
    preview.innerHTML = `<span style="color:${colors[1]}">?</span>`;
  }

  function handlePhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('请选择图片文件'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        state.checkin.photo = canvas.toDataURL('image/jpeg', 0.82);
        paintPreview();
        toast('头像已采集，仅保存在本机浏览器');
      };
      img.onerror = () => toast('图片读取失败，换一张试试');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function checkInMember(id) {
    const event = currentCheckinEvent();
    if (!event) { toast('请先创建活动场次'); return; }
    const raw = TD.memberById(id);
    if (!raw) return;
    const eventIndex = Math.max(0, TD.events.findIndex(item => item.id === Number(event.id)));
    const bits = String(raw.att || '').padEnd(TD.events.length, '0').split('');
    if (bits[eventIndex] === '1') { toast(`${raw.name} 本场已经打过卡了`); return; }
    const before = TD.levelOf(TD.score(raw));
    bits[eventIndex] = '1';
    raw.att = bits.join('');
    TD.save();
    const after = TD.levelOf(TD.score(raw));
    const updated = TD.memberInfo(raw);
    confetti();
    toast(`${raw.name} 打卡成功 · 活跃指数 ${updated.score}`);
    if (after.n > before.n) setTimeout(() => toast(`${raw.name} 晋升为 Lv.${after.n} ${after.name}！`), 1100);
    renderCheckin();
    refreshCurrentView();
  }

  function handleNewMember(event) {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    if (!name) { toast('请先填写姓名'); return; }
    if (TD.members.some(member => member.name === name)) { toast('已有同名成员，请在名字后加一个区分标识'); return; }
    if (!data.get('consent')) { toast('请勾选数据使用说明'); return; }
    const eventNow = currentCheckinEvent();
    let att = '';
    if (eventNow) {
      const eventIndex = Math.max(0, TD.events.findIndex(item => item.id === Number(eventNow.id)));
      const bits = Array(TD.events.length).fill('0');
      bits[eventIndex] = '1';
      att = bits.join('');
    }
    const member = TD.addMember({
      name,
      role: String(data.get('role') || '').trim(),
      org: String(data.get('org') || '').trim(),
      tagline: String(data.get('tagline') || '').trim(),
      colors: TD.MEMBER_COLORS[state.checkin.color % TD.MEMBER_COLORS.length],
      photo: state.checkin.photo,
      att
    });
    if (!member) { toast('登记失败，请检查姓名'); return; }
    const saved = TD.save();
    confetti();
    toast(saved
      ? (eventNow ? `${name} 已登记并完成本场打卡` : `${name} 已登记，创建活动后即可打卡`)
      : `${name} 已登记，但浏览器存储已满，头像可能无法长期保存`);
    state.checkin.photo = null;
    state.checkin.color = (state.checkin.color + 1) % TD.MEMBER_COLORS.length;
    if (eventNow) {
      state.checkin.tab = 'member';
      state.checkin.query = name;
    } else {
      state.checkin.tab = 'new';
      state.checkin.query = '';
    }
    renderCheckin();
    refreshCurrentView();
  }

  /* ---------------- command palette ---------------- */
  function commandItems() {
    const items = [
      { group: 'NAVIGATE / 页面', label: '社区总览', hint: 'OVERVIEW', icon: '#i-grid', run: () => { closeCommand(); navigate('overview'); } },
      { group: 'NAVIGATE / 页面', label: '成员成长天梯', hint: 'LADDER × NAILONG', icon: '#i-podium', run: () => { closeCommand(); navigate('ladder'); } },
      { group: 'NAVIGATE / 页面', label: '活动打卡', hint: 'EVENTS', icon: '#i-calendar', run: () => { closeCommand(); navigate('events'); } },
      { group: 'NAVIGATE / 页面', label: '作品现场', hint: 'WORKS', icon: '#i-layers', run: () => { closeCommand(); navigate('works'); } },
      { group: 'FLOW / 工作流', label: '现场打卡', hint: '选择成员完成本场签到', icon: '#i-check', run: () => { closeCommand(); openCheckin(); } },
      { group: 'FLOW / 工作流', label: '登记新成员', hint: '姓名 / 身份 / 头像', icon: '#i-plus', run: () => { closeCommand(); openCheckin(null, 'new'); } },
      { group: 'FLOW / 工作流', label: '加入新作品', hint: '标题 / 作者 / 主题 / 封面', icon: '#i-layers', run: () => { closeCommand(); openWorkForm(); } },
      { group: 'FLOW / 工作流', label: '创建活动', hint: '日期 / 主题 / 预期人数', icon: '#i-calendar', run: () => { closeCommand(); openEventForm(); } },
      { group: 'DISPLAY / 大屏', label: '全屏播放', hint: '打开 16:9 输出画面', icon: '#i-expand', run: () => { closeCommand(); if (state.view !== 'overview') navigate('overview'); requestStageFullscreen(); } },
      { group: 'DISPLAY / 大屏', label: '暂停 / 继续轮播', hint: 'SPACE', icon: '#i-pause', run: () => { closeCommand(); if (state.view !== 'overview') navigate('overview'); state.screen.playing = !state.screen.playing; renderStage(); restartStageTimer(); } }
    ];

    TD.allMembers().forEach(member => {
      items.push({
        group: 'MEMBER / 成员',
        label: member.name,
        hint: `${member.en} · Lv.${member.level.n} ${member.level.name} · ${member.score} INDEX`,
        icon: '#i-podium',
        run: () => { closeCommand(); openMember(member.id); }
      });
    });
    TD.allEvents().slice().reverse().forEach(event => {
      items.push({
        group: 'EVENT / 活动',
        label: event.title,
        hint: `${fmtDate(event.date)} · ${event.total} 人到场`,
        icon: '#i-calendar',
        run: () => { closeCommand(); openCheckin(event.id, 'member'); }
      });
    });
    TD.works.slice(0, 8).forEach(work => {
      items.push({
        group: 'WORK / 作品',
        label: work.cn || work.title,
        hint: `${work.theme || ''} · ${work.type || ''}`,
        icon: '#i-layers',
        run: () => { closeCommand(); openWork(work.id); }
      });
    });
    items.push({
      group: 'SYSTEM / 系统',
      label: '清空本机数据',
      hint: '删除全部成员、活动与头像',
      icon: '#i-reset',
      danger: true,
      run: () => { closeCommand(); resetData(); }
    });

    const q = state.command.query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items.filter(item => `${item.label} ${item.hint || ''}`.toLowerCase().includes(q)).slice(0, 30);
  }

  function renderCommand() {
    const list = $('#command-list');
    if (!list) return;
    const items = commandItems();
    state.command.items = items;
    if (state.command.index >= items.length) state.command.index = 0;
    let group = '';
    list.innerHTML = items.length ? items.map((item, index) => {
      const head = item.group !== group ? `<div class="command-group mono">${esc(item.group)}</div>` : '';
      group = item.group;
      return `${head}<button class="command-item ${index === state.command.index ? 'active' : ''} ${item.danger ? 'danger' : ''}" data-command-index="${index}">
        <span class="command-icon"><svg class="icon"><use href="${item.icon || '#i-arrow'}"/></svg></span>
        <span class="command-copy"><strong>${esc(item.label)}</strong><small>${esc(item.hint || '')}</small></span>
        <span class="command-key mono">${index === state.command.index ? '↵' : ''}</span>
      </button>`;
    }).join('') : `<div class="command-empty">没有匹配的指令。换个关键词，或直接登记成员。</div>`;
    $$('.command-item', list).forEach(button => {
      button.addEventListener('mouseenter', () => {
        state.command.index = Number(button.dataset.commandIndex);
        $$('.command-item', list).forEach(item => item.classList.toggle('active', item === button));
      });
    });
  }

  function openCommand() {
    if (!state.entered) return;
    lastFocused = document.activeElement;
    state.command.open = true;
    state.command.query = '';
    state.command.index = 0;
    const panel = $('#command');
    const input = $('#command-input');
    if (!panel || !input) return;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    input.value = '';
    renderCommand();
    syncModalState();
    setTimeout(() => input.focus({ preventScroll: true }), 30);
  }

  function closeCommand() {
    const panel = $('#command');
    if (!panel) return;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    state.command.open = false;
    syncModalState();
    if (lastFocused && document.contains(lastFocused)) {
      lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }
  }

  function runCommand(index) {
    const item = state.command.items[index];
    if (item) item.run();
  }

  function resetData() {
    if (!window.confirm('清空本机全部数据？成员、活动、打卡与头像都会被删除。')) return;
    TD.reset();
    state.members.focus = null;
    state.members.level = null;
    state.members.query = '';
    state.members.filter = 'all';
    state.works = { type: 'ALL', theme: 'ALL', query: '' };
    state.checkin.event = null;
    state.screen.index = 0;
    closeModal();
    closeCheckin();
    toast('本机数据已清空，屏幕回到待机状态');
    refreshCurrentView();
    if (state.view === 'overview') startStageTimer();
  }

  /* ---------------- global interactions ---------------- */
  function isTyping(target) {
    return Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function bindGlobal() {
    ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll', 'input', 'click'].forEach(type => {
      document.addEventListener(type, markActivity, { passive: true });
    });

    document.addEventListener('click', event => {
      const stageFrame = event.target.closest('#stage-frame');
      if (stageFrame) {
        if (event.detail > 1) return;
        clearTimeout(stageClickTimer);
        stageClickTimer = window.setTimeout(toggleStagePlayback, 180);
        return;
      }

      const nav = event.target.closest('[data-nav]');
      if (nav) { event.preventDefault(); navigate(nav.dataset.nav); return; }

      const commandItem = event.target.closest('[data-command-index]');
      if (commandItem) { event.preventDefault(); runCommand(Number(commandItem.dataset.commandIndex)); return; }

      const work = event.target.closest('[data-work]');
      if (work) { event.preventDefault(); openWork(Number(work.dataset.work)); return; }

      const member = event.target.closest('[data-member]');
      if (member) { event.preventDefault(); openMember(Number(member.dataset.member)); return; }

      const focusMember = event.target.closest('[data-focus-member]');
      if (focusMember) {
        event.preventDefault();
        state.members.focus = Number(focusMember.dataset.focusMember);
        renderMembers();
        if (window.innerWidth < 1100) $('#member-dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const openProfile = event.target.closest('[data-open-profile]');
      if (openProfile) {
        event.preventDefault();
        const id = Number(openProfile.dataset.openProfile);
        closeModal();
        state.members.level = null;
        state.members.filter = 'all';
        state.members.query = '';
        state.members.limit = 999;
        state.members.focus = id;
        if (state.view === 'ladder') renderMembers();
        else navigate('ladder');
        setTimeout(() => {
          if (window.innerWidth < 1100) $('#member-dossier')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return;
      }

      const newMember = event.target.closest('[data-new-member]');
      if (newMember) { event.preventDefault(); openCheckin(null, 'new'); return; }

      const newWork = event.target.closest('[data-new-work]');
      if (newWork) { event.preventDefault(); openWorkForm(); return; }

      const newEvent = event.target.closest('[data-new-event]');
      if (newEvent) { event.preventDefault(); openEventForm(); return; }

      const checkinOpen = event.target.closest('[data-checkin-open]');
      if (checkinOpen) { event.preventDefault(); openCheckin(); return; }

      const checkinEvent = event.target.closest('[data-checkin-event]');
      if (checkinEvent) { event.preventDefault(); openCheckin(Number(checkinEvent.dataset.checkinEvent), 'member'); return; }

      const checkinMember = event.target.closest('[data-checkin-member]');
      if (checkinMember) {
        event.preventDefault();
        const id = Number(checkinMember.dataset.checkinMember);
        const info = memberInfo(id);
        closeModal();
        const latest = latestEvent();
        if (latest) {
          openCheckin(latest.id, 'member');
          if (info) {
            state.checkin.query = info.name;
            renderCheckin();
          }
        } else {
          openCheckin(null, 'new');
          toast('先创建活动，才能记录本场打卡');
        }
        return;
      }

      const levelJump = event.target.closest('[data-level-jump]');
      if (levelJump) {
        event.preventDefault();
        const level = Number(levelJump.dataset.levelJump);
        state.members.level = state.members.level === level ? null : level;
        state.members.focus = null;
        state.members.limit = 9;
        if (state.view === 'ladder') renderMembers();
        else navigate('ladder');
        return;
      }

      if (event.target.closest('[data-level-clear]')) {
        event.preventDefault();
        state.members.level = null;
        state.members.focus = null;
        renderMembers();
        return;
      }

      const memberSort = event.target.closest('[data-member-sort]');
      if (memberSort) {
        event.preventDefault();
        state.members.sort = memberSort.dataset.memberSort;
        state.members.limit = 9;
        renderMembers();
        return;
      }

      const memberFilter = event.target.closest('[data-member-filter]');
      if (memberFilter) {
        event.preventDefault();
        state.members.filter = memberFilter.dataset.memberFilter;
        state.members.focus = null;
        state.members.limit = 9;
        renderMembers();
        return;
      }

      if (event.target.closest('[data-member-reset]')) {
        event.preventDefault();
        state.members.query = '';
        state.members.filter = 'all';
        state.members.level = null;
        state.members.focus = null;
        renderMembers();
        return;
      }

      const workType = event.target.closest('[data-work-type]');
      if (workType) {
        event.preventDefault();
        state.works.type = workType.dataset.workType;
        state.works.theme = 'ALL';
        renderWorks();
        return;
      }

      const workTheme = event.target.closest('[data-work-theme]');
      if (workTheme) {
        event.preventDefault();
        state.works.theme = workTheme.dataset.workTheme;
        renderWorks();
        return;
      }

      if (event.target.closest('[data-work-reset]')) {
        event.preventDefault();
        state.works = { type: 'ALL', theme: 'ALL', query: '' };
        renderWorks();
        return;
      }

      const stageMode = event.target.closest('[data-stage-mode]');
      if (stageMode) {
        event.preventDefault();
        state.screen.mode = stageMode.dataset.stageMode;
        state.screen.index = 0;
        renderStage();
        restartStageTimer();
        return;
      }

      if (event.target.closest('#stage-play')) {
        event.preventDefault();
        toggleStagePlayback();
        return;
      }

      if (event.target.closest('[data-stage-prev]')) { event.preventDefault(); stepStage(-1); return; }
      if (event.target.closest('[data-stage-next]')) { event.preventDefault(); stepStage(1); return; }

      const stageIndex = event.target.closest('[data-stage-index]');
      if (stageIndex) {
        event.preventDefault();
        state.screen.index = Number(stageIndex.dataset.stageIndex);
        renderStage();
        restartStageTimer();
        return;
      }

      if (event.target.closest('[data-stage-fullscreen]')) { event.preventDefault(); requestStageFullscreen(); return; }

      const screenWork = event.target.closest('[data-screen-work]');
      if (screenWork) {
        event.preventDefault();
        const id = Number(screenWork.dataset.screenWork);
        closeModal();
        if (state.view !== 'overview') navigate('overview');
        state.screen.mode = 'works';
        const sequence = stageScenes();
        const index = sequence.findIndex(item => item.type === 'work' && item.id === id);
        state.screen.index = index >= 0 ? index : 0;
        renderStage();
        restartStageTimer();
        $('#stage-frame')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    });

    document.addEventListener('keydown', event => {
      const key = event.key;
      const workCard = event.target.closest?.('[data-work][role="button"]');
      if (workCard && (key === 'Enter' || key === ' ')) {
        event.preventDefault();
        workCard.click();
        return;
      }
      const levelNode = event.target.closest?.('[data-level-jump]');
      if (levelNode && (key === 'ArrowLeft' || key === 'ArrowRight')) {
        event.preventDefault();
        const buttons = $$('[data-level-jump]', levelNode.closest('.level-rail'));
        const index = buttons.indexOf(levelNode);
        const nextIndex = (index + (key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
        return;
      }
      const stageFrame = event.target.closest?.('#stage-frame');
      if (stageFrame && (key === 'Enter' || key === ' ')) {
        event.preventDefault();
        toggleStagePlayback();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'k') {
        if (!state.entered) return;
        event.preventDefault();
        if (state.command.open) closeCommand();
        else openCommand();
        return;
      }

      if (state.command.open) {
        if (key === 'ArrowDown') {
          event.preventDefault();
          state.command.index = (state.command.index + 1) % Math.max(state.command.items.length, 1);
          renderCommand();
          $('.command-item.active')?.scrollIntoView({ block: 'nearest' });
        } else if (key === 'ArrowUp') {
          event.preventDefault();
          state.command.index = (state.command.index - 1 + Math.max(state.command.items.length, 1)) % Math.max(state.command.items.length, 1);
          renderCommand();
          $('.command-item.active')?.scrollIntoView({ block: 'nearest' });
        } else if (key === 'Enter') {
          event.preventDefault();
          runCommand(state.command.index);
        } else if (key === 'Escape') {
          event.preventDefault();
          closeCommand();
        }
        return;
      }

      if (key === 'Escape') {
        if ($('#modal')?.classList.contains('open')) { closeModal(); return; }
        if ($('#checkin')?.classList.contains('open')) { closeCheckin(); return; }
        return;
      }

      if ($('#modal')?.classList.contains('open') || $('#checkin')?.classList.contains('open')) return;
      if (isTyping(event.target)) return;
      if (state.view !== 'overview') return;
      if (!state.entered) return;

      if (key === 'ArrowRight') { event.preventDefault(); stepStage(1); }
      else if (key === 'ArrowLeft') { event.preventDefault(); stepStage(-1); }
      else if (key === ' ') {
        if (event.target.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        toggleStagePlayback();
      } else if (key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (event.target.closest('button, a, input, select, textarea')) return;
        event.preventDefault();
        requestStageFullscreen();
      }
    });

    $('#modal-close')?.addEventListener('click', closeModal);
    $('#modal')?.addEventListener('click', event => { if (event.target.id === 'modal') closeModal(); });
    $('#checkin-close')?.addEventListener('click', closeCheckin);
    $('#checkin')?.addEventListener('click', event => { if (event.target.id === 'checkin') closeCheckin(); });
    $('#checkin-open')?.addEventListener('click', () => openCheckin());
    $('#command-open')?.addEventListener('click', openCommand);
    $('#command-close')?.addEventListener('click', closeCommand);
    $('#command')?.addEventListener('click', event => { if (event.target.id === 'command') closeCommand(); });
    $('#command-input')?.addEventListener('input', event => {
      state.command.query = event.target.value;
      state.command.index = 0;
      renderCommand();
    });
    $('#reset-data')?.addEventListener('click', resetData);

    document.addEventListener('pointermove', event => {
      if (!state.entered) return;
      const app = $('#app');
      if (app) {
        app.style.setProperty('--mx', `${event.clientX}px`);
        app.style.setProperty('--my', `${event.clientY}px`);
      }
      const surface = event.target.closest?.('.scan-surface');
      if (surface) {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--scan-x', `${((event.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
        surface.style.setProperty('--scan-y', `${((event.clientY - rect.top) / rect.height * 100).toFixed(1)}%`);
      }
      const frame = event.target.closest?.('#stage-frame');
      if (frame) {
        const rect = frame.getBoundingClientRect();
        frame.style.setProperty('--stage-x', `${((event.clientX - rect.left) / rect.width * 100).toFixed(1)}%`);
        frame.style.setProperty('--stage-y', `${((event.clientY - rect.top) / rect.height * 100).toFixed(1)}%`);
      }
      const tilt = event.target.closest('[data-tilt]');
      if (!tilt) return;
      const rect = tilt.getBoundingClientRect();
      const rx = ((event.clientY - rect.top) / rect.height - .5) * -3.2;
      const ry = ((event.clientX - rect.left) / rect.width - .5) * 3.2;
      tilt.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
      tilt.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
    });

    document.addEventListener('pointerout', event => {
      const tilt = event.target.closest?.('[data-tilt]');
      if (!tilt) return;
      if (event.relatedTarget && tilt.contains(event.relatedTarget)) return;
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
    });

    document.addEventListener('dblclick', event => {
      if (!event.target.closest('#stage-frame')) return;
      clearTimeout(stageClickTimer);
      event.preventDefault();
      requestStageFullscreen();
    });

    window.addEventListener('hashchange', () => {
      if (!state.entered) return;
      const hash = location.hash.replace('#', '');
      if (VIEW_LABELS[hash] && hash !== state.view) navigate(hash);
    });

    document.addEventListener('fullscreenchange', () => {
      const btn = $('[data-stage-fullscreen]');
      if (btn) {
        const label = document.fullscreenElement ? '退出全屏' : '全屏';
        btn.innerHTML = `<svg class="icon"><use href="${document.fullscreenElement ? '#i-close' : '#i-expand'}"/></svg> ${label}`;
      }
    });
  }

  function startClock() {
    const el = $('#clock');
    if (!el) return;
    function tick() {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('zh-CN', { hour12: false });
      el.title = now.toLocaleDateString('zh-CN');
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------------- boot ---------------- */
  function boot() {
    bindCover();
    bindGlobal();
    startClock();

    const hash = location.hash.replace('#', '');
    state.view = VIEW_LABELS[hash] ? hash : 'overview';
    document.body.dataset.view = state.view;
    $$('.view').forEach(panel => panel.classList.toggle('active', panel.dataset.viewPanel === state.view));
    $$('.rail-item').forEach(item => item.classList.toggle('active', item.dataset.nav === state.view));
    const label = $('#page-label');
    if (label) label.textContent = VIEW_LABELS[state.view];

    render();
  }

  boot();
})();
