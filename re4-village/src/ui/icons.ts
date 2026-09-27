import { ITEMS } from '../data/items';

/** Tiny inline SVG silhouettes for items (viewBox scaled to the item's grid footprint). */
export function itemIcon(id: string, rot = false): string {
  const d = ITEMS[id];
  const w = d ? d.w : 1, h = d ? d.h : 1;
  const W = w * 50, H = h * 50;
  let body = '';
  const c = d?.color ?? '#888';
  switch (true) {
    case id === 'sg09' || id === 'red9':
      body = `<path d="M${W * 0.08} ${H * 0.28} h${W * 0.84} v${H * 0.22} h${-W * 0.5} l${-W * 0.06} ${H * 0.42} h${-W * 0.2} l${W * 0.06} ${-H * 0.42} h${-W * 0.14} z" fill="#2e3136" stroke="#8a8f96" stroke-width="2"/>${id === 'red9' ? `<rect x="${W * 0.4}" y="${H * 0.5}" width="${W * 0.08}" height="${H * 0.3}" fill="#6a2a20"/>` : ''}`;
      break;
    case id === 'w870':
      body = `<path d="M${W * 0.02} ${H * 0.38} h${W * 0.62} v${H * 0.18} h${-W * 0.62} z" fill="#30333a" stroke="#8a8f96" stroke-width="2"/><path d="M${W * 0.64} ${H * 0.34} h${W * 0.14} l${W * 0.18} ${H * 0.14} v${H * 0.3} l${-W * 0.2} ${-H * 0.14} h${-W * 0.12} z" fill="#6a4428" stroke="#a07050" stroke-width="2"/><rect x="${W * 0.2}" y="${H * 0.56}" width="${W * 0.22}" height="${H * 0.12}" fill="#6a4428"/>`;
      break;
    case id === 'sr1903':
      body = `<path d="M${W * 0.02} ${H * 0.45} h${W * 0.6} v${H * 0.14} h${-W * 0.6} z" fill="#30333a" stroke="#8a8f96" stroke-width="2"/><path d="M${W * 0.3} ${H * 0.52} h${W * 0.4} l${W * 0.28} ${H * 0.05} v${H * 0.3} l${-W * 0.3} ${-H * 0.12} h${-W * 0.38} z" fill="#6a4428" stroke="#a07050" stroke-width="2"/><rect x="${W * 0.42}" y="${H * 0.18}" width="${W * 0.22}" height="${H * 0.2}" rx="4" fill="#1a1a1c" stroke="#777"/>`;
      break;
    case id.startsWith('ammo'): {
      const n = id === 'ammo_hg' ? 5 : id === 'ammo_sg' ? 3 : 3;
      body = `<rect x="${W * 0.12}" y="${H * 0.45}" width="${W * 0.76}" height="${H * 0.42}" fill="${c}" stroke="#ccb" stroke-width="2"/>`;
      for (let i = 0; i < n; i++) {
        const x = W * (0.2 + (i * 0.6) / Math.max(1, n - 1)) - 4;
        body += `<rect x="${x}" y="${H * 0.15}" width="8" height="${H * 0.34}" rx="3" fill="${id === 'ammo_sg' ? '#b03020' : '#c8a040'}"/>`;
      }
      break;
    }
    case id.startsWith('herb'): {
      const cols: string[] = [];
      for (const ch of id.slice(5)) cols.push(ch === 'g' ? '#4a8a30' : ch === 'r' ? '#b03028' : '#c8b030');
      body = `<path d="M${W * 0.25} ${H * 0.6} h${W * 0.5} l${-W * 0.08} ${H * 0.35} h${-W * 0.34} z" fill="#7a5a38" stroke="#b08a60" stroke-width="2"/>`;
      cols.forEach((col, i) => {
        const x = W * (0.5 + (i - (cols.length - 1) / 2) * 0.2);
        body += `<ellipse cx="${x}" cy="${H * 0.36}" rx="${W * 0.2}" ry="${H * 0.18}" fill="${col}" stroke="#222" stroke-width="1.5"/>`;
      });
      break;
    }
    case id === 'spray':
      body = `<rect x="${W * 0.3}" y="${H * 0.25}" width="${W * 0.4}" height="${H * 0.68}" rx="6" fill="#d8d8d0" stroke="#888" stroke-width="2"/><rect x="${W * 0.38}" y="${H * 0.1}" width="${W * 0.24}" height="${H * 0.15}" fill="#444"/><path d="M${W * 0.42} ${H * 0.55} h${W * 0.16} M${W * 0.5} ${H * 0.47} v${H * 0.16}" stroke="#b02020" stroke-width="5"/>`;
      break;
    case id.startsWith('egg'):
      body = `<ellipse cx="${W / 2}" cy="${H * 0.55}" rx="${W * 0.28}" ry="${H * 0.36}" fill="${c}" stroke="#555" stroke-width="2"/>`;
      break;
    case id === 'nade':
      body = `<ellipse cx="${W / 2}" cy="${H * 0.6}" rx="${W * 0.32}" ry="${H * 0.26}" fill="#3a4a2a" stroke="#889" stroke-width="2"/><rect x="${W * 0.4}" y="${H * 0.18}" width="${W * 0.2}" height="${H * 0.2}" fill="#777"/>`;
      break;
    case id === 'flash':
      body = `<rect x="${W * 0.28}" y="${H * 0.25}" width="${W * 0.44}" height="${H * 0.65}" rx="5" fill="#8a8a8a" stroke="#ccc" stroke-width="2"/><rect x="${W * 0.4}" y="${H * 0.12}" width="${W * 0.2}" height="${H * 0.14}" fill="#555"/>`;
      break;
    default:
      body = `<rect x="${W * 0.2}" y="${H * 0.2}" width="${W * 0.6}" height="${H * 0.6}" fill="${c}" stroke="#aaa" stroke-width="2"/>`;
  }
  const tr = rot ? `transform="rotate(90 ${H / 2} ${H / 2})"` : '';
  const vb = rot ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`;
  return `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><g ${tr}>${body}</g></svg>`;
}
