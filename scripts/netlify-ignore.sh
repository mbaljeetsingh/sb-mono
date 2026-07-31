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

# No usable cached ref → build (don't skip).
#
# Netlify signals "no cache" by setting CACHED_COMMIT_REF *equal to*
# COMMIT_REF, not by leaving it empty (docs: "When a build runs without
# cache, CACHED_COMMIT_REF will be the same as the COMMIT_REF"). Diffing a
# commit against itself is always empty, so checking only for the empty var
# cancelled every cache-less build — and a cancelled build saves no cache,
# which made the next build cache-less too. One evicted/cleared cache
# therefore cancelled every production deploy from then on.
if [[ -z "${CACHED_COMMIT_REF:-}" || "${CACHED_COMMIT_REF}" == "${COMMIT_REF:-}" ]]; then
  echo "No usable cached commit ref — running build."
  exit 1
fi

# The diff paths below are repo-root-relative; make that true regardless of
# the directory Netlify invokes us from.
cd "$(git rev-parse --show-toplevel)" || exit 1

# git diff --quiet exits 0 if no diff (skip build), 1 if there are changes (build).
git diff --quiet "$CACHED_COMMIT_REF" "${COMMIT_REF:-HEAD}" -- "${COMMON[@]}" "${PATHS[@]}"
