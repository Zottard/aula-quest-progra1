# C++ Quest — Aula Invertida

Juego web tipo Habitica/Pokémon para practicar debugging de C++ en un contexto de
**aula invertida**: los alumnos leen el material antes de clase, y en clase (o en casa)
arreglan código roto para subir de nivel a su personaje. Hecho en **Nuxt 3 + Vue 3 SFCs**
(`ssr: false`, SPA pura).

El juego es **local-first**: si no hay credenciales de Supabase configuradas, corre
100% client-side con estado en `localStorage`, exactamente como antes. Si se configura
Supabase (ver sección 9), se suma un **panel docente** con aulas, códigos de invitación
y progreso por alumno sincronizado — pero el juego en sí nunca depende de que eso esté
andando; ver `isSupabaseConfigured()` en `composables/useSupabase.ts`.

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
Array de `Exercise`, cada una con `topic` (a qué módulo pertenece), `bugs[]` (solo
descriptivos: label/hint/explanation/xp para la UI y las pistas — **no** validan nada),
`expectedOutput` (la salida exacta del programa ya arreglado) y el código roto inicial.
La misión se resuelve corriendo el código con un compilador real y comparando la salida
contra `expectedOutput` — ver `checkCode()` abajo. La misión 7 tiene `boss: true` y 2 bugs
(combina ciclos+vectores+operadores).

**Los `expectedOutput`/bugs de cada ejercicio están verificados corriéndolos de verdad**,
no a ojo — al migrar a compilación real aparecieron 3 bugs de diseño que la vieja
validación por regex nunca había detectado (el jefe final coincidía con la respuesta
correcta *sin arreglar nada*, por ejemplo). Si tocás el código/valores de un ejercicio,
volvé a correr las 4 combinaciones (ambos bugs arreglados / solo uno / ninguno) contra un
compilador real antes de asumir que el `expectedOutput` sigue siendo válido.

### `data/items.ts` — armas, armaduras, mascotas
Las armas tienen `affinity` (`Topic | "universal"`): si coincide con el tema del ejercicio
activo, el golpe es "muy efectivo" (+50% XP). La daga es neutral, Excálibur es universal
(siempre efectiva). Armas y armaduras tienen `image` (sprite PNG en `/public/sprites`)
que se dibuja superpuesto sobre el avatar (ver `PixelAvatar.vue`).

### `data/tiers.ts` — niveles del personaje
5 tiers por rango de nivel, cada uno con su propio sprite de avatar completo (no hay
"capas" de ropa — cada tier es una imagen distinta).

### `composables/useCompiler.ts` — el compilador real
`runCpp(code)` manda el código a **Wandbox** (`https://wandbox.org/api/compile.json`,
API pública gratuita, sin key, CORS abierto — se llama directo desde el navegador, sin
backend propio), compilando con `g++` + `-fsanitize=undefined -fno-sanitize-recover=all`.
Los sanitizers son la pieza clave: convierten comportamiento indefinido (leer un vector
fuera de rango, típicamente) en un error de runtime real y determinístico en vez de
"funciona de casualidad según qué basura haya en el stack" — sin esto, el ejercicio de
desborde de vector (`ve1`) es un caso real de falso positivo (ver README sección 2,
párrafo de `exercises.ts`). Devuelve `{ status: "ok"|"compile_error"|"runtime_error"|
"timeout"|"network_error", stdout, stderr, compileError }`. Hay un timeout de 10s en el
cliente (`AbortController`) para bucles infinitos — Wandbox mata el proceso solo, pero
tarda ~40s, demasiado para la UX de un botón "Compilar".

