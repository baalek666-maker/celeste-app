import { useEffect, useRef, useState } from 'react';

interface ShareCardProps {
  open: boolean;
  onClose: () => void;
  data: {
    date: string; // 'vendredi 11 juillet'
    sign?: string; // 'Bélier'
    general: string; // phrase du jour
    energy?: number; // 1-5
    mood?: string; // 'audacieux'
    luckyNumber?: number;
    luckyColor?: string;
  } | null;
}

const W = 1080;
const H = 1920;

// Dégradé nuit → or (couleurs céleste)
const NIGHT_TOP = '#0a0a1f';
const NIGHT_BOT = '#1a1133';
const GOLD = '#d4af37';
const GOLD_LIGHT = '#f4d77a';
const COSMIC = '#a78bfa';

export default function ShareCard({ open, onClose, data }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open || !data) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Background gradient night → cosmic
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, NIGHT_TOP);
    bg.addColorStop(0.5, NIGHT_BOT);
    bg.addColorStop(1, '#2d1b4e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Stars (50 dots)
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.7;
      const r = Math.random() * 2 + 0.5;
      const a = Math.random() * 0.6 + 0.2;
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Top moon (decorative)
    ctx.fillStyle = `${GOLD}30`;
    ctx.beginPath();
    ctx.arc(W / 2, 280, 140, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `${GOLD}`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W / 2, 280, 140, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = GOLD_LIGHT;
    ctx.font = '700 90px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☾', W / 2, 280);

    // 4. Logo "Céleste"
    ctx.fillStyle = GOLD;
    ctx.font = '700 84px Georgia, serif';
    ctx.fillText('Céleste', W / 2, 540);

    // 5. Date
    ctx.fillStyle = '#a89f8c';
    ctx.font = '500 36px Georgia, serif';
    ctx.fillText(data.date, W / 2, 620);

    // 6. Signe (si connu)
    if (data.sign) {
      ctx.fillStyle = COSMIC;
      ctx.font = '600 38px Georgia, serif';
      ctx.fillText(`— ${data.sign} —`, W / 2, 690);
    }

    // 7. Barre dorée
    const grad = ctx.createLinearGradient(200, 0, W - 200, 0);
    grad.addColorStop(0, `${GOLD}00`);
    grad.addColorStop(0.5, `${GOLD}`);
    grad.addColorStop(1, `${GOLD}00`);
    ctx.fillStyle = grad;
    ctx.fillRect(200, 760, W - 400, 3);

    // 8. Phrase du jour (wrapped)
    const phrase = data.general || 'Une journée cosmique t\'attend.';
    ctx.fillStyle = '#f5f0e1';
    ctx.font = 'italic 500 56px Georgia, serif';
    const lines = wrapText(ctx, phrase, W - 200);
    const lineHeight = 80;
    const startY = 900 - (lines.length - 1) * (lineHeight / 2);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, startY + i * lineHeight);
    });

    // 9. Mood + Énergie (badge row)
    const badgeY = H - 700;
    if (data.mood) {
      drawBadge(ctx, W / 2, badgeY, data.mood.toUpperCase(), COSMIC);
    }
    if (data.energy) {
      drawBadge(ctx, W / 2, badgeY + 90, 'Énergie ' + '●'.repeat(Math.max(0, Math.min(5, data.energy))) + '○'.repeat(5 - Math.max(0, Math.min(5, data.energy))), GOLD);
    }

    // 10. Lucky number + color (si présents)
    if (data.luckyNumber || data.luckyColor) {
      ctx.fillStyle = '#a89f8c';
      ctx.font = '500 38px Georgia, serif';
      const parts = [];
      if (data.luckyNumber) parts.push(`★ ${data.luckyNumber}`);
      if (data.luckyColor) parts.push(`● ${data.luckyColor}`);
      ctx.fillText(parts.join('   '), W / 2, badgeY + 220);
    }

    // 11. Footer
    ctx.fillStyle = '#5a5168';
    ctx.font = '500 32px Georgia, serif';
    ctx.fillText('Mon horoscope du jour', W / 2, H - 280);
    ctx.fillStyle = GOLD;
    ctx.font = '600 36px Georgia, serif';
    ctx.fillText('celeste-app.com', W / 2, H - 220);

    // Save blob for share/download
    canvas.toBlob((b) => setBlob(b), 'image/png', 0.92);
  }, [open, data]);

  if (!open || !data) return null;

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `celeste-${data.date.replace(/\s/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copyText = async () => {
    const text = `🔮 ${data.date}${data.sign ? ' — ' + data.sign : ''}\n\n${data.general}\n\nvia Céleste`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    if (!blob || sharing) return;
    setSharing(true);
    try {
      const file = new File([blob], `celeste-${data.date.replace(/\s/g, '-')}.png`, { type: 'image/png' });
      const shareData: any = {
        title: 'Mon horoscope Céleste',
        text: `🔮 ${data.date}\n\n${data.general}`,
        files: [file],
      };
      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await copyText();
      }
    } catch {
      // user cancelled
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-night-900 rounded-3xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto border border-night-700"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gold-gradient mb-1">Carte à partager</h2>
        <p className="text-night-400 text-xs mb-4">Format Stories (1080×1920)</p>

        {/* Preview (scaled) */}
        <div className="relative w-full bg-night-800 rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: '9/16' }}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain' }}
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            onClick={download}
            disabled={!blob}
            className="px-4 py-3 rounded-xl bg-night-800 text-night-100 border border-night-700 hover:border-gold-500/40 disabled:opacity-50 text-sm font-medium"
          >
            ⬇ Télécharger
          </button>
          <button
            onClick={shareNative}
            disabled={!blob || sharing}
            className="px-4 py-3 rounded-xl bg-gradient-to-r from-cosmic-500 to-gold-500 text-white disabled:opacity-50 text-sm font-medium"
          >
            {sharing ? '…' : '↗ Partager'}
          </button>
        </div>
        <button
          onClick={copyText}
          className="w-full px-4 py-2 rounded-xl text-night-300 border border-night-700 hover:border-night-600 text-xs"
        >
          {copied ? '✓ Copié !' : '📋 Copier le texte'}
        </button>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-night-500 text-xs mt-2"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5); // max 5 lines
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.font = '600 36px Georgia, serif';
  const w = ctx.measureText(text).width + 60;
  ctx.fillStyle = `${color}20`;
  roundRect(ctx, x - w / 2, y - 30, w, 60, 30);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - 30, w, 60, 30);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}