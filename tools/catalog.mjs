// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO GOOD GAME — mapeo de recortes → productos
//
// Cada fila describe UN videojuego identificado visualmente en las fotografías
// originales de la carpeta `godogame`. No se inventan precios, stock, ediciones
// ni disponibilidad: eso lo completa el negocio en src/data/products.ts.
//
// Formato: [idRecorte, nombre, género, destacado?, nota?]
//   - idRecorte  → archivo en tools/crops/<id>.png
//   - género     → accion | aventura | rpg | terror | deportes | carreras |
//                  familiar | plataformas | lucha
//   - destacado  → aparece en "Videojuegos destacados" del home
//   - nota       → aclaración honesta cuando la foto no permite confirmar algo
//
// EXCLUIDOS: los títulos marcados con una X roja en las fotos NO se publican.
//            Están listados al final en RETIRADOS para referencia del negocio.
// ─────────────────────────────────────────────────────────────────────────────

export const SHEETS = {
  juegos1: 'switch',
  juegos2: 'switch',
  juegos3: 'ps4',
  juegos4: 'ps4',
  juegos6: 'ps5',
}

export const ROWS = [
  // ── Nintendo Switch (foto 1) ───────────────────────────────────────────────
  ['juegos1-00', 'Kirby Star Allies', 'plataformas'],
  ['juegos1-01', "Luigi's Mansion 3", 'aventura'],
  ['juegos1-02', 'Mario Kart 8 Deluxe', 'carreras', true],
  ['juegos1-03', 'Metal Slug Tactics', 'accion'],
  ['juegos1-04', 'MIO: Memories in Orbit', 'aventura'],
  ['juegos1-05', 'Moonlighter', 'rpg'],
  ['juegos1-06', 'Moonscars', 'accion'],
  ['juegos1-07', 'Neptunia: Sisters VS Sisters', 'rpg'],
  ['juegos1-08', 'New Super Mario Bros. U Deluxe', 'plataformas'],
  ['juegos1-09', 'Ninja Gaiden: Ragebound', 'accion'],
  ['juegos1-10', 'Ori and the Blind Forest: Definitive Edition', 'plataformas'],
  ['juegos1-11', 'Ori and the Will of the Wisps', 'plataformas'],
  ['juegos1-12', 'Owlboy', 'plataformas'],
  ['juegos1-13', 'Leyendas Pokémon: Z-A', 'rpg', true],
  ['juegos1-14', 'Leyendas Pokémon: Z-A — Nintendo Switch 2 Edition', 'rpg'],
  ['juegos1-15', "Pokémon: Let's Go, Eevee!", 'rpg'],
  ['juegos1-16', 'Pokémon Mystery Dungeon: Rescue Team DX', 'rpg'],
  ['juegos1-17', 'Pokémon Scarlet', 'rpg', true],
  ['juegos1-18', 'Pokémon Shield', 'rpg'],
  ['juegos1-19', 'Pokémon Shining Pearl', 'rpg'],
  ['juegos1-20', 'Pokémon Brilliant Diamond & Shining Pearl — Double Pack', 'rpg'],
  ['juegos1-21', 'New Pokémon Snap', 'familiar'],
  ['juegos1-22', 'Pokémon Violet', 'rpg'],
  ['juegos1-23', 'Prince of Persia: The Lost Crown', 'plataformas'],
  ['juegos1-24', 'Resident Evil Requiem — Nintendo Switch 2', 'terror', true],
  ['juegos1-25', 'Rogue Legacy', 'accion'],
  ['juegos1-26', 'Samurai Jack: Battle Through Time', 'accion'],
  ['juegos1-27', 'Sea of Stars', 'rpg'],
  ['juegos1-28', 'Shadow Labyrinth', 'aventura'],
  ['juegos1-29', 'Steredenn: Binary Stars', 'accion'],

  // ── Nintendo Switch (foto 2) ───────────────────────────────────────────────
  ['juegos2-00', 'Super Mario 3D All-Stars', 'plataformas'],
  ['juegos2-01', "Super Mario 3D World + Bowser's Fury", 'plataformas'],
  ['juegos2-02', 'Super Mario Galaxy 1 + 2', 'plataformas'],
  ['juegos2-03', 'Super Mario Maker 2', 'plataformas'],
  ['juegos2-04', 'Super Mario Odyssey', 'plataformas', true],
  ['juegos2-05', 'Super Mario RPG', 'rpg'],
  ['juegos2-06', 'Super Mario Bros. Wonder', 'plataformas', true],
  ['juegos2-07', 'Super Smash Bros. Ultimate', 'lucha', true],
  ['juegos2-08', 'The Elder Scrolls V: Skyrim', 'rpg'],
  ['juegos2-09', 'The Last Faith', 'accion'],
  ['juegos2-10', 'The Legend of Zelda: Breath of the Wild', 'aventura', true],
  ['juegos2-11', "The Legend of Zelda: Link's Awakening", 'aventura'],
  ['juegos2-12', 'The Messenger', 'plataformas'],
  ['juegos2-13', 'Xenoblade Chronicles: Definitive Edition', 'rpg'],
  ['juegos2-14', 'Xenoblade Chronicles 3', 'rpg'],
  ['juegos2-15', 'Ys IX: Monstrum Nox — Pact Edition', 'rpg'],
  ['juegos2-16', 'Yoshi and the Mysterious Book — Nintendo Switch 2', 'plataformas'],
  ['juegos2-17', 'Ys Origin', 'rpg'],

  // ── PlayStation 4 (foto 3) ─────────────────────────────────────────────────
  ['juegos3-00', 'Rayman Legends', 'plataformas'],
  ['juegos3-01', 'Red Dead Redemption II', 'aventura', true],
  ['juegos3-02', 'Resident Evil 2', 'terror'],
  ['juegos3-04', 'Resident Evil 4', 'terror', true],
  ['juegos3-05', 'Resident Evil 4 — Portada clásica', 'terror', false, 'Edición con la portada clásica de la serie. Confirma versión e idioma por WhatsApp.'],
  ['juegos3-06', 'Resident Evil 6', 'terror'],
  ['juegos3-07', 'Resident Evil Origins Collection', 'terror'],
  ['juegos3-08', 'Resident Evil Revelations', 'terror'],
  ['juegos3-09', 'Resident Evil Revelations 2', 'terror'],
  ['juegos3-10', 'Sekiro: Shadows Die Twice', 'accion', true],
  ['juegos3-11', "Marvel's Spider-Man — Game of the Year Edition", 'accion'],
  ['juegos3-12', "Marvel's Spider-Man: Miles Morales", 'accion', true],
  ['juegos3-13', 'Spyro Reignited Trilogy', 'plataformas'],
  ['juegos3-14', 'Star Wars Jedi: Fallen Order', 'accion'],
  ['juegos3-15', 'Star Wars: Squadrons', 'accion'],
  ['juegos3-16', 'Tales of Berseria', 'rpg'],
  ['juegos3-17', 'Tekken 7', 'lucha'],
  ['juegos3-18', 'theHunter: Call of the Wild', 'deportes'],
  ['juegos3-19', 'The King of Fighters XIV', 'lucha'],
  ['juegos3-20', 'The Last of Us Remastered', 'accion'],
  ['juegos3-21', 'The Last of Us Part II', 'accion', true],
  ['juegos3-22', 'The Walking Dead', 'aventura', false, 'Edición exacta por confirmar. Escríbenos y te decimos cuál está disponible.'],
  ['juegos3-23', 'Titanfall 2', 'accion'],
  ['juegos3-24', 'Until Dawn', 'terror'],
  ['juegos3-25', 'Watch Dogs: Legion', 'accion'],

  // ── PlayStation 4 (foto 4) ─────────────────────────────────────────────────
  ['juegos4-00', 'Ghost of Tsushima', 'accion', true],
  ['juegos4-01', "Ghost of Tsushima Director's Cut", 'accion'],
  ['juegos4-02', 'God Eater 3', 'rpg'],
  ['juegos4-03', 'God of War III Remastered', 'accion'],
  ['juegos4-05', 'God of War Ragnarök', 'accion', true],
  ['juegos4-06', 'Grand Theft Auto: The Trilogy — The Definitive Edition', 'accion'],
  ['juegos4-07', 'Grand Theft Auto V — Premium Edition', 'accion'],
  ['juegos4-08', 'Hollow Knight', 'plataformas'],
  ['juegos4-10', 'Immortals Fenyx Rising', 'aventura'],
  ['juegos4-11', 'It Takes Two', 'familiar'],
  ['juegos4-13', 'LEGO Batman 3: Beyond Gotham', 'familiar'],
  ['juegos4-14', 'LittleBigPlanet 3', 'plataformas'],
  ['juegos4-16', 'Minecraft: Story Mode — A Telltale Games Series', 'aventura'],
  ['juegos4-17', 'Monster Hunter: World', 'rpg'],
  ['juegos4-19', 'NieR: Automata', 'rpg'],
  ['juegos4-20', 'NieR Replicant ver.1.22474487139...', 'rpg'],
  ['juegos4-21', 'Nioh', 'rpg'],
  ['juegos4-22', 'Nioh 2', 'rpg'],
  ['juegos4-23', 'Persona 5', 'rpg'],
  ['juegos4-24', 'Ratchet & Clank', 'plataformas'],

  // ── PlayStation 5 (foto 6) ─────────────────────────────────────────────────
  ['juegos6-00', "Assassin's Creed Black Flag Resynced", 'aventura'],
  ['juegos6-01', 'Alan Wake II — Deluxe Edition', 'terror'],
  ['juegos6-02', "Baldur's Gate 3", 'rpg', true],
  ['juegos6-03', 'Crimson Desert', 'aventura'],
  ['juegos6-04', 'Cronos: The New Dawn', 'terror'],
  ['juegos6-05', 'Cyberpunk 2077', 'rpg', true],
  ['juegos6-06', 'Dead Island 2', 'terror'],
  ['juegos6-07', 'Death Stranding 2: On the Beach', 'aventura'],
  ['juegos6-08', "Demon's Souls", 'rpg'],
  ['juegos6-09', 'Devil May Cry 5 Special Edition', 'accion'],
  ['juegos6-10', 'DOOM: The Dark Ages', 'accion'],
  ['juegos6-11', 'Dragon Quest HD-2D Remake', 'rpg', false, 'Entrega exacta de la saga por confirmar. Consúltanos por WhatsApp antes de comprar.'],
  ['juegos6-12', 'Elden Ring', 'rpg', true],
  ['juegos6-13', 'Elden Ring Nightreign', 'rpg'],
  ['juegos6-14', 'Far Cry 6', 'accion'],
  ['juegos6-15', 'EA Sports FC 26', 'deportes', true],
  ['juegos6-16', 'Final Fantasy VII Remake Intergrade', 'rpg'],
  ['juegos6-17', 'Final Fantasy VII Rebirth', 'rpg', true],
  ['juegos6-18', 'Final Fantasy XVI', 'rpg'],
  ['juegos6-19', "Ghost of Tsushima Director's Cut", 'accion'],
  ['juegos6-20', 'God of War Ragnarök', 'accion', true],
  ['juegos6-21', 'Grand Theft Auto V', 'accion'],
  ['juegos6-22', 'Hitman: World of Assassination', 'accion'],
  ['juegos6-23', 'Hogwarts Legacy', 'rpg', true],
  ['juegos6-24', 'Horizon Forbidden West', 'aventura'],
]

// Títulos marcados con X roja en las fotografías → NO se publican como disponibles.
export const RETIRADOS = [
  ['juegos3-03', 'Resident Evil 3', 'ps4'],
  ['juegos4-04', 'God of War (2018)', 'ps4'],
  ['juegos4-09', 'Horizon Zero Dawn', 'ps4'],
  ['juegos4-12', 'Kena: Bridge of Spirits', 'ps4'],
  ['juegos4-15', 'Mega Man X Legacy Collection 1+2', 'ps4'],
  ['juegos4-18', 'Need for Speed Payback', 'ps4'],
]
