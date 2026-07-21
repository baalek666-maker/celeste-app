// Portrait astral PDF generator — v3 HTML + Playwright.
// Rend du HTML complet (design Céleste dark/gold) en headless Chromium → PDF.
//
// Contenu enrichi :
// 1. Cover avec 3 cartes signes + infos naissance
// 2. Roue zodiacale SVG (10 planètes positionnées)
// 3. Tableau planétaire (planète, signe, degré, maison, rétrograde)
// 4. Distribution des éléments (Feu/Terre/Air/Eau) avec barres
// 5. Distribution des modes (Cardinal/Fixe/Mutable)
// 6. Portrait textuel (sections ## du LLM ou fallback)

import { chromium } from 'playwright';
import { ZODIAC_SIGNS } from './zodiac-shared.js';

// ─── Helpers ──────────────────────────────────────────────────────

const PLANET_META = {
  sun:     { name: 'Soleil',   symbol: '☉', color: '#fbbf24' },
  moon:    { name: 'Lune',     symbol: '☽', color: '#e0e0e0' },
  mercury: { name: 'Mercure',  symbol: '☿', color: '#a8d8b9' },
  venus:   { name: 'Vénus',    symbol: '♀', color: '#f9a8d4' },
  mars:    { name: 'Mars',     symbol: '♂', color: '#ef4444' },
  jupiter: { name: 'Jupiter',  symbol: '♃', color: '#fb923c' },
  saturn:  { name: 'Saturne',  symbol: '♄', color: '#fbbf24' },
  uranus:  { name: 'Uranus',   symbol: '♅', color: '#60a5fa' },
  neptune: { name: 'Neptune',  symbol: '♆', color: '#818cf8' },
  pluto:   { name: 'Pluton',   symbol: '♇', color: '#c084fc' },
};

const ELEMENT_COLORS = { Feu: '#ef4444', Terre: '#84cc16', Air: '#60a5fa', Eau: '#c084fc' };
const MODE_LABELS = { Cardinal: 'Cardinal', Fixe: 'Fixe', Mutable: 'Mutable' };

