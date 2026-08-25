import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
process.chdir(dirname(fileURLToPath(import.meta.url)))

import fs from 'node:fs'
import { buildInventory, norm } from './inventory.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// asignar-fotos.mjs — Empareja cada fotografía con su producto del inventario.
//
// Las portadas ya fueron LEÍDAS una por una (tools/_portadas-leidas.json), así
// que aquí se compara el título impreso en la caja contra el título del Excel.
// Eso es mucho más fiable que comparar nombres de archivo abreviados.
//
// Aun así, todo lo dudoso se resuelve con el mapa MANUAL de abajo y se revisa
// mirando las hojas de contacto que genera tools/hoja-fotos.mjs.
// ─────────────────────────────────────────────────────────────────────────────

/** Portadas que el lector automático no resolvió o resolvió mal. */
const MANUAL = {
  'requiem.webp': { titulo: 'Resident Evil Requiem', plataforma: 'ps5' },
  'microsd256gb.webp': { titulo: 'MicroSD Kingston Canvas Select Plus 256GB', plataforma: 'switch' },
}

/**
 * Asignaciones forzadas fotografía → producto del inventario, para los casos
 * en que el título leído no coincide literalmente con el del Excel.
 * Clave: archivo · Valor: "<nombre del inventario>|<plataforma>"
 */
