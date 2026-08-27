// Genera los sprites de avatar del alumno.
//
// Por qué generados y no de un pack: los 5 avatares de Kenney que se usaban
// antes eran cinco PERSONAJES distintos (silueta, paleta y género distintos),
// enganchados al nivel — así que al subir de tier el alumno "se convertía en
// otra persona", incluso cambiando de género aparente. Acá todos comparten
// EXACTAMENTE la misma silueta y solo cambian de paleta y tocado, así que
// ninguna variante lee como más masculina o femenina que otra: es una
// elección estética del alumno, no una consecuencia de su nivel.
//
// Correr con:  node scripts/generate-avatars.mjs
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "sprites", "avatars");

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// ---------------------------------------------------------------- silueta base
// Una sola silueta para TODOS los avatares. Proporción chibi (cabeza grande,
// cuerpo corto) que es deliberadamente andrógina: sin marcadores de género en
// el torso, sin pelo largo, sin pestañas.
//   .=vacío  #=contorno  h=tocado/pelo  s=piel  e=ojo  b=túnica  a=manga  l=piernas  f=botas
const BASE = [
  "................",
  ".....######.....",
  "....#hhhhhh#....",
  "....#hhhhhh#....",
  "....#ssssss#....",
  "....#sesses#....",
  "....#ssssss#....",
  ".....######.....",
  "....#bbbbbb#....",
  "..###bbbbbb###..",
  "..#aabbbbbbaa#..",
  "..#aabbbbbbaa#..",
  "...##bbbbbb##...",
  "....#ll##ll#....",
  ".....ll..ll.....",
  ".....ff..ff....."
];

/** Variantes de tocado. Cambian solo la zona de la cabeza, nunca la silueta
 * del cuerpo, para que las seis opciones se lean como "la misma persona con
 * distinta ropa" y no como personajes distintos. */
const HEADGEAR = {
  plain: (rows) => rows,
  hood: (rows) => {
    const r = [...rows];
    r[4] = "....#hssssh#....";
    r[5] = "....#hesseh#....";
    r[6] = "....#hssssh#....";
    return r;
  },
  cap: (rows) => {
    const r = [...rows];
    // La visera usa color propio ("c"), no el del pelo: con pelo muy oscuro
    // la gorra se fundía con el contorno y la cabeza quedaba como un borrón.
    r[2] = "....#cccccc#....";
    r[3] = "....#cccccc#....";
    r[4] = "...cccccccccc...";
    return r;
  }
};

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const TRANSPARENT = [0, 0, 0, 0];

// Seis paletas. La túnica usa los colores del juego (ámbar/cian/magenta y
// derivados) para que el avatar no desentone con el resto de la interfaz.
const AVATARS = [
  { id: "brisa",  headgear: "plain", skin: "#e8c39a", hair: "#3b2a1e", tunic: "#5eead4", legs: "#2f6f68", boots: "#1d3b38" },
  { id: "chispa", headgear: "hood",  skin: "#f2d6b3", hair: "#e6e6e6", tunic: "#ff3fa4", legs: "#8f2159", boots: "#4d1330" },
  { id: "duna",   headgear: "cap",   skin: "#8d5a3b", hair: "#1f1712", tunic: "#ffb000", legs: "#8a6300", boots: "#4a3500", cap: "#e0552e" },
  { id: "iris",   headgear: "plain", skin: "#c98d64", hair: "#7a3b1f", tunic: "#8b7bff", legs: "#463c8f", boots: "#26214f" },
  { id: "nimbo",  headgear: "hood",  skin: "#f5e0c8", hair: "#5a4a72", tunic: "#7fd1ff", legs: "#2f6a8f", boots: "#1a3c50" },
  { id: "tizo",   headgear: "cap",   skin: "#6b432c", hair: "#101010", tunic: "#7ee081", legs: "#2f7a3b", boots: "#1a4321", cap: "#d8dee3" }
];

const OUTLINE = "#1a1420";
const EYE = "#141018";

function render(av) {
  const rows = HEADGEAR[av.headgear](BASE);
  const map = {
    "#": hex(OUTLINE),
    h: hex(av.hair),
    c: hex(av.cap ?? av.tunic),
    s: hex(av.skin),
    e: hex(EYE),
    b: hex(av.tunic),
    // La manga es la túnica un poco más oscura, para que el brazo se despegue
    // del torso sin necesidad de otro color en la paleta.
    a: hex(av.tunic).map((v, i) => (i === 3 ? 255 : Math.round(v * 0.72))),
    l: hex(av.legs),
    f: hex(av.boots),
    ".": TRANSPARENT
  };

  const rgba = Buffer.alloc(16 * 16 * 4);
  rows.forEach((row, y) => {
    if (row.length !== 16) throw new Error(`fila ${y} de ${av.id} mide ${row.length}, debe medir 16`);
    [...row].forEach((ch, x) => {
      const c = map[ch];
      if (!c) throw new Error(`carácter desconocido "${ch}" en ${av.id}`);
      const o = (y * 16 + x) * 4;
      rgba[o] = c[0];
      rgba[o + 1] = c[1];
      rgba[o + 2] = c[2];
      rgba[o + 3] = c[3];
    });
  });
  return encodePng(16, 16, rgba);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const av of AVATARS) {
  const file = path.join(OUT_DIR, `${av.id}.png`);
  fs.writeFileSync(file, render(av));
  console.log("✔", path.relative(process.cwd(), file));
}
console.log(`\n${AVATARS.length} avatares generados.`);
