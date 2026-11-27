#!/bin/sh
# Installs or updates zambil on macOS and Linux:
#   curl -fsSL https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh | sh
#
# ZAMBIL_HOME      the folder of the clone, default ~/.local/share/zambil
# ZAMBIL_BIN_DIR   the folder of the zambil link, default ~/.local/bin
# ZAMBIL_GIT_URL   the repo to clone, default https://github.com/AndersCan/zambil.git
# ZAMBIL_GIT_REF   the release tag or the branch to install, default the newest release, or main without one
#
# An install takes the newest release: the highest tag of the form vX.Y.Z. A clone on main moves to it once
# the release is at or after the commit of the clone. A branch that ZAMBIL_GIT_REF names is followed from
# then on, and a release tag that it names is installed once.
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
      "Install Node $lowest_node_major or later from https://nodejs.org, then run the install command again."
  fi
  node_version=$(node --version)
  node_major=${node_version#v}
  node_major=${node_major%%.*}
  case $node_major in
    '' | *[!0-9]*) fail "zambil cannot read the version of Node: node --version printed \"$node_version\"." ;;
  esac
  if [ "$node_major" -lt "$lowest_node_major" ]; then
    fail "zambil needs Node $lowest_node_major or later, and this is Node ${node_version#v}." \
      "Install Node $lowest_node_major or later from https://nodejs.org, then run the install command again."
  fi
  if ! command -v npm > /dev/null 2>&1; then
    fail "zambil needs npm, and npm is not on your PATH. npm comes with Node from https://nodejs.org." \
      "Some Linux packages of Node leave it out. Then install the npm package of your Linux distribution."
  fi
}

check_git() {
  if ! command -v git > /dev/null 2>&1; then
    fail "zambil needs git, and git is not on your PATH." \
      "Install git from https://git-scm.com, then run the install command again."
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
      "zambil did not change it. Remove it, or set ZAMBIL_BIN_DIR to another folder, then run the install command again."
  fi
  if [ -e "$link" ]; then
    fail "$link already exists and is not a link to zambil." \
      "zambil did not change it. Remove it, or set ZAMBIL_BIN_DIR to another folder, then run the install command again."
  fi
  if ! mkdir -p "$bin_dir" 2> /dev/null || [ ! -w "$bin_dir" ]; then
    fail "zambil cannot write to $bin_dir, so it cannot link zambil there." \
      "Set ZAMBIL_BIN_DIR to a folder that you own and that is on your PATH, then run the install command again."
  fi
}

# Prints the highest tag of the form vX.Y.Z of the repo at the URL, or nothing when it has none.
newest_release() {
  tags=$(git ls-remote --tags --refs "$1" 'v*' < /dev/null) || return 1
  node -e '
    const versions = [];
    for (const line of process.argv[1].split("\n")) {
      const match = /\srefs\/tags\/v(\d+)\.(\d+)\.(\d+)$/.exec(line);
      if (match !== null) versions.push(match.slice(1).map(Number));
    }
    versions.sort((first, second) => first[0] - second[0] || first[1] - second[1] || first[2] - second[2]);
    const newest = versions.at(-1);
    if (newest !== undefined) console.log(`v${newest.join(".")}`);
  ' "$tags"
}

# Sets target and kind for ZAMBIL_GIT_REF: a release tag or a branch of the repo at the URL.
resolve_ref() {
  if ! refs=$(git ls-remote --refs "$1" "refs/tags/$git_ref" "refs/heads/$git_ref" < /dev/null); then
    fail "zambil cannot read the releases and branches of $1. git printed the reason above. Run the install command again."
  fi
  target=$git_ref
  if has_ref "refs/tags/$git_ref"; then
    kind=release
  elif has_ref "refs/heads/$git_ref"; then
    kind=branch
  else
    fail "$1 has no release or branch named $git_ref. Releases are named like v0.1.0." \
      "Fix ZAMBIL_GIT_REF, or leave it out to install the newest release."
  fi
}

# Whether the output of git ls-remote in $refs names this exact ref. ls-remote reads its patterns as globs.
has_ref() {
  printf '%s\n' "$refs" | awk -v wanted="$1" '$2 == wanted { found = 1 } END { exit !found }'
}

