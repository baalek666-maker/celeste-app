// Tarot card image mapping
// Images stored in /public/tarot/
// 22 Major Arcana — all custom artwork mapped

export const TAROT_IMAGE_MAP: Record<number, string> = {
  0:  '/tarot/00-le-fou.jpg',
  1:  '/tarot/01-le-bateleur.jpg',
  2:  '/tarot/02-la-papesse.jpg',
  3:  '/tarot/03-limperatrice.jpg',
  4:  '/tarot/04-lempereur.jpg',
  5:  '/tarot/05-le-pape.jpg',
  6:  '/tarot/06_lamoureux.jpg',
  7:  '/tarot/07_le_chariot.jpg',
  8:  '/tarot/08_la_justice.jpg',
  9:  '/tarot/09_lermite.jpg',
  10: '/tarot/10_la_roue_de_fortune.jpg',
  11: '/tarot/11_la_force.jpg',
  12: '/tarot/12_le_pendu.jpg',
  13: '/tarot/13_larcane_sans_nom.jpg',
  14: '/tarot/14_temperance.jpg',
  15: '/tarot/15_le_diable.jpg',
  16: '/tarot/16_la_maison_dieu.jpg',
  17: '/tarot/17_letoile.jpg',
  18: '/tarot/18_la_lune.jpg',
  19: '/tarot/19_le_soleil.jpg',
  20: '/tarot/20_le_jugement.jpg',
  21: '/tarot/21_le_monde.jpg',
};

export function getTarotImage(cardId: number): string | null {
  return TAROT_IMAGE_MAP[cardId] ?? null;
}
