/** The address of the script that installs and updates zambil. */
export const installScriptUrl =
  "https://raw.githubusercontent.com/AndersCan/zambil/main/install.sh";

/** The command from the README that installs zambil, or updates it. */
export const installScriptCommand = `curl -fsSL ${installScriptUrl} | sh`;
