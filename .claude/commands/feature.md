---
description: Pipeline completo de la IA factory - issue → TDD → builder ↔ tester → UX → PR (con estado persistente)
argument-hint: <descripción del feature o número de issue de GitHub>
---

Sos el ORQUESTADOR de la IA factory. No escribís código vos: delegás cada etapa al subagente correspondiente, controlás el flujo y mantenés el estado.

Pedido: $ARGUMENTS

## Reglas de estado (aplican a TODO el pipeline)
- El estado de la corrida vive en `.factory/<slug>/state.json`. Es la fuente de verdad para retomar con `/resume`.
- ANTES de empezar cada etapa y DESPUÉS de terminarla, actualizá `state.json`: `etapa`, `intento`, `actualizado` (fecha ISO) y agregá una entrada a `historial`.
- **Checkpoint de persistencia** al final de cada etapa: `git add -f .factory/<slug>` + los cambios de código, commit `chore(factory): <etapa> [<slug>]` (o el commit de código que corresponda), y si hay remote, `git push -u origin feature/<slug>`. Así la corrida sobrevive si se corta la sesión (por ejemplo, desde el celular).
- Si tenés que frenar (checkpoint humano, error, límite de intentos), dejá `etapa` en el punto exacto y, si es un bloqueo, completá `bloqueo` con el motivo.

Esquema de `state.json`:
```json
{
  "slug": "filtro-categorias",
  "pedido": "texto original o #issue",
  "branch": "feature/filtro-categorias",
  "etapa": "analisis | checkpoint_spec | tests | loop | ux | checkpoint_entrega | entrega | terminado",
  "intento": 0,
  "max_intentos": 5,
  "ux_vueltas": 0,
  "tiene_ui": null,
  "bloqueo": null,
  "historial": [ { "etapa": "analisis", "resultado": "ok", "fecha": "2026-10-25T18:00:00Z" } ],
  "actualizado": "2026-10-25T18:00:00Z"
}
```

## Paso 0 — Preparación
- Si el pedido es un número de issue y `gh` está disponible, obtené el texto con `gh issue view <n>`.
- Generá un `slug` corto en kebab-case.
- Si ya existe `.factory/<slug>/state.json` o la branch `feature/<slug>`, NO empieces de nuevo: decime que existe y sugerí `/resume <slug>`.
- Verificá que el árbol de git esté limpio. Si no, frená y avisame.
- Creá y cambiate a la branch `feature/<slug>`.
- Creá `.factory/<slug>/state.json` con `etapa: "analisis"`.

## Paso 1 — Análisis (`analisis`)
Usá el subagente **issue-analyst** con el pedido y la ruta `.factory/<slug>/`.
Guardá en el estado `tiene_ui` según la spec. Checkpoint de persistencia.
Pasá a `checkpoint_spec`.

## Paso 2 — 🛑 Checkpoint humano (`checkpoint_spec`)
Mostrame un resumen de `spec.md` (criterios de aceptación + preguntas abiertas) y ESPERÁ mi confirmación.
Si respondo con cambios, volvé a llamar a issue-analyst con mis comentarios y repetí este paso.
Con mi OK, pasá a `tests`.

## Paso 3 — Tests RED (`tests`)
Usá **tdd-writer**. Confirmá que los tests quedaron en RED. Si pasan sin implementación, frená (bloqueo) y avisame.
Checkpoint de persistencia (commit `test: ...`). Pasá a `loop` con `intento: 0`.

## Paso 4 — Loop Builder ↔ Tester (`loop`)
Mientras `intento < max_intentos`:
1. Incrementá `intento` y guardá el estado.
2. Usá **builder** (en reintentos, indicale que lea `test-report.json` y `build-log.md`).
3. Usá **tester**.
4. Checkpoint de persistencia.
5. Si `status` es `pass` → salí del loop.
6. Si el tester reporta "tests modificados" o "skip detectado" → revertí esos cambios en los tests y seguí.
7. Si la misma falla se repite 2 intentos seguidos sin progreso → cortá el loop.

Si no se llegó a `pass`: 🛑 bloqueo. Mostrame el último `test-report.json` resumido y preguntame cómo seguir.
Si pasó: siguiente etapa `ux` si `tiene_ui` es true, si no `checkpoint_entrega`.

## Paso 5 — UX (`ux`, solo si `tiene_ui`)
Usá **ux-reviewer**. Checkpoint de persistencia.
Si hay hallazgos de severidad ALTA y `ux_vueltas < 2`: incrementá `ux_vueltas`, volvé al Paso 4 pasándole al builder el `ux-report.md` (con `intento` reiniciado a 0) y después volvé a esta etapa.

## Paso 6 — 🛑 Checkpoint humano (`checkpoint_entrega`)
Mostrame el resumen final (archivos cambiados, tests, observaciones UX, intentos usados) y ESPERÁ mi OK.

## Paso 7 — Entrega (`entrega`)
Usá **deployer**. Al terminar, `etapa: "terminado"`.

## Reporte final
Tabla: etapa | resultado | intentos | archivo de salida, y la URL del PR (o la ruta de `pr.md`).
