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
- `composables/useChapters.ts` / `usePdfExtract.ts` — capítulos generados desde un PDF
  por el docente (extracción, llamado a `/api/generate-chapter`, publicar/listar/borrar
  en Supabase). Ver sección 10, es la pieza más grande de esta lista.

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
- **Los capítulos (sección 10) dependen de que el PDF tenga ejemplos ya resueltos en
  texto seleccionable** (no un PDF escaneado/imagen — `pdfjs-dist` no hace OCR). Si un
  ejercicio de la guía no trae ningún ejemplo resuelto, se descarta silenciosamente
  (nunca se inventa uno) — el docente puede terminar con menos ejercicios generados que
  los que tenía el PDF, y eso es esperado, no un bug.
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

El proyecto de Vercel (`aula-quest-progra1`) está conectado al repo de GitHub
(`Zottard/aula-quest-progra1`) — cada `git push` a `main` deploya solo. Producción:
https://aula-quest-progra1.vercel.app.

(Hubo un `cpp-quest` anterior deployado a mano vía el MCP de Vercel, sin conexión a Git;
quedó frozen en su último deploy manual cuando se migró a este proyecto conectado — no
es el que está en uso.)

**Importante:** las variables de entorno **no viajan con el repo** — hay que cargarlas a
mano en el dashboard de Vercel (Project Settings → Environment Variables) del proyecto
`aula-quest-progra1`: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY` y
`DEEPSEEK_API_KEY` (ver `.env.example` y sección 10). El código se actualiza solo con el
push; las env vars son un paso manual aparte, y solo hace falta repetirlo si cambian.

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
- `exercise_sets` — capítulos generados desde un PDF (ver sección 10):
  `generated_exercises jsonb`, `status` draft/published/archived, `topic` opcional
  (informativo, no se usa para nada en el cliente).
- RLS en todas las tablas: un docente solo ve/edita aulas donde `teacher_id = auth.uid()`
  y alumnos/capítulos de esas aulas (via join); un alumno solo ve/edita su propia fila
  de `students` (`auth_user_id = auth.uid()`), y solo puede LEER capítulos `published` de
  su propia aula (`exercise_sets_select_student`, sin acceso a los borradores del docente).

### 9.5 Páginas y rutas nuevas
| Ruta | Rol |
|---|---|
| `/admin/login` | Login/signup del docente (email+password) |
| `/admin` | Lista de aulas del docente + crear aula nueva |
| `/admin/aulas/[id]` | Roster de alumnos de una aula + detalle por misión/bug |
| `/admin/aulas/[id]/capitulos` | Subir PDF → generar capítulo con IA → publicar (sección 10) |

`middleware/admin-auth.ts` protege todo `/admin/**` excepto `/admin/login`.

---

## 10. Capítulos: convertir un PDF de ejercicios en contenido jugable

### 10.1 Idea
El docente sube el PDF de una guía de ejercicios (de las de "escribí un programa que
lea X por teclado y calcule Y" — no del estilo "arreglá el bug" de las 7 misiones fijas).
Una IA (DeepSeek) arma un "capítulo" con esos ejercicios, el docente revisa/publica en
una aula puntual, y a los alumnos de esa aula les aparece como una sección más en el
juego (grupo "📘 Capítulo" en `QuestTabs.vue`, siempre desbloqueada).

### 10.2 De dónde salen los casos de prueba (y cuándo la IA sí inventa uno)
Estas guías (a diferencia del código de las 7 misiones) no fijan la salida exacta que
tiene que imprimir el programa — dos soluciones correctas pueden imprimir cosas distintas
con el mismo resultado. Por eso, cuando el ejercicio **trae** un ejemplo ya resuelto en
el texto ("si se ingresan 3 y 8, A=8 y B=3"), el prompt de
`server/api/generate-chapter.post.ts` le pide a la IA que lo **extraiga tal cual** —
`testCases: [{ stdin, expectedValues, computed: false }]` — para que el "oráculo" de
corrección salga del enunciado humano, no del modelo.

Pero en la práctica no todos los ejercicios de una guía real traen ejemplo (probamos con
una guía real de la cátedra y justo el ejercicio 1 no tenía). Descartar esos en silencio
significaba perder ejercicios sin que el docente se enterara. Así que para esos casos la
IA sí inventa un caso simple aplicando la fórmula del enunciado, pero lo marca
**`computed: true`** — la pantalla de publicación (`pages/admin/aulas/[id]/capitulos.vue`)
resalta esos casos con una advertencia y los deja **editables** (stdin y resultado
esperado, como texto) para que el docente verifique o corrija la cuenta antes de
publicar. Nunca se publica un caso "computed" sin que el docente lo haya podido ver.

### 10.3 Cómo se corrige (todo con el compilador real, sin la IA)
`checkCode()` en `useGameState.ts` detecta `exercise.testCases` y usa un camino distinto
al de las 7 misiones: corre el programa del alumno **una vez por cada caso**, pasándole
`stdin` real vía Wandbox (ver `useCompiler.ts`, que ahora soporta un segundo parámetro
`stdin`), y en vez de exigir una salida exacta busca que **cada `expectedValue` aparezca**
en la salida (`outputContainsValue()`): si el valor esperado es numérico, compara números
con tolerancia (para no romper por formato de decimales); si es texto, hace un contains
case-insensitive. Todo o nada por ejercicio, igual que las 7 misiones: si pasan todos los
casos se acredita `xpReward` (60 XP por defecto) de una sola vez.

### 10.4 DeepSeek: por qué `deepseek-chat` y no `deepseek-reasoner`
Convertir texto de un enunciado en JSON estructurado es extracción/formato, no
razonamiento multi-paso — `deepseek-chat` (alias del modelo "flash" más nuevo de
DeepSeek al momento de escribir esto) lo resuelve bien y sale muchísimo más barato que
`deepseek-reasoner`, que gasta tokens de más en una cadena de razonamiento que acá no
hace falta. Un llamado real de prueba con un ejercicio simple costó ~144 tokens totales.

Control de costo adicional: el texto del PDF se extrae 100% en el navegador
(`composables/usePdfExtract.ts`, vía `pdfjs-dist` — cero costo de IA en ese paso) y se
recorta a los primeros ~15.000 caracteres antes de mandarlo al modelo
(`MAX_INPUT_CHARS` en `generate-chapter.post.ts`) para poner un techo duro al gasto por
PDF, sea cual sea su tamaño.

### 10.5 Flujo completo
1. **`composables/usePdfExtract.ts`** (`extractPdfText`) — extrae el texto del PDF en el
   navegador con `pdfjs-dist`, colapsando espacios/saltos de línea repetidos.
2. **`server/api/generate-chapter.post.ts`** — recibe ese texto, llama a DeepSeek con el
   prompt de extracción, devuelve `{ exercises, truncated, usage }`. Corre server-side
   (Nitro function) para que `DEEPSEEK_API_KEY` nunca llegue al bundle del cliente —
   funciona en Vercel aunque el resto de la app sea `ssr:false`, las rutas de `server/api`
   son independientes de eso.
3. **`pages/admin/aulas/[id]/capitulos.vue`** — el docente sube el PDF, ve el texto
   extraído (colapsable), pide la generación, revisa la lista resultante (puede
   desmarcar ejercicios, editar título/consigna), le pone un título al capítulo y
   publica — inserta una fila en `exercise_sets` con `status: 'published'`.
4. **`composables/useChapters.ts`** (`fetchChaptersForAula`) — se llama desde `app.vue`
   al montar y cada vez que `state.aulaId` cambia (alumno recién registrado/logueado);
   trae los capítulos `published` del aula del alumno y los mapea a `Exercise[]` con
   un código inicial en blanco (a diferencia de las 7 misiones, acá el alumno escribe el
   programa entero, no arregla uno roto).

### 10.6 Tipo de batalla por ejercicio (para que valga la pena cambiar de arma)
Cada ejercicio de capítulo también recibe un `topic` real (`operadores` | `ciclos` |
`vectores`, el mismo enum que usan las 7 misiones — ver `data/modules.ts`), no el
`"capitulo"` neutral por defecto. La IA lo clasifica según qué hace falta para resolver
el ejercicio (variables sueltas + cuentas → operadores; repetir algo → ciclos; guardar y
recorrer una lista → vectores) como parte del mismo llamado que arma los casos de
prueba — no hay un segundo llamado a la IA para esto. El docente puede corregir la
clasificación en la pantalla de publicación (selector junto a cada ejercicio) antes de
publicar.

Con un `topic` real, la afinidad de arma (`typeEffectiveness()` en `useGameState.ts`, el
mismo sistema tipo Pokémon de las 7 misiones) también aplica en los capítulos: si el arma
equipada tiene afinidad con el tema del ejercicio, +50% XP y el toast "⚡ ¡Es muy
efectivo!" — mismo código, cero lógica nueva. Esto es lo que fuerza al alumno a decidir
si le conviene cambiar de arma **dentro de un mismo capítulo**, no solo entre módulos de
la campaña fija. `"capitulo"` (gris, sin afinidad de ningún arma salvo Excálibur) queda
solo como fallback defensivo si la IA devuelve algo inválido o un capítulo viejo no tiene
el campo todavía (`normalizeTopic()` en `useChapters.ts`).

### 10.7 Env var
`DEEPSEEK_API_KEY` en `runtimeConfig` (NO `runtimeConfig.public` — a propósito, para que
solo la lea el server). Se saca en https://platform.deepseek.com. Sin esta variable, el
resto de la app funciona igual; el botón "Generar con IA" del panel docente falla con un
error claro (500 desde el endpoint) en vez de romper nada más.
