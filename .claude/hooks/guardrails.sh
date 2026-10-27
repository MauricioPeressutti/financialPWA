#!/usr/bin/env bash
# Hook PreToolUse para Bash: bloquea comandos peligrosos.
# Claude Code envía el evento como JSON por stdin. Salir con código 2 bloquea el comando
# y el mensaje de stderr se le devuelve al agente.

input="$(cat)"
# Extrae el comando con jq si está; si no, usa el JSON crudo (funciona igual para buscar patrones).
if command -v jq >/dev/null 2>&1; then
  cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  cmd="$input"
fi

[ -z "$cmd" ] && exit 0

block() { echo "BLOQUEADO por guardrails: $1" >&2; exit 2; }

case "$cmd" in
  *"rm -rf /"*|*"rm -rf ~"*|*"rm -rf ."*)        block "borrado recursivo peligroso" ;;
  *"push --force"*|*"push -f"*)                    block "push forzado no permitido" ;;
  *"git push"*" main"*|*"git push"*" master"*)     block "push directo a main/master" ;;
  *"gh pr merge"*)                                  block "el merge lo hace un humano" ;;
  *"git reset --hard"*)                             block "reset --hard no permitido" ;;
  *"kubectl"*"prod"*|*"--env=prod"*|*"--prod"*)     block "deploy a producción no permitido" ;;
  *".env"*"cat"*|*"cat"*".env"*)                    block "no leer archivos .env" ;;
esac

exit 0
