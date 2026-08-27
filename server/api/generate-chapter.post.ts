// Convierte el texto de un PDF de ejercicios en un capítulo jugable, vía
// DeepSeek. Corre server-side (Nitro function, funciona en Vercel aunque
// ssr:false) para que la API key nunca viaje al bundle del cliente.
//
// deepseek-chat (no deepseek-reasoner): esto es extracción/formato de texto
// a JSON, no razonamiento multi-paso — el modelo "reasoner" gastaría mucho
// más token/plata por el mismo resultado.
//
// Casos de prueba: preferimos EXTRAER los ejemplos ya resueltos del propio
// enunciado (así el "oráculo" de corrección sale de lo que ya escribió la
// cátedra, no de una alucinación) — pero no todos los ejercicios de una guía
// real traen ejemplo (ver memoria del proyecto: el ejercicio 1 de la primera
// guía que probamos no tenía). En vez de descartar esos ejercicios en
// silencio, la IA arma un caso ella misma para esos casos puntuales, pero
// marcado "computed": true — el docente lo revisa/corrige a mano en la
// pantalla de publicación antes de que quede visible para los alumnos.
//
// Tipo de batalla ("topic"): la IA también clasifica cada ejercicio en
// operadores/ciclos/vectores según qué hace falta para resolverlo, para que
// la mecánica de afinidad de arma (ver typeEffectiveness() en useGameState.ts)
// también aplique a los capítulos — si todos quedaran "neutros" no habría
// ningún incentivo a cambiar de arma en un capítulo, que es justamente la
// gracia del sistema tipo Pokémon.
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_INPUT_CHARS = 15000;
// Techo pedido por el usuario: un capítulo con más de 10 ejercicios "es un
// montón" para jugar de una — mejor que suba el PDF completo de la guía y
// que el docente elija qué generar en tandas, a un capítulo gigante. Se lo
// pedimos al modelo (ahorra tokens de output si el PDF trae muchos más) y
// además lo garantizamos server-side por si no lo respeta.
const MAX_EXERCISES = 10;

const SYSTEM_PROMPT = `Sos un asistente que convierte guías de ejercicios de programación en C++ (cátedra de Programación 1, nivel introductorio: variables, cin/cout, operadores aritméticos, if simple) en ejercicios evaluables por un compilador real, para un juego con mecánica tipo Pokémon (cada ejercicio es un "enemigo" de un tipo, y ciertas armas son más efectivas contra ciertos tipos).

Generá COMO MÁXIMO ${MAX_EXERCISES} ejercicios en total. Si el texto trae más, procesá solo los primeros ${MAX_EXERCISES} (en el orden en que aparecen) e ignorá el resto — no hace falta que avises que los recortaste.

Para CADA ejercicio que proceses (de los que traen ejemplo resuelto y de los que no):
- "title": título corto, ej "Ejercicio 3 · Sueldo del vendedor".
- "briefing": la consigna para el alumno, en HTML simple (uno o dos <p>), clara. Mismo problema que el original, podés prolijar la redacción pero NO cambiarlo ni agregar datos que no estén.
- "inputSpec": lista de los datos que el programa va a leer con cin, EN EL MISMO ORDEN en que los lee, descritos en pocas palabras. Ej: ["cantidad de horas trabajadas", "valor por hora"]. Es lo que el alumno necesita saber para escribir sus cin en el orden correcto. Si el programa no lee nada por teclado, devolvé [].
- "topic": el tipo de batalla, EXACTAMENTE uno de "operadores" | "ciclos" | "vectores", según qué hace falta para resolverlo:
  - "operadores": alcanza con variables sueltas, cuentas aritméticas y como mucho un if — no hay que repetir nada ni guardar una lista de valores. Es el caso más común en guías introductorias (la gran mayoría de "ingresá X e Y, calculá Z" son esto).
  - "ciclos": hace falta repetir algo un número de veces o hasta cumplir una condición (sumar/contar/acumular varios valores ingresados uno por uno, por ejemplo).
  - "vectores": hace falta guardar y recorrer una lista de varios valores relacionados entre sí (un arreglo de notas, productos, etc.), no solo variables sueltas.
  - Elegí el tipo que mejor represente la DIFICULTAD PRINCIPAL del ejercicio, no cualquier detalle menor.
- "testCases": al menos un caso de prueba:
  - Si el ejercicio TRAE uno o más ejemplos ya resueltos en el texto (input -> resultado esperado), extraé cada uno TAL CUAL está escrito (no cambies los números) y marcá "computed": false.
  - Si el ejercicio NO trae ningún ejemplo resuelto en el texto, INVENTÁ vos un caso: elegí valores de entrada simples y redondos, aplicá con mucho cuidado la fórmula/regla exacta que describe el enunciado para calcular el resultado, y marcá "computed": true.
  - Cada caso: "stdin" (los valores de entrada, en el orden en que el programa los leería con cin, uno por línea) y "expectedValues" (los resultados clave que el programa debe mostrar para ese input — sin el símbolo $, con % si el resultado esperado es un porcentaje).

Reglas estrictas:
- NO escribas el código de la solución.
- "inputSpec" tiene que tener exactamente un elemento por cada línea de "stdin", en el mismo orden. Si no coinciden, el alumno no puede saber en qué orden poner sus cin.
- Si el caso es "computed": true, la cuenta tiene que estar bien hecha — el docente puede confiar en el número si no lo corrige, así que verificala vos mismo antes de responder.
- Devolvé SOLO este JSON, sin texto adicional: {"exercises":[{"title":"...","briefing":"...","inputSpec":["..."],"topic":"operadores","testCases":[{"stdin":"...","expectedValues":["..."],"computed":false}]}]}`;

interface DeepSeekChoice {
  message?: { content?: string };
}
interface DeepSeekResponse {
  choices?: DeepSeekChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  if (!config.deepseekApiKey) {
    throw createError({ statusCode: 500, statusMessage: "Falta configurar DEEPSEEK_API_KEY en el servidor." });
  }

  const body = await readBody<{ text?: string }>(event);
  const text = (body?.text ?? "").trim();
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: "Falta el texto extraído del PDF." });
  }

  const truncated = text.length > MAX_INPUT_CHARS;
  const inputText = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.deepseekApiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: 8000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: inputText }
      ]
    })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw createError({
      statusCode: 502,
      statusMessage: `Error de DeepSeek (${res.status}): ${errBody.slice(0, 300)}`
    });
  }

  const data = (await res.json()) as DeepSeekResponse;
  const content = data.choices?.[0]?.message?.content ?? "{}";

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw createError({ statusCode: 502, statusMessage: "DeepSeek devolvió una respuesta que no es JSON válido." });
  }

  const allExercises = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
  const capped = allExercises.length > MAX_EXERCISES;
  const exercises = capped ? allExercises.slice(0, MAX_EXERCISES) : allExercises;

  return { exercises, truncated, capped, usage: data.usage ?? null };
});
