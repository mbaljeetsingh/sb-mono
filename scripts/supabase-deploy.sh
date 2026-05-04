#!/usr/bin/env bash
# scripts/supabase-deploy.sh — push local schema to a Supabase project.
#
# Usage:
#   ./scripts/supabase-deploy.sh           # deploy migrations only
#   ./scripts/supabase-deploy.sh --seed    # also re-seed (DANGEROUS in prod)
#
# Requires: SUPABASE_PROJECT_REF env var (or arg --project <ref>).
# Requires: supabase CLI logged in (`supabase login`).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
SEED="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_REF="$2"; shift 2 ;;
    --seed)    SEED="true";       shift ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PROJECT_REF" ]]; then
  echo "❌ Set SUPABASE_PROJECT_REF (or pass --project <ref>)" >&2
  exit 1
fi

echo "→ linking sb-mono to project $PROJECT_REF"
pnpm exec supabase link --project-ref "$PROJECT_REF"

echo "→ pushing migrations"
pnpm exec supabase db push

if [[ "$SEED" == "true" ]]; then
  echo "⚠  re-seeding remote database (DESTRUCTIVE)"
  read -p "Type the project ref to confirm: " CONFIRM
  if [[ "$CONFIRM" != "$PROJECT_REF" ]]; then
    echo "❌ aborted"; exit 1
  fi
  pnpm exec supabase db reset --linked
fi

echo "✅ deploy complete"
