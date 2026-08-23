# C++ Quest — Aula Invertida

Juego web tipo Habitica/Pokémon para practicar debugging de C++ en un contexto de
**aula invertida**: los alumnos leen el material antes de clase, y en clase (o en casa)
arreglan código roto para subir de nivel a su personaje. Hecho en **Nuxt 3 + Vue 3 SFCs**,
100% client-side (sin backend), estado en `localStorage`.

**Producción:** https://cpp-quest-zottards-projects.vercel.app
**Repo Vercel:** proyecto `cpp-quest` en el team `zottards-projects`, deployado con el
MCP de Vercel (`deploy_to_vercel`), no vía Git push automático — cualquier cambio requiere
un nuevo deploy manual con el árbol de archivos completo.

---

## 1. Alcance de contenido (importante)

El curso que cubre este juego es **Programación 1**, y **solo** entra:
- Operadores (asignación vs. comparación, módulo vs. división, aritméticos)
- Ciclos `for` (las tres partes, condición de corte, incremento/decremento)
- Vectores/arrays (recorrido, límites, búsqueda lineal)

**Explícitamente fuera de alcance** (no agregar ejercicios de esto): archivos, punteros,
memoria dinámica (`new`/`delete`), paso por referencia, objetos, clases, polimorfismo.
Hubo una versión anterior con ejercicios de punteros/memoria que se sacó por esto — si
ves referencias viejas a "Ingeniero de Punteros" o similar en código legado, es un bug,
ya se corrigió a "Ingeniero de Vectores"/"Arquitecto de Ciclos" en `data/tiers.ts`.

---

## 2. Arquitectura de datos

### `data/modules.ts` — los 3 "tipos" de batalla
Cada tema del curso es un `Topic` (`"operadores" | "ciclos" | "vectores"`) y también un
"tipo" al estilo Pokémon para el sistema de batalla. Cada módulo tiene color, sprite de
enemigo y descripción.

### `data/exercises.ts` — las 7 misiones
Array de `Exercise`, cada una con `topic` (a qué módulo pertenece), `bugs[]` (cada bug
tiene un regex/función `test(code)` que valida si el alumno lo arregló), briefing HTML,
y código roto inicial. La misión 7 tiene `boss: true` y 2 bugs (combina ciclos+vectores+operadores).

### `data/items.ts` — armas, armaduras, mascotas
Las armas tienen `affinity` (`Topic | "universal"`): si coincide con el tema del ejercicio
activo, el golpe es "muy efectivo" (+50% XP). La daga es neutral, Excálibur es universal
(siempre efectiva). Armas y armaduras tienen `image` (sprite PNG en `/public/sprites`)
que se dibuja superpuesto sobre el avatar (ver `PixelAvatar.vue`).

### `data/tiers.ts` — niveles del personaje
5 tiers por rango de nivel, cada uno con su propio sprite de avatar completo (no hay
"capas" de ropa — cada tier es una imagen distinta).

### `composables/useGameState.ts` — el cerebro
Singleton reactivo (`reactive()` a nivel de módulo, no un store de Pinia) compartido por
toda la app. Acá vive: XP, nivel, equipo, misiones resueltas, `checkCode()` (valida el
código contra los bugs de la misión activa), `typeEffectiveness()` (el multiplicador
Pokémon-style). Persiste todo a `localStorage` bajo la key `cppQuestSave_v2`.

**Detalle importante de `checkCode()`:** solo resuelve **un bug por click** en
"Compilar" (hay un `break` después del primer bug que matchea), aunque el código ya
arregle varios bugs a la vez. Esto es a propósito: si no, un jefe de 2 bugs muere en un
solo click y la ventaja de tipo nunca se nota (esto fue un bug real que un usuario reportó
y se corrigió). Si el alumno ya arregló todo, solo necesita apretar "Compilar" de nuevo
para que se registre el siguiente bug — el código no se toca ni se resetea.

---

## 3. Sistema de batalla (`BattleHUD.vue`)

Aparece arriba de la lista de misiones. Muestra al personaje (con arma/armadura
equipada, visibles superpuestas) vs. un enemigo del color/sprite del módulo activo.
La barra de HP del enemigo baja según el % de XP de bugs restantes en la misión. Al
resolver un bug: animación de golpe (GSAP) + shake del enemigo + toast "⚡ ¡Es muy
efectivo!" si la ventaja de tipo aplica. Al fallar el compile: el personaje recibe un
shake de "hurt". Al completar la misión: el enemigo se desvanece.

