// Compilador real de C++, vía Wandbox (API pública, sin API key, CORS abierto).
// Se compila con sanitizers (-fsanitize=undefined) para que los bugs de
// comportamiento indefinido (ej. leer un vector fuera de rango) den un error
// de verdad en vez de "funcionar de casualidad" según qué basura haya en el
// stack. Ver memoria del proyecto / README para el detalle de por qué.
const WANDBOX_URL = "https://wandbox.org/api/compile.json";
const COMPILER = "gcc-13.2.0";
const CLIENT_TIMEOUT_MS = 10000;
const SANITIZE_FLAGS = "-fsanitize=undefined\n-fno-sanitize-recover=all\n-g";

export type CompileStatus = "ok" | "compile_error" | "runtime_error" | "timeout" | "network_error";

export interface CompileResult {
  status: CompileStatus;
  /** stdout del programa (solo tiene sentido cuando status === "ok" o "runtime_error") */
  stdout: string;
  /** stderr del programa: mensajes de sanitizer/crash cuando status === "runtime_error" */
  stderr: string;
  /** stderr del compilador (g++) cuando status === "compile_error" */
  compileError: string;
}

interface WandboxResponse {
  status: string;
  compiler_error?: string;
  program_output?: string;
  program_error?: string;
}

export function useCompiler() {
  async function runCpp(code: string, stdin?: string): Promise<CompileResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch(WANDBOX_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          code,
          compiler: COMPILER,
          options: "warning",
          stdin: stdin ?? "",
          "compiler-option-raw": SANITIZE_FLAGS
        })
      });
      clearTimeout(timer);

      if (!res.ok) {
        return { status: "network_error", stdout: "", stderr: "", compileError: `HTTP ${res.status}` };
      }

      const data = (await res.json()) as WandboxResponse;
      const stdout = data.program_output ?? "";
      const stderr = data.program_error ?? "";
      const compileError = data.compiler_error ?? "";
      const ranAtAll = stdout.length > 0 || stderr.length > 0;

      if (data.status === "0") {
        return { status: "ok", stdout, stderr, compileError: "" };
      }
      if (ranAtAll) {
        return { status: "runtime_error", stdout, stderr, compileError: "" };
      }
      return {
        status: "compile_error",
        stdout: "",
        stderr: "",
        compileError: compileError.trim() || "Error desconocido al compilar."
      };
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        return { status: "timeout", stdout: "", stderr: "", compileError: "" };
      }
      return {
        status: "network_error",
        stdout: "",
        stderr: "",
        compileError: e?.message ?? "No se pudo conectar con el compilador."
      };
    }
  }

  return { runCpp };
}

/** Normaliza salida para comparar contra el resultado esperado: fin de línea
 * uniforme, sin espacios colgando al final de cada línea, sin líneas vacías
 * de más al principio/final. */
export function normalizeOutput(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

const NUMERIC_RE = /^-?\d+(?:[.,]\d+)?%?$/;

/** Chequeo de salida "libre" para los capítulos armados desde un PDF: en vez
 * de exigir una salida exacta (el enunciado no fija el formato de impresión,
 * a diferencia de las 7 misiones fijas), busca que el valor esperado
 * aparezca en algún lado de la salida real del alumno.
 *
 * Si el valor esperado es numérico, compara números (con tolerancia, para
 * no romper por redondeo/formato de decimales) en vez de exigir que el
 * string aparezca literal — así "26.12" matchea aunque el alumno haya
 * impuesto "26.1200" o "IMC: 26.12". Si no es numérico, hace un contains de
 * texto case-insensitive. */
export function outputContainsValue(stdout: string, expected: string): boolean {
  const clean = expected.trim();
  if (!clean) return true;

  if (NUMERIC_RE.test(clean)) {
    const target = parseFloat(clean.replace(",", "."));
    const found = [...stdout.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => parseFloat(m[0].replace(",", ".")));
    return found.some((n) => Math.abs(n - target) < 0.05);
  }

  return normalizeOutput(stdout).toLowerCase().includes(clean.toLowerCase());
}