# The last line of a refusal. It repeats ZAMBIL_GIT_REF, so that the next run keeps the choice of the user.
rerun_line() {
  if [ -n "$git_ref" ]; then
    printf '%s\n' "Then run the install command again with ZAMBIL_GIT_REF=$git_ref."
  else
    printf '%s\n' "Then run the install command again."
  fi
}

# Stops when HEAD is detached at commits that no tag, no branch and not $1 has, so that a switch loses none.
keep_detached_commits() {
  if [ -n "$branch" ]; then return; fi
  if [ -n "$(git -C "$install_dir" tag --points-at HEAD)" ]; then return; fi
  if [ -n "$(git -C "$install_dir" for-each-ref --points-at HEAD refs/heads)" ]; then return; fi
  if git -C "$install_dir" merge-base --is-ancestor HEAD "$1"; then return; fi
  keep_branch=$(free_branch_name)
  fail "zambil did not update, because the clone in $(tilde "$install_dir") has commits that no release or branch has." \
    "To keep them on the new branch $keep_branch, run:" "" \
    "  git -C \"$install_dir\" branch $keep_branch" "" \
    "$(rerun_line)"
}

# Sets target to the newest release of the repo at the URL, and kind to release. Without a release: main.
pick_release() {
  if ! target=$(newest_release "$1"); then
    fail "zambil cannot read the releases of $1. git printed the reason above. Run the install command again."
  fi
  kind=release
  if [ -z "$target" ]; then
    target=main
    kind=branch
  fi
}

# A clone follows a branch other than releases only when ZAMBIL_GIT_REF named that branch.
remember_choice() {
  if [ -z "$git_ref" ]; then return; fi
  if [ "$kind" = branch ]; then
    git -C "$install_dir" config zambil.follow branch
  else
    git -C "$install_dir" config --unset zambil.follow || true
  fi
}

clone() {
  if [ -n "$git_ref" ]; then resolve_ref "$git_url"; else pick_release "$git_url"; fi
  if [ -z "$git_ref" ] && [ "$kind" = branch ]; then
    say "zambil has no release yet, so this installs the newest commit of the branch main."
  fi
  say "Downloading zambil $target into $(tilde "$install_dir")."
  mkdir -p "$(dirname "$install_dir")"
  if ! git -c advice.detachedHead=false clone --quiet --branch "$target" "$git_url" "$install_dir" < /dev/null; then
    fail "zambil did not install. git printed the reason above. Run the install command again."
  fi
  remember_choice
  fresh=yes
}

is_zambil_clone() {
  [ -f "$install_dir/package.json" ] || return 1
  [ "$(node -p 'require(process.argv[1]).name' "$install_dir/package.json" 2> /dev/null)" = zambil ] || return 1
  top_level=$(git -C "$install_dir" rev-parse --show-toplevel 2> /dev/null) || return 1
  [ "$(cd "$top_level" && pwd -P)" = "$(cd "$install_dir" && pwd -P)" ]
}

# A branch name that the clone does not have yet, so that advice to keep commits never fails on an old name.
free_branch_name() {
  candidate=my-zambil-changes
  number=1
  while git -C "$install_dir" show-ref --verify --quiet "refs/heads/$candidate"; do
    number=$((number + 1))
    candidate=my-zambil-changes-$number
  done
  printf '%s\n' "$candidate"
}

