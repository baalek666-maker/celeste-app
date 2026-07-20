// Portrait astral PDF generator — v2 premium dark/gold theme.
// Uses pdfkit (no headless browser, no Chromium deps).
// Output: streamable PDF Buffer for Express send.
//
// Design : cohérent avec l'app Céleste (dark cosmic + accents dorés).
// Remplace la v1 beige/blanc qui visuellement ne matchait pas la marque.

import PDFDocument from 'pdfkit';
import { ZODIAC_SIGNS } from './zodiac-shared.js';

// ─── Brand palette (dark theme comme l'app) ──────────────────────
const NIGHT = '#0a0a15';        // fond cosmic-bg
const NIGHT_SOFT = '#14142a';   // cards
const GOLD = '#d4af37';          // gold-500 — titres, accents
const GOLD_BRIGHT = '#f4d27a';   // gold-300 — surlignages
const TEXT_LIGHT = '#e8e8f0';    // texte principal sur fond sombre
const TEXT_MUTED = '#8a8aab';    // texte secondaire
const DIVIDER = 'rgba(212, 175, 55, 0.25)';

/**
 * Dessine le fond cosmic sombre sur toute la page courante.
 */
function paintBackground(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(NIGHT);
  // Halo doré radial simulé en haut
  for (let r = 200; r > 0; r -= 8) {
    const alpha = (1 - r / 200) * 0.04;
    doc.fillColor(`rgba(212, 175, 55, ${alpha})`)
       .circle(doc.page.width / 2, 120, r)
       .fill();
  }
}

/**
 * Dessine un astrolabe décoratif simplifié (cercles concentriques + planètes).
 */
function drawAstrolabe(doc, cx, cy, radius, alpha = 0.15) {
  const stroke = `rgba(212, 175, 55, ${alpha})`;
  doc.save();
  doc.strokeColor(stroke).lineWidth(0.5);
  // 3 orbites
  doc.circle(cx, cy, radius).dash(2, { space: 3 }).stroke();
  doc.circle(cx, cy, radius * 0.66).dash(2, { space: 3 }).stroke();
  doc.circle(cx, cy, radius * 0.33).dash(2, { space: 3 }).stroke();
  // Centre (soleil)
  doc.fillColor(`rgba(244, 210, 122, ${alpha * 2})`).circle(cx, cy, 4).fill();
  // 4 planètes sur l'orbite externe
  const planets = [
    { angle: 0, color: `rgba(244, 210, 122, ${alpha * 2})`, size: 3 },
    { angle: 90, color: `rgba(192, 132, 252, ${alpha * 2})`, size: 2.5 },
    { angle: 180, color: `rgba(168, 85, 247, ${alpha * 1.8})`, size: 2 },
    { angle: 270, color: `rgba(117, 123, 196, ${alpha * 1.5})`, size: 2 },
  ];
  for (const p of planets) {
    const a = (p.angle - 90) * Math.PI / 180;
    const px = cx + radius * Math.cos(a);
    const py = cy + radius * Math.sin(a);
    doc.fillColor(p.color).circle(px, py, p.size).fill();
  }
  doc.restore();
}

/**
 * Carte signe pour l'en-tête (nom + label).
 * Les glyphes Unicode (♈♌...) ne s'affichent pas en PDF Helvetica — on utilise
 * le nom du signe en gras doré à la place, plus lisible et plus premium.
 */
function drawSignCard(doc, x, y, w, h, emoji, signName, label) {
  // Fond carte
  doc.roundedRect(x, y, w, h, 12).fill(NIGHT_SOFT);
  // Bordure dorée subtile
  doc.roundedRect(x, y, w, h, 12)
     .strokeColor(`rgba(212, 175, 55, 0.3)`)
     .lineWidth(1).stroke();
  // Point doré décoratif en haut
  doc.fillColor(GOLD_BRIGHT).circle(x + w / 2, y + 16, 3).fill();
  // Nom du signe en gros
  doc.fillColor(GOLD_BRIGHT).fontSize(14).font('Helvetica-Bold')
     .text(signName, x, y + 26, { width: w, align: 'center' });
  // Label (Soleil/Lune/Ascendant)
  doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica')
     .text(label, x, y + 50, { width: w, align: 'center' });
}

/**
 * Convert markdown-flavoured portrait text (## + paragraphs) into PDF doc blocks.
 * Thème dark premium avec accents dorés.
 */
