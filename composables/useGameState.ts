import { reactive, computed } from "vue";
import { EXERCISES, type Exercise } from "~/data/exercises";
import { XP_PER_LEVEL, levelFromXp, tierForLevel } from "~/data/tiers";
import { WEAPONS, ARMORS, PETS, type EquipItem, type UnlockCondition } from "~/data/items";
import type { Topic } from "~/data/modules";
import { SKILLS } from "~/data/skills";
import { DEFAULT_AVATAR_ID, avatarById, auraForTier } from "~/data/avatars";
import { useExerciseOverrides, applyPatch } from "~/composables/useExerciseOverrides";
import { useSound } from "~/composables/useSound";
import { useEventBus } from "~/composables/useEventBus";
import { useCompiler, normalizeOutput, outputContainsValue } from "~/composables/useCompiler";

const SAVE_KEY = "cppQuestSave_v2";

export interface ExerciseState {
  solved: Record<string, boolean>;
  hinted: Record<string, boolean>;
  completed: boolean;
  savedCode?: string;
  log: { type: "ok" | "err" | "sys" | "boss"; text: string }[];
}

interface Equipment {
  weaponId: string;
  armorId: string | null;
  petId: string;
}

interface GameState {
  xp: number;
  activeId: string;
  muted: boolean;
  exercises: Record<string, ExerciseState>;
  equipment: Equipment;
  unlockedSkills: string[];
  studentName: string;
  avatarName: string;
  /** Avatar elegido por el alumno (id de data/avatars.ts). Es una elección
   * estética estable: NO cambia al subir de nivel. */
  avatarId: string;
  /** Identidad ligada al panel docente (Supabase). Si el juego corre sin
   * Supabase configurado (dev local sin .env), quedan en null y el juego
   * sigue funcionando 100% local como antes — ver useProgressSync.ts. */
  studentId: string | null;
  aulaId: string | null;
  username: string | null;
  /** Material de teoría ya leído (capítulos kind:"theory"), por id de
   * exercise_sets. Se guarda aparte de `exercises` porque no es un ejercicio:
   * no da XP de combate ni cuenta como misión, pero sí es lo que le permite
   * al docente ver quién llegó preparado a la clase. */
  theoryDone: Record<string, { at: string; score: number; total: number }>;
}

/** Fila de la tabla `students` tal como la devuelven register_student /
 * claim_student_by_username (ver supabase/ RPCs). */
export interface StudentRow {
  id: string;
  auth_user_id: string;
  aula_id: string;
  real_name: string;
  username: string;
  character_name: string;
  game_state: Partial<{
    xp: number;
    exercises: Record<string, ExerciseState>;
    equipment: Equipment;
    unlockedSkills: string[];
    theoryDone: Record<string, { at: string; score: number; total: number }>;
    avatarId: string;
  }> | null;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
}

function freshExState(): ExerciseState {
  return { solved: {}, hinted: {}, completed: false, log: [] };
}

function defaultState(): GameState {
  return {
    xp: 0,
    activeId: EXERCISES[0].id,
    muted: false,
    exercises: {},
    equipment: { weaponId: "daga", armorId: null, petId: "chispita" },
    unlockedSkills: [],
    studentName: "",
    avatarName: "",
    avatarId: DEFAULT_AVATAR_ID,
    studentId: null,
    aulaId: null,
    username: null,
    theoryDone: {}
  };
}

function loadInitial(): GameState {
  if (import.meta.client) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // merge con default por si el save viene de una versión anterior sin equipo/skills
        return { ...defaultState(), ...parsed, equipment: { ...defaultState().equipment, ...(parsed.equipment ?? {}) } };
      }
    } catch {
      // localStorage corrupto o inaccesible: arrancamos de cero.
    }
  }
  return defaultState();
}

// Singleton a nivel de módulo: todos los componentes que llaman useGameState()
// comparten la misma instancia reactiva.
const state = reactive<GameState>(loadInitial());
const bus = useEventBus();
const { sfxSolve, sfxWrong, sfxComplete, sfxLevelUp, sfxHint, sfxEquip, sfxUnlockSkill } = useSound(
  computed(() => state.muted) as unknown as { value: boolean }
);

function persist() {
  if (import.meta.client) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }
}

function exState(id: string): ExerciseState {
  if (!state.exercises[id]) state.exercises[id] = freshExState();
  return state.exercises[id];
}