# Moves the clone to the release or the branch that it follows. It never merges, resets or stashes.
update() {
  if ! is_zambil_clone; then
    fail "$install_dir already exists and is not a clone of zambil." \
      "zambil did not change it. Move it, or set ZAMBIL_HOME to another folder, then run the install command again."
  fi
  if [ -n "$(git -C "$install_dir" status --porcelain --untracked-files=no)" ]; then
    fail "zambil did not update, because the clone in $install_dir has local changes. To put them aside, run:" "" \
      "  git -C \"$install_dir\" stash" "" \
      "Then run the install command again. After the update, \`git -C \"$install_dir\" stash pop\` brings the changes back."
  fi
  source_url=$git_url
  source=$git_url
  if origin_url=$(git -C "$install_dir" remote get-url origin 2> /dev/null); then
    source=origin
    source_url=$origin_url
  fi
  branch=$(git -C "$install_dir" symbolic-ref --quiet --short HEAD || true)
  follow=$(git -C "$install_dir" config --get zambil.follow || true)
  if [ -n "$git_ref" ]; then
    resolve_ref "$source_url"
  elif [ -n "$branch" ] && [ "$follow" = branch ]; then
    target=$branch
    kind=branch
  else
    pick_release "$source_url"
  fi
  if [ "$kind" = release ]; then fetch_release; fi
  if [ -z "$git_ref" ] && [ "$kind" = release ] && [ -n "$branch" ]; then
    leave_branch_for_release
  fi
  if [ "$kind" = release ]; then update_to_release; else update_branch; fi
  remember_choice
}

# Without ZAMBIL_GIT_REF, a clone on main moves to the newest release, unless it is ahead of that release.
leave_branch_for_release() {
  if [ "$branch" != main ]; then
    target=main
    kind=branch
    return
  fi
  if git -C "$install_dir" merge-base --is-ancestor HEAD "$release"; then return; fi
  if git -C "$install_dir" merge-base --is-ancestor "$release" HEAD; then
    say "The clone is ahead of the newest release $target, so it follows the branch main until a newer release."
  else
    say "The newest release $target does not have the commit of the clone, so the clone follows the branch main."
  fi
  target=main
  kind=branch
}

# Moves the clone forward to the newest commit of the branch $target on its origin.
update_branch() {
  is_named=no
  if [ -z "$branch" ] && [ -n "$git_ref" ]; then is_named=yes; fi
  if [ "$branch" != "$target" ] && [ "$is_named" = no ]; then
    fail "zambil did not update, because the clone in $install_dir is not on the branch $target. To switch to it, run:" "" \
      "  git -C \"$install_dir\" switch $target" "" \
      "$(rerun_line)"
  fi
  say "Updating zambil in $(tilde "$install_dir") from $source_url."
  if ! git -C "$install_dir" fetch --quiet "$source" "$target" < /dev/null; then
    fail "zambil did not update. git printed the reason above, and the clone is as it was. Run the install command again."
  fi
  fetched=$(git -C "$install_dir" rev-parse FETCH_HEAD)
  before=$(git -C "$install_dir" rev-parse HEAD)
  if [ "$is_named" = yes ]; then switch_to_branch; fi
  if ! git -C "$install_dir" merge-base --is-ancestor HEAD "$fetched"; then
    keep_branch=$(free_branch_name)
    fail "zambil did not update, because the branch $target in $(tilde "$install_dir") has commits that $source_url does not have." \
      "To keep them on the new branch $keep_branch and update, run:" "" \
      "  git -C \"$install_dir\" branch $keep_branch && git -C \"$install_dir\" reset --keep $fetched" "" \
      "$(rerun_line)"
  fi
  if ! git -C "$install_dir" merge --quiet --ff-only "$fetched" < /dev/null; then
    fail "zambil did not update, because git cannot move the clone forward. git printed the reason above and changed no file."
  fi
  if [ "$is_named" = yes ]; then
    say "Switched zambil to the branch $target."
  elif [ "$(git -C "$install_dir" rev-parse HEAD)" = "$before" ]; then
    say "zambil is up to date on the branch $target."
  else
    say "Updated zambil to $(git -C "$install_dir" log -1 --format='%h %s')."
  fi
}

# Moves a clone at a release to the branch $target that ZAMBIL_GIT_REF names. The tree is clean already.
switch_to_branch() {
  keep_detached_commits "$fetched"
  if git -C "$install_dir" show-ref --verify --quiet "refs/heads/$target"; then
    switched=$(git -C "$install_dir" switch --quiet "$target" < /dev/null 2>&1) || is_named=failed
  else
    switched=$(git -C "$install_dir" switch --quiet --create "$target" "$fetched" < /dev/null 2>&1) || is_named=failed
  fi
  if [ "$is_named" = failed ]; then
    fail "$switched" "zambil did not update, because git cannot switch the clone to the branch $target. git printed the reason above."
  fi
  branch=$target
}

