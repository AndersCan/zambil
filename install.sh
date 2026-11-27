#!/bin/sh
# Installs or updates zambil on macOS and Linux:
#   curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
#
# ZAMBIL_HOME      the folder of the clone, default ~/.local/share/zambil
# ZAMBIL_BIN_DIR   the folder of the zambil link, default ~/.local/bin
# ZAMBIL_GIT_URL   the repo to clone, default https://github.com/AndersCan/zambil.git
# ZAMBIL_GIT_REF   the branch to install, default main
#
# Everything is in functions, so that sh reads the whole script before it runs a command.

set -eu

lowest_node_major=24

say() {
  printf '%s\n' "$@"
}

fail() {
  printf '%s\n' "$@" >&2
  exit 1
}

# Prints a path with ~ in place of the home folder, so the user can copy it.
tilde() {
  case $1 in
    "$HOME") printf '~\n' ;;
    "$HOME"/*) printf '~/%s\n' "${1#"$HOME"/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

check_node() {
  if ! command -v node > /dev/null 2>&1; then
    fail "zambil needs Node $lowest_node_major or later, and node is not on your PATH." \
      "Install Node $lowest_node_major or later from https://nodejs.org, then run this script again."
  fi
  node_version=$(node --version)
  node_major=${node_version#v}
  node_major=${node_major%%.*}
  case $node_major in
    '' | *[!0-9]*) fail "zambil cannot read the version of Node: node --version printed \"$node_version\"." ;;
  esac
  if [ "$node_major" -lt "$lowest_node_major" ]; then
    fail "zambil needs Node $lowest_node_major or later, and this is Node $node_version." \
      "Install Node $lowest_node_major or later from https://nodejs.org, then run this script again."
  fi
  if ! command -v npm > /dev/null 2>&1; then
    fail "zambil needs npm, and npm is not on your PATH. npm comes with Node from https://nodejs.org." \
      "Some Linux packages of Node leave it out. Then install the npm package of your Linux distribution."
  fi
}

check_git() {
  if ! command -v git > /dev/null 2>&1; then
    fail "zambil needs git, and git is not on your PATH." \
      "Install git from https://git-scm.com, then run this script again."
  fi
}

# Stops before any change when the link path holds a file that is not a zambil link.
check_link() {
  if [ -L "$link" ]; then
    linked_to=$(readlink "$link")
    case $linked_to in
      "$entry" | */apps/cli/src/main.ts) return ;;
    esac
    fail "$link already exists and points to $linked_to, not to zambil." \
      "zambil did not change it. Remove it, or set ZAMBIL_BIN_DIR to another folder, then run this script again."
  fi
  if [ -e "$link" ]; then
    fail "$link already exists and is not a link to zambil." \
      "zambil did not change it. Remove it, or set ZAMBIL_BIN_DIR to another folder, then run this script again."
  fi
}

clone() {
  say "Downloading zambil into $(tilde "$install_dir")."
  mkdir -p "$(dirname "$install_dir")"
  git clone --quiet --branch "$git_ref" "$git_url" "$install_dir" < /dev/null
}

is_zambil_clone() {
  [ -f "$install_dir/package.json" ] || return 1
  grep -q '"name": "zambil"' "$install_dir/package.json" || return 1
  top_level=$(git -C "$install_dir" rev-parse --show-toplevel 2> /dev/null) || return 1
  [ "$(cd "$top_level" && pwd -P)" = "$(cd "$install_dir" && pwd -P)" ]
}

# Moves the clone forward to the newest commit of the branch. It never merges, resets or stashes.
update() {
  if ! is_zambil_clone; then
    fail "$install_dir already exists and is not a clone of zambil." \
      "zambil did not change it. Move it, or set ZAMBIL_HOME to another folder, then run this script again."
  fi
  if [ -n "$(git -C "$install_dir" status --porcelain --untracked-files=no)" ]; then
    fail "zambil did not update, because the clone in $install_dir has local changes." \
      "Commit them, or put them aside with: git -C \"$install_dir\" stash" \
      "Then run this script again."
  fi
  branch=$(git -C "$install_dir" symbolic-ref --quiet --short HEAD || true)
  if [ "$branch" != "$git_ref" ]; then
    fail "zambil did not update, because the clone in $install_dir is not on the branch $git_ref." \
      "To update, run: git -C \"$install_dir\" switch $git_ref" \
      "Then run this script again."
  fi
  say "Updating zambil in $(tilde "$install_dir")."
  git -C "$install_dir" fetch --quiet "$git_url" "$git_ref" < /dev/null
  if ! git -C "$install_dir" merge-base --is-ancestor HEAD FETCH_HEAD; then
    fail "zambil did not update, because the branch $git_ref in $install_dir has commits that $git_url does not have." \
      "zambil kept them. Move them to another branch, then run this script again."
  fi
  git -C "$install_dir" merge --quiet --ff-only FETCH_HEAD < /dev/null
}