const FORZADAS = {
  // El Excel escribe "Resident evil 9"; la caja dice "Resident Evil Requiem"
  'requiem.webp': 'resident evil 9|ps5',
  'RErequiemswitch2.webp': 'resident evil 9|switch2',
  // El Excel abrevia
  'GTA5.webp': 'gta v|ps4',
  'gta5ps5.webp': 'gta v|ps5',
  'grandthefautotrylogy.webp': 'gta trilogy|ps4',
  'thehunter.webp': 'the hunter call of the wild|ps4',
  'SPIDERMAN.webp': 'spiderman version standard|ps4',
  'spidermangoty.webp': 'spiderman goty (codigos vigentes)|ps4',
  'milesmorales.webp': 'spiderman miles morales|ps4',
  'milesmoralesps5.webp': 'spiderman miles morales|ps5',
  'howardslegacy.webp': 'hogwarts legacy|ps5',
  'grimsondeset.webp': 'crimson desert|ps5',
  'thekingoftgthers.webp': 'the king of fighters xiv steelbook con juego|ps4',
  'RAYMANlegens.webp': 'rayman|ps4',
  'REORIGINGSTRYLOGY.webp': 'resident evil origins collection|ps4',
  'NIOH.webp': 'nioh|ps4',
  'p5persons.webp': 'persona 5 - (playstation hits)|ps4',
  'ps5royale.webp': 'persona 5 royal|ps5',
  'p5sswitch.webp': 'persona 5 strikers|switch',
  'elisyum.webp': 'disco elisium|ps4',
  'verge.webp': 'axiom verge 2|ps4',
  'titian.webp': 'attack on titan 1|ps4',
  'thacallisto.webp': 'callisto protocol|ps4',
  'modern.webp': 'call of duty modern warfare|ps4',
  'destroy.webp': 'destroy all humans|ps4',
  'deusex.webp': 'deus ex|ps4',
  'crash.webp': 'crash trilogy|ps4',
  'crashteamracing.webp': 'crash team racing|ps4',
  'nitrofueledswitch.webp': 'crash ctr|switch',
  'bandicoonswitch.webp': 'crash bandicoot n. sane trilogy|switch',
  'bandicoon4switch.webp': "crash bandicoot 4 it's about time|switch",
  'itsabout.webp': 'crash bandicoot 4|ps4',
  'wolong.webp': 'woo long|ps5',
  'wold.webp': 'chronicles of the wolf|switch',
  'nonine.webp': 'nine sols|ps5',
  'shadows.webp': '9 years of shadows|switch',
  '1971.webp': "1971 collector's edition|switch",
  'sh2.webp': 'silent hill 2|ps5',
  'shf.webp': 'silent hill f|ps5',
  'mk1ps5.webp': 'mortal kombat 1|ps5',
  'mk11.webp': 'mortal kombat 11 ultimate|ps5',
  'fantasyvii.webp': 'final fantasy rebirth|ps5',
  'finalfantasyvii.webp': 'final fantasy vii remake intergrade|ps5',
  'firesrubicon.webp': 'armored core|ps5',
  'GOWreloader.webp': 'gears of war|ps5',
  'goodofwar.webp': 'god of war 3|ps4',
  'ragnarok.webp': 'god of war ragnarök|ps5',
  'DOOM.webp': 'doom 2016|ps4',
  'darkages.webp': 'doom: the dark ages|ps5',
  'doomswtich.webp': 'doom|switch',
  'doomclasicswitch.webp': 'doom classic collection|switch',
  'diabloeternalswitch.webp': 'diablo 3|switch',
  'soulstrylogy.webp': 'dark souls trilogy|ps4',
  'darksouls2.webp': 'dark souls 2|ps4',
  'darksoulsswitch.webp': 'dark souls remastered|switch',
  'kakarot.webp': 'dragon ball z kakarot|ps4',
  'kakarontps5.webp': 'dragon ball z kakarot|ps5',
  'kakarotswitch.webp': 'dragon ball z kakarot|switch',
  'dragonquest.webp': 'dragon quest vii|ps5',
  'dragonquestswitch.webp': 'dragon quest i & ii hd-2d remake|switch',
  'dragonquest3switch.webp': 'dragon quest iii hd-2d remake|switch',
  'questswitch.webp': 'dragon quest vii reimagined|switch',
  'questxiswitch.webp': 'dragon quest xi s americano|switch',
  'buildersswitch.webp': 'dragon quest builders|switch',
  'brosudeluxeswtich.webp': 'new super mario bros u deluxe|switch',
  'mariowonderswitch.webp': 'super mario bros. wonder|switch',
  'deluxe8swtich.webp': 'mario kart 8 deluxe|switch',
  'kartworldswitch.webp': 'mario kart world|switch2',
  'mariomarkt2switch.webp': 'super mario maker 2|switch',
  'mario3dswitch.webp': 'super mario 3d all-stars|switch',
  'supermario3dworldswtich.webp': "super mario 3d world + bowser's fury|switch",
  'mariogalaxy1+2switch.webp': 'super mario galaxy 1+2|switch',
  'mariorpgswitch.webp': 'super mario rpg|switch',
  'odysseyswitch.webp': 'super mario odyssey|switch',
  'mariopartyswticjh.webp': 'super mario party|switch',
  'jamboreswitch.webp': 'mario party jamboree|switch',
  'superstarsswitch.webp': 'mario party superstars|switch',
  'mariotenisswitch2.webp': 'mario tennis|switch2',
  'smashbrosswitch.webp': 'super smash bros ultimate|switch',
  'zeldabreathswitch.webp': 'the legend of zelda breath of the wild|switch',
  'zeldaswitch.webp': "the legend of zelda link's awakening|switch",
  'zeldatearsswitch.webp': 'zelda tears of the kingdom|switch',
  'zeldatearswtich2.webp': 'zelda: tears of the kingdom|switch2',
  'pokemonscarletswitch.webp': 'pokémon scarlet|switch',
  'pokemonvioletswitch.webp': 'pokémon violet|switch',
  'pokemonshieldswitch.webp': 'pokémon shield|switch',
  'pokemonshield2switch.webp': 'pokémon shield eu|switch',
  'pokemonshinigswitch.webp': 'pokémon shining pearl|switch',
  'pokemondiamondpearlswitch.webp': 'pokémon shining pearl + brillant diamont|switch',
  'pokemonspaswitch.webp': 'pokémon snap|switch',
  // La caja es Detective Pikachu en japonés, no Leyendas Arceus
  'pokemonswitch.webp': 'detective pikachu jp|switch',
  'pokemonzastich.webp': 'pokémon legends z-a|switch',
  'pkemonza2swirch2.webp': 'pokémon legends z-a switch 2 edition|switch2',
  'pokopiaswitch.webp': 'pokemon pokopia|switch2',
  'kirbyswitch.webp': 'kirby star alliance|switch',
  'kirbyforgottenswitch.webp': 'kirby and the forgotten land|switch',
  'donkeykongswitch.webp': 'donkey kong tropical freeze|switch',
  'xenoblade3switch.webp': 'xenoblade chronicles 3|switch',
  'xenobladexswtich.webp': 'xenoblade chronicles x definitive edition|switch',
  'xsoriginswitch.webp': 'ys origin|switch',
  'xsswirch.webp': 'ys ix|switch',
  'oriswitch.webp': 'ori and the blind forest definitive edition|switch',
  'oriwispswitch.webp': 'ori and the will of the wisps|switch',
  'oricollectionswitch.webp': 'ori collection|switch',
  'endermagnoliaswitch.webp': 'ender magnolia bloom in the mist|switch',
  'magnolia2switch.webp': 'ender magnolia bloom in the mist americano|switch',
  'enderliliesswitch.webp': 'ender lilies|switch',
  'lastfaithswitch.webp': 'the last faith|switch',
  'thalastofus2.webp': 'the last of us 2|ps4',
  'thalastofusremaster.webp': 'the last of us remastered|ps4',
  'thelastofus2.webp': 'the last of us part 1|ps5',
  'thelastofus2remaster.webp': 'the last of us part 2|ps5',
  'metalgearsolid1.webp': 'metal gear solid collection vol 1|ps5',
  'solid1switch.webp': 'metal gear solid collection|switch',
  'ghost.webp': 'ghost of tsushima|ps4',
  'ghostdirectors.webp': "ghost of tsushima director's cut|ps4",
  'ghostoftushimura.webp': "ghost of tsushima director's cut|ps5",
  'ghostyotei.webp': 'ghost of yotei|ps5',
  'horizon.webp': 'horizon zero dawn remastered|ps5',
  'horizonwest.webp': 'horizon forbidden west|ps5',
  'hollowknigth.webp': 'hollow knight|ps4',
  'hollowkinthswitch.webp': 'hollow knight|switch',
  'nierautomata.webp': 'nier automata|ps4',
  'nioh3.webp': 'nioh 3|ps5',
  'niohcollection.webp': 'nioh collection|ps5',
  'jedi.webp': 'star wars jedi fallen order|ps4',
  'SQUADRONS.webp': 'star wars: squadrons (liquidacion)|ps4',
  'reddeadswtich.webp': 'red dead redemption|switch',
  'thewalkingdead.webp': 'the walking dead: the telltale definitive series|ps4',
  'legobatman3.webp': 'lego batman 3|ps4',
  'batmanlego.webp': 'lego batman|ps5',
  '2kdrive.webp': 'lego 2k drive|ps5',
  'batman.webp': 'batman arkham collection|ps4',
  'bioshock.webp': 'bioshock collection|ps4',
  'blasphemus.webp': 'blasphemous deluxe edition|ps4',
  'blasphemusswitch.webp': 'blasphemous deluxe edition|switch',
  'blasphusstwitch.webp': 'blasphemous|switch',
  'blasphemus2.webp': 'blasphemous 2|switch',
  'blasphemuse.webp': 'blasphemous ii|switch',
  'bloodborn.webp': 'bloodborne goty|ps4',
  'bloodborne.webp': 'bloodborne|ps4',
  'bloodtaines.webp': 'bloodstained ritual of the night|switch',
  'blostaines2.webp': 'bloodstained ritual of the night 2|switch',
  'castlevania.webp': 'castlevania dominus collection|switch',
  'castlevanin.webp': 'castlevania advance collection|switch',
  'contra.webp': 'contra rogue corps|switch',
  'control.webp': 'control ultimate edition|ps5',
  'cooked1+2stich.webp': 'overcooked and overcooked 2|switch',
  'creed3.webp': "assasin's creed 3|switch",
  'EZIO.webp': "assasin's creed the ezio collection|ps4",
  'ORIGINS.webp': "assasin's creed origins|ps4",
  'cyberpunk.webp': 'cyberpunk 2077: ultimate edition (promocion)|ps5',
  'RE4.webp': 'resident evil 4 remake (promocion)|ps4',
  'REE4.webp': 'resident evil 4 version clasica|ps4',
  'RE4PS5.webp': 'resident evil 4|ps5',
  'biohazardPS5.webp': 'resident evil 7 biohazard gold edition|ps5',
  'DRDR.webp': 'dead rising remastered|ps5',
  'deadsells.webp': 'dead cells goty (no incluye llavero)|ps4',
  'deadsellsswitch.webp': 'dead cells return to castlevania|switch',
  'deadislan2.webp': 'dead island 2|ps5',
  'stranding2.webp': 'death stranding 2|ps5',
  'expedition33.webp': 'expedition 33|ps5',
  'hellisus.webp': 'hell is us|ps5',
  'hellisusdeluxe.webp': 'hell is us deluxe edition|ps5',
  'fc25ps5.webp': 'fc 25|ps5',
  '2k25.webp': 'nba 2k25|ps5',
  'granturismo7.webp': 'gran turismo 7|ps5',
  'sonicracing.webp': 'sonic racing: crossworlds|ps5',
  'sonicshadow.webp': 'sonic x shadow generations|ps5',
  'megaman.webp': 'megaman star force legacy collection  (liquidacion)|ps5',
  'metaphord.webp': 'metaphor: refantazio launch edition|ps5',
  'likedragon.webp': 'like a dragon: infinite wealth (liquidacion)|ps5',
  'midnigthsuns.webp': 'midnight suns|ps5',
  'mouseps5.webp': 'mouse p.i for hire|ps5',
  'mouseseitch2.webp': 'mouse p.i. for hire|switch2',
  // La caja dice 'Space Marine II': corresponde al 2, no al primero
  'spacemarine.webp': 'space marine 2|ps5',
  'starsfield.webp': 'starfield (liquidacion)|ps5',
  'stellarblade.webp': 'stellar blade|ps5',
  'splitfiction.webp': 'split fiction|ps5',
  'thewitcher3.webp': 'the witcher 3 complete edition usa|ps5',
  'uncharted.webp': 'uncharted collection|ps5',
  'wuchang.webp': 'wuchang|ps5',
  'wukong.webp': 'black myth wukong|ps5',
  'yooka.webp': 'yooka-replaylee|ps5',
  'guardiansofgalaxy.webp': 'guardianes de la galaxia|ps5',
  'godfall.webp': 'god fall|ps5',
  'kena.webp': 'kena|ps5',
  'saros.webp': 'saros|ps5',
  'pragmata.webp': 'pragmata|ps5',
  'beast.webp': 'beast of reincarnation standard|ps5',
  'ARIANA.webp': 'ariana and the elder codex|ps5',
  'blackops7.webp': 'call of duty black ops 7|ps5',
  'blackflag.webp': "assassin's creed black flag resynced|ps5",
  'HALO.webp': 'halo: campaign evolved|ps5',
  'cronos.webp': 'cronos the new dawn|ps5',
  'cronosswitch.webp': 'cronos the new dawn|switch2',
  'terminator.webp': 'terminator 2d: no fate|ps5',
  'soulhackers.webp': 'soul hackers 2|ps5',
  'ultradeluxeswitch2.webp': 'the stanley parable ultra deluxe|switch',
  'elliotswithc.webp': 'the adventure of elliot|switch2',
  'metoridswitch2.webp': 'metroid prime 4|switch2',
  'yoshiswithc.webp': 'yoshi and the misterious book|switch2',
  'ninjagaiden.webp': 'ninja gaiden ragebound|ps5',
  'ninjaswtich.webp': 'ninja gaiden ragebound|switch',
  'MIOswitch.webp': 'mio memories in orbit|switch',
  'moonligthersswitch.webp': 'moonlighter|switch',
  'moonscarsswitch.webp': 'moonscar|switch',
  'neptudiaswitch.webp': 'neptunia sisters vs sisters|switch',
  'nigthmares3switch.webp': 'little nightmares iii|switch',
  'nigthreing.webp': 'elden ring nightrein|ps5',
  'eldenring.webp': 'elden ring|ps5',
  'messengerswitch.webp': 'the messenger|switch',
  'owlboyswitch.webp': 'owlboy|switch',
  'persiaswitch.webp': 'prince of persia the lost crown|switch',
  'rhythmswtich.webp': 'rhythm heaven groove|switch',
  'roguelegacyswtich.webp': 'rogue legacy|switch',
  'samuraijackswitch.webp': 'samurai jack battle through time|switch',
  'seastarsswitch.webp': 'sea of stars|switch',
  'sifuswtich.webp': 'sifu switch|switch',
  'skyrimswitch.webp': 'the elder scrolls v skyrim|switch',
  'sterednnswitch.webp': 'steredenn binary stars|switch',
  'streetswitch.webp': 'streths of rage 4|switch',
  'labyrithswitch.webp': 'shadow labyrinth|switch',
  'higlindswtich.webp': 'highland song|switch',
  'mailmoleswitch.webp': 'mail mole|switch',
  'fistswitch.webp': 'f.i.s.t. forged in shadow torch|switch',
  'fordwardswitch.webp': 'ever foward|switch',
  'kaisenswitch.webp': 'jujutsu kaisen|switch',
  'luigis3switch.webp': "luigi's mansion 3|switch",
  'carrion.webp': 'carrion|switch',
  'cuphead.webp': 'cuphead|ps4',
  'cupheadswitch.webp': 'cuphead|switch',
  'ittakesswitch.webp': 'it takes two|switch',
  'forager.webp': 'forager|ps4',
  'fateexelio.webp': 'fate extella|ps4',
  'devilmaycry.webp': 'devil may cry collection|ps4',
  'maycry5.webp': 'devil may cry 5 special edition|ps5',
  'darksiders3.webp': 'darksiders iii|ps4',
  'fenyxrising.webp': 'immortals fenyx rising|ps4',
  'monsterhunter.webp': 'monster hunter|ps4',
  'rachet.webp': 'ratchet and clank|ps4',
  'spyro.webp': 'spyro|ps4',
  'sekiro.webp': 'sekiro|ps4',
  'talesofberseria.webp': 'tales of berseria|ps4',
  'tekken7.webp': 'tekken 7|ps4',
  'tekken8.webp': 'tekken 8|ps5',
  'titanfall2.webp': 'titanfall 2|ps4',
  'watchdogslegions.webp': 'watch dogs legion|ps4',
  'hitman.webp': 'hitman: world of assassination|ps5',
  'demonssouls.webp': "demon's souls|ps5",
  'baldurgates.webp': "baldur's gate 3|ps5",
  'alanwake2.webp': 'alan wake 2 deluxe edition|ps5',
  'animalcrosing.webp': 'animal crossing new horizons|switch',
  'RE2.webp': 'resident evil 2|ps4',
  'RE2PS5.webp': 'resident evil 2|ps5',
  'RE3PS5.webp': 'resident evil 3|ps5',
  'RErevelations.webp': 'resident evil revelations|ps4',
  'RErevelations2.webp': 'resident evil revelations 2|ps4',
  'GTA5.webp': 'gta v|ps4',
  'grimsondesetdeluxe.webp': 'crimson desert deluxe edition|ps5',
}

