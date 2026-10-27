#!/usr/bin/env bash
# Hook de la IA factory: registra cuándo arranca y termina cada subagente.
# Se engancha en PreToolUse y PostToolUse de la herramienta que lanza subagentes.
# Escribe en .factory/<slug>/activity.log de la corrida más reciente (o .factory/activity.log).
# Nunca bloquea: siempre sale con 0.

input="$(cat 2>/dev/null)"
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
[ -d "$root/.factory" ] || exit 0

# Extraer campos del JSON del evento (python3 si está; si no, sed básico)
get() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$input" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    sys.exit(0)
cur=d
for k in sys.argv[1].split('.'):
    cur=cur.get(k,{}) if isinstance(cur,dict) else {}
print(cur if isinstance(cur,str) else '')
" "$1" 2>/dev/null
  else
    local key="${1##*.}"
    printf '%s' "$input" | sed -n "s/.*\"$key\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" | head -n1
  fi
}

event="$(get hook_event_name)"
agent="$(get tool_input.subagent_type)"
desc="$(get tool_input.description)"
[ -z "$agent" ] && agent="subagente"

case "$event" in
  PreToolUse)  action="▶ inicia" ;;
  PostToolUse) action="■ termina" ;;
  *)           action="$event" ;;
esac

# Corrida más reciente = state.json modificado más recientemente
latest="$(ls -t "$root"/.factory/*/state.json 2>/dev/null | head -n1)"
if [ -n "$latest" ]; then log="$(dirname "$latest")/activity.log"; else log="$root/.factory/activity.log"; fi

printf '%s | %s | %s%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$agent" "$action" "${desc:+ — $desc}" >> "$log" 2>/dev/null
exit 0