const SIGN_FR_TO_ELEMENT = {
  'Bélier': 'Feu', 'Lion': 'Feu', 'Sagittaire': 'Feu',
  'Taureau': 'Terre', 'Vierge': 'Terre', 'Capricorne': 'Terre',
  'Gémeaux': 'Air', 'Balance': 'Air', 'Verseau': 'Air',
  'Cancer': 'Eau', 'Scorpion': 'Eau', 'Poissons': 'Eau',
};
const SIGN_FR_TO_MODE = {
  'Bélier': 'Cardinal', 'Cancer': 'Cardinal', 'Balance': 'Cardinal', 'Capricorne': 'Cardinal',
  'Taureau': 'Fixe', 'Lion': 'Fixe', 'Scorpion': 'Fixe', 'Verseau': 'Fixe',
  'Gémeaux': 'Mutable', 'Vierge': 'Mutable', 'Sagittaire': 'Mutable', 'Poissons': 'Mutable',
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Roue zodiacale SVG ───────────────────────────────────────────

function buildZodiacWheel(planets) {
  const cx = 150, cy = 150, rOuter = 135, rSign = 115, rInner = 65;
  const planetsSvg = (planets || []).map(p => {
    if (!p?.longitude && p?.longitude !== 0) return '';
    const angle = (p.longitude - 90) * Math.PI / 180;
    const px = cx + rInner * Math.cos(angle);
    const py = cy + rInner * Math.sin(angle);
    const meta = PLANET_META[p.key] || { symbol: '•', color: '#fff' };
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="${meta.color}" opacity="0.9"/>
            <text x="${px.toFixed(1)}" y="${(py + 2).toFixed(1)}" text-anchor="middle" font-size="8" fill="#0a0a15" font-weight="bold">${meta.symbol}</text>`;
  }).join('');

  // 12 segments
  let segmentsSvg = '';
  for (let i = 0; i < 12; i++) {
    const a1 = (i * 30 - 90) * Math.PI / 180;
    const a2 = ((i + 1) * 30 - 90) * Math.PI / 180;
    const x1o = cx + rOuter * Math.cos(a1), y1o = cy + rOuter * Math.sin(a1);
    const x2o = cx + rOuter * Math.cos(a2), y2o = cy + rOuter * Math.sin(a2);
    const x1i = cx + rSign * Math.cos(a1), y1i = cy + rSign * Math.sin(a1);
    const x2i = cx + rSign * Math.cos(a2), y2i = cy + rSign * Math.sin(a2);
    segmentsSvg += `<path d="M ${x1o.toFixed(1)} ${y1o.toFixed(1)} A ${rOuter} ${rOuter} 0 0 1 ${x2o.toFixed(1)} ${y2o.toFixed(1)} L ${x2i.toFixed(1)} ${y2i.toFixed(1)} A ${rSign} ${rSign} 0 0 0 ${x1i.toFixed(1)} ${y1i.toFixed(1)} Z" fill="rgba(212,175,55,0.03)" stroke="rgba(212,175,55,0.15)" stroke-width="0.5"/>`;
  }

  // 12 glyphs
  const signs = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
  let glyphsSvg = '';
  for (let i = 0; i < 12; i++) {
    const a = (i * 30 + 15 - 90) * Math.PI / 180;
    const sx = cx + ((rOuter + rSign) / 2) * Math.cos(a);
    const sy = cy + ((rOuter + rSign) / 2) * Math.sin(a);
    glyphsSvg += `<text x="${sx.toFixed(1)}" y="${(sy + 3).toFixed(1)}" text-anchor="middle" font-size="10" fill="#d4af37" opacity="0.7">${signs[i]}</text>`;
  }

  return `<svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="0.8"/>
    <circle cx="${cx}" cy="${cy}" r="${rSign}" fill="none" stroke="rgba(212,175,55,0.15)" stroke-width="0.5"/>
    <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="none" stroke="rgba(212,175,55,0.1)" stroke-width="0.5"/>
    ${segmentsSvg}
    ${glyphsSvg}
    ${planetsSvg}
    <circle cx="${cx}" cy="${cy}" r="3" fill="#f4d27a"/>
  </svg>`;
}

// ─── Tableau planétaire ───────────────────────────────────────────

function buildPlanetTable(natalChart) {
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto'];
  const rows = planets.map(key => {
    const p = natalChart?.[key];
    if (!p) return '';
    const meta = PLANET_META[key];
    const retro = p.retrograde ? ' ℞' : '';
    return `<tr>
      <td><span class="p-symbol" style="color:${meta.color}">${meta.symbol}</span> ${meta.name}${retro}</td>
      <td>${escapeHtml(p.sign || '—')}</td>
      <td>${typeof p.degree === 'number' ? p.degree.toFixed(1) : '—'}°</td>
    </tr>`;
  }).join('');
  return `<table class="planet-table">
    <thead><tr><th>Planète</th><th>Signe</th><th>Degré</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Distribution éléments + modes ────────────────────────────────

function buildElementBars(natalChart) {
  const counts = { Feu: 0, Terre: 0, Air: 0, Eau: 0 };
  const planets = ['sun','moon','mercury','venus','mars','jupiter','saturn'];
  for (const k of planets) {
    const p = natalChart?.[k];
    if (p?.sign && SIGN_FR_TO_ELEMENT[p.sign]) counts[SIGN_FR_TO_ELEMENT[p.sign]]++;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const icons = { Feu: '🔥', Terre: '🌿', Air: '💨', Eau: '💧' };
  return Object.entries(counts).map(([el, n]) => {
    const pct = Math.round(n / total * 100);
    return `<div class="bar-row">
      <span class="bar-label">${icons[el]} ${el}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${ELEMENT_COLORS[el]}"></div></div>
      <span class="bar-val">${n}</span>
    </div>`;
  }).join('');
}

// ─── HTML complet ─────────────────────────────────────────────────

function buildPortraitHtml(input) {
  const sunMeta = ZODIAC_SIGNS?.[input.sun] || { name: input.sun };
  const moonMeta = ZODIAC_SIGNS?.[input.moon] || { name: input.moon };
  const risingMeta = ZODIAC_SIGNS?.[input.rising] || { name: input.rising };
  const name = input.name || '—';
  const nc = input.natalChart;
  const bd = input.birthData;

  // Planet list pour la roue
  const planetList = ['sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto']
    .map(k => nc?.[k] ? { key: k, longitude: nc[k].longitude, sign: nc[k].sign, degree: nc[k].degree } : null)
    .filter(Boolean);

  // Portrait sections
  const sections = (input.portrait || '')
    .split(/\n/).map(l => l.trim())
    .reduce((acc, line) => {
      if (!line) return acc;
      if (line.startsWith('## ') || line.startsWith('# ')) {
        acc.push({ title: line.replace(/^#+\s+/, '').trim(), body: [] });
      } else if (acc.length > 0) {
        acc[acc.length - 1].body.push(line);
      }
      return acc;
    }, []);

  const sectionsHtml = sections.map(s => `
    <div class="section">
      <div class="section-title-wrap"><div class="section-title-bar"></div><h2 class="section-title">${escapeHtml(s.title)}</h2></div>
      <div class="section-divider"></div>
      <p class="section-body">${escapeHtml(s.body.join('\n\n'))}</p>
    </div>
  `).join('');

  const birthInfo = bd?.date
    ? `${escapeHtml(bd.date || '—')}${bd.time ? ' à ' + escapeHtml(bd.time) : ''}${bd.city ? ', ' + escapeHtml(bd.city) : ''}`
    : '';

  const wheelSvg = nc ? buildZodiacWheel(planetList) : '';
  const planetTableHtml = nc ? buildPlanetTable(nc) : '';
  const elementBarsHtml = nc ? buildElementBars(nc) : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Georgia', serif; background: #0a0a15; color: #e8e8f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

/* COVER */
.cover { width: 210mm; height: 297mm; background: radial-gradient(ellipse at top, #14142a 0%, #0a0a15 60%), radial-gradient(circle at 50% 25%, rgba(212,175,55,0.08) 0%, transparent 50%); display: flex; flex-direction: column; align-items: center; padding: 25mm 20mm; page-break-after: always; }
.cover-logo { font-family: 'Helvetica', sans-serif; font-size: 11pt; color: #d4af37; letter-spacing: 3pt; font-weight: bold; margin-bottom: 25mm; }
.cover-title { font-size: 30pt; color: #f4d27a; text-align: center; font-weight: bold; margin-bottom: 5mm; text-shadow: 0 0 20px rgba(244,210,122,0.3); }
.cover-subtitle { font-family: 'Helvetica', sans-serif; font-size: 11pt; color: #8a8aab; text-align: center; margin-bottom: 6mm; }
.cover-divider { width: 60mm; height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin-bottom: 8mm; }
.cover-name-label { font-family: 'Helvetica', sans-serif; font-size: 8pt; color: #6b6b8a; letter-spacing: 2pt; text-transform: uppercase; margin-bottom: 2mm; }
.cover-name { font-size: 18pt; color: #e8e8f0; font-weight: bold; margin-bottom: 4mm; }
.cover-birth { font-family: 'Helvetica', sans-serif; font-size: 9pt; color: #6b6b8a; margin-bottom: 25mm; }
.sign-cards { display: flex; gap: 6mm; width: 100%; justify-content: center; }
.sign-card { width: 45mm; height: 28mm; background: rgba(20,20,42,0.8); border: 1px solid rgba(212,175,55,0.3); border-radius: 4mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm; }
.sign-card-dot { width: 3mm; height: 3mm; background: #f4d27a; border-radius: 50%; margin-bottom: 1mm; }
.sign-card-name { font-family: 'Helvetica', sans-serif; font-size: 13pt; color: #f4d27a; font-weight: bold; }
.sign-card-label { font-family: 'Helvetica', sans-serif; font-size: 7pt; color: #8a8aab; letter-spacing: 1.5pt; text-transform: uppercase; }
.cover-wheel { margin-top: 15mm; opacity: 0.9; }

/* CONTENT */
.content { width: 210mm; padding: 18mm 20mm 20mm 20mm; background: #0a0a15; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8mm; padding-bottom: 3mm; border-bottom: 1px solid rgba(212,175,55,0.15); }
.page-header-logo { font-family: 'Helvetica', sans-serif; font-size: 8pt; color: #d4af37; font-weight: bold; letter-spacing: 2pt; }
.page-header-meta { font-family: 'Helvetica', sans-serif; font-size: 8pt; color: #6b6b8a; }

/* ROUE + TABLEAU (page 2) */
.chart-grid { display: flex; gap: 8mm; align-items: flex-start; }
.chart-wheel { flex: 0 0 80mm; }
.chart-data { flex: 1; }
.data-block { margin-bottom: 8mm; }
.data-block-title { font-family: 'Helvetica', sans-serif; font-size: 8pt; color: #d4af37; letter-spacing: 2pt; text-transform: uppercase; margin-bottom: 3mm; }

.planet-table { width: 100%; border-collapse: collapse; font-family: 'Helvetica', sans-serif; font-size: 9pt; }
.planet-table th { text-align: left; color: #6b6b8a; font-size: 7pt; text-transform: uppercase; letter-spacing: 1pt; padding-bottom: 2mm; border-bottom: 1px solid rgba(212,175,55,0.1); }
.planet-table td { padding: 1.5mm 0; color: #c8c8d8; border-bottom: 1px solid rgba(255,255,255,0.03); }
.planet-table .p-symbol { font-size: 11pt; }

.bar-row { display: flex; align-items: center; gap: 3mm; margin-bottom: 2.5mm; }
.bar-label { font-family: 'Helvetica', sans-serif; font-size: 9pt; color: #c8c8d8; width: 22mm; }
.bar-track { flex: 1; height: 5mm; background: rgba(255,255,255,0.05); border-radius: 2.5mm; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 2.5mm; transition: width 0.3s; }
.bar-val { font-family: 'Helvetica', sans-serif; font-size: 9pt; color: #8a8aab; width: 5mm; text-align: right; }

/* SECTIONS PORTRAIT */
.section { margin-bottom: 8mm; page-break-inside: avoid; }
.section-title-wrap { display: flex; align-items: center; gap: 3mm; margin-bottom: 2mm; }
.section-title-bar { width: 3px; height: 16pt; background: #d4af37; border-radius: 2px; }
.section-title { font-size: 14pt; color: #f4d27a; font-weight: bold; }
.section-divider { width: 100%; height: 1px; background: rgba(212,175,55,0.1); margin-bottom: 3mm; }
.section-body { font-family: 'Helvetica', sans-serif; font-size: 10.5pt; line-height: 1.7; color: #c8c8d8; text-align: justify; white-space: pre-line; }
</style></head><body>

<!-- COVER -->
<div class="cover">
  <div class="cover-logo">✦ CÉLESTE</div>
  <div class="cover-title">Ton portrait astral</div>
  <div class="cover-subtitle">Lecture générée à partir de tes planètes natales</div>
  <div class="cover-divider"></div>
  <div class="cover-name-label">PRÉPARÉ POUR</div>
  <div class="cover-name">${escapeHtml(name)}</div>
  ${birthInfo ? `<div class="cover-birth">${birthInfo}</div>` : ''}
  <div class="sign-cards">
    <div class="sign-card"><div class="sign-card-dot"></div><div class="sign-card-name">${sunMeta.name}</div><div class="sign-card-label">SOLEIL</div></div>
    <div class="sign-card"><div class="sign-card-dot"></div><div class="sign-card-name">${moonMeta.name}</div><div class="sign-card-label">LUNE</div></div>
    <div class="sign-card"><div class="sign-card-dot"></div><div class="sign-card-name">${risingMeta.name}</div><div class="sign-card-label">ASCENDANT</div></div>
  </div>
  ${wheelSvg ? `<div class="cover-wheel">${wheelSvg}</div>` : ''}
</div>

<!-- PAGE 2 : THEME NATAL -->
<div class="content">
  <div class="page-header"><span class="page-header-logo">✦ CÉLESTE</span><span class="page-header-meta">Ton thème natal</span></div>
  ${wheelSvg || planetTableHtml ? `
  <div class="chart-grid">
    ${wheelSvg ? `<div class="chart-wheel">${wheelSvg}</div>` : ''}
    <div class="chart-data">
      ${planetTableHtml ? `<div class="data-block"><div class="data-block-title">Tableau planétaire</div>${planetTableHtml}</div>` : ''}
      ${elementBarsHtml ? `<div class="data-block"><div class="data-block-title">Éléments</div>${elementBarsHtml}</div>` : ''}
    </div>
  </div>
  ` : ''}
</div>

<!-- PAGE 3+ : PORTRAIT TEXTO -->
${sectionsHtml ? `<div class="content">
  <div class="page-header"><span class="page-header-logo">✦ CÉLESTE</span><span class="page-header-meta">Portrait · ${escapeHtml(name)}</span></div>
  ${sectionsHtml}
</div>` : ''}

</body></html>`;
}

export async function generatePortraitPdf(input) {
  const html = buildPortraitHtml(input);
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}