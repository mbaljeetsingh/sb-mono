#!/usr/bin/env bash
# Netlify build-skip script.
# Exits 0 to skip the build, non-zero to run it.
#
# Usage in netlify.toml:
#   ignore = "bash scripts/netlify-ignore.sh <app-name>"

set -u

APP="${1:?app name required: app|web}"

# Always rebuild on lockfile / turbo / repo-wide config changes.
COMMON=(
  "pnpm-lock.yaml"
  "turbo.json"
  "pnpm-workspace.yaml"
)

case "$APP" in
  app)
    PATHS=(
      "apps/app/"
      "packages/engine/"
      "packages/themes/"
      "packages/shared/"
      "layers/ui/"
      "layers/app-base/"
    )
    ;;
  web)
    PATHS=(
      "apps/web/"
      "packages/shared/"
      "layers/ui/"
    )
    ;;
  *)
    echo "Unknown app: $APP" >&2
    exit 1
    ;;
esac

# First deploy or missing cached ref → build (don't skip).
if [[ -z "${CACHED_COMMIT_REF:-}" ]]; then
  echo "No cached commit ref — running build."
  exit 1
fi

# git diff --quiet exits 0 if no diff (skip build), 1 if there are changes (build).
git diff --quiet "$CACHED_COMMIT_REF" "${COMMIT_REF:-HEAD}" -- "${COMMON[@]}" "${PATHS[@]}"