# Fetches the tag of the release $target, and sets release to its commit.
fetch_release() {
  if ! git -C "$install_dir" fetch --quiet --no-tags "$source" "+refs/tags/$target:refs/tags/$target" < /dev/null; then
    fail "zambil did not update. git printed the reason above, and the clone is as it was. Run the install command again."
  fi
  release=$(git -C "$install_dir" rev-parse "refs/tags/$target^{commit}")
}

# Moves the clone to the release $target. Commits that only the clone has stop it, so that none is lost.
update_to_release() {
  say "Updating zambil in $(tilde "$install_dir") from $source_url."
  before=$(git -C "$install_dir" rev-parse HEAD)
  keep_detached_commits "$release"
  if [ "$before" = "$release" ] && [ -z "$branch" ]; then
    say "zambil is up to date: $target."
    return
  fi
  if ! git -C "$install_dir" switch --quiet --detach "refs/tags/$target" < /dev/null; then
    fail "zambil did not update, because git cannot switch the clone to $target. git printed the reason above."
  fi
  say "Switched zambil to $target."
}

# pnpm comes from npm, so it need not be installed. npm runs outside the clone, because the clone pins pnpm.
# Only the dependencies that run zambil are installed. No script runs, so the clone gets no git hooks.
install_dependencies() {
  pnpm_version=$(node -p 'require(process.argv[1]).devEngines.packageManager.version' "$install_dir/package.json")
  if [ "$fresh" = yes ]; then
    say "Installing the dependencies of zambil with pnpm $pnpm_version. This downloads about 120 MB."
  else
    say "Installing the dependencies of zambil with pnpm $pnpm_version."
  fi
  install_log=$(mktemp)
  if ! (cd / && npm exec --yes --package="pnpm@$pnpm_version" -- \
    pnpm --dir "$install_dir" install --prod --frozen-lockfile --ignore-scripts \
    --config.confirm-modules-purge=false) < /dev/null > "$install_log" 2>&1; then
    cat "$install_log" >&2
    rm -f "$install_log"
    fail "zambil cannot install its dependencies. npm or pnpm printed the reason above." \
      "Until the install command runs to the end, zambil can fail to start. Fix the problem, then run the install command again."
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
    *":$bin_dir:"* | *":$bin_dir/:"*) ;;
    *)
      path_hint
      return
      ;;
  esac
  found=$(command -v zambil || true)
  found_dir=$(cd "$(dirname "$found")" 2> /dev/null && pwd -P || true)
  if [ "$found_dir" != "$(cd "$bin_dir" && pwd -P)" ]; then
    say "" "Your shell runs another zambil first: $found" \
      "Remove it, or put $(tilde "$bin_dir") earlier in your PATH."
  fi
}

main() {
  git_url=${ZAMBIL_GIT_URL:-https://github.com/AndersCan/zambil.git}
  git_ref=${ZAMBIL_GIT_REF:-}
  install_dir=${ZAMBIL_HOME:-${XDG_DATA_HOME:-$HOME/.local/share}/zambil}
  bin_dir=${ZAMBIL_BIN_DIR:-$HOME/.local/bin}
  case $install_dir in /*) ;; *) install_dir=$PWD/$install_dir ;; esac
  case $bin_dir in /*) ;; *) bin_dir=$PWD/$bin_dir ;; esac
  if [ "$bin_dir" != / ]; then bin_dir=${bin_dir%/}; fi
  if [ "$install_dir" != / ]; then install_dir=${install_dir%/}; fi
  fresh=no
  link=$bin_dir/zambil
  entry=$install_dir/apps/cli/src/main.ts

  check_node
  check_git
  check_link
  if [ -e "$install_dir" ]; then update; else clone; fi
  if [ ! -d "$install_dir/node_modules" ]; then fresh=yes; fi
  install_dependencies
  link_zambil
  report_path
  if [ "$fresh" = yes ]; then
    say "" "zambil is ready. To set it up, run:" "" "  zambil init"
  else
    say "" "zambil is ready."
  fi
}

main "$@"