/**
 * Fotografías que NO se publican, con el motivo. Revisadas mirando la imagen.
 * La mayoría son juegos que el negocio fotografió pero que no están en el
 * inventario, o copias repetidas del mismo título.
 */
const DESCARTADAS = {
  'minecraftsotyymode.webp':
    'La caja es Minecraft: Story Mode, pero el inventario dice Minecraft Dungeons: son juegos distintos',
  'kongswitch.webp': 'Donkey Kong Bananza (Switch 2) — no está en el inventario',
  'kongcountryswitch.webp': 'Donkey Kong Country: Tropical Freeze — repetida de donkeykongswitch.webp',
  'fifa21.webp': 'FIFA 21 (PS4) — no está en el inventario',
  'madisonswitch.webp': 'MADiSON (Switch) — no está en el inventario',
  'metalslugswitch.webp': 'Metal Slug Tactics (Switch) — no está en el inventario',
  'mk1.webp': 'Mortal Kombat 1 — repetida de mk1ps5.webp',
  'RE3.webp': 'Resident Evil 3 en caja PS4 — el inventario solo lo tiene en PS5',
  'xenobladeswitch.webp': 'Xenoblade Chronicles 3 — repetida de xenoblade3switch.webp',
  'biohazard.webp': 'Resident Evil VII en caja PS4 — el inventario solo lo tiene en PS5',
}

