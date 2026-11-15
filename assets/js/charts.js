/* ============================================================
   图表层 · 纯 SVG，无第三方依赖 · 首发海报视觉
   ============================================================ */
window.TC = (function () {
  'use strict';

  const INK = '#0e1a2c';
  const BLUE = '#1c46e8';
  const ORANGE = '#f4511e';
  const YELLOW = '#ffc400';
  const TECH = '#1c46e8';
  const MUTED = '#697386';
  const GRID = 'rgba(14, 26, 44, .16)';

  function esc(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function shortDate(date) {
    return String(date || '').slice(5).replace('-', '.');
  }

  function attendanceChart(events) {
    const W = 820;
    const H = 320;
    const pad = { top: 34, right: 18, bottom: 58, left: 46 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    if (!events || !events.length) {
      return `<svg class="chart chart-attendance" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="暂无活动数据">
        <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
        <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${W - pad.right}" y2="${pad.top + plotH}" stroke="${GRID}"/>
        <text x="${W / 2}" y="${H / 2 - 4}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="12" letter-spacing="3" fill="${MUTED}">NO ACTIVITY DATA</text>
        <text x="${W / 2}" y="${H / 2 + 20}" text-anchor="middle" font-family="Noto Sans SC, sans-serif" font-size="12" fill="${MUTED}">创建活动后生成到场曲线</text>
      </svg>`;
    }

    const max = Math.max(...events.map(event => event.total), 10);
    const yMax = Math.ceil(max / 10) * 10;
    const group = plotW / events.length;
    const barW = Math.min(34, group * 0.46);

    const y = value => pad.top + plotH - (value / yMax) * plotH;
    const x = index => pad.left + group * index + group / 2;

    const grid = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
      const gy = pad.top + plotH - plotH * ratio;
      const value = Math.round(yMax * ratio);
      return `<g>
        <line x1="${pad.left}" y1="${gy}" x2="${W - pad.right}" y2="${gy}" stroke="${INK}" stroke-opacity="${ratio === 0 ? .28 : .09}" stroke-width="1" ${ratio === 0 ? '' : 'stroke-dasharray="3 5"'}/>
        <text x="${pad.left - 10}" y="${gy + 4}" text-anchor="end" font-family="IBM Plex Mono, monospace" font-size="10" fill="${MUTED}">${value}</text>
      </g>`;
    }).join('');

    const bars = events.map((event, index) => {
      const cx = x(index);
      const newH = (event.fresh / yMax) * plotH;
      const retH = (event.returning / yMax) * plotH;
      const newY = pad.top + plotH - newH;
      const retY = newY - retH;
      return `<g>
        <rect x="${cx - barW / 2}" y="${newY}" width="${barW}" height="${Math.max(1, newH)}" fill="${ORANGE}" opacity=".92"/>
        <rect x="${cx - barW / 2}" y="${retY}" width="${barW}" height="${Math.max(1, retH)}" fill="${BLUE}" opacity=".92"/>
        <rect x="${cx - barW / 2}" y="${retY}" width="${barW}" height="${Math.max(1, newH + retH)}" fill="none" stroke="${INK}" stroke-opacity=".2"/>
        <text x="${cx}" y="${retY - 9}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" font-weight="600" fill="${INK}">${event.total}</text>
        <title>${esc(shortDate(event.date))} ${esc(event.short || event.title)} · 实到 ${event.total} 人（新面孔 ${event.fresh} / 回访 ${event.returning}）</title>
      </g>`;
    }).join('');

    const points = events.map((event, index) => [x(index), y(event.total)]);
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
    const area = `${line} L${x(events.length - 1).toFixed(1)} ${pad.top + plotH} L${x(0).toFixed(1)} ${pad.top + plotH} Z`;
    const dots = points.map((point, index) => {
      const isLast = index === events.length - 1;
      return `<g>
        <circle cx="${point[0]}" cy="${point[1]}" r="${isLast ? 6.5 : 4.2}" fill="${isLast ? TECH : '#f3f0e7'}" stroke="${isLast ? TECH : INK}" stroke-width="${isLast ? 2 : 1.5}"/>
        ${isLast ? `<circle cx="${point[0]}" cy="${point[1]}" r="12" fill="none" stroke="${TECH}" stroke-width="1.2" opacity=".55"/>` : ''}
      </g>`;
    }).join('');

    const labels = events.map((event, index) => `<g>
      <text x="${x(index)}" y="${H - 30}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="${INK}">${shortDate(event.date)}</text>
      <text x="${x(index)}" y="${H - 14}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8.5" fill="${MUTED}">${esc(String(event.theme || '').slice(0, 4))}</text>
    </g>`).join('');

    return `<svg class="chart chart-attendance" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="每场活动到场人数、新面孔与回访趋势">
      <defs>
        <linearGradient id="attArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${TECH}" stop-opacity=".18"/>
          <stop offset="1" stop-color="${TECH}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#attArea)"/>
      ${bars}
      <path d="${line}" fill="none" stroke="${TECH}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${labels}
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="${INK}" stroke-opacity=".28"/>
    </svg>`;
  }

  function themeBars(themes) {
    if (!themes || !themes.length) {
      return '<div class="theme-bars"><div class="chart-empty">暂无主题数据。创建活动并打卡后自动生成。</div></div>';
    }
    const max = Math.max(...themes.map(theme => theme.heat), 1);
    return `<div class="theme-bars">${themes.map((theme, index) => `
      <div class="theme-row">
        <span class="theme-rank mono">${String(index + 1).padStart(2, '0')}</span>
        <div class="theme-main">
          <div class="theme-head"><strong>${esc(theme.theme)}</strong><span class="mono">${theme.count} 场 · 场均 ${theme.avg.toFixed(1)} 人</span></div>
          <div class="theme-track"><i style="width:${(theme.heat / max * 100).toFixed(1)}%;background:${index === 0 ? ORANGE : index === 1 ? BLUE : TECH}"></i></div>
        </div>
        <div class="theme-score"><strong>${theme.heat.toFixed(0)}</strong><span class="mono">热度</span></div>
      </div>`).join('')}</div>`;
  }

  function donut(retention) {
    const size = 210;
    const r = 78;
    const stroke = 26;
    const C = 2 * Math.PI * r;
    const total = retention.total || 0;
    let offset = 0;
    const segments = total ? retention.buckets.map(bucket => {
      const fraction = bucket.people.length / total;
      const length = C * fraction;
      const segment = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${bucket.color}" stroke-width="${stroke}" stroke-dasharray="${Math.max(length - 3, 0)} ${C - Math.max(length - 3, 0)}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(bucket.label)}：${bucket.people.length} 人</title></circle>`;
      offset += length;
      return segment;
    }).join('') : '';

    return `<svg class="chart chart-donut" viewBox="0 0 ${size} ${size}" role="img" aria-label="成员参与次数分布">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${INK}" stroke-opacity=".08" stroke-width="${stroke}"/>
      ${segments}
      <text x="${size / 2}" y="${size / 2 - 4}" text-anchor="middle" font-family="Archivo, sans-serif" font-size="39" font-weight="900" fill="${INK}">${Math.round((retention.returnRate || 0) * 100)}<tspan font-size="16">%</tspan></text>
      <text x="${size / 2}" y="${size / 2 + 18}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8.5" letter-spacing="1.4" fill="${MUTED}">RETURN RATE</text>
      <text x="${size / 2}" y="${size / 2 + 34}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8" fill="${MUTED}">${retention.returning}/${retention.total} 人回访</text>
    </svg>`;
  }

  function sparkline(values, options = {}) {
    const W = options.width || 210;
    const H = options.height || 56;
    const list = Array.isArray(values) ? values : [];
    if (!list.length) {
      return `<svg class="chart chart-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="${H - 4}" x2="${W}" y2="${H - 4}" stroke="${GRID}" stroke-width="1" stroke-dasharray="3 5"/>
      </svg>`;
    }
    const max = Math.max(...list, 1);
    const min = Math.min(...list, 0);
    const span = max - min || 1;
    const step = list.length > 1 ? W / (list.length - 1) : 0;
    const points = list.map((value, index) => {
      const px = list.length > 1 ? index * step : W / 2;
      const py = H - 4 - ((value - min) / span) * (H - 10);
      return [px, py];
    });
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
    const last = points[points.length - 1];
    const color = options.color || TECH;
    return `<svg class="chart chart-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3.6" fill="${color}"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="7.5" fill="none" stroke="${color}" stroke-opacity=".35" stroke-width="1"/>
    </svg>`;
  }

  function progressRing(percent, size = 76, color = ORANGE) {
    const r = size / 2 - 6;
    const C = 2 * Math.PI * r;
    return `<svg class="progress-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${INK}" stroke-opacity=".1" stroke-width="6"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C * Math.min(percent, 100) / 100} ${C}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="${size / 2}" y="${size / 2 + 5}" text-anchor="middle" font-family="Archivo, sans-serif" font-size="18" font-weight="800" fill="${INK}">${Math.round(percent)}</text>
    </svg>`;
  }

  return { attendanceChart, themeBars, donut, sparkline, progressRing, shortDate, esc };
}());
