/* ============================================================
   数据层 · 社区初始档案 + 本地持久化
   从 turing-community-demo.html 接入 8 位成员与 6 件作品。
   数据只保存在浏览器 localStorage，不上传。
   ============================================================ */
window.TD = (function () {
  'use strict';

  const CURRENT_VERSION = 4;
  const STORAGE_KEY = 'turing-community-screen-v4';
  const LEGACY_STORAGE_KEYS = ['turing-community-screen-v3'];

  const LEVELS = [
    { n: 1, key: 'egg',    name: '奶蛋',       en: 'MILK EGG',    min: 0,  rule: '活跃指数 0–11 · 完成首次打卡', tone: '#f6e3a8', accent: '#b49a5c' },
    { n: 2, key: 'mouse',  name: '奶鼠',       en: 'MILK MOUSE',  min: 12, rule: '活跃指数 12+ · 开始稳定到场', tone: '#ffdc55', accent: '#c08c00' },
    { n: 3, key: 'dog',    name: '奶狗',       en: 'MILK DOG',    min: 24, rule: '活跃指数 24+ · 留下第一件作品', tone: '#ffd84a', accent: '#b87f00' },
    { n: 4, key: 'soy',    name: '豆奶',       en: 'SOY MILK',    min: 36, rule: '活跃指数 36+ · 到场与作品并行', tone: '#ffd24a', accent: '#b07a00' },
    { n: 5, key: 'fish',   name: '奶鱼',       en: 'MILK FISH',   min: 48, rule: '活跃指数 48+ · 近 6 场参与 4 场', tone: '#f7c93f', accent: '#9c6800' },
    { n: 6, key: 'frog',   name: '奶蛙',       en: 'MILK FROG',   min: 60, rule: '活跃指数 60+ · 持续共创', tone: '#f2c23a', accent: '#8f5e00' },
    { n: 7, key: 'sigma',  name: '西格玛奶蛙', en: 'SIGMA FROG',  min: 72, rule: '活跃指数 72+ · 核心共创者', tone: '#eeb32f', accent: '#7a4b00' }
  ];

  const MEMBER_COLORS = [
    ['#182b4d', '#6ea8ff'], ['#2c1a2e', '#ff8a65'], ['#20281a', '#ffd54f'],
    ['#102b33', '#5eead4'], ['#241c3d', '#a78bfa'], ['#142a22', '#6ee7a8'],
    ['#2d1b27', '#f472b6'], ['#232a33', '#c7d4e8']
  ];

  const MEMBER_SEED = [
    {
      id: 0,
      importKey: 'turing-demo-member-0',
      name: '陈墨',
      en: 'CHEN MO',
      role: 'AI 研究创作者',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e7f4ff', '#174eac'],
      photo: null,
      joined: -1,
      importedActivity: 96,
      sourceProfile: { level: 'LV.08 · 共创者', participation: 128, listedWorks: 8, trend: '↗ 12', accessory: 'orbit' }
    },
    {
      id: 1,
      importKey: 'turing-demo-member-1',
      name: '林夕',
      en: 'YUKI LIN',
      role: '医工交叉探索者',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e6f9ff', '#176b93'],
      photo: null,
      joined: -1,
      importedActivity: 92,
      sourceProfile: { level: 'LV.07 · 造梦者', participation: 116, listedWorks: 6, trend: '↗ 08', accessory: 'antenna' }
    },
    {
      id: 2,
      importKey: 'turing-demo-member-2',
      name: '周舟',
      en: 'ZHOU ZHOU',
      role: '数字孪生工程师',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#edf0ff', '#2f4d9d'],
      photo: null,
      joined: -1,
      importedActivity: 88,
      sourceProfile: { level: 'LV.07 · 造梦者', participation: 124, listedWorks: 5, trend: '↗ 05', accessory: 'ring' }
    },
    {
      id: 3,
      importKey: 'turing-demo-member-3',
      name: '阿策',
      en: 'ACE WU',
      role: '具身智能开发者',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e8f7ff', '#24567a'],
      photo: null,
      joined: -1,
      importedActivity: 84,
      sourceProfile: { level: 'LV.06 · 探索者', participation: 98, listedWorks: 7, trend: '↗ 03', accessory: 'bolt' }
    },
    {
      id: 4,
      importKey: 'turing-demo-member-4',
      name: '苏禾',
      en: 'SU HE',
      role: '数字视觉研究者',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e4f3ff', '#37668d'],
      photo: null,
      joined: -1,
      importedActivity: 79,
      sourceProfile: { level: 'LV.06 · 探索者', participation: 106, listedWorks: 9, trend: '↗ 06', accessory: 'antenna' }
    },
    {
      id: 5,
      importKey: 'turing-demo-member-5',
      name: '何一',
      en: 'HE YI',
      role: '全栈研究工程师',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e8ecff', '#3a4e86'],
      photo: null,
      joined: -1,
      importedActivity: 74,
      sourceProfile: { level: 'LV.05 · 行动派', participation: 88, listedWorks: 4, trend: '— 00', accessory: 'ring' }
    },
    {
      id: 6,
      importKey: 'turing-demo-member-6',
      name: '许星',
      en: 'XU XING',
      role: '空间计算探索者',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#ecf5ff', '#396775'],
      photo: null,
      joined: -1,
      importedActivity: 68,
      sourceProfile: { level: 'LV.05 · 行动派', participation: 76, listedWorks: 3, trend: '↗ 02', accessory: 'orbit' }
    },
    {
      id: 7,
      importKey: 'turing-demo-member-7',
      name: '陆离',
      en: 'LU LI',
      role: '人机交互设计师',
      org: '温州市图灵人工智能高等研究院',
      att: '',
      tagline: '在研究与真实需求的交汇处持续探索。',
      colors: ['#e6f0ff', '#2e557b'],
      photo: null,
      joined: -1,
      importedActivity: 63,
      sourceProfile: { level: 'LV.04 · 新同频', participation: 54, listedWorks: 4, trend: '↗ 04', accessory: 'bolt' }
    }
  ];

  const WORK_SEED = [
    {
      id: 0,
      importKey: 'turing-demo-work-0',
      title: 'MEDICAL VISION',
      cn: '医影智析',
      author: 0,
      co: [],
      theme: '医学影像',
      type: 'AI',
      year: 2026,
      likes: 0,
      motif: 0,
      desc: '面向医学影像智能分析与临床应用的概念项目。通过可解释的视觉模型与交互界面，辅助研究者观察复杂影像，让算法成为医生的另一种感知。',
      tags: ['AI', '3D', '医学研究'],
      programType: 'AI × MEDICAL RESEARCH'
    },
    {
      id: 1,
      importKey: 'turing-demo-work-1',
      title: 'INDUSTRY TRANSLATOR',
      cn: 'AI 行业翻译官',
      author: 1,
      co: [],
      theme: '产业服务',
      type: 'WEB',
      year: 2026,
      likes: 0,
      motif: 1,
      desc: '把企业的真实问题转译为可执行的 AI 任务，连接产业需求、技术团队与研究成果，让更多创新从对话走向落地。',
      tags: ['WEB', 'VISUAL', '产业服务'],
      programType: 'AI × INDUSTRY SERVICE'
    },
    {
      id: 2,
      importKey: 'turing-demo-work-2',
      title: 'CITY DIGITAL TWIN',
      cn: '城市数字孪生',
      author: 2,
      co: [],
      theme: '空间计算',
      type: '3D',
      year: 2026,
      likes: 0,
      motif: 2,
      desc: '以实时数据与三维空间为纽带，构建可观察、可推演的城市数字镜像，探索城市治理与公共服务的全新交互方式。',
      tags: ['3D', 'WEB', '数字孪生'],
      programType: 'SPATIAL COMPUTING'
    },
    {
      id: 3,
      importKey: 'turing-demo-work-3',
      title: 'OUYUE ARCHIVE',
      cn: '瓯越视觉档案',
      author: 3,
      co: [],
      theme: '文化设计',
      type: 'VISUAL',
      year: 2026,
      likes: 0,
      motif: 3,
      desc: '以数字设计重新整理瓯越文化线索，用网格、色彩与生成视觉建立一座可持续生长的城市文化档案。',
      tags: ['VISUAL', '瓯越文化', '数字档案'],
      programType: 'CULTURE × DIGITAL DESIGN'
    },
    {
      id: 4,
      importKey: 'turing-demo-work-4',
      title: 'CAMPUS NETWORK',
      cn: '高校共创网络',
      author: 4,
      co: [],
      theme: '高校共创',
      type: 'AI',
      year: 2026,
      likes: 0,
      motif: 5,
      desc: '把在温高校的研究方向、创作者与项目连接成可生长的协作网络，让跨学科合作拥有更清晰的入口。',
      tags: ['AI', '3D', '高校共创'],
      programType: 'UNIVERSITY COLLABORATION'
    },
    {
      id: 5,
      importKey: 'turing-demo-work-5',
      title: 'HUMANOID LAB',
      cn: '具身智能实验室',
      author: 5,
      co: [],
      theme: '人机交互',
      type: 'WEB',
      year: 2026,
      likes: 0,
      motif: 4,
      desc: '一个具身智能交互概念实验。通过动作、反馈与动态界面，探索人和智能体之间更自然、更直观的沟通方式。',
      tags: ['WEB', 'VISUAL', '具身智能'],
      programType: 'HUMAN × ROBOT INTERACTION'
    }
  ];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function emptyState() {
    return {
      version: CURRENT_VERSION,
      members: [],
      events: [],
      works: []
    };
  }

  function seed() {
    return clone({
      version: CURRENT_VERSION,
      members: MEMBER_SEED,
      events: [],
      works: WORK_SEED
    });
  }

  let data = null;

  function normalize(raw) {
    const next = emptyState();
    if (!raw || ![3, CURRENT_VERSION].includes(Number(raw.version))) return next;
    next.members = Array.isArray(raw.members) ? raw.members : [];
    next.events = Array.isArray(raw.events) ? raw.events : [];
    next.works = Array.isArray(raw.works) ? raw.works : [];
    next.works.forEach(work => {
      work.co = Array.isArray(work.co) ? work.co.map(Number).filter(Number.isFinite) : [];
      work.tags = Array.isArray(work.tags) ? work.tags : [];
    });
    const width = next.events.length;
    next.members.forEach(member => {
      const bits = String(member.att || '').padEnd(width, '0').slice(0, width);
      member.att = bits || '0'.repeat(width);
    });
    return next;
  }

  function mergeSeed(raw) {
    const next = normalize({ ...raw, version: CURRENT_VERSION });
    const memberIdMap = new Map();

    MEMBER_SEED.forEach(seedMember => {
      let existing = next.members.find(member => member.importKey === seedMember.importKey);
      if (!existing) {
        const nextMemberId = next.members.reduce((max, member) => Math.max(max, Number(member.id) || 0), -1) + 1;
        existing = { ...clone(seedMember), id: nextMemberId };
        next.members.push(existing);
      }
      memberIdMap.set(seedMember.id, existing.id);
    });

    WORK_SEED.forEach(seedWork => {
      if (next.works.some(work => work.importKey === seedWork.importKey)) return;
      const nextWorkId = next.works.reduce((max, work) => Math.max(max, Number(work.id) || 0), -1) + 1;
      next.works.push({
        ...clone(seedWork),
        id: nextWorkId,
        author: memberIdMap.get(seedWork.author) ?? null,
        co: seedWork.co.map(id => memberIdMap.get(id)).filter(Number.isFinite)
      });
    });

    return next;
  }

  function load() {
    if (data) return data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Number(parsed.version) === CURRENT_VERSION) {
          data = normalize(parsed);
          return data;
        }
      }
      for (const key of LEGACY_STORAGE_KEYS) {
        const legacyRaw = localStorage.getItem(key);
        if (!legacyRaw) continue;
        const legacy = JSON.parse(legacyRaw);
        if (legacy && Number(legacy.version) === 3) {
          data = mergeSeed(legacy);
          save();
          return data;
        }
      }
    } catch (error) { /* ignore corrupt storage */ }
    data = seed();
    save();
    return data;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  function reset() {
    data = seed();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    } catch (error) { /* ignore */ }
    return data;
  }

  /* ---------- writes ---------- */
  function addMember(input) {
    const state = load();
    const nextId = state.members.reduce((max, member) => Math.max(max, Number(member.id) || 0), -1) + 1;
    const name = String(input.name || '').trim();
    if (!name) return null;
    const member = {
      id: nextId,
      name,
      en: String(input.en || name).trim().toUpperCase().slice(0, 18),
      role: String(input.role || '').trim() || '社区成员',
      org: String(input.org || '').trim() || '温州市图灵人工智能高等研究院',
      att: String(input.att || '').padEnd(state.events.length, '0').slice(0, state.events.length) || '0'.repeat(state.events.length),
      tagline: String(input.tagline || '').trim() || '第一次到场，故事从这里开始。',
      colors: input.colors || MEMBER_COLORS[nextId % MEMBER_COLORS.length],
      photo: input.photo || null,
      joined: firstEvent({ att: input.att || '' })
    };
    state.members.push(member);
    save();
    return memberInfo(member);
  }

  function addEvent(input) {
    const state = load();
    const nextId = state.events.reduce((max, event) => Math.max(max, Number(event.id) || 0), -1) + 1;
    const title = String(input.title || '').trim();
    if (!title) return null;
    const date = String(input.date || '').trim() || new Date().toISOString().slice(0, 10);
    const event = {
      id: nextId,
      date,
      title,
      short: String(input.short || title).trim().slice(0, 14),
      theme: String(input.theme || '').trim() || '社区活动',
      expected: Math.max(0, Number(input.expected) || 0),
      satisfaction: Math.max(0, Number(input.satisfaction) || 0),
      venue: String(input.venue || '').trim() || '图灵研究院',
      note: String(input.note || '').trim()
    };
    state.events.push(event);
    state.members.forEach(member => { member.att = `${member.att || ''}0`.slice(0, state.events.length); });
    save();
    return eventInfo(event);
  }

  function addWork(input) {
    const state = load();
    const nextId = state.works.reduce((max, work) => Math.max(max, Number(work.id) || 0), -1) + 1;
    const cn = String(input.cn || input.title || '').trim();
    if (!cn) return null;
    const authorValue = Number(input.author);
    const author = Number.isFinite(authorValue) && state.members.some(member => member.id === authorValue)
      ? authorValue
      : null;
    const co = [...new Set((Array.isArray(input.co) ? input.co : [])
      .map(Number)
      .filter(id => Number.isFinite(id) && id !== author && state.members.some(member => member.id === id)))];
    const work = {
      id: nextId,
      title: String(input.title || cn).trim().toUpperCase().slice(0, 54),
      cn: cn.slice(0, 30),
      author,
      co,
      theme: String(input.theme || '').trim().slice(0, 16) || '未分类',
      type: ['个人', '综合', '同主题'].includes(String(input.type || '')) ? String(input.type) : '个人',
      year: Math.max(2000, Number(input.year) || new Date().getFullYear()),
      likes: Math.max(0, Number(input.likes) || 0),
      motif: Math.abs(Number(input.motif) || 0) % 12,
      desc: String(input.desc || '').trim().slice(0, 180),
      tags: (Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(/[,，]/))
        .map(tag => String(tag).trim())
        .filter(Boolean)
        .slice(0, 6)
    };
    state.works.push(work);
    save();
    return work;
  }

  /* ---------- derived ---------- */
  function visits(member) {
    return String(member.att || '').split('').filter(ch => ch === '1').length;
  }

  function attendedEvents(member) {
    return String(member.att || '').split('').map((ch, index) => ch === '1' ? index : -1).filter(index => index >= 0);
  }

  function firstEvent(member) {
    return String(member.att || '').indexOf('1');
  }

  function streak(member) {
    let count = 0;
    const att = String(member.att || '');
    for (let i = att.length - 1; i >= 0; i -= 1) {
      if (att[i] === '1') count += 1;
      else break;
    }
    return count;
  }

  function authoredWorks(memberId) {
    return data.works.filter(work => work.author === memberId);
  }

  function coauthoredWorks(memberId) {
    return data.works.filter(work => work.co.includes(memberId));
  }

  function workCount(memberId) {
    return authoredWorks(memberId).length + coauthoredWorks(memberId).length * 0.5;
  }

  const EVENT_WEIGHT = [0.5, 0.6, 0.7, 0.8, 0.95, 1.1, 1.25, 1.4];
  const EVENT_WEIGHT_BASE = EVENT_WEIGHT.reduce((sum, value) => sum + value, 0);

  function score(member) {
    const state = load();
    const bits = String(member.att || '').split('');
    const chronological = state.events
      .map((event, index) => ({ index, date: String(event.date || '') }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const weightOf = new Map();
    chronological.forEach((event, rank) => {
      weightOf.set(event.index, EVENT_WEIGHT[rank] ?? EVENT_WEIGHT[EVENT_WEIGHT.length - 1]);
    });
    const weighted = bits.reduce((sum, bit, index) => sum + (bit === '1' ? weightOf.get(index) || 0 : 0), 0);
    const attendScore = Math.min(58, weighted / EVENT_WEIGHT_BASE * 58);
    const workScore = Math.min(workCount(member.id), 6) / 6 * 26;
    const streakScore = Math.min(streak(member), 8) / 8 * 16;
    const calculated = Math.round(attendScore + workScore + streakScore);
    const importedBaseline = Math.min(100, Math.max(0, Number(member.importedActivity) || 0));
    return Math.max(calculated, importedBaseline);
  }

  function levelOf(memberScore) {
    let current = LEVELS[0];
    LEVELS.forEach(level => { if (memberScore >= level.min) current = level; });
    return current;
  }

  function memberInfo(member) {
    const s = score(member);
    const level = levelOf(s);
    const att = String(member.att || '');
    const recent = att.slice(-3).split('').filter(ch => ch === '1').length;
    const previous = att.slice(0, 3).split('').filter(ch => ch === '1').length;
    return {
      ...member,
      visits: visits(member),
      events: attendedEvents(member),
      first: firstEvent(member),
      streak: streak(member),
      works: authoredWorks(member.id).length,
      coWorks: coauthoredWorks(member.id).length,
      score: s,
      level,
      trend: recent - previous
    };
  }

  function allMembers() {
    return load().members.map(memberInfo).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function memberById(id) {
    return load().members.find(member => Number(member.id) === Number(id)) || null;
  }

  function eventInfo(event) {
    const attendees = load().members.filter(member => member.att[event.id] === '1');
    const fresh = attendees.filter(member => firstEvent(member) === event.id);
    const returning = attendees.length - fresh.length;
    const rate = event.expected > 0 ? attendees.length / event.expected : 0;
    const satisfaction = Number(event.satisfaction) || 0;
    const heat = Math.round(Math.min(100, rate * 70 + satisfaction / 5 * 30));
    return {
      ...event,
      attendees,
      total: attendees.length,
      fresh: fresh.length,
      returning,
      rate,
      heat,
      freshMembers: fresh,
      returningMembers: attendees.filter(member => firstEvent(member) !== event.id)
    };
  }

  function allEvents() {
    return load().events.map(eventInfo).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function themeStats() {
    const events = allEvents();
    const map = new Map();
    events.forEach(event => {
      if (!map.has(event.theme)) {
        map.set(event.theme, { theme: event.theme, events: [], total: 0, expected: 0, satisfaction: 0, heat: 0 });
      }
      const bucket = map.get(event.theme);
      bucket.events.push(event);
      bucket.total += event.total;
      bucket.expected += event.expected;
      bucket.satisfaction += event.satisfaction;
      bucket.heat += event.heat;
    });
    return [...map.values()].map(bucket => {
      const count = bucket.events.length;
      return {
        theme: bucket.theme,
        count,
        avg: count ? bucket.total / count : 0,
        rate: bucket.expected ? bucket.total / bucket.expected : 0,
        satisfaction: count ? bucket.satisfaction / count : 0,
        heat: count ? bucket.heat / count : 0,
        works: load().works.filter(work => work.theme === bucket.theme).length,
        total: bucket.total
      };
    }).sort((a, b) => b.heat - a.heat);
  }

  function retention() {
    const members = load().members.map(memberInfo);
    const buckets = [
      { key: 'once', label: '只来过 1 次', hint: '需要唤醒', people: [], color: '#f4511e' },
      { key: 'few', label: '来过 2–3 次', hint: '可以加深', people: [], color: '#ffc400' },
      { key: 'regular', label: '来过 4–6 次', hint: '稳定参与', people: [], color: '#1c46e8' },
      { key: 'core', label: '来过 7–8 次', hint: '常驻核心', people: [], color: '#0e1a2c' }
    ];
    members.forEach(member => {
      const bucket = member.visits <= 1 ? buckets[0] : member.visits <= 3 ? buckets[1] : member.visits <= 6 ? buckets[2] : buckets[3];
      bucket.people.push(member);
    });
    buckets.forEach(bucket => bucket.people.sort((a, b) => b.score - a.score));
    const returning = members.filter(member => member.visits >= 2).length;
    return {
      buckets,
      total: members.length,
      returning,
      returnRate: members.length ? returning / members.length : 0
    };
  }

  function totals() {
    const events = allEvents();
    const checkins = events.reduce((sum, event) => sum + event.total, 0);
    return {
      members: load().members.length,
      works: load().works.length,
      events: events.length,
      checkins,
      avg: events.length ? checkins / events.length : 0,
      satisfaction: events.length ? events.reduce((sum, event) => sum + event.satisfaction, 0) / events.length : 0
    };
  }

  function themesOfWorks() {
    const present = new Set(load().works.map(work => work.theme));
    return [...present];
  }

  return {
    LEVELS,
    MEMBER_COLORS,
    get data() { return load(); },
    get members() { return load().members; },
    get events() { return load().events; },
    get works() { return load().works; },
    load, save, reset, seed,
    addMember, addEvent, addWork, memberById,
    visits, attendedEvents, firstEvent, streak,
    authoredWorks, coauthoredWorks, workCount,
    score, levelOf, memberInfo, allMembers,
    eventInfo, allEvents, themeStats, retention, totals,
    themesOfWorks
  };
}());
