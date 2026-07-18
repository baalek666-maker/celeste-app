/**
 * P2#17 — SkyMap partageable.
 *
 * Capture le SVG de la SkyMap en PNG téléchargeable/partageable, sans dépendance
 * externe (pas de html2canvas). Utilise XMLSerializer + canvas drawImage.
 *
 * Flow :
 *   1. L'user clique sur "Partager" dans la SkyMap
 *   2. On clone le SVG, on inline les styles computed (sinon canvas dessine sans CSS)
 *   3. On sérialise → data URL → Image → canvas → PNG blob
 *   4. Web Share API si dispo (mobile), fallback download
 *
 * Usage :
 *   <SkyMapShare svgRef={skyMapSvgRef} dateLabel="11 juillet 2026" />
 */

import { useState, type RefObject } from 'react';

interface SkyMapShareProps {
  /** Référence vers l'élément <svg> de la SkyMap. */
  svgRef: RefObject<SVGSVGElement | null>;
  /** Label de date affiché en watermark (ex. "11 juillet 2026"). */
  dateLabel?: string;
}

// Dimensions de l'image de sortie (carré pour réseaux sociaux).
const OUTPUT_SIZE = 1080;

export function SkyMapShare({ svgRef, dateLabel }: SkyMapShareProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Inline les styles computed sur chaque nœud du SVG cloné, sinon le canvas
   * perd toutes les couleurs (CSS externe non appliqué au data: URL).
   */
  function inlineStyles(source: Element, target: Element) {
    const computed = window.getComputedStyle(source);
    let style = '';
    for (let i = 0; i < computed.length; i++) {
      const prop = computed.item(i);
      style += `${prop}:${computed.getPropertyValue(prop)};`;
    }
    (target as HTMLElement).setAttribute('style', style);
    for (let i = 0; i < source.children.length; i++) {
      inlineStyles(source.children[i], target.children[i]);
    }
  }

  async function capturePng(): Promise<Blob | null> {
    const svg = svgRef.current;
    if (!svg) return null;

    // Clone + inline styles
    const clone = svg.cloneNode(true) as SVGSVGElement;
    inlineStyles(svg, clone);

    // Watermark date en bas
    if (dateLabel) {
      const ns = 'http://www.w3.org/2000/svg';
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', '50%');
      txt.setAttribute('y', '98%');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('font-family', 'serif');
      txt.setAttribute('font-size', '14');
      txt.setAttribute('fill', '#d4af37');
      txt.setAttribute('opacity', '0.7');
      txt.textContent = `✦ Céleste — ${dateLabel}`;
      clone.appendChild(txt);
    }

    // Taille explicite (requis pour drawImage)
    const bbox = svg.getBoundingClientRect();
    clone.setAttribute('width', String(bbox.width));
    clone.setAttribute('height', String(bbox.height));

    const xml = new XMLSerializer().serializeToString(clone);
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG → Image failed'));
      img.src = svgDataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fond dégradé nuit
    const grad = ctx.createLinearGradient(0, 0, 0, OUTPUT_SIZE);
    grad.addColorStop(0, '#0a0a1f');
    grad.addColorStop(1, '#1a1133');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    // Centrer le SVG (carré) sur le canvas
    const size = Math.min(bbox.width, bbox.height);
    const scale = (OUTPUT_SIZE * 0.9) / size;
    const drawW = bbox.width * scale;
    const drawH = bbox.height * scale;
    ctx.drawImage(img, (OUTPUT_SIZE - drawW) / 2, (OUTPUT_SIZE - drawH) / 2, drawW, drawH);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
    });
  }

  async function handleShare() {
    setBusy(true);
    setError(null);
    try {
      const blob = await capturePng();
      if (!blob) throw new Error('Capture échouée');
      const file = new File([blob], 'celeste-skymap.png', { type: 'image/png' });

      // Web Share API (mobile) si dispo
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'Mon ciel du jour',
          text: `✦ Voici mon ciel. Et le tien ? — Céleste`,
        });
      } else {
        // Fallback : téléchargement direct
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'celeste-skymap.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError('Capture impossible. Réessaie.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleShare}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-xs font-medium text-gold-200 transition active:scale-95 disabled:opacity-50"
      >
        <span>{busy ? '⏳' : '📤'}</span>
        {busy ? 'Capture…' : 'Partager mon ciel'}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

export default SkyMapShare;