No hay un HP pool independiente del recuento de bugs — el "combate" está 1:1 atado a
cuántos bugs le quedan a la misión. Es una limitación conocida (ver sección 6).

---

## 4. Componentes clave

| Componente | Rol |
|---|---|
| `PixelAvatar.vue` | Sprite del personaje según tier + arma/armadura superpuestas (props `armorImage`, `weaponImage`), estados `attacking`/`hurt`/`leveling` |
| `BattleHUD.vue` | La escena de batalla arriba de las misiones |
| `QuestTabs.vue` | Navegación agrupada por módulo (con color por tema) + jefe final aparte |
| `QuestCard.vue` | El editor de código + botón Compilar/Reiniciar |
| `BugList.vue` | Lista de bugs de la misión activa, con pistas |
| `CharacterPanel.vue` | Panel lateral: avatar, nivel, XP, badges, equipo, skills |
| `EquipmentPanel.vue` | Selector de arma/armadura/mascota |
| `SkillTree.vue` | Habilidades pasivas (bonus de XP, descuento de pistas) |
| `LevelUpModal.vue` | Modal de subida de nivel (timeline GSAP: flash + shake + pop) |
| `ConfettiLayer.vue` | Confetti físico (canvas-confetti) en hits/completar/subir nivel |

Todo se comunica vía `composables/useEventBus.ts` (bus de eventos mínimo, sin librería),
eventos: `solved`, `wrong`, `complete`, `levelup`, `skillUnlocked`, `openOnboarding`.

---

## 5. Assets

Los sprites (`public/sprites/`) son de **Kenney's Roguelike Characters pack** (CC0,
`public/sprites/KENNEY_LICENSE.txt`), bajados de un repo GitHub que los vendorea (no
hay acceso directo a itch.io/kenney.nl desde este entorno). Los avatares por tier son
personajes premade del spritesheet; las armas son íconos de espada recortados; los
"enemigos" de cada módulo son sprites recoloreados/compuestos a mano con Python/PIL
(bichos tipo robot con antenas, un color por módulo) porque no se encontró un pack CC0
de monstruos accesible.

Las **mascotas** (`PetSprite.vue`) NO son sprites — son `div`s de CSS puro (igual que el
avatar viejo pre-Kenney). Quedó así por tiempo, no por diseño: sería la primera cosa a
mejorar visualmente si se consigue un pack de criaturas.

---

## 6. Limitaciones conocidas / ideas para iterar

- **Mascotas sin sprite real** (CSS shapes). Buscar pack CC0 de criaturas o generar
  sprites nuevos.
- **HP de batalla = % de XP de bugs restantes**, no un pool de vida independiente. Un
  sistema de combate más "de verdad" (HP fijo, daño variable según dificultad del bug,
  quizás vida del jugador que baja con intentos fallidos) le daría más peso al RPG.
- **Sin persistencia multi-dispositivo**: todo vive en `localStorage`, por navegador. Si
  un alumno cambia de dispositivo pierde el progreso. Candidato natural: Supabase (el
  stack habitual del autor incluye Supabase/Postgres/Vercel).
- **Solo 3 módulos / 7 misiones**: fácil de extender agregando objetos a `EXERCISES` y,
  si se agrega un módulo nuevo, un `Topic` más en `data/modules.ts`.
- **Sin panel docente**: no hay forma de que un profesor vea el progreso de la clase.
  Encaja con la idea de Supabase de arriba (tabla `progress` + vista agregada).
- **Sin tests automatizados**: los `bugs[].test()` son regex escritos a mano y no
  tienen cobertura de casos raros (código con espacios/formato distinto al esperado
  puede dar falso negativo). Vale la pena revisar caso por caso si se reportan bugs de
  "hice bien el ejercicio y no me lo toma".
- **Sistema de tipos simple**: solo hay "efectivo" (x1.5) o "neutral" (x1) — no hay
  "resistente" (x0.5) como en Pokémon real. Podría agregarse para más profundidad
  estratégica al elegir arma.

## 7. Cómo correrlo local

```bash
npm install
npm run dev
```

Abre en `http://localhost:3000`. Para build estático: `npm run generate` (genera
`.output/public/`, listo para cualquier hosting estático).

## 8. Cómo desplegar

Actualmente se despliega a mano vía el MCP de Vercel, mandando el árbol de archivos
completo del proyecto (source, no el build) en cada cambio — no hay CI/CD conectado a
un repo Git todavía. Si conectás este repo a Vercel vía Git (dashboard de Vercel →
Import Project), se puede activar deploy automático en cada push y dejar de mandar el
árbol de archivos a mano.
