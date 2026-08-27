// Avatares elegibles por el alumno. Todos comparten exactamente la misma
// silueta (ver scripts/generate-avatars.mjs) y difieren solo en paleta y
// tocado — ninguna variante está pensada para leerse como más masculina o
// femenina que otra.
//
// IMPORTANTE: el avatar NO depende del nivel. Antes cada tier era un sprite
// de un personaje distinto, así que subir de nivel te convertía literalmente
// en otra persona (y cambiaba el género aparente). Ahora el nivel solo agrega
// efectos visuales encima — ver AURAS abajo y PixelAvatar.vue.

export interface AvatarOption {
  id: string;
  name: string;
  sprite: string;
  /** Color de acento, para bordes/realces en la UI de selección. */
  accent: string;
}

export const AVATARS: AvatarOption[] = [
  { id: "brisa", name: "Brisa", sprite: "/sprites/avatars/brisa.png", accent: "#5eead4" },
  { id: "chispa", name: "Chispa", sprite: "/sprites/avatars/chispa.png", accent: "#ff3fa4" },
  { id: "duna", name: "Duna", sprite: "/sprites/avatars/duna.png", accent: "#ffb000" },
  { id: "iris", name: "Iris", sprite: "/sprites/avatars/iris.png", accent: "#8b7bff" },
  { id: "nimbo", name: "Nimbo", sprite: "/sprites/avatars/nimbo.png", accent: "#7fd1ff" },
  { id: "tizo", name: "Tizo", sprite: "/sprites/avatars/tizo.png", accent: "#7ee081" }
];

export const DEFAULT_AVATAR_ID = AVATARS[0].id;

export function avatarById(id: string | null | undefined): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}

/** Lo que SÍ cambia con el nivel: puro efecto visual alrededor del avatar.
 * Es la progresión estética que reemplaza al cambio de personaje. */
export interface TierAura {
  tier: number;
  /** Color del halo. null = sin halo (nivel inicial). */
  glow: string | null;
  /** Intensidad del resplandor en px. */
  blur: number;
  /** Partículas orbitando el avatar. */
  particles: number;
  /** Marco/plataforma bajo los pies. */
  ring: boolean;
  label: string;
}

export const TIER_AURAS: TierAura[] = [
  { tier: 1, glow: null, blur: 0, particles: 0, ring: false, label: "Sin aura" },
  { tier: 2, glow: "#5eead4", blur: 10, particles: 0, ring: true, label: "Aura tenue" },
  { tier: 3, glow: "#7fd1ff", blur: 14, particles: 3, ring: true, label: "Aura de cazador" },
  { tier: 4, glow: "#ff3fa4", blur: 18, particles: 5, ring: true, label: "Aura arcana" },
  { tier: 5, glow: "#ffb000", blur: 24, particles: 8, ring: true, label: "Aura del archimago" }
];

export function auraForTier(tier: number): TierAura {
  return TIER_AURAS.find((a) => a.tier === tier) ?? TIER_AURAS[0];
}
