import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const args of [
  ["--watch", "server/index.mjs", "--port", "3001"],
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
]) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  children.push(child);
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => stop(code ?? 0));
}
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => stop());