// No se persiste: solo indica "hay una compilación en vuelo" para la UI
// (botón COMPILAR deshabilitado / spinner). Vive fuera de GameState a
// propósito, es efímero y por eso no va en localStorage.
const compiling = reactive<Record<string, boolean>>({});

/** Ejercicios "de capítulo" del aula del alumno (generados por el docente
 * desde un PDF, ver useChapters.ts). No viven en localStorage — se
 * recargan desde Supabase en cada sesión, así que no se persisten en
 * GameState.exercises (esa parte sí, es el progreso, no el contenido). */
const chapterExercises = reactive<Exercise[]>([]);

function setChapterExercises(exs: Exercise[]) {
  chapterExercises.splice(0, chapterExercises.length, ...exs);
}

/** Las 7 misiones fijas CON los parches del aula aplicados (ver
 * useExerciseOverrides.ts). Todo el juego tiene que leer de acá y no de
 * EXERCISES directo, si no el alumno vería el enunciado de fábrica y —peor—
 * se lo corregiría contra el expectedOutput de fábrica en vez del que puso
 * su docente. Sin aula o sin overrides es idéntico a EXERCISES. */
const overridePatches = useExerciseOverrides();
const baseExercises = computed(() => EXERCISES.map((ex) => applyPatch(ex, overridePatches[ex.id])));

/** Busca un ejercicio por id entre las 7 misiones fijas y los capítulos
 * dinámicos del aula — la mayoría de las funciones de abajo necesitan esto
 * en vez de EXERCISES.find() a secas, porque activeId puede apuntar a
 * cualquiera de los dos. */
function findExercise(id: string): Exercise | undefined {
  return baseExercises.value.find((e) => e.id === id) ?? chapterExercises.find((e) => e.id === id);
}