/**
 * El Excel escribe algunos títulos dos veces con distinta grafía. Son el mismo
 * juego, así que comparten fotografía.
 * Clave: producto SIN foto · Valor: producto que SÍ la tiene.
 */
const ALIAS = {
  'zelda: breath of the wild|switch': 'the legend of zelda breath of the wild|switch',
  'skyrim|switch': 'the elder scrolls v skyrim|switch',
  'super mario wonder|switch': 'super mario bros. wonder|switch',
  'super mario galaxy + galaxy 2|switch': 'super mario galaxy 1+2|switch',
  'super mario 3d all-stars nuevo|switch': 'super mario 3d all-stars|switch',
  'animal crossign: new horizons|switch': 'animal crossing new horizons|switch',
  'last faith|switch': 'the last faith|switch',
  'castlevania dominus|switch': 'castlevania dominus collection|switch',
  'resident evil réquiem|ps5': 'resident evil 9|ps5',
  'pokemon za|switch2': 'pokémon legends z-a switch 2 edition|switch2',
  'crash ctr|ps4': 'crash team racing|ps4',
  'super mario bros deluxe|switch': 'new super mario bros u deluxe|switch',
  'final fantasy remake|ps5': 'final fantasy vii remake intergrade|ps5',
}

export { DESCARTADAS, ALIAS }

