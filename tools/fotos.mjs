// ─────────────────────────────────────────────────────────────────────────────
// fotos.mjs — Qué fotografía le corresponde a cada producto del inventario.
//
// El emparejamiento automático por nombre falla en una tienda de videojuegos
// (asignaba la portada de "God Eater 3" a "God of war 3"), así que este mapa
// está REVISADO A MANO uno por uno mirando cada recorte.
//
// Clave  : "<nombre exacto del inventario>|<plataforma>"  en minúsculas
// Valor  : id del recorte en tools/crops/<id>.png
//
// Una misma fotografía puede servir a dos productos (copia nueva y copia usada
// del mismo título, o el mismo juego escrito de dos formas en el Excel).
// Los títulos que no aparecen aquí se publican sin fotografía, con una portada
// de marca generada por la web. NUNCA se usa la portada de otro juego.
// ─────────────────────────────────────────────────────────────────────────────

export const FOTOS = {
  // ── PlayStation 4 ─────────────────────────────────────────────────────────
  'ghost of tsushima|ps4': 'juegos4-00',
  "ghost of tsushima director's cut|ps4": 'juegos4-01',
  'god of war 3|ps4': 'juegos4-03',
  'gta trilogy|ps4': 'juegos4-06',
  'gta v|ps4': 'juegos4-07',
  'hollow knight|ps4': 'juegos4-08',
  'immortals fenyx rising|ps4': 'juegos4-10',
  'it takes two|ps4': 'juegos4-11',
  'lego batman 3|ps4': 'juegos4-13',
  'monster hunter|ps4': 'juegos4-17',
  'nier automata|ps4': 'juegos4-19',
  'nioh|ps4': 'juegos4-21',
  'persona 5 - (playstation hits)|ps4': 'juegos4-23',
  'ratchet and clank|ps4': 'juegos4-24',
  'rayman|ps4': 'juegos3-00',
  'red dead redemption 2 (sin mapa)|ps4': 'juegos3-01',
  'resident evil 2|ps4': 'juegos3-02',
  'resident evil 4 remake (promocion)|ps4': 'juegos3-04',
  'resident evil 4 version clasica|ps4': 'juegos3-05',
  'resident evil origins collection|ps4': 'juegos3-07',
  'resident evil revelations|ps4': 'juegos3-08',
  'resident evil revelations 2|ps4': 'juegos3-09',
  'sekiro|ps4': 'juegos3-10',
  'spiderman goty (codigos vigentes)|ps4': 'juegos3-11',
  'spiderman miles morales|ps4': 'juegos3-12',
  'spyro|ps4': 'juegos3-13',
  'star wars jedi fallen order|ps4': 'juegos3-14',
  'star wars: squadrons (liquidacion)|ps4': 'juegos3-15',
  'tales of berseria|ps4': 'juegos3-16',
  'tekken 7|ps4': 'juegos3-17',
  'the hunter call of the wild|ps4': 'juegos3-18',
  'the king of fighters xiv steelbook con juego|ps4': 'juegos3-19',
  'the last of us remastered|ps4': 'juegos3-20',
  'the last of us 2|ps4': 'juegos3-21',
  'the walking dead: the telltale definitive series|ps4': 'juegos3-22',
  'titanfall 2|ps4': 'juegos3-23',
  'watch dogs legion|ps4': 'juegos3-25',

  // ── PlayStation 5 ─────────────────────────────────────────────────────────
  'alan wake 2 deluxe edition|ps5': 'juegos6-01',
  "assassin's creed black flag resynced|ps5": 'juegos6-00',
  "baldur's gate 3|ps5": 'juegos6-02',
  'crimson desert|ps5': 'juegos6-03',
  'cronos the new dawn|ps5': 'juegos6-04',
  'dead island 2|ps5': 'juegos6-06',
  'death stranding 2|ps5': 'juegos6-07',
  "demon's souls|ps5": 'juegos6-08',
  'devil may cry 5 special edition|ps5': 'juegos6-09',
  'doom: the dark ages|ps5': 'juegos6-10',
  'dragon quest vii|ps5': 'juegos6-11',
  'elden ring|ps5': 'juegos6-12',
  'elden ring nightrein|ps5': 'juegos6-13',
  'final fantasy vii remake intergrade|ps5': 'juegos6-16',
  'final fantasy rebirth|ps5': 'juegos6-17',
  "ghost of tsushima director's cut|ps5": 'juegos6-19',
  'god of war ragnarök|ps5': 'juegos6-20',
  'gta v|ps5': 'juegos6-21',
  'hitman: world of assassination|ps5': 'juegos6-22',
  'hogwarts legacy|ps5': 'juegos6-23',
  'horizon zero dawn remastered|ps5': 'juegos6-24',

  // ── Nintendo Switch ───────────────────────────────────────────────────────
  'kirby star alliance|switch': 'juegos1-00',
  "luigi's mansion 3|switch": 'juegos1-01',
  'mario kart 8 deluxe|switch': 'juegos1-02',
  'mio memories in orbit|switch': 'juegos1-04',
  'moonlighter|switch': 'juegos1-05',
  'moonscar|switch': 'juegos1-06',
  'neptunia sisters vs sisters|switch': 'juegos1-07',
  'new super mario bros u deluxe|switch': 'juegos1-08',
  'ninja gaiden ragebound|switch': 'juegos1-09',
  'ori and the blind forest definitive edition|switch': 'juegos1-10',
  'ori and the will of the wisps|switch': 'juegos1-11',
  'owlboy|switch': 'juegos1-12',
  'pokémon legends z-a|switch': 'juegos1-13',
  'pokémon scarlet|switch': 'juegos1-17',
  'pokémon shield|switch': 'juegos1-18',
  'pokémon shining pearl|switch': 'juegos1-19',
  'pokémon shining pearl + brillant diamont|switch': 'juegos1-20',
  'pokémon snap|switch': 'juegos1-21',
  'pokémon violet|switch': 'juegos1-22',
  'prince of persia the lost crown|switch': 'juegos1-23',
  'rogue legacy|switch': 'juegos1-25',
  'samurai jack battle through time|switch': 'juegos1-26',
  'sea of stars|switch': 'juegos1-27',
  'shadow labyrinth|switch': 'juegos1-28',
  'steredenn binary stars|switch': 'juegos1-29',
  'super mario 3d all-stars|switch': 'juegos2-00',
  'super mario 3d all-stars nuevo|switch': 'juegos2-00',
  "super mario 3d world + bowser's fury|switch": 'juegos2-01',
  'super mario galaxy 1+2|switch': 'juegos2-02',
  'super mario galaxy + galaxy 2|switch': 'juegos2-02',
  'super mario maker 2|switch': 'juegos2-03',
  'super mario odyssey|switch': 'juegos2-04',
  'super mario rpg|switch': 'juegos2-05',
  'super mario bros. wonder|switch': 'juegos2-06',
  'super mario wonder|switch': 'juegos2-06',
  'super smash bros ultimate|switch': 'juegos2-07',
  'the elder scrolls v skyrim|switch': 'juegos2-08',
  'skyrim|switch': 'juegos2-08',
  'the last faith|switch': 'juegos2-09',
  'last faith|switch': 'juegos2-09',
  'the legend of zelda breath of the wild|switch': 'juegos2-10',
  'zelda: breath of the wild|switch': 'juegos2-10',
  "the legend of zelda link's awakening|switch": 'juegos2-11',
  'the messenger|switch': 'juegos2-12',
  'xenoblade chronicles 3|switch': 'juegos2-14',
  'ys ix|switch': 'juegos2-15',
  'ys origin|switch': 'juegos2-17',

  // ── Nintendo Switch 2 ─────────────────────────────────────────────────────
  'pokémon legends z-a switch 2 edition|switch2': 'juegos1-14',
  'resident evil 9|switch2': 'juegos1-24',
  'yoshi and the misterious book|switch2': 'juegos2-16',
}

