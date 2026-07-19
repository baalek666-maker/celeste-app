// Portrait astral PDF generator.
// Uses pdfkit (no headless browser, no Chromium deps, ships as pure-Node binary).
// Output: streamable PDF Buffer for Express send.

import PDFDocument from 'pdfkit';
import { ZODIAC_SIGNS } from './zodiac-shared.js';

// Brand colors
const GOLD = '#d4af37';        // gold-500
const SOFT = '#f6e6b4';        // gold-300 softer
const TEXT_DARK = '#1a1a2e';
const TEXT_BODY = '#2c2c44';
const MUTED = '#6b6b8a';
const BG_TITLE = '#faf6ee';

/**
 * Convert markdown-flavoured portrait text (## + paragraphs) into PDF doc blocks.
 * No external md parser to avoid deps — keeps AST simple.
 */
function renderPortrait(doc, portraitText, meta) {
  // ── COVER HEADER ───────────────────────────────────────────────
  doc.fillColor(GOLD).rect(0, 0, doc.page.width, 220).fill();
  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(28)
    .text('Ton portrait astral', 50, 80, { width: doc.page.width - 100 });
  doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(13)
    .text(meta.subtitle || 'Une lecture unique de qui tu es.', 50, 125, { width: doc.page.width - 100 });

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
    .text('Préparé pour', 50, 165);
  doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11)
    .text(meta.name || '—', 50, 182);

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
    .text('Soleil', doc.page.width - 200, 165, { width: 150, align: 'right' });
  doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11)
    .text(`${meta.sunEmoji} ${meta.sun}`, doc.page.width - 200, 182, { width: 150, align: 'right' });

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
    .text('Lune', doc.page.width - 200, 200, { width: 150, align: 'right' });
  doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11)
    .text(`${meta.moonEmoji} ${meta.moon}`, doc.page.width - 200, 217, { width: 150, align: 'right' });

  doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(11)
    .text('Ascendant', doc.page.width - 200, 235, { width: 150, align: 'right' });
  doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11)
    .text(`${meta.risingEmoji} ${meta.rising}`, doc.page.width - 200, 252, { width: 150, align: 'right' });

  doc.moveDown(7);
  doc.fillColor(TEXT_DARK);

  // ── BODY: parse simple ## sections ────────────────────────────
  const lines = portraitText.split(/\r?\n/);
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) {
      // New section heading
      const title = line.replace(/^##\s+/, '').trim();
      doc.moveDown(1.4);
      // Title underline in gold
      doc.fillColor(GOLD).rect(50, doc.y, 24, 2).fill();
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(18)
        .text(title, 50, doc.y + 6, { width: doc.page.width - 100 });
      doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11);
      inSection = true;
    } else if (line.startsWith('# ')) {
      // H1 (rare in portrait) — treat as section too
      const title = line.replace(/^#\s+/, '').trim();
      doc.moveDown(2);
      doc.fillColor(GOLD).rect(50, doc.y, 24, 2).fill();
      doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(20)
        .text(title, 50, doc.y + 6, { width: doc.page.width - 100 });
      doc.fillColor(TEXT_BODY).font('Helvetica').fontSize(11);
      inSection = true;
    } else {
      // Body paragraph (justify, paragraph spacing)
      doc.text(line, 50, doc.y + 4, {
        width: doc.page.width - 100,
        align: 'justify',
        paragraphGap: 6,
        lineGap: 2,
      });
    }
  }

  // ── FOOTER on each page ────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(
      `Céleste · Portrait astral${meta.name ? ` de ${meta.name}` : ''} — ${meta.sunEmoji} ${meta.sun} · ${meta.moonEmoji} ${meta.moon} · ${meta.risingEmoji} ${meta.rising}`,
      50,
      doc.page.height - 40,
      { width: doc.page.width - 100, align: 'center' }
    );
  }
}

/**
 * Generates a portrait PDF Buffer.
 *
 * @param {Object} input
 * @param {string} input.portrait - the portrait markdown text
 * @param {string} input.name     - user display name / email
 * @param {string} input.sun      - sun sign key (e.g. 'leo')
 * @param {string} input.moon     - moon sign key
 * @param {string} input.rising   - rising sign key
 * @returns {Promise<Buffer>}
 */
export function generatePortraitPdf(input) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: true,
        size: 'A4',
        margins: { top: 50, bottom: 60, left: 50, right: 50 },
        info: {
          Title: 'Portrait astral — Céleste',
          Author: 'Céleste',
          Subject: 'Portrait astral personnalisé',
          Creator: 'Céleste',
        },
      });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const sunMeta = ZODIAC_SIGNS?.[input.sun] || { name: input.sun, emoji: '✦' };
      const moonMeta = ZODIAC_SIGNS?.[input.moon] || { name: input.moon, emoji: '✦' };
      const risingMeta = ZODIAC_SIGNS?.[input.rising] || { name: input.rising, emoji: '✦' };

      renderPortrait(doc, input.portrait || '', {
        name: input.name,
        subtitle: input.subtitle || `Lecture générée à partir de tes planètes natales.`,
        sun: sunMeta.name,
        moon: moonMeta.name,
        rising: risingMeta.name,
        sunEmoji: sunMeta.emoji,
        moonEmoji: moonMeta.emoji,
        risingEmoji: risingMeta.emoji,
      });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