export function asignar() {
  const inventario = buildInventory()
  const titulos = [...new Map(inventario.map((p) => [norm(p.name) + '|' + p.platform, p])).values()]
  const porClave = new Map(titulos.map((t) => [t.name.toLowerCase() + '|' + t.platform, t]))

  const leidas = JSON.parse(fs.readFileSync('_portadas-leidas.json', 'utf8'))
  const porArchivo = new Map(leidas.map((f) => [f.archivo, f]))
  for (const [archivo, datos] of Object.entries(MANUAL)) {
    porArchivo.set(archivo, { archivo, ...datos, edicion: '', confianza: 'alta' })
  }

  const archivos = fs.readdirSync('../_source/fotos').filter((f) => /.webp$/i.test(f))

  const tri = (s) => {
    const t = ' ' + norm(s) + ' '
    const o = new Set()
    for (let i = 0; i < t.length - 2; i++) o.add(t.slice(i, i + 3))
    return o
  }
  const sim = (a, b) => {
    const A = tri(a)
    const B = tri(b)
    let n = 0
    for (const g of A) if (B.has(g)) n++
    return (2 * n) / (A.size + B.size)
  }

  const resultado = []
  for (const archivo of archivos) {
    const leida = porArchivo.get(archivo)
    if (DESCARTADAS[archivo]) {
      resultado.push({ archivo, titulo: leida?.titulo ?? '', plataforma: leida?.plataforma ?? null, producto: null, platProducto: null, clave: null, score: 0, via: 'descartada' })
      continue
    }
    const forzada = FORZADAS[archivo]
    let producto = null
    let score = 1
    let via = 'forzada'

    if (forzada) {
      producto = porClave.get(forzada) ?? null
      if (!producto) via = 'FORZADA-ROTA'
    } else if (leida) {
      via = 'automatica'
      const cand = titulos
        .filter((t) => leida.plataforma === 'desconocida' || t.platform === leida.plataforma)
        .map((t) => ({ t, s: sim(leida.titulo, t.name) }))
        .sort((a, b) => b.s - a.s)
      if (cand[0] && cand[0].s >= 0.5) {
        producto = cand[0].t
        score = +cand[0].s.toFixed(2)
      } else {
        score = cand[0] ? +cand[0].s.toFixed(2) : 0
        via = 'SIN-COINCIDENCIA'
      }
    } else {
      via = 'SIN-LEER'
    }

    resultado.push({
      archivo,
      titulo: leida?.titulo ?? '',
      plataforma: leida?.plataforma ?? null,
      producto: producto ? producto.name : null,
      platProducto: producto ? producto.platform : null,
      clave: producto ? producto.name.toLowerCase() + '|' + producto.platform : null,
      score,
      via,
    })
  }
  return { resultado, titulos }
}