function renderPortrait(doc, portraitText, meta) {
  const W = doc.page.width;
  const M = 50; // marge latérale
  const CW = W - M * 2; // content width

  // ── PAGE 1 : COVER ──────────────────────────────────────────────
  paintBackground(doc);

  // Astrolabe décoratif en arrière-plan centre
  drawAstrolabe(doc, W / 2, 320, 180, 0.1);

  // Petit logo en haut
  doc.fillColor(GOLD).fontSize(11).font('Helvetica-Bold')
     .text('✦ CÉLESTE', W / 2, 40, { width: CW, align: 'center' });

  // Titre principal
  doc.fillColor(GOLD_BRIGHT).fontSize(34).font('Helvetica-Bold')
     .text('Ton portrait astral', M, 100, { width: CW, align: 'center' });

  // Sous-titre
  doc.fillColor(TEXT_MUTED).fontSize(12).font('Helvetica')
     .text(meta.subtitle || 'Une lecture unique de qui tu es.', M, 150, { width: CW, align: 'center' });

  // Ligne séparatrice dorée
  doc.strokeColor(GOLD).lineWidth(1)
     .moveTo(W / 2 - 60, 180).lineTo(W / 2 + 60, 180).stroke();

  // "Préparé pour"
  if (meta.name) {
    doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
       .text('PRÉPARÉ POUR', M, 210, { width: CW, align: 'center' });
    doc.fillColor(TEXT_LIGHT).fontSize(16).font('Helvetica-Bold')
       .text(meta.name, M, 226, { width: CW, align: 'center' });
  }

  // ── 3 cartes signes (Soleil / Lune / Ascendant) ──────────────
  const cardW = 140;
  const cardH = 80;
  const gap = 20;
  const totalW = cardW * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  const cardY = 410;

  drawSignCard(doc, startX, cardY, cardW, cardH, meta.sunEmoji, meta.sun, 'SOLEIL');
  drawSignCard(doc, startX + cardW + gap, cardY, cardW, cardH, meta.moonEmoji, meta.moon, 'LUNE');
  drawSignCard(doc, startX + (cardW + gap) * 2, cardY, cardW, cardH, meta.risingEmoji, meta.rising, 'ASCENDANT');

  // ── PAGES SUIVANTES : CORPS ────────────────────────────────────
  doc.addPage();
  paintBackground(doc);

  // En-tête page de contenu
  doc.fillColor(GOLD).fontSize(9).font('Helvetica-Bold')
     .text('✦ CÉLESTE', M, 30);
  doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
     .text('Portrait astral', W - M - 100, 30, { width: 100, align: 'right' });
  doc.strokeColor(DIVIDER).lineWidth(0.5)
     .moveTo(M, 48).lineTo(W - M, 48).stroke();

  let cursorY = 70;

  const lines = portraitText.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      const title = line.replace(/^##\s+/, '').trim();

      // Nouvelle page si plus de place
      if (cursorY > doc.page.height - 120) {
        doc.addPage();
        paintBackground(doc);
        cursorY = 70;
      }

      // Espace avant le titre
      cursorY += 24;

      // Barre dorée décorative avant le titre
      doc.fillColor(GOLD).rect(M, cursorY, 3, 18).fill();

      // Titre de section
      doc.fillColor(GOLD_BRIGHT).font('Helvetica-Bold').fontSize(17)
         .text(title, M + 12, cursorY, { width: CW - 12 });
      cursorY = doc.y + 8;

      // Ligne fine sous le titre
      doc.strokeColor(DIVIDER).lineWidth(0.3)
         .moveTo(M + 12, cursorY).lineTo(W - M, cursorY).stroke();
      cursorY += 12;

      doc.fillColor(TEXT_LIGHT).font('Helvetica').fontSize(11);
    } else if (line.startsWith('# ')) {
      const title = line.replace(/^#\s+/, '').trim();
      if (cursorY > doc.page.height - 120) {
        doc.addPage();
        paintBackground(doc);
        cursorY = 70;
      }
      cursorY += 30;
      doc.fillColor(GOLD_BRIGHT).font('Helvetica-Bold').fontSize(20)
         .text(title, M, cursorY, { width: CW });
      cursorY = doc.y + 10;
      doc.fillColor(TEXT_LIGHT).font('Helvetica').fontSize(11);
    } else {
      // Paragraphe corps
      const textOptions = {
        width: CW,
        align: 'justify',
        paragraphGap: 8,
        lineGap: 4,
      };

      // Vérifier qu'on a de la place, sinon nouvelle page
      const approxLines = Math.ceil(line.length / 70);
      const approxHeight = approxLines * 17;
      if (cursorY + approxHeight > doc.page.height - 60) {
        doc.addPage();
        paintBackground(doc);
        cursorY = 70;
        // En-tête page
        doc.fillColor(GOLD).fontSize(9).font('Helvetica-Bold')
           .text('✦ CÉLESTE', M, 30);
        doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
           .text('Portrait astral', W - M - 100, 30, { width: 100, align: 'right' });
        doc.strokeColor(DIVIDER).lineWidth(0.5)
           .moveTo(M, 48).lineTo(W - M, 48).stroke();
      }

      doc.fillColor(TEXT_LIGHT).font('Helvetica').fontSize(11)
         .text(line, M, cursorY, textOptions);
      cursorY = doc.y;
    }
  }

  // ── PIED DE PAGE sur chaque page ──────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    // Pied de page subtil
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(7);
    doc.text(
      `Céleste · ${meta.name ? `${meta.name} · ` : ''}${meta.sun} · ${meta.moon} · ${meta.rising}`,
      50,
      doc.page.height - 30,
      { width: doc.page.width - 100, align: 'center' }
    );
    // Numéro de page
    doc.fillColor(TEXT_MUTED).fontSize(7)
       .text(`${i + 1} / ${range.count}`, doc.page.width - 80, doc.page.height - 30, { width: 30, align: 'right' });
  }
}

/**
 * Generates a portrait PDF Buffer.
 */
export function generatePortraitPdf(input) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        autoFirstPage: true,
        bufferPages: true,
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
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
        subtitle: input.subtitle || 'Lecture générée à partir de tes planètes natales.',
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