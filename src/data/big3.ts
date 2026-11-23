// v15 — Écran « Big 3 » post-onboarding. Textes fixes (zéro LLM), voix Céleste :
// tutoiement, concret, bienveillant, jamais de jargon non expliqué.

export const SUN_TEXT: Record<string, string> = {
  'Bélier': "Tu avances d'abord, tu réfléchis en marchant. Ton énergie démarre ce que les autres hésitent à lancer.",
  'Taureau': "Tu construis lentement, mais pour de vrai. Ce que tu aimes, tu le gardes — et ça te rend solide.",
  'Gémeaux': "Ta tête ne s'arrête jamais. Tu relies les idées et les gens comme personne.",
  'Cancer': "Tu ressens tout, souvent avant les autres. Ton instinct de protéger est ta vraie force.",
  'Lion': "Tu as besoin de briller, et c'est sain. Quand tu crois en quelque chose, tu entraînes tout le monde.",
  'Vierge': "Tu vois le détail qui cloche et tu sais comment le réparer. Ton soin des choses, c'est ta façon d'aimer.",
  'Balance': "Tu cherches l'équilibre partout — dans les liens, les choix, la beauté. Tu apaises sans t'en rendre compte.",
  'Scorpion': "Tu ne fais rien à moitié. Tu vas au fond des choses, et des gens, là où d'autres restent en surface.",
  'Sagittaire': "Tu as besoin d'horizon. Le sens, la liberté, l'aventure — c'est ce qui te garde vivant·e.",
  'Capricorne': "Tu sais où tu vas, même si tu ne le dis pas. Ta patience finit toujours par payer.",
  'Verseau': "Tu penses à côté, et c'est précieux. Tu as besoin d'être libre pour donner le meilleur de toi.",
  'Poissons': "Tu captes ce qui ne se dit pas. Ton imagination et ta sensibilité sont un radar rare.",
};

export const MOON_TEXT: Record<string, string> = {
  'Bélier': "Tes émotions arrivent vite et fort — et repartent aussi vite. Tu as besoin d'agir pour te sentir mieux.",
  'Taureau': "Tu te sens en sécurité avec du concret : un repas, un câlin, une routine. Le calme te recharge.",
  'Gémeaux': "Tu as besoin de mettre des mots sur ce que tu ressens. Parler, écrire, c'est ta façon de digérer.",
  'Cancer': "Tu as besoin d'un nid et de gens sûrs. Quand tu te sens aimé·e, tu donnes sans compter.",
  'Lion': "Tu as besoin de te sentir vu·e et apprécié·e. Un mot sincère te réchauffe pour la semaine.",
  'Vierge': "Tu te rassures en mettant de l'ordre. Une liste, un rangement, et ta tête respire à nouveau.",
  'Balance': "Les conflits te pèsent plus qu'aux autres. Tu as besoin d'harmonie pour te sentir bien.",
  'Scorpion': "Tu ressens intensément et tu ne le montres pas toujours. La confiance, chez toi, se gagne.",
  'Sagittaire': "Tu as besoin d'air et d'optimisme. Quand ça va mal, bouger ou apprendre te fait du bien.",
  'Capricorne': "Tu gardes beaucoup pour toi. Te sentir utile et maître de ta vie t'apaise.",
  'Verseau': "Tu prends du recul sur tes émotions. Tu as besoin d'espace — et d'être accepté·e tel·le que tu es.",
  'Poissons': "Tu absorbes l'humeur des autres comme une éponge. La musique, l'eau, le rêve te ramènent à toi.",
};

export const RISING_TEXT: Record<string, string> = {
  'Bélier': "On te voit direct·e, vif·ve, prêt·e à foncer. Tu fais le premier pas, et ça donne envie aux autres d'en faire autant.",
  'Taureau': "On te voit calme, rassurant·e, ancré·e. Ta présence apaise — on se sent en sécurité à côté de toi.",
  'Gémeaux': "On te voit curieux·se, drôle, toujours en mouvement. Tu mets les gens à l'aise en deux phrases.",
  'Cancer': "On te voit doux·ce, attentionné·e, un peu réservé·e au début. Ceux qui t'approchent découvrent une vraie chaleur.",
  'Lion': "On te remarque : chaleur, présence, charisme. Tu illumines une pièce sans forcément le chercher.",
  'Vierge': "On te voit posé·e, précis·e, fiable. On vient vers toi quand il faut que les choses soient bien faites.",
  'Balance': "On te trouve charmant·e, élégant·e, facile à vivre. Tu sais créer l'harmonie là où tu passes.",
  'Scorpion': "On te sent magnétique, intense, difficile à cerner. Tu attires sans rien dire, et on veut te connaître.",
  'Sagittaire': "On te voit ouvert·e, enthousiaste, plein·e d'humour. Avec toi, tout semble possible.",
  'Capricorne': "On te voit sérieux·se, mature, solide. On te confie les responsabilités sans hésiter.",
  'Verseau': "On te trouve original·e, différent·e, un peu insaisissable. Tu fais réfléchir les gens autrement.",
  'Poissons': "On te voit rêveur·se, empathique, doux·ce. On se confie à toi sans même s'en rendre compte.",
};