if (process.argv[1] && process.argv[1].endsWith('asignar-fotos.mjs')) {
  const { resultado, titulos } = asignar()
  const ok = resultado.filter((r) => r.producto)
  const mal = resultado.filter((r) => !r.producto)
  console.log(`fotografías: ${resultado.length} · asignadas: ${ok.length} · sin asignar: ${mal.length}`)

  // Choques: dos fotos al mismo producto
  const cuenta = {}
  for (const r of ok) cuenta[r.clave] = (cuenta[r.clave] || 0) + 1
  const choques = Object.entries(cuenta).filter(([, n]) => n > 1)
  console.log(`\nproductos con más de una foto: ${choques.length}`)
  for (const [k, n] of choques) {
    console.log(`  ${k} ×${n} →`, ok.filter((r) => r.clave === k).map((r) => r.archivo).join(' '))
  }

  console.log('\n── SIN ASIGNAR ──')
  for (const r of mal) console.log(`  ${r.archivo.padEnd(30)} "${r.titulo}" [${r.plataforma}] ${r.via} ${r.score}`)

  const cubiertos = new Set(ok.map((r) => r.clave))
  const sinFoto = titulos.filter((t) => !cubiertos.has(t.name.toLowerCase() + '|' + t.platform))
  console.log(`\ntítulos del inventario SIN foto: ${sinFoto.length} de ${titulos.length}`)
  console.log(sinFoto.map((t) => `${t.name} [${t.platform}]`).join(' | '))

  fs.writeFileSync('_asignacion-fotos.json', JSON.stringify(resultado, null, 1))
}