**Por qué Wandbox y no otra cosa:** la [Piston API](https://github.com/engineer-man/piston)
pública (`emkc.org`), la opción evidente para esto, pasó a ser whitelist-only en
2026-02-15 — devuelve 401 sin API key. Wandbox no requiere key, tiene CORS abierto y
soporta flags de compilador raw (`compiler-option-raw`), que es lo que permite pasarle
los sanitizers. Si en algún momento Wandbox también deja de estar disponible gratis, hay
que buscar otra API de ejecución (o, como último recurso, un compilador C++ compilado a
WebAssembly corriendo 100% en el navegador — más pesado pero sin dependencia externa).

### `composables/useGameState.ts` — el cerebro
Singleton reactivo (`reactive()` a nivel de módulo, no un store de Pinia) compartido por
toda la app. Acá vive: XP, nivel, equipo, misiones resueltas, `checkCode()`,
`typeEffectiveness()` (el multiplicador Pokémon-style). Persiste todo a `localStorage`
bajo la key `cppQuestSave_v2`.

**`checkCode()` es async y todo-o-nada:** compila y corre el código con `useCompiler`, y
si la salida coincide con `exercise.expectedOutput` marca **todos** los bugs de la misión
como resueltos de una sola vez (no hay detección de "cuál bug en particular se arregló
primero" — cualquier forma válida de arreglar el programa cuenta). Si no compila, si
falla en runtime (sanitizer/crash), si tarda demasiado, o si corre pero da un resultado
distinto, la misión sigue sin resolver y se loguea el motivo real en el `ConsoleLog`
(incluyendo el error de compilación tal cual lo devuelve `g++`, o la salida real que
produjo el programa del alumno). Antes de esto, cada bug se validaba con una regex sobre
el código fuente — se abandonó porque solo aceptaba una forma específica de arreglar
cada bug, y porque nunca ejecutaba el programa (ver el hallazgo de bugs de diseño más
arriba).

### Composables de backend (opcionales, solo si hay Supabase configurado)
- `composables/useSupabase.ts` — cliente singleton (`createClient()`), config desde
  `useRuntimeConfig().public`. Exporta `isSupabaseConfigured()`, que es el interruptor
  que decide si el resto de esta lista se activa o no.
- `composables/useProgressSync.ts` — capa de sync alumno↔Supabase: sesión anónima
  (`ensureAnonSession()`), `registerStudent()`/`claimStudent()` (ver sección 9),
  `pushGameState()` con debounce de 900ms sobre cambios de `useGameState`, y
  `logEvent()` que escucha el event bus (`solved`/`wrong`/`complete`/`levelup`) para
  alimentar `progress_events` (analítica pedagógica fina: qué bug traba más a la clase).
  Todo es best-effort — nunca bloquea ni rompe el juego si Supabase falla.
- `composables/useTeacherAuth.ts` — auth de **docente** (Supabase Auth normal,
  email+password). A propósito separada de la auth anónima de alumnos: son dos
  identidades que no deberían mezclarse en la misma sesión de navegador.
- `middleware/admin-auth.ts` — guard client-side de `/admin/**` (redirige a
  `/admin/login` si no hay sesión docente activa).

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
- **Solo 3 módulos / 7 misiones**: fácil de extender agregando objetos a `EXERCISES` y,
  si se agrega un módulo nuevo, un `Topic` más en `data/modules.ts`.
- **Generador de ejercicios por LLM+PDF: solo la base está preparada, no el generador.**
  La tabla `exercise_sets` (docente sube PDF → LLM arma ejercicios) existe en el schema
  de Supabase pero no hay ninguna UI ni función que la use todavía — ver sección 9.
- **La compilación depende de un servicio externo gratuito sin SLA** (Wandbox — ver
  sección 2, `useCompiler.ts`). No tiene API key ni cuota fija, así que si Wandbox cae o
  cambia de política (ya le pasó a la Piston API pública, la alternativa obvia, que se
  puso whitelist-only), el botón "Compilar" deja de funcionar hasta que se cambie de
  proveedor. No hay fallback automático hoy.
- **Sin tests automatizados**: los `expectedOutput` de `data/exercises.ts` se verificaron
  a mano corriendo cada combinación de bugs contra un compilador real al migrar a
  compilación real, pero no hay un test suite que lo re-verifique solo. Si se edita un
  ejercicio, hay que volver a correrlo a mano (ver sección 2).
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

Sin `.env`, el juego corre igual (100% local, sin panel docente — ver sección 1). Para
activar Supabase, copiá `.env.example` a `.env` y completá las dos variables (ya trae
los valores del proyecto `cpp-quest` actual como referencia). Ver sección 9 para el
detalle completo, incluyendo un paso manual obligatorio en el dashboard de Supabase.

## 8. Cómo desplegar

Actualmente se despliega a mano vía el MCP de Vercel, mandando el árbol de archivos
completo del proyecto (source, no el build) en cada cambio — no hay CI/CD conectado a
un repo Git todavía. Si conectás este repo a Vercel vía Git (dashboard de Vercel →
Import Project), se puede activar deploy automático en cada push y dejar de mandar el
árbol de archivos a mano.

**Importante:** como el deploy es un push de archivos y no un `git push`/build con env
propio, las variables `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_ANON_KEY` **no
se toman de ningún `.env` local** — hay que cargarlas a mano en el dashboard de Vercel
(Project Settings → Environment Variables) para que el panel docente funcione en
producción. Ver `.env.example` para los valores actuales del proyecto Supabase.

---

## 9. Backend: Supabase (panel docente + progreso de alumnos)

### 9.1 Qué resuelve
- Un docente puede tener **varias aulas**, cada una con un **código de invitación** de 6
  caracteres (`join_code`, sin `0/O/1/I/L` para que se pueda dictar en clase sin
  ambigüedad).
- Dentro de cada aula, el docente ve una tabla con **todos sus alumnos** (nombre real,
  usuario, personaje, nivel, XP, misiones completadas, última conexión) y puede
  expandir cada fila para ver el **detalle por misión/bug** (resuelto / con pista /
  pendiente), usando `data/exercises.ts` como referencia. También puede borrar un
  alumno (borra su progreso).
- El progreso del alumno vive en Supabase (`students.game_state`, un JSON casi calcado
  de `GameState`), así que **sobrevive un cambio de dispositivo** si el alumno vuelve a
  entrar con su usuario.

### 9.2 Auth: dos identidades separadas, nunca mezcladas
- **Docente**: Supabase Auth normal (email + password), vía `useTeacherAuth.ts`. Al
  crear cuenta se autocompleta `profiles` con un trigger (`handle_new_teacher`).
- **Alumno**: la UX pedida es "el nombre de usuario funciona como contraseña" (sin
  campo de password separado, para bajar la fricción en una clase). Por dentro esto se
  implementa con **Supabase Anonymous Auth** (`signInAnonymously()`, un `auth.uid()`
  real y persistente por navegador) + dos funciones Postgres `SECURITY DEFINER`
  (`register_student`, `claim_student_by_username`) que son los **únicos** puntos de
  entrada para crear/reclamar una fila de `students` — no hay INSERT/UPDATE directo por
  username expuesto a `anon`. Es un tradeoff de seguridad aceptado a propósito para el
  contexto de bajo riesgo de un aula (está comentado así en la migración SQL).
- Primera vez: código de aula + nombre real + usuario + nombre de personaje
  (`registerStudent()`, sube el progreso local como base). Ya tenía usuario: solo el
  usuario (`claimStudent()`, baja el progreso remoto y pisa el local). Ambos flujos y el
  toggle entre uno y otro viven en `components/OnboardingModal.vue`.

### 9.3 Paso manual obligatorio (no hay MCP que lo exponga)
El proyecto Supabase necesita **"Anonymous Sign-Ins" habilitado a mano** en
`https://supabase.com/dashboard/project/rquyfymebnhaftpljpsn/auth/providers` (Auth →
Providers → Anonymous). Sin esto, ningún alumno puede registrarse ni entrar — el
onboarding va a fallar silenciosamente en el paso de `ensureAnonSession()`. Ninguna
herramienta de Supabase disponible en este entorno permite prenderlo por API/MCP; hay
que entrar al dashboard y tildarlo una sola vez.

### 9.4 Schema (proyecto `cpp-quest`, `rquyfymebnhaftpljpsn`, región `sa-east-1`)
- `profiles` — 1 fila por docente (id = `auth.users.id`).
- `aulas` — `teacher_id`, `name`, `join_code` (único, `citext`), `archived`.
- `students` — `auth_user_id` (único, la sesión anónima), `aula_id`, `real_name`,
  `username` (único, `citext`), `character_name`, `game_state jsonb`, más `xp`/`level`
  como **columnas generadas** desde `game_state->>'xp'` (para poder ordenar/filtrar
  barato sin recalcular en cada query).
- `students_overview` — vista (`security_invoker`) con las columnas anteriores +
  `quests_done` (subquery sobre `game_state`, no se puede expresar como columna
  generada). Es lo que consume `pages/admin/aulas/[id].vue`.
- `progress_events` — log append-only de eventos finos (`solved`/`wrong`/`complete`/
  `levelup`, con `xp_gained`/`hinted`) alimentado por el event bus del juego. Pensado
  para analítica pedagógica (ej. qué bug traba más a la clase), todavía sin UI que lo
  consuma.
- `exercise_sets` — preparado para la futura función **LLM + PDF**: el docente sube un
  PDF de contenido y un LLM genera ejercicios (`generated_exercises jsonb`, `status`
  draft/published/archived, `topic` restringido a los 3 módulos del curso). Hoy es solo
  schema — no hay endpoint ni UI que la llene todavía.
- RLS en todas las tablas: un docente solo ve/edita aulas donde `teacher_id = auth.uid()`
  y alumnos de esas aulas (via join); un alumno solo ve/edita su propia fila
  (`auth_user_id = auth.uid()`).

### 9.5 Páginas y rutas nuevas
| Ruta | Rol |
|---|---|
| `/admin/login` | Login/signup del docente (email+password) |
| `/admin` | Lista de aulas del docente + crear aula nueva |
| `/admin/aulas/[id]` | Roster de alumnos de una aula + detalle por misión/bug |

`middleware/admin-auth.ts` protege todo `/admin/**` excepto `/admin/login`.
