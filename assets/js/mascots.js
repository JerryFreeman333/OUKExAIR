/* ============================================================
   视觉生成层 · 奶系角色（实物抠图）/ 成员头像 / 作品封面
   角色为本地透明 PNG，头像与作品视觉为内联 SVG。
   ============================================================ */
window.TV = (function () {
  'use strict';

  let artSeq = 0;

  const ART_PALETTES = [
    { bg: '#dfe6ff', a: '#1c46e8', b: '#0e1a2c', c: '#ffc400' },
    { bg: '#ffe3d8', a: '#f4511e', b: '#0e1a2c', c: '#1c46e8' },
    { bg: '#fff0bf', a: '#ffb400', b: '#0e1a2c', c: '#f4511e' },
    { bg: '#d9f0ff', a: '#35a8d8', b: '#0e1a2c', c: '#ffc400' },
    { bg: '#e6e2ff', a: '#6c4cf1', b: '#0e1a2c', c: '#f4511e' },
    { bg: '#dff3e6', a: '#19a974', b: '#0e1a2c', c: '#ffc400' }
  ];

  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  /* ---------------- 奶系角色 ---------------- */
  function mascot(level, options = {}) {
    const lv = Math.min(7, Math.max(1, typeof level === 'number' ? level : (level && level.n) || 1));
    const meta = TD.LEVELS[lv - 1] || TD.LEVELS[0];
    const cls = options.className || '';
    return `<span class="mascot ${cls}" aria-hidden="true"><img src="assets/img/mascots/${meta.key}.png" alt="" loading="lazy" decoding="async" draggable="false"></span>`;
  }

  /* ---------------- 成员头像 ---------------- */
  function avatar(member, options = {}) {
    const size = options.size || 'md';
    const level = member.level || TD.levelOf(TD.score(member));
    const ring = level.tone || '#ffc400';
    const [bg, ink] = member.colors || ['#dfe6ff', '#1c46e8'];
    const initial = (member.name || '?').slice(0, 1);
    const en = (member.en || '').split(' ')[0] || '';
    if (member.photo) {
      return `<span class="avatar avatar-${size}" style="--ring:${ring}" aria-label="${esc(member.name)}">
        <img src="${member.photo}" alt="${esc(member.name)}" loading="lazy">
        <i class="avatar-level">${level.n}</i>
      </span>`;
    }
    return `<span class="avatar avatar-${size}" style="--ring:${ring};--av-bg:${bg};--av-ink:${ink}" aria-label="${esc(member.name)}">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <rect width="100" height="100" fill="${bg}"/>
        <circle cx="82" cy="20" r="30" fill="${ink}" opacity=".08"/>
        <circle cx="14" cy="88" r="26" fill="${ink}" opacity=".07"/>
        <path d="M0 74c22 6 30 20 34 26H0Z" fill="${ink}" opacity=".12"/>
        <text x="50" y="58" text-anchor="middle" font-family="Archivo, Noto Sans SC, sans-serif" font-size="40" font-weight="900" fill="${ink}">${esc(initial)}</text>
        <text x="50" y="76" text-anchor="middle" font-family="monospace" font-size="8" letter-spacing="1.6" fill="${ink}" opacity=".7">${esc(en.slice(0, 4))}</text>
      </svg>
      <i class="avatar-level">${level.n}</i>
    </span>`;
  }

  /* ---------------- 作品封面 ---------------- */
  function gridOverlay(uid, color) {
    return `<g stroke="${color}" stroke-opacity=".10" stroke-width="1">
      <path d="M0 110h640M0 220h640M0 330h640M160 0v440M320 0v440M480 0v440"/>
    </g>`;
  }

  function artHTML(work) {
    const palette = ART_PALETTES[work.motif % ART_PALETTES.length];
    const uid = `art${work.id}-${artSeq += 1}`;
    const { bg, a, b, c } = palette;
    const motif = work.motif % 12;
    let shape = '';

    if (motif === 0) {
      shape = `<g>
        <ellipse cx="320" cy="220" rx="190" ry="78" fill="none" stroke="${b}" stroke-width="1.4" opacity=".55" transform="rotate(-18 320 220)"/>
        <ellipse cx="320" cy="220" rx="150" ry="150" fill="none" stroke="${b}" stroke-width="1.2" opacity=".35"/>
        <ellipse cx="320" cy="220" rx="112" ry="46" fill="none" stroke="${b}" stroke-width="1.4" opacity=".6" transform="rotate(26 320 220)"/>
        <circle cx="320" cy="220" r="70" fill="${a}"/>
        <circle cx="320" cy="220" r="70" fill="none" stroke="${b}" stroke-width="2"/>
        <circle cx="345" cy="196" r="24" fill="${c}"/>
        <circle cx="150" cy="196" r="9" fill="${b}"/>
        <circle cx="488" cy="270" r="6" fill="${b}"/>
        <path d="M120 330h60M450 120h46" stroke="${b}" stroke-width="2"/>
      </g>`;
    } else if (motif === 1) {
      const lines = Array.from({ length: 18 }, (_, i) =>
        `<path d="M-20 ${70 + i * 18} C120 ${-40 + i * 22}, 220 ${260 - i * 6}, 340 ${130 + i * 12} S520 ${30 + i * 20}, 680 ${110 + i * 10}" fill="none" stroke="${i % 5 === 0 ? c : a}" stroke-width="${i % 5 === 0 ? 2.6 : 1.3}" opacity="${i % 5 === 0 ? .95 : .55}"/>`).join('');
      shape = `<g>${lines}</g><rect x="0" y="360" width="640" height="80" fill="${b}" opacity=".92"/>`;
    } else if (motif === 2) {
      shape = `<g>
        <g fill="${a}" opacity=".92">
          <path d="M320 96l90 52-90 52-90-52Z"/><path d="M320 200l90 52-90 52-90-52Z"/>
        </g>
        <g fill="${b}" opacity=".82">
          <path d="M230 148l90 52v104l-90-52Z"/><path d="M410 148l-90 52v104l90-52Z"/>
        </g>
        <g fill="${c}" opacity=".9">
          <path d="M140 148l90 52-90 52-90-52Z"/><path d="M500 148l90 52-90 52-90-52Z"/>
        </g>
        <path d="M0 392h640" stroke="${b}" stroke-width="2"/>
      </g>`;
    } else if (motif === 3) {
      shape = `<g>
        <rect x="54" y="54" width="532" height="332" fill="none" stroke="${b}" stroke-width="1.6" opacity=".7"/>
        <text x="70" y="150" font-family="Archivo, sans-serif" font-size="96" font-weight="900" fill="${b}" letter-spacing="-4">OUYUE</text>
        <text x="70" y="248" font-family="Archivo, sans-serif" font-size="96" font-weight="900" fill="none" stroke="${b}" stroke-width="1.6" letter-spacing="-4">ARCHIVE</text>
        <circle cx="486" cy="320" r="56" fill="${c}"/>
        <path d="M70 300h300M70 314h180" stroke="${b}" stroke-width="2"/>
        <text x="70" y="352" font-family="monospace" font-size="12" fill="${b}" letter-spacing="3">WENZHOU / 27.9949 N</text>
      </g>`;
    } else if (motif === 4) {
      shape = `<g>
        <path d="M226 96h188c16 0 28 12 28 28v150c0 16-12 28-28 28H226c-16 0-28-12-28-28V124c0-16 12-28 28-28Z" fill="${b}"/>
        <rect x="238" y="132" width="164" height="96" rx="30" fill="${bg}" stroke="${a}" stroke-width="6"/>
        <circle cx="282" cy="180" r="13" fill="${a}"/><circle cx="358" cy="180" r="13" fill="${a}"/>
        <circle cx="285" cy="176" r="4" fill="#fff"/><circle cx="361" cy="176" r="4" fill="#fff"/>
        <path d="M300 210c12 8 28 8 40 0" stroke="${a}" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M320 96V64M320 64h-22M320 64h22" stroke="${b}" stroke-width="6" stroke-linecap="round"/>
        <circle cx="320" cy="52" r="10" fill="${c}"/>
        <path d="M198 300h244" stroke="${c}" stroke-width="6"/>
      </g>`;
    } else if (motif === 5) {
      const nodes = [[110, 120], [250, 70], [320, 190], [190, 240], [430, 110], [510, 230], [380, 330], [230, 350], [520, 360]];
      const edges = [[0, 1], [0, 3], [1, 2], [2, 3], [2, 4], [4, 5], [2, 5], [3, 6], [6, 7], [5, 6], [5, 8], [6, 8]];
      shape = `<g>
        ${edges.map(([i, j]) => `<line x1="${nodes[i][0]}" y1="${nodes[i][1]}" x2="${nodes[j][0]}" y2="${nodes[j][1]}" stroke="${b}" stroke-width="1.3" opacity=".45"/>`).join('')}
        ${nodes.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 16 : 9}" fill="${i % 3 === 0 ? c : a}" stroke="${b}" stroke-width="1.5"/>`).join('')}
        <text x="540" y="330" font-family="monospace" font-size="11" fill="${b}" opacity=".7">N=11</text>
      </g>`;
    } else if (motif === 6) {
      shape = `<g>
        <rect x="70" y="70" width="150" height="70" rx="12" fill="${b}"/>
        <rect x="70" y="70" width="150" height="70" rx="12" fill="none" stroke="${b}" stroke-width="2"/>
        <text x="88" y="112" font-family="monospace" font-size="14" fill="${bg}">INPUT</text>
        <rect x="360" y="70" width="200" height="70" rx="12" fill="${a}"/>
        <text x="380" y="112" font-family="monospace" font-size="14" fill="#fff">AGENT.01</text>
        <rect x="150" y="260" width="150" height="70" rx="12" fill="${bg}" stroke="${b}" stroke-width="2"/>
        <text x="168" y="302" font-family="monospace" font-size="14" fill="${b}">TOOL</text>
        <rect x="400" y="260" width="150" height="70" rx="12" fill="${c}"/>
        <text x="418" y="302" font-family="monospace" font-size="14" fill="${b}">OUTPUT</text>
        <path d="M220 105h140M460 140v120M300 295h100M225 260v-70" fill="none" stroke="${b}" stroke-width="1.6" stroke-dasharray="5 5"/>
        <circle cx="360" cy="105" r="5" fill="${b}"/><circle cx="460" cy="260" r="5" fill="${b}"/>
      </g>`;
    } else if (motif === 7) {
      const bars = Array.from({ length: 44 }, (_, i) => {
        const angle = (Math.PI * 2 / 44) * i;
        const r1 = 96;
        const r2 = 138 + Math.sin(i * 0.9) * 40;
        const x1 = 320 + Math.cos(angle) * r1;
        const y1 = 220 + Math.sin(angle) * r1;
        const x2 = 320 + Math.cos(angle) * r2;
        const y2 = 220 + Math.sin(angle) * r2;
        return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i % 4 === 0 ? c : a}" stroke-width="4" stroke-linecap="round" opacity="${i % 4 === 0 ? 1 : .7}"/>`;
      }).join('');
      shape = `<g><circle cx="320" cy="220" r="62" fill="${b}"/><path d="M320 200v40M310 220h20" stroke="${bg}" stroke-width="3"/>${bars}</g>`;
    } else if (motif === 8) {
      shape = `<g>
        <defs><pattern id="${uid}-dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2.6" fill="${b}"/></pattern></defs>
        <circle cx="320" cy="220" r="160" fill="url(#${uid}-dots)" opacity=".9"/>
        <circle cx="320" cy="220" r="108" fill="${c}"/>
        <circle cx="320" cy="220" r="108" fill="none" stroke="${b}" stroke-width="2"/>
        <circle cx="286" cy="196" r="13" fill="${b}"/><circle cx="358" cy="196" r="13" fill="${b}"/>
        <circle cx="290" cy="191" r="4" fill="#fff"/><circle cx="362" cy="191" r="4" fill="#fff"/>
        <path d="M292 246c16 12 40 12 56 0" stroke="${b}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M268 160l-18-22M372 160l18-22" stroke="${b}" stroke-width="5" stroke-linecap="round"/>
      </g>`;
    } else if (motif === 9) {
      const values = [42, 78, 58, 96, 72, 120, 104, 138, 92, 116];
      const max = 150;
      const bars = values.map((value, i) => {
        const h = value / max * 260;
        return `<rect x="${64 + i * 54}" y="${360 - h}" width="34" height="${h}" fill="${i === values.length - 1 ? c : i % 2 ? b : a}" opacity="${i % 2 ? .82 : .95}"/>`;
      }).join('');
      shape = `<g>${bars}<path d="M50 360h540" stroke="${b}" stroke-width="2"/>
        <polyline points="${values.map((v, i) => `${81 + i * 54},${360 - v / max * 260 - 18}`).join(' ')}" fill="none" stroke="${b}" stroke-width="2" stroke-dasharray="4 4"/>
        <text x="64" y="60" font-family="monospace" font-size="12" fill="${b}" letter-spacing="2">LIVE / 2026</text>
      </g>`;
    } else if (motif === 10) {
      shape = `<g>
        <path d="M80 360V230c0-50 40-90 90-90s90 40 90 90v130" fill="none" stroke="${b}" stroke-width="22"/>
        <path d="M300 360V230c0-50 40-90 90-90s90 40 90 90v130" fill="none" stroke="${a}" stroke-width="22"/>
        <circle cx="170" cy="230" r="34" fill="${c}"/>
        <path d="M40 360h560" stroke="${b}" stroke-width="2"/>
        <path d="M60 390h160M60 400h100" stroke="${b}" stroke-width="3"/>
      </g>`;
    } else {
      shape = `<g>
        <circle cx="250" cy="200" r="130" fill="${a}" opacity=".9"/>
        <circle cx="390" cy="250" r="120" fill="${c}" opacity=".82" style="mix-blend-mode:multiply"/>
        <circle cx="250" cy="200" r="130" fill="none" stroke="${b}" stroke-width="1.5"/>
        <circle cx="390" cy="250" r="120" fill="none" stroke="${b}" stroke-width="1.5"/>
        <path d="M110 360h420" stroke="${b}" stroke-width="2"/>
        <text x="110" y="392" font-family="monospace" font-size="12" fill="${b}" letter-spacing="3">OPEN DAY / ARCHIVE</text>
      </g>`;
    }

    return `<div class="artwork" data-motif="${motif}">
      <svg viewBox="0 0 640 440" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(work.cn)} 作品封面">
        <rect width="640" height="440" fill="${bg}"/>
        ${gridOverlay(uid, b)}
        ${shape}
      </svg>
      <span class="art-no mono">TURING / ${String(work.id + 1).padStart(3, '0')}</span>
      <span class="art-tag mono">${esc(work.theme)}</span>
      <span class="art-caption mono">${esc(work.type)} · ${work.year}</span>
      <i class="art-cross cross-a">+</i><i class="art-cross cross-b">+</i>
    </div>`;
  }

  return { mascot, avatar, artHTML, esc, LEVELS: TD.LEVELS };
}());
