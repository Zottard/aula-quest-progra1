// Extracción de texto de un PDF, 100% en el navegador (pdf.js) — cero costo
// de IA en este paso. El texto ya extraído es lo único que después viaja al
// servidor para el llamado a DeepSeek (ver server/api/generate-chapter.post.ts).
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    pages.push(line);
  }

  // Colapsar espacios/saltos repetidos: pdf.js separa cada fragmento de texto
  // como un item propio, así que sin esto el string queda lleno de espacios
  // de más — son tokens de IA gastados en nada en el próximo paso.
  return pages
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
