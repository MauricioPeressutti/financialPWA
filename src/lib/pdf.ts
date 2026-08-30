import "server-only";

/** Texto de un PDF (capa de texto). Vacío si es un PDF escaneado / solo imágenes. */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text).trim();
  } catch (err) {
    console.error("pdf extract:", err);
    return "";
  }
}
