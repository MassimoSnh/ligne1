/* Liste des jeux de l'arcade et leur système de points.
   "arcade" = ce que le jeu apporte au classement général. */
window.ARCADE_GAMES = [
  { id: "ligne1", name: "Ligne 1", url: "ligne1/", tag: "Automatisme", color: "#f2b705",
    desc: "Programme 20 machines en ladder : convoyeurs, robots, sécurités.",
    rule: "100 pts par étoile + bonus de vitesse, meilleur score par niveau.",
    metric: g => `${g.points || 0} pts · ${g.stars || 0}★`, rank: "points", arcade: g => g.points || 0 },
  { id: "volt", name: "Volt", url: "volt/", tag: "Plateforme", color: "#38bdf8",
    desc: "Saut, saut de mur et dash : 12 niveaux de précision.",
    rule: "50 pts par niveau fini + 100 par étoile + bonus chrono.",
    metric: g => `${g.points || 0} pts · ${g.stars || 0}★`, rank: "points", arcade: g => g.points || 0 },
  { id: "casino", name: "Le Casino", url: "casino/", tag: "Hasard", color: "#e11d48",
    desc: "Roulette, blackjack et machine à sous. 100 coins offerts chaque lundi.",
    rule: "Classement des coins de la semaine. Au général : ton meilleur gain au-delà des 100 coins offerts (max 3 000).",
    metric: g => `${g.coins ?? 0} coins (${g.week || "—"})`, rank: "coins", weekly: true, arcade: g => Math.min(3000, Math.max(0, (g.record || 0) - 100)) },
  { id: "tir", name: "Bloc Assaut", url: "tir/", tag: "Tir 3D", color: "#22c55e",
    desc: "5 armes, des robots qui tirent et un boss toutes les 5 vagues. Ou affronte tes collègues : match à mort et domination.",
    rule: "Solo : 100 pts par robot, bonus de vague et de précision. Au général : record solo ÷ 4, + 100 par victoire en multi et + 5 par élimination (plafond 4000).",
    metric: g => `record ${g.best || 0} · ${g.mpWins || 0} victoire${(g.mpWins || 0) > 1 ? "s" : ""} en multi`, rank: "best",
    arcade: g => Math.round((g.best || 0) / 4) + Math.min(4000, (g.mpWins || 0) * 100 + (g.mpKills || 0) * 5) },
  { id: "tour", name: "La Tour", url: "tour/", tag: "Réflexe", color: "#a855f7",
    desc: "Empile les blocs le plus haut possible. Un seul bouton.",
    rule: "1 point par étage. Au général : record × 25.",
    metric: g => `record ${g.best || 0} étages`, rank: "best", arcade: g => (g.best || 0) * 25 },
  { id: "blast", name: "Blast", url: "blast/", tag: "Arène · 2 à 4", color: "#f97316",
    desc: "Pose des bombes, casse les caisses, piège tes collègues. Ou entraîne-toi contre 3 robots.",
    rule: "Multi : 120 pts par partie gagnée, 15 par collègue piégé. Solo : 25 pts par victoire contre les robots. Au général : le tout, plafonné à 5 000.",
    metric: g => `${g.wins || 0} victoire${(g.wins || 0) > 1 ? "s" : ""} · ${g.kills || 0} pièges`, rank: "wins",
    arcade: g => Math.min(5000, (g.wins || 0) * 120 + (g.kills || 0) * 15 + Math.min(1000, (g.botWins || 0) * 25)) },
  { id: "fenwick", name: "Course de Fenwick", url: "fenwick/", tag: "Course · 1 à 8", color: "#eab308",
    desc: "Course de chariots élévateurs dans l'entrepôt : turbo, flaques d'huile et palettes.",
    rule: "Multi : 150 pts la victoire, 80 la 2e place, 40 la 3e. Solo : chrono sur 3 tours. Au général : courses + bonus chrono (max 1 500), plafonné à 6 000.",
    metric: g => `${g.wins || 0} victoire${(g.wins || 0) > 1 ? "s" : ""}${g.bestLap ? ` · meilleur tour ${(g.bestLap / 1000).toFixed(2)} s` : ""}`, rank: "wins",
    arcade: g => Math.min(6000, (g.wins || 0) * 150 + (g.seconds || 0) * 80 + (g.thirds || 0) * 40 + (g.bestLap ? Math.max(0, Math.min(1500, Math.round((40000 - g.bestLap) / 10))) : 0)) },
  { id: "dessin", name: "Dessine et devine", url: "dessin/", tag: "Ambiance · 2 à 10", color: "#ec4899",
    desc: "Un collègue dessine, les autres devinent dans le chat. Le plus rapide marque le plus.",
    rule: "Trouver vite rapporte jusqu'à 100 pts, faire deviner son dessin 25 pts par collègue qui trouve. Au général : la moitié de tes points cumulés, plafonné à 5 000.",
    metric: g => `${g.points || 0} pts · ${g.wins || 0} victoire${(g.wins || 0) > 1 ? "s" : ""}`, rank: "points",
    arcade: g => Math.min(5000, Math.round((g.points || 0) / 2)) },
  { id: "rando", name: "La Rando Folle", url: "rando/", tag: "Course d'obstacles · 2 à 8", color: "#4ade80",
    desc: "Des petites grenouilles en pleine nature : rondins, rochers, pont qui s'effondre, puis la finale des nénuphars.",
    rule: "Multi : 300 pts la couronne, 80 par finale, 30 par manche passée. Solo : 60 pts par couronne contre les robots. Au général : le tout, plafonné à 5 000.",
    metric: g => `${g.wins || 0} couronne${(g.wins || 0) > 1 ? "s" : ""} · ${g.finals || 0} finale${(g.finals || 0) > 1 ? "s" : ""}`, rank: "wins",
    arcade: g => Math.min(5000, (g.wins || 0) * 300 + (g.finals || 0) * 80 + (g.quals || 0) * 30 + Math.min(1200, (g.soloWins || 0) * 60)) },
  { id: "garou", name: "Loup-Garou", url: "garou/", tag: "Bluff · 4 à 10", color: "#dc2626",
    desc: "Un village la nuit : fais tes tâches, démasque les loups-garous… ou dévore les villageois sans te faire voir.",
    rule: "Multi : 200 pts par victoire (+100 si tu étais loup-garou), 10 par tâche faite. Solo : 50 pts par victoire. Au général : le tout, plafonné à 5 000.",
    metric: g => `${g.wins || 0} victoire${(g.wins || 0) > 1 ? "s" : ""} · ${g.wolfWins || 0} en loup`, rank: "wins",
    arcade: g => Math.min(5000, (g.wins || 0) * 200 + (g.wolfWins || 0) * 100 + (g.tasks || 0) * 10 + Math.min(1000, (g.soloWins || 0) * 50)) }
];
window.ARCADE_WEEK = (d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0")}`; })(new Date());

// Défis de la semaine : 3 défis tirés selon la semaine, comptés à partir du lundi
window.ARCADE_DEFIS = [
  { id: "tir-kills", txt: "Détruis 40 robots à Bloc Assaut", key: "tir.kills", need: 40, pts: 200, game: "tir" },
  { id: "tir-mp", txt: "Fais 10 éliminations en multi à Bloc Assaut", key: "tir.mpKills", need: 10, pts: 250, game: "tir" },
  { id: "blast-bots", txt: "Bats les 3 robots à Blast", key: "blast.botWins", need: 1, pts: 150, game: "blast" },
  { id: "blast-kills", txt: "Piège 5 collègues à Blast", key: "blast.kills", need: 5, pts: 200, game: "blast" },
  { id: "fen-races", txt: "Termine 3 courses de Fenwick", key: "fenwick.races", need: 3, pts: 150, game: "fenwick" },
  { id: "fen-win", txt: "Gagne une course de Fenwick en multi", key: "fenwick.wins", need: 1, pts: 250, game: "fenwick" },
  { id: "dessin-pts", txt: "Marque 200 points à Dessine et devine", key: "dessin.points", need: 200, pts: 200, game: "dessin" },
  { id: "tour-play", txt: "Joue 10 parties de La Tour", key: "tour.played", need: 10, pts: 100, game: "tour" },
  { id: "l1-stars", txt: "Gagne 3 étoiles de plus à Ligne 1", key: "ligne1.stars", need: 3, pts: 200, game: "ligne1" },
  { id: "volt-stars", txt: "Gagne 3 étoiles de plus à Volt", key: "volt.stars", need: 3, pts: 200, game: "volt" },
  { id: "tir-games", txt: "Joue 3 parties de Bloc Assaut", key: "tir.games", need: 3, pts: 100, game: "tir" },
  { id: "dessin-games", txt: "Joue 2 parties de Dessine et devine", key: "dessin.games", need: 2, pts: 150, game: "dessin" },
  { id: "rando-final", txt: "Atteins 2 finales de La Rando Folle", key: "rando.finals", need: 2, pts: 200, game: "rando" },
  { id: "rando-games", txt: "Joue 3 parties de La Rando Folle en multi", key: "rando.games", need: 3, pts: 150, game: "rando" },
  { id: "garou-games", txt: "Joue 3 parties de Loup-Garou en multi", key: "garou.games", need: 3, pts: 150, game: "garou" },
  { id: "garou-tasks", txt: "Fais 15 tâches de villageois au Loup-Garou", key: "garou.tasks", need: 15, pts: 200, game: "garou" }
];
window.ARCADE_DEFIS_OF = week => {
  let h = 0; for (const c of week) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pool = window.ARCADE_DEFIS.slice(), out = [], used = new Set();
  while (out.length < 3 && pool.length) { h = (h * 1103515245 + 12345) >>> 0; const d = pool.splice(h % pool.length, 1)[0]; if (used.has(d.game) && pool.some(x => !used.has(x.game))) { pool.push(d); continue; } used.add(d.game); out.push(d); }
  return out;
};
window.ARCADE_STAT = (games, key) => { const [g, k] = key.split("."); return (games && games[g] && +games[g][k]) || 0; };