export function useGameState() {
  const level = computed(() => levelFromXp(state.xp));
  const xpIntoLevel = computed(() => state.xp % XP_PER_LEVEL);
  const tierInfo = computed(() => tierForLevel(level.value));

  // bugsFixed y noHintQuestDone también cuentan capítulos: son logros
  // genéricos de "resolver cosas", no específicos de la campaña fija de 7
  // misiones (esa distinción sí importa para questsDone/allComplete, que
  // literalmente son "completá las 7 misiones" — esos se quedan como están).
  // Un ejercicio de capítulo no tiene bugs individuales, así que una
  // resolución completa cuenta como 1 bug cazado (es la unidad atómica de
  // "resolví algo" ahí). Tampoco tiene sistema de pistas, así que una
  // resolución de capítulo siempre cuenta como "sin pistas" — es verdad
  // (nunca tuvo la opción de pedir una), no es una forma de hacer trampa.
  const bugsFixed = computed(
    () =>
      EXERCISES.reduce((sum, ex) => sum + Object.keys(exState(ex.id).solved).length, 0) +
      chapterExercises.filter((ex) => exState(ex.id).completed).length
  );
  const questsDone = computed(
    () => EXERCISES.filter((ex) => exState(ex.id).completed).length
  );
  const noHintQuestDone = computed(
    () =>
      EXERCISES.some((ex) => {
        const es = exState(ex.id);
        return es.completed && Object.keys(es.hinted).length === 0;
      }) || chapterExercises.some((ex) => exState(ex.id).completed)
  );
  const allComplete = computed(() => questsDone.value === EXERCISES.length);

  /** Progreso de los capítulos del aula. */
  const chaptersDone = computed(() => chapterExercises.filter((ex) => exState(ex.id).completed).length);

  function isUnlocked(index: number): boolean {
    if (index === 0) return true;
    return exState(EXERCISES[index - 1].id).completed;
  }

  function setActive(id: string) {
    state.activeId = id;
    persist();
  }

  /* ================= IDENTIDAD (alumno + nombre del personaje) ================= */
  const hasIdentity = computed(() => !!state.studentName.trim() && !!state.avatarName.trim());

  function setNames(studentName: string, avatarName: string) {
    state.studentName = studentName.trim().slice(0, 40);
    state.avatarName = avatarName.trim().slice(0, 30);
    persist();
  }

  /** El avatar es puramente estético y lo elige el alumno; se puede cambiar
   * cuando quiera sin perder nada de progreso. */
  function setAvatarId(id: string) {
    state.avatarId = avatarById(id).id;
    persist();
  }
  const avatar = computed(() => avatarById(state.avatarId));
  /** Efectos visuales que sí dependen del nivel (halo, partículas, base). */
  const aura = computed(() => auraForTier(tierInfo.value.tier));

  /** true si esta identidad ya quedó ligada a una fila `students` en
   * Supabase (registro o claim exitoso). Ver useProgressSync.ts. */
  const isLinkedToAula = computed(() => !!state.studentId);

  /* ================= MATERIAL DE TEORÍA (lectura previa) ================= */
  function markTheoryDone(chapterId: string, score: number, total: number) {
    state.theoryDone[chapterId] = { at: new Date().toISOString(), score, total };
    persist();
    bus.emit("theoryDone", { chapterId, score, total });
  }
  function isTheoryDone(chapterId: string): boolean {
    return !!state.theoryDone?.[chapterId];
  }

  /** Aplica los datos que devuelve register_student/claim_student_by_username.
   * `hydrateFromRemote` en true pisa el progreso local con el de la base
   * (caso "ya tengo usuario" en un dispositivo nuevo); en false deja el
   * progreso local como está (caso registro nuevo: la base arranca vacía y
   * lo que suba después es el progreso local ya existente, si lo había). */
  function setIdentityFromStudent(row: StudentRow, hydrateFromRemote: boolean) {
    state.studentId = row.id;
    state.aulaId = row.aula_id;
    state.username = row.username;
    state.studentName = row.real_name;
    state.avatarName = row.character_name;
    if (hydrateFromRemote && row.game_state) {
      const gs = row.game_state;
      if (typeof gs.xp === "number") state.xp = gs.xp;
      if (gs.exercises && typeof gs.exercises === "object") state.exercises = gs.exercises;
      if (gs.equipment && typeof gs.equipment === "object") state.equipment = { ...state.equipment, ...gs.equipment };
      if (Array.isArray(gs.unlockedSkills)) state.unlockedSkills = gs.unlockedSkills;
      if (gs.theoryDone && typeof gs.theoryDone === "object") state.theoryDone = gs.theoryDone;
      if (typeof gs.avatarId === "string") state.avatarId = avatarById(gs.avatarId).id;
    }
    persist();
  }

  /* ================= HABILIDADES PASIVAS ================= */
  function hasSkill(id: string): boolean {
    return state.unlockedSkills.includes(id);
  }
  const totalSkillPoints = computed(() => Math.max(0, level.value - 1));
  const spentSkillPoints = computed(() =>
    state.unlockedSkills.reduce((sum, id) => sum + (SKILLS.find((s) => s.id === id)?.cost ?? 0), 0)
  );
  const availableSkillPoints = computed(() => totalSkillPoints.value - spentSkillPoints.value);

  function canUnlockSkill(skillId: string): boolean {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) return false;
    if (hasSkill(skillId)) return false;
    if (availableSkillPoints.value < skill.cost) return false;
    return skill.requires.every((r) => hasSkill(r));
  }

  function unlockSkill(skillId: string) {
    if (!canUnlockSkill(skillId)) return;
    state.unlockedSkills.push(skillId);
    persist();
    sfxUnlockSkill();
    bus.emit("skillUnlocked", { skillId });
  }

  /* ================= EQUIPO (armas / armadura / mascotas) ================= */
  function badgeUnlocked(badge: string): boolean {
    if (badge === "firstBug") return bugsFixed.value >= 1;
    if (badge === "fiveBugs") return bugsFixed.value >= 5;
    if (badge === "noHint") return noHintQuestDone.value;
    if (badge === "allComplete") return allComplete.value;
    return false;
  }

  function meetsUnlock(cond: UnlockCondition): boolean {
    if (cond.type === "level") return level.value >= cond.value;
    return badgeUnlocked(cond.value);
  }

  function unlockLabel(cond: UnlockCondition): string {
    if (cond.type === "level") return `Nivel ${cond.value}`;
    const map: Record<string, string> = {
      firstBug: "Cazá tu primer bug",
      fiveBugs: "Cazá 5 bugs",
      noHint: "Completá una misión sin pistas",
      allComplete: "Completá las 7 misiones"
    };
    return map[cond.value] ?? "???";
  }

  function itemsWithStatus(catalog: EquipItem[]) {
    return catalog.map((item) => ({
      ...item,
      unlocked: meetsUnlock(item.unlock),
      unlockLabel: unlockLabel(item.unlock)
    }));
  }

  const weapons = computed(() => itemsWithStatus(WEAPONS));
  const armors = computed(() => itemsWithStatus(ARMORS));
  const pets = computed(() => itemsWithStatus(PETS));

  const equippedWeapon = computed(() => WEAPONS.find((w) => w.id === state.equipment.weaponId) ?? WEAPONS[0]);

  /** ¿El arma equipada es "muy efectiva" contra este tema? Sistema tipo Pokémon,
   * donde el "tipo" del enemigo/ejercicio es el tema del programa. */
  function typeEffectiveness(topic: Topic): number {
    const affinity = equippedWeapon.value.affinity;
    if (!affinity) return 1;
    if (affinity === "universal") return 1.5;
    return affinity === topic ? 1.5 : 1;
  }
  const equippedArmor = computed(() => ARMORS.find((a) => a.id === state.equipment.armorId) ?? null);
  const equippedPet = computed(() => PETS.find((p) => p.id === state.equipment.petId) ?? PETS[0]);

  function equipWeapon(id: string) {
    const item = WEAPONS.find((w) => w.id === id);
    if (!item || !meetsUnlock(item.unlock)) return;
    state.equipment.weaponId = id;
    persist();
    sfxEquip();
  }
  function equipArmor(id: string | null) {
    if (id) {
      const item = ARMORS.find((a) => a.id === id);
      if (!item || !meetsUnlock(item.unlock)) return;
    }
    state.equipment.armorId = id;
    persist();
    sfxEquip();
  }
  function equipPet(id: string) {
    const item = PETS.find((p) => p.id === id);
    if (!item || !meetsUnlock(item.unlock)) return;
    state.equipment.petId = id;
    persist();
    sfxEquip();
  }

  function useHint(exerciseId: string, bugId: string) {
    const es = exState(exerciseId);
    es.hinted[bugId] = true;
    persist();
    sfxHint();
  }

  function saveCode(exerciseId: string, code: string) {
    exState(exerciseId).savedCode = code;
    persist();
  }

  function pushLog(exerciseId: string, entry: ExerciseState["log"][number]) {
    const es = exState(exerciseId);
    es.log.push(entry);
    if (es.log.length > 8) es.log = es.log.slice(-8);
  }

  /** Compila y corre el código con un compilador real (ver useCompiler.ts).
   * Todo o nada: la misión se resuelve completa cuando la salida coincide
   * con exercise.expectedOutput, sin importar CÓMO se haya arreglado el
   * código — no hay chequeo por bug individual.
   *
   * Los ejercicios "de capítulo" (exercise.testCases presente, ver
   * useChapters.ts) usan un camino de corrección distinto: se corre el
   * programa una vez por cada caso con su stdin, y en vez de salida exacta
   * se busca que aparezcan los valores clave esperados (outputContainsValue
   * en useCompiler.ts) — el enunciado del PDF no fija un formato de
   * impresión, así que exigir un match literal penalizaría a alumnos que
   * resuelven bien pero imprimen distinto. */
  async function checkCode(exerciseId: string, code: string) {
    const exercise = findExercise(exerciseId);
    if (!exercise) return;
    const es = exState(exerciseId);
    es.savedCode = code;
    persist();

    if (es.completed) {
      pushLog(exerciseId, { type: "ok", text: "✔ Esta misión ya está resuelta." });
      return;
    }

    compiling[exerciseId] = true;
    const { runCpp } = useCompiler();

    if (exercise.testCases && exercise.testCases.length > 0) {
      for (let i = 0; i < exercise.testCases.length; i++) {
        const tc = exercise.testCases[i];
        const result = await runCpp(code, tc.stdin);
        // Mostramos siempre qué input se probó (casi siempre ya está en el
        // propio enunciado, así que no hay nada que "esconder") — si no, el
        // alumno ve un error sin poder saber con qué valores falló.
        const inputList = tc.stdin
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean)
          .join(", ");
        const label = `Caso ${i + 1}/${exercise.testCases.length} (input: ${inputList || "sin input"})`;

        if (result.status === "network_error") {
          compiling[exerciseId] = false;
          pushLog(exerciseId, { type: "sys", text: "⚠ No se pudo conectar con el compilador. Probá de nuevo." });
          return;
        }
        if (result.status === "timeout") {
          compiling[exerciseId] = false;
          pushLog(exerciseId, { type: "err", text: `✖ ${label}: tu programa no terminó a tiempo.` });
          sfxWrong();
          bus.emit("wrong", { exerciseId, reason: "timeout" });
          return;
        }
        if (result.status === "compile_error") {
          compiling[exerciseId] = false;
          pushLog(exerciseId, { type: "err", text: `✖ Error de compilación:\n${result.compileError}` });
          sfxWrong();
          bus.emit("wrong", { exerciseId, reason: "compile_error" });
          return;
        }
        if (result.status === "runtime_error") {
          compiling[exerciseId] = false;
          pushLog(exerciseId, {
            type: "err",
            text: `✖ ${label}: compiló pero falló al correr:\n${result.stderr || "(sin mensaje)"}`
          });
          sfxWrong();
          bus.emit("wrong", { exerciseId, reason: "runtime_error" });
          return;
        }

        const missing = tc.expectedValues.filter((v) => !outputContainsValue(result.stdout, v));
        if (missing.length > 0) {
          compiling[exerciseId] = false;
          pushLog(exerciseId, {
            type: "err",
            text: `✖ ${label}: no encontré ${missing.join(", ")} en la salida de tu programa.\nSalida:\n${result.stdout || "(sin salida)"}`
          });
          sfxWrong();
          bus.emit("wrong", { exerciseId, reason: "wrong_output" });
          return;
        }

        pushLog(exerciseId, { type: "ok", text: `✔ ${label} resuelto.` });
      }

      compiling[exerciseId] = false;
      const before = level.value;
      // Misma afinidad de arma que las 7 misiones: si el docente/IA le puso
      // un tipo real a este ejercicio (no "capitulo"), cambiar de arma acá
      // también da bono de XP — es lo que hace que valga la pena cambiar de
      // equipo dentro de un capítulo, no solo en la campaña fija.
      const effectiveness = typeEffectiveness(exercise.topic);
      const bugXpMultiplier = hasSkill("estudio-rapido") ? 1.15 : 1;
      let bonus = Math.round((exercise.xpReward ?? 60) * bugXpMultiplier * effectiveness);
      if (hasSkill("bonus-mision")) bonus = Math.round(bonus * 1.25);
      const xpGain = bonus;
      state.xp += xpGain;
      es.completed = true;
      const tag = effectiveness > 1 ? " ⚡ ¡Muy efectivo!" : "";
      pushLog(exerciseId, { type: "ok", text: `🏆 Capítulo completo. +${xpGain} XP.${tag}` });
      sfxSolve();
      sfxComplete();
      bus.emit("solved", { exerciseId, bugId: null, superEffective: effectiveness > 1, xpGain, hinted: false });
      bus.emit("complete", { exerciseId });
      persist();
      if (levelFromXp(state.xp) > before) {
        sfxLevelUp();
        bus.emit("levelup", { level: level.value, title: tierInfo.value.title });
      }
      return;
    }

    const result = await runCpp(code);
    compiling[exerciseId] = false;

    if (result.status === "network_error") {
      pushLog(exerciseId, {
        type: "sys",
        text: "⚠ No se pudo conectar con el compilador. Probá de nuevo en unos segundos."
      });
      return;
    }
    if (result.status === "timeout") {
      pushLog(exerciseId, {
        type: "err",
        text: "⏱ Tu programa no terminó a tiempo (¿un bucle que no corta nunca?)."
      });
      sfxWrong();
      bus.emit("wrong", { exerciseId, reason: "timeout" });
      return;
    }
    if (result.status === "compile_error") {
      pushLog(exerciseId, { type: "err", text: `✖ Error de compilación:\n${result.compileError}` });
      sfxWrong();
      bus.emit("wrong", { exerciseId, reason: "compile_error" });
      return;
    }
    if (result.status === "runtime_error") {
      pushLog(exerciseId, {
        type: "err",
        text: `✖ Compiló, pero falló al correr:\n${result.stderr || "(sin mensaje)"}`
      });
      sfxWrong();
      bus.emit("wrong", { exerciseId, reason: "runtime_error" });
      return;
    }

    const actual = normalizeOutput(result.stdout);
    const expected = normalizeOutput(exercise.expectedOutput ?? "");

    if (actual !== expected) {
      pushLog(exerciseId, {
        type: "err",
        text: `✖ Compiló y corrió, pero el resultado no es el esperado.\nSalida de tu programa:\n${result.stdout || "(sin salida)"}`
      });
      sfxWrong();
      bus.emit("wrong", { exerciseId, reason: "wrong_output" });
      return;
    }

    // ¡Misión resuelta! Se acredita todo el XP de los bugs de una.
    const before = level.value;
    const hintDiscount = hasSkill("ojo-certero") ? 0.8 : 0.6;
    const bugXpMultiplier = hasSkill("estudio-rapido") ? 1.15 : 1;
    const effectiveness = typeEffectiveness(exercise.topic);
    const wasHinted = exercise.bugs.some((b) => es.hinted[b.id]);

    let bugXpTotal = 0;
    for (const bug of exercise.bugs) {
      const hinted = !!es.hinted[bug.id];
      const xpGain = Math.round((hinted ? bug.xp * hintDiscount : bug.xp) * bugXpMultiplier * effectiveness);
      bugXpTotal += xpGain;
      es.solved[bug.id] = true;
      const tag = effectiveness > 1 ? " ⚡ ¡Muy efectivo!" : "";
      pushLog(exerciseId, { type: "ok", text: `✔ Bug resuelto: ${bug.label} (+${xpGain} XP)${tag}` });
    }
    state.xp += bugXpTotal;

    es.completed = true;
    let bonus = exercise.boss ? 100 : 40;
    if (hasSkill("bonus-mision")) bonus = Math.round(bonus * 1.25);
    if (exercise.boss && hasSkill("instinto-jefe")) bonus = Math.round(bonus * 1.5);
    state.xp += bonus;
    pushLog(exerciseId, { type: exercise.boss ? "boss" : "ok", text: `🏆 Misión completa. Bono de +${bonus} XP.` });

    sfxSolve();
    sfxComplete();
    bus.emit("solved", {
      exerciseId,
      bugId: null,
      superEffective: effectiveness > 1,
      xpGain: bugXpTotal + bonus,
      hinted: wasHinted
    });
    bus.emit("complete", { exerciseId });

    persist();

    if (levelFromXp(state.xp) > before) {
      sfxLevelUp();
      bus.emit("levelup", { level: level.value, title: tierInfo.value.title });
    }
  }

  function resetCode(exerciseId: string) {
    const exercise = findExercise(exerciseId);
    if (!exercise) return;
    exState(exerciseId).savedCode = exercise.code;
    persist();
  }

  function toggleMute() {
    state.muted = !state.muted;
    persist();
  }

  function resetProgress() {
    const muted = state.muted;
    const studentName = state.studentName;
    const avatarName = state.avatarName;
    const fresh = defaultState();
    state.xp = fresh.xp;
    state.activeId = fresh.activeId;
    state.exercises = fresh.exercises;
    state.equipment = fresh.equipment;
    state.unlockedSkills = fresh.unlockedSkills;
    state.muted = muted;
    state.studentName = studentName;
    state.avatarName = avatarName;
    persist();
  }

  return {
    state,
    level,
    xpIntoLevel,
    tierInfo,
    bugsFixed,
    questsDone,
    noHintQuestDone,
    allComplete,
    isUnlocked,
    exState,
    setActive,
    useHint,
    saveCode,
    checkCode,
    compiling,
    resetCode,
    toggleMute,
    resetProgress,
    // las 7 misiones fijas con los parches del aula ya aplicados
    baseExercises,
    // capítulos (contenido del docente generado desde un PDF)
    chapterExercises,
    setChapterExercises,
    findExercise,
    chaptersDone,
    XP_PER_LEVEL,
    // identidad
    hasIdentity,
    setNames,
    setAvatarId,
    avatar,
    aura,
    isLinkedToAula,
    setIdentityFromStudent,
    // material de teoría
    markTheoryDone,
    isTheoryDone,
    // habilidades
    SKILLS,
    hasSkill,
    totalSkillPoints,
    spentSkillPoints,
    availableSkillPoints,
    canUnlockSkill,
    unlockSkill,
    // equipo
    weapons,
    armors,
    pets,
    equippedWeapon,
    equippedArmor,
    equippedPet,
    equipWeapon,
    equipArmor,
    equipPet,
    typeEffectiveness
  };
}
