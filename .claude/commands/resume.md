---
description: Retoma una corrida de la IA factory desde donde quedó (lee .factory/<slug>/state.json). Sin argumento, lista las corridas.
argument-hint: [slug]
---

Sos el ORQUESTADOR de la IA factory retomando una corrida.

Argumento: $ARGUMENTS

## 1. Encontrar la corrida
- Si no hay argumento:
  - Buscá `.factory/*/state.json` en la branch actual.
  - Buscá también en las branches `feature/*` locales y remotas (`git fetch` si hay remote; `git branch -a --list '*feature/*'` y `git show <branch>:.factory/<slug>/state.json`).
  - Mostrame una tabla: slug | branch | etapa | intento | bloqueo | actualizado, y preguntame cuál retomar. Si hay una sola sin terminar, proponé esa.
- Si hay argumento, usá ese slug.

## 2. Preparar
- Cambiate a la branch `feature/<slug>` (si solo existe en el remote, creala trackeándola). Si hay cambios sin commitear, frená y avisame.
- Leé `state.json` y los artefactos existentes en `.factory/<slug>/` (spec, test-plan, build-log, test-report, ux-report).
- Si `etapa` es `terminado`, decímelo y mostrá el link del PR si lo hay.

## 3. Confirmar
Mostrame en pocas líneas: qué se pidió, qué etapas se completaron, en qué etapa e intento quedó, y el bloqueo si lo hubo. Preguntame si sigo desde ahí, si reinicio una etapa puntual, o si cambio algo (por ejemplo, subir `max_intentos`).

## 4. Continuar
Con mi OK, leé `.claude/commands/feature.md` y seguí EXACTAMENTE sus reglas a partir del paso que corresponde a la `etapa` guardada (incluidas las reglas de estado y los checkpoints de persistencia). No repitas etapas ya completadas salvo que te lo pida.
- `analisis` → Paso 1 · `checkpoint_spec` → Paso 2 · `tests` → Paso 3 · `loop` → Paso 4 (continuando el `intento` guardado) · `ux` → Paso 5 · `checkpoint_entrega` → Paso 6 · `entrega` → Paso 7.
- Si la etapa tenía un `bloqueo`, primero resolvelo conmigo y limpiá el campo.
