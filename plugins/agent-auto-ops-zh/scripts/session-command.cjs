var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// tools/session-command.mjs
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_crypto = require("node:crypto");
async function main() {
  const [root, verb, ...argv] = process.argv.slice(2);
  if (!root || !verb) throw Error("Usage: session-command.cjs SESSION_DIRECTORY observe|status|move|click|key|type|fill|scroll|context|stop [arguments]");
  const dir = import_node_path.default.resolve(root), flag = (name2) => {
    const i = argv.indexOf(name2);
    return i < 0 ? void 0 : argv[i + 1];
  };
  const num = (v, name2) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw Error("Integer required: " + name2);
    return n;
  };
  let action, name, args = {};
  const texts = () => flag("--text-file") ? import_node_fs.default.readFileSync(import_node_path.default.resolve(flag("--text-file")), "utf8") : argv[0];
  if (verb === "move") action = { kind: "move_relative", dx: num(argv[0], "dx"), dy: num(argv[1], "dy") };
  else if (verb === "click") action = { kind: "click_current", button: argv[0] ?? "left", count: 1 };
  else if (verb === "key") action = { kind: "press_key", key: argv[0], modifiers: flag("--mods")?.split(",") ?? [] };
  else if (verb === "type" || verb === "fill") action = { kind: verb === "fill" ? "fill_text" : "type_text", text: texts(), ...verb === "fill" ? { submit: argv.includes("--submit") } : {} };
  else if (verb === "scroll") action = { kind: "scroll_current", ticks: num(argv[0], "ticks") };
  else if (verb === "context") {
    name = "kvm_set_view_context";
    args = { display_mode: argv[0], observation_id: flag("--observation") };
  } else if (["observe", "status", "stop"].includes(verb)) {
    name = "kvm_" + verb;
    if (verb === "observe" && argv.includes("--wait")) args = { wait_for_change: true, timeout_ms: 1800 };
  } else throw Error("Unknown command");
  if (action) {
    name = "kvm_act";
    args = { action, observation_id: flag("--observation"), operation_id: flag("--operation") ?? (0, import_node_crypto.randomUUID)() };
  }
  if ((action || verb === "context") && !args.observation_id) throw Error("Pass --observation from the image you inspected; latest is never selected implicitly");
  const id = (0, import_node_crypto.randomUUID)(), lock = import_node_path.default.join(dir, "command.lock"), request = import_node_path.default.join(dir, "request.json");
  if (import_node_fs.default.existsSync(lock)) {
    const prior = JSON.parse(import_node_fs.default.readFileSync(lock, "utf8"));
    let alive = true;
    try {
      process.kill(prior.pid, 0);
    } catch (e) {
      if (e.code === "ESRCH") alive = false;
    }
    let reply;
    try {
      reply = JSON.parse(import_node_fs.default.readFileSync(import_node_path.default.join(dir, "response.json"), "utf8"));
    } catch {
    }
    if (!alive && !import_node_fs.default.existsSync(request) && reply?.id === prior.id) import_node_fs.default.unlinkSync(lock);
    else throw Error("BUSY or unresolved outcome: the earlier command still owns this session");
  }
  const fd = import_node_fs.default.openSync(lock, "wx");
  import_node_fs.default.writeFileSync(fd, JSON.stringify({ pid: process.pid, id }));
  import_node_fs.default.closeSync(fd);
  const temp = import_node_path.default.join(dir, "request-" + id + ".tmp");
  let watcher, timer, wake, completed = false, submitted = false;
  try {
    if (import_node_fs.default.existsSync(request)) throw Error("BUSY: a command is already pending");
    const response = import_node_path.default.join(dir, "response.json");
    const result = await new Promise((resolve, reject) => {
      const check = () => {
        try {
          const r = JSON.parse(import_node_fs.default.readFileSync(response, "utf8"));
          if (r.id === id) resolve(r);
        } catch {
        }
      };
      watcher = import_node_fs.default.watch(dir, (_event, file) => {
        if (String(file) === "response.json") check();
      });
      wake = setInterval(check, 100);
      timer = setTimeout(() => reject(Error("Outcome unknown: command timed out; observe before any retry")), 22e3);
      submitted = true;
      import_node_fs.default.writeFileSync(temp, JSON.stringify({ id, name, arguments: args }));
      import_node_fs.default.renameSync(temp, request);
      check();
    });
    completed = true;
    const output = { ...result, text: result.isError ? result.text : void 0 };
    process.stdout.write(JSON.stringify(output) + "\n");
    if (result.isError) process.exitCode = 1;
  } finally {
    watcher?.close();
    clearTimeout(timer);
    clearInterval(wake);
    if (import_node_fs.default.existsSync(temp)) import_node_fs.default.unlinkSync(temp);
    if (completed || !submitted) import_node_fs.default.unlinkSync(lock);
  }
}
main().catch((e) => {
  process.stderr.write(e.message + "\n");
  process.exitCode = 1;
});
