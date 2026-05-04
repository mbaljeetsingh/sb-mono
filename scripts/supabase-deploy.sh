#!/bin/bash
# scripts/supabase-deploy.sh — deploy schema + edge functions to Supabase.
#
# Mirrors np-mono's pattern: multi-project array, flag-driven selection.
# v1: just one project (sb-mono). v3 will add per-academy projects to the
# PROJECTS array so a single run pushes to all networks at once.
set -e

# ─────────── Project refs ───────────
# Get refs from your Supabase dashboard once the projects exist:
#   supabase projects create sb-mono --org-id <id>
#   ↳ output includes the ref. Paste it here, replacing the placeholder.
SB_REF="${SB_PROJECT_REF:-REPLACE_ME_AFTER_CREATING_PROJECT}"
PROJECTS=("sb-mono:$SB_REF")
# Future v3 example:
# XPERIENCE_REF="..."
# PROJECTS+=("xperience-academy:$XPERIENCE_REF")

DEPLOY_DB=false
DEPLOY_FUNCTIONS=false
FUNCTION_NAMES=()

usage() {
  echo "Usage: ./scripts/supabase-deploy.sh [--db] [--functions [name...]] [--all]"
  echo ""
  echo "  --db                   Push database migrations"
  echo "  --functions [name...]  Deploy edge functions (all if no names given)"
  echo "  --all                  Both db + all functions"
  echo ""
  echo "Examples:"
  echo "  ./scripts/supabase-deploy.sh --db"
  echo "  ./scripts/supabase-deploy.sh --functions update-subscription"
  echo "  ./scripts/supabase-deploy.sh --all"
  echo ""
  echo "Project refs:"
  for p in "${PROJECTS[@]}"; do
    echo "  - ${p%%:*}: ${p##*:}"
  done
  exit 1
}

[[ $# -eq 0 ]] && usage

while [[ $# -gt 0 ]]; do
  case $1 in
    --db) DEPLOY_DB=true; shift ;;
    --all) DEPLOY_DB=true; DEPLOY_FUNCTIONS=true; shift ;;
    --functions)
      DEPLOY_FUNCTIONS=true
      shift
      while [[ $# -gt 0 && ! "$1" == --* ]]; do
        FUNCTION_NAMES+=("$1")
        shift
      done
      ;;
    *) usage ;;
  esac
done

for project in "${PROJECTS[@]}"; do
  name="${project%%:*}"
  ref="${project##*:}"

  if [[ "$ref" == "REPLACE_ME_AFTER_CREATING_PROJECT" ]]; then
    echo ""
    echo "⚠  Project '$name' has no ref set."
    echo "   Create it first: supabase projects create $name --org-id <id>"
    echo "   Then either edit this script or export SB_PROJECT_REF=<ref>."
    exit 1
  fi

  echo ""
  echo "========== $name ($ref) =========="

  pnpm supabase link --project-ref "$ref"

  if $DEPLOY_DB; then
    echo "-> Pushing migrations..."
    pnpm supabase db push
  fi

  if $DEPLOY_FUNCTIONS; then
    if [ ${#FUNCTION_NAMES[@]} -eq 0 ]; then
      echo "-> Deploying all edge functions..."
      pnpm supabase functions deploy
    else
      for func_name in "${FUNCTION_NAMES[@]}"; do
        echo "-> Deploying $func_name..."
        pnpm supabase functions deploy "$func_name"
      done
    fi
  fi

  echo "✓ $name done"
done

echo ""
echo "========== All projects deployed =========="
