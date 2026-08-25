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
  async function runCpp(code: string): Promise<CompileResult> {
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
