// STYLE.md fixes 30 fps; "12.5s" style arguments convert with it.
export const FPS_DEFAULT = 30;

/** `--name value` / `--flag` parsing against a small type map; everything else is positional. */
export const parseArgs = (argv, types) => {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const name = arg.slice(2);
    const type = types[name];
    if (!type) throw new Error(`Unknown option --${name}`);
    if (type === "boolean") flags[name] = true;
    else {
      const value = argv[++i];
      if (value === undefined) throw new Error(`--${name} needs a value`);
      flags[name] = type === "number" ? Number(value) : value;
    }
  }
  return { positional, flags };
};
