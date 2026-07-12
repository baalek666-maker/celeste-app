// Tarot card image mapping
// Images stored in /public/tarot/
// Add entries as user provides custom artwork

export const TAROT_IMAGE_MAP: Record<number, string> = {
  0:  '/tarot/00-le-fou.jpg',
  1:  '/tarot/01-le-bateleur.jpg',
  2:  '/tarot/02-la-papesse.jpg',
  3:  '/tarot/03-limperatrice.jpg',
  // 4:  '/tarot/04-lempereur.jpg',
  // 5:  '/tarot/05-le-pape.jpg',
  // 6:  '/tarot/06-lamoureux.jpg',
  // 7:  '/tarot/07-le-chariot.jpg',
  // 8:  '/tarot/08-la-justice.jpg',
  // 9:  '/tarot/09-lermite.jpg',
  // 10: '/tarot/10-la-roue-de-fortune.jpg',
  // 11: '/tarot/11-la-force.jpg',
  // 12: '/tarot/12-le-pendu.jpg',
  // 13: '/tarot/13-larcane-sans-nom.jpg',
  // 14: '/tarot/14-temperance.jpg',
  // 15: '/tarot/15-le-diable.jpg',
  // 16: '/tarot/16-la-maison-dieu.jpg',
  // 17: '/tarot/17-letoile.jpg',
  // 18: '/tarot/18-la-lune.jpg',
  // 19: '/tarot/19-le-soleil.jpg',
  // 20: '/tarot/20-le-jugement.jpg',
  // 21: '/tarot/21-le-monde.jpg',
};

export function getTarotImage(cardId: number): string | null {
  return TAROT_IMAGE_MAP[cardId] ?? null;
}
