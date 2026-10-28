// Utilidades para inspeccionar árboles de React (sin DOM) y el código fuente.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function readSrc(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

// ── Árbol de elementos de React ────────────────────────────────────────────

function childrenOf(node) {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node;
  const c = node.props?.children;
  if (c == null) return [];
  return Array.isArray(c) ? c.flat(Infinity) : [c];
}

/** Texto plano de un nodo (concatena strings/numbers descendientes). */
export function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return childrenOf(node).map(textOf).join("");
}

/** Recorre todos los elementos (objetos con props) del árbol. */
export function walk(node, visit, parents = []) {
  if (node == null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit, parents));
    return;
  }
  if (node.props) visit(node, parents);
  childrenOf(node).forEach((c) => walk(c, visit, [...parents, node]));
}

export function classesOf(el) {
  const cn = el?.props?.className;
  return typeof cn === "string" ? cn.split(/\s+/).filter(Boolean) : [];
}

/** Elemento más profundo cuyo texto contiene `needle`. */
export function deepestContaining(tree, needle) {
  let best = null;
  let bestDepth = -1;
  walk(tree, (el, parents) => {
    if (textOf(el).includes(needle) && parents.length > bestDepth) {
      best = { el, parents };
      bestDepth = parents.length;
    }
  });
  return best;
}

// ── Código fuente ─────────────────────────────────────────────────────────

/**
 * Devuelve el texto crudo del primer atributo `className=` a partir de `from`
 * (string literal o expresión `{...}` completa con llaves balanceadas).
 */
export function classAttrAfter(src, from) {
  const i = src.indexOf("className=", from);
  if (i === -1) return null;
  let j = i + "className=".length;
  if (src[j] === '"') {
    const end = src.indexOf('"', j + 1);
    return { text: src.slice(j + 1, end), index: i };
  }
  if (src[j] === "{") {
    let depth = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === "{") depth++;
      else if (src[k] === "}") {
        depth--;
        if (depth === 0) return { text: src.slice(j + 1, k), index: i };
      }
    }
  }
  return null;
}

/** Recorta `src` entre la primera aparición de `start` y la siguiente de `end`. */
export function between(src, start, end) {
  const a = src.indexOf(start);
  if (a === -1) throw new Error(`No se encontró el ancla ${JSON.stringify(start)}`);
  const b = src.indexOf(end, a + start.length);
  return src.slice(a, b === -1 ? undefined : b);
}

/** Tokens de clase presentes en un texto (string, template literal o cn()). */
export function tokens(text) {
  return (text ?? "").split(/[\s"'`(),{}?:]+/).filter(Boolean);
}

/** Clases que permiten cortar palabras largas aun dentro de un flex/grid item. */
export const WRAP_ANYWHERE = ["wrap-anywhere", "[overflow-wrap:anywhere]", "break-all"];
/** Clases que cortan palabras largas solo si el item puede encogerse (min-w-0). */
export const WRAP_BREAK_WORD = ["break-words", "wrap-break-word", "[overflow-wrap:break-word]"];
