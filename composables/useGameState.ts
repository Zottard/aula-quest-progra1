import { reactive, computed } from "vue";
import { EXERCISES } from "~/data/exercises";
import { XP_PER_LEVEL, levelFromXp, tierForLevel } from "~/data/tiers";
import { WEAPONS, ARMORS, PETS, type EquipItem, type UnlockCondition } from "~/data/items";
import type { Topic } from "~/data/modules";
import { SKILLS } from "~/data/skills";
import { useSound } from "~/composables/useSound";
import { useEventBus } from "~/composables/useEventBus";

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
    avatarName: ""
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

export function useGameState() {
  const level = computed(() => levelFromXp(state.xp));
  const xpIntoLevel = computed(() => state.xp % XP_PER_LEVEL);
  const tierInfo = computed(() => tierForLevel(level.value));

  const bugsFixed = computed(() =>
    EXERCISES.reduce((sum, ex) => sum + Object.keys(exState(ex.id).solved).length, 0)
  );
  const questsDone = computed(
    () => EXERCISES.filter((ex) => exState(ex.id).completed).length
  );
  const noHintQuestDone = computed(() =>
    EXERCISES.some((ex) => {
      const es = exState(ex.id);
      return es.completed && Object.keys(es.hinted).length === 0;
    })
  );
  const allComplete = computed(() => questsDone.value === EXERCISES.length);

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

  /** Corre los tests de la misión activa contra el código enviado. */
  function checkCode(exerciseId: string, code: string) {
    const exercise = EXERCISES.find((e) => e.id === exerciseId);
    if (!exercise) return;
    const es = exState(exerciseId);
    es.savedCode = code;

    let leveledUp = false;
    let newlySolved = 0;
    let lastSolvedId: string | null = null;

    const hintDiscount = hasSkill("ojo-certero") ? 0.8 : 0.6;
    const bugXpMultiplier = hasSkill("estudio-rapido") ? 1.15 : 1;
    const effectiveness = typeEffectiveness(exercise.topic);

    for (const bug of exercise.bugs) {
      if (es.solved[bug.id]) continue;
      if (bug.test(code)) {
        const before = level.value;
        let xpGain = es.hinted[bug.id] ? bug.xp * hintDiscount : bug.xp;
        xpGain = Math.round(xpGain * bugXpMultiplier * effectiveness);
        state.xp += xpGain;
        es.solved[bug.id] = true;
        newlySolved++;
        lastSolvedId = bug.id;
        if (levelFromXp(state.xp) > before) leveledUp = true;
        const tag = effectiveness > 1 ? " ⚡ ¡Muy efectivo!" : "";
        pushLog(exerciseId, { type: "ok", text: `✔ Bug resuelto: ${bug.label} (+${xpGain} XP)${tag}` });
        // Un golpe por click: si el código ya arregla varios bugs a la vez,
        // igual se resuelve de a uno, para que las batallas de varios bugs
        // (como el jefe) tengan turnos reales donde la ventaja de tipo cuente.
        break;
      }
    }

    if (newlySolved === 0) {
      pushLog(exerciseId, {
        type: "err",
        text: "✖ Todavía queda al menos un bug activo. Revisá la lista de abajo."
      });
      sfxWrong();
      bus.emit("wrong", { exerciseId });
    } else {
      sfxSolve();
      bus.emit("solved", { exerciseId, bugId: lastSolvedId, superEffective: effectiveness > 1 });
    }

    const allSolved = exercise.bugs.every((b) => es.solved[b.id]);
    if (allSolved && !es.completed) {
      es.completed = true;
      let bonus = exercise.boss ? 100 : 40;
      if (hasSkill("bonus-mision")) bonus = Math.round(bonus * 1.25);
      if (exercise.boss && hasSkill("instinto-jefe")) bonus = Math.round(bonus * 1.5);
      const before = level.value;
      state.xp += bonus;
      if (levelFromXp(state.xp) > before) leveledUp = true;
      pushLog(exerciseId, {
        type: exercise.boss ? "boss" : "ok",
        text: `🏆 Misión completa. Bono de +${bonus} XP.`
      });
      sfxComplete();
      bus.emit("complete", { exerciseId });
    }

    persist();

    if (leveledUp) {
      sfxLevelUp();
      bus.emit("levelup", { level: level.value, title: tierInfo.value.title });
    }
  }

  function resetCode(exerciseId: string) {
    const exercise = EXERCISES.find((e) => e.id === exerciseId);
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
    resetCode,
    toggleMute,
    resetProgress,
    XP_PER_LEVEL,
    // identidad
    hasIdentity,
    setNames,
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