// ─────────────────────────────────────────────────────────────────────────────
// Recortes que NO se usan: el título no está en el inventario actual, o la
// edición del inventario no coincide con la caja fotografiada.
// Se conservan en tools/crops/ para cuando el negocio los vuelva a tener.
// ─────────────────────────────────────────────────────────────────────────────
export const FOTOS_SIN_USO = {
  'juegos1-03': 'Metal Slug Tactics — no está en el inventario',
  'juegos1-15': "Pokémon: Let's Go, Eevee! — no está en el inventario",
  'juegos1-16': 'Pokémon Mystery Dungeon: Rescue Team DX — no está en el inventario',
  'juegos2-13': 'Xenoblade Chronicles: Definitive Edition — el inventario tiene la X, que es otro juego',
  'juegos3-06': 'Resident Evil 6 — no está en el inventario',
  'juegos3-24': 'Until Dawn — no está en el inventario',
  'juegos4-02': 'God Eater 3 — no está en el inventario',
  'juegos4-05': 'God of War Ragnarök (caja PS4) — el inventario solo lo tiene en PS5',
  'juegos4-14': 'LittleBigPlanet 3 — no está en el inventario',
  'juegos4-16': 'Minecraft: Story Mode — el inventario tiene Minecraft Dungeons, otro juego',
  'juegos4-20': 'NieR Replicant — no está en el inventario',
  'juegos4-22': 'Nioh 2 — el inventario tiene Nioh 3 y Nioh Collection, en PS5',
  'juegos6-05': 'Cyberpunk 2077 (edición estándar) — el inventario tiene la Ultimate Edition',
  'juegos6-14': 'Far Cry 6 — no está en el inventario',
  'juegos6-15': 'EA Sports FC 26 — el inventario tiene FC 25, que es otro año',
  'juegos6-18': 'Final Fantasy XVI — no está en el inventario',
}

/** Productos del inventario que son accesorios, no videojuegos. */
export const ACCESORIOS = new Set([
  'control xbox negro|xbox',
  'microsd kingston canvas select plus 256gb|switch',
])