# pnpm comes from npm, so it need not be installed. npm runs outside the clone, because the clone pins pnpm.
# Only the dependencies that run zambil are installed. No script runs, so the clone gets no git hooks.
install_dependencies() {
  pnpm_version=$(node -p 'require(process.argv[1]).devEngines.packageManager.version' "$install_dir/package.json")
  say "Installing the dependencies of zambil with pnpm $pnpm_version. The first time, this downloads about 120 MB."
  install_log=$(mktemp)
  if ! (cd / && npm exec --yes --package="pnpm@$pnpm_version" -- \
    pnpm --dir "$install_dir" install --prod --frozen-lockfile --ignore-scripts \
    --config.confirm-modules-purge=false) < /dev/null > "$install_log" 2>&1; then
    cat "$install_log" >&2
    rm -f "$install_log"
    fail "zambil cannot install its dependencies. pnpm printed the text above."
  fi
  rm -f "$install_log"
}

link_zambil() {
  mkdir -p "$bin_dir"
  if [ -L "$link" ] && [ "$(readlink "$link")" = "$entry" ]; then return; fi
  if [ -L "$link" ]; then say "$(tilde "$link") pointed to $(readlink "$link"). It now points to this install."; fi
  ln -sf "$entry" "$link"
  say "Linked $(tilde "$link") to $(tilde "$entry")."
}

# The line to add to the profile of the shell in $SHELL, for a bin folder that is not on PATH.
path_hint() {
  shown_bin=$bin_dir
  case $bin_dir in
    "$HOME"/*) shown_bin="\$HOME/${bin_dir#"$HOME"/}" ;;
  esac
  case $(basename "${SHELL:-sh}") in
    zsh)
      profile='~/.zshrc'
      line="export PATH=\"$shown_bin:\$PATH\""
      ;;
    bash)
      profile='~/.bashrc'
      if [ "$(uname -s)" = Darwin ]; then profile='~/.bash_profile'; fi
      line="export PATH=\"$shown_bin:\$PATH\""
      ;;
    fish)
      profile='~/.config/fish/config.fish'
      line="fish_add_path \"$shown_bin\""
      ;;
    *)
      profile='~/.profile'
      line="export PATH=\"$shown_bin:\$PATH\""
      ;;
  esac
  say "" "$(tilde "$bin_dir") is not on your PATH. Add this line to $profile:" "" "  $line" "" \
    "Then open a new terminal."
}

report_path() {
  case ":$PATH:" in
    *":$bin_dir:"*) ;;
    *)
      path_hint
      return
      ;;
  esac
  found=$(command -v zambil || true)
  if [ "$found" != "$link" ]; then
    say "" "Your shell runs another zambil first: $found" \
      "Remove it, or put $(tilde "$bin_dir") earlier in your PATH."
  fi
}

main() {
  git_url=${ZAMBIL_GIT_URL:-https://github.com/AndersCan/zambil.git}
  git_ref=${ZAMBIL_GIT_REF:-main}
  install_dir=${ZAMBIL_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/zambil}
  bin_dir=${ZAMBIL_BIN_DIR:-$HOME/.local/bin}
  case $install_dir in /*) ;; *) install_dir=$PWD/$install_dir ;; esac
  case $bin_dir in /*) ;; *) bin_dir=$PWD/$bin_dir ;; esac
  link=$bin_dir/zambil
  entry=$install_dir/apps/cli/src/main.ts

  check_node
  check_git
  check_link
  if [ -e "$install_dir" ]; then update; else clone; fi
  install_dependencies
  link_zambil
  report_path
  say "" "zambil is ready. To set it up, run:" "" "  zambil init"
}

main "$@"
