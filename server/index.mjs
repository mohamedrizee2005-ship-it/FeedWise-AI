import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.mjs";
import { createAppServer } from "./http.mjs";

const portFlag = process.argv.indexOf("--port");
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 3000;
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Choose a valid port from 1 to 65535.");
const filename =
  process.env.FEEDWISE_DB_PATH ||
  fileURLToPath(new URL("../data/feedwise.sqlite", import.meta.url));
const db = openDatabase(filename);
const server = createAppServer(db);
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Close the other FeedWise window or choose another port.`
      : error.message,
  );
  db.close();
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `FeedWise running at http://localhost:${port}\nKeep this terminal open. Press Ctrl+C to stop.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeIdleConnections();
  });
