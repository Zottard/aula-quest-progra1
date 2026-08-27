// Convierte un PDF de TEORÍA (apunte, capítulo, guía de contenido) en el
// "material previo" que los alumnos leen antes de la clase, con preguntas de
// comprensión cortas.
//
// Es un endpoint SEPARADO de generate-chapter.post.ts a propósito: ese sigue
// generando ejercicios evaluables por el compilador y no se toca. Son las dos
// mitades del aula invertida — la teoría se lee antes, los ejercicios se
// resuelven — y mezclarlas en un solo prompt daría peor resultado en ambas.
//
// Las preguntas de comprensión son deliberadamente pocas y de opción múltiple:
// la investigación sobre aula invertida es consistente en que si el trabajo
// previo pesa más que la tarea tradicional, los alumnos directamente no lo
// hacen. Son un "ticket de entrada", no un examen.
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_INPUT_CHARS = 15000;
const MAX_SECTIONS = 6;
const MAX_CHECKS = 4;

const SYSTEM_PROMPT = `Sos un asistente que convierte apuntes de teoría de programación en C++ (cátedra de Programación 1, nivel introductorio) en material de lectura previa para un modelo de aula invertida.

Devolvé:
- "title": título corto del material, ej "Operadores aritméticos y de comparación".
- "sections": COMO MÁXIMO ${MAX_SECTIONS} secciones de lectura. Cada una:
  - "heading": título corto de la sección.
  - "body": el contenido explicado de forma clara y breve, en HTML simple (solo <p>, <ul>, <li>, <code>, <strong>). Entre 2 y 5 oraciones por sección. Podés reordenar y prolijar la redacción del apunte original, pero NO inventes contenido que no esté ni agregues temas nuevos.
- "checks": COMO MÁXIMO ${MAX_CHECKS} preguntas de comprensión de opción múltiple sobre lo que acabás de explicar. Cada una:
  - "question": la pregunta.
  - "options": entre 3 y 4 opciones (texto plano, sin numerar).
  - "correctIndex": el índice (0-based) de la opción correcta.

Reglas estrictas:
- Las preguntas deben poder responderse SOLO con lo que está en las secciones que vos mismo escribiste.
- Que sean de comprensión, no de memoria literal: que verifiquen que entendieron la idea.
- Una sola opción correcta por pregunta, y que las incorrectas sean plausibles (errores típicos de un principiante), no absurdas.
- Nivel introductorio: nada de punteros, memoria dinámica, objetos ni polimorfismo aunque el apunte los mencione al pasar.
- Devolvé SOLO este JSON, sin texto adicional: {"title":"...","sections":[{"heading":"...","body":"..."}],"checks":[{"question":"...","options":["..."],"correctIndex":0}]}`;

interface DeepSeekResponse {
  choices?: { message?: { content?: string } }[];
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
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 6000,
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

  const sections = Array.isArray(parsed?.sections) ? parsed.sections.slice(0, MAX_SECTIONS) : [];
  // Descartamos preguntas con un correctIndex que no apunte a ninguna opción:
  // si la IA se equivoca ahí, el alumno no podría acertar nunca.
  const checks = (Array.isArray(parsed?.checks) ? parsed.checks : [])
    .filter(
      (c: any) =>
        Array.isArray(c?.options) &&
        c.options.length >= 2 &&
        Number.isInteger(c?.correctIndex) &&
        c.correctIndex >= 0 &&
        c.correctIndex < c.options.length
    )
    .slice(0, MAX_CHECKS);

  return {
    title: typeof parsed?.title === "string" ? parsed.title : "",
    sections,
    checks,
    truncated,
    usage: data.usage ?? null
  };
});
