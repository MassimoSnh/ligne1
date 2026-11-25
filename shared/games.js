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
    desc: "Survis aux vagues de robots en solo, ou affronte tes collègues : match à mort et domination.",
    rule: "Solo : 100 pts par robot, bonus de vague et de précision. Au général : record solo ÷ 4, + 100 par victoire en multi et + 5 par élimination (plafond 4000).",
    metric: g => `record ${g.best || 0} · ${g.mpWins || 0} victoire${(g.mpWins || 0) > 1 ? "s" : ""} en multi`, rank: "best",
    arcade: g => Math.round((g.best || 0) / 4) + Math.min(4000, (g.mpWins || 0) * 100 + (g.mpKills || 0) * 5) },
  { id: "tour", name: "La Tour", url: "tour/", tag: "Réflexe", color: "#a855f7",
    desc: "Empile les blocs le plus haut possible. Un seul bouton.",
    rule: "1 point par étage. Au général : record × 25.",
    metric: g => `record ${g.best || 0} étages`, rank: "best", arcade: g => (g.best || 0) * 25 }
];
window.ARCADE_WEEK = (d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-S${String(Math.ceil(((t - y) / 864e5 + 1) / 7)).padStart(2, "0")}`; })(new Date());
