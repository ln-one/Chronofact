import { loadRuntimeEnv } from "./env.js";
import { startServer } from "./app.js";

loadRuntimeEnv();

const port = Number(process.env.PORT || 3002);

startServer({ port })
  .then(() => {
    console.log(`Chronofact Agent listening on http://127.0.0.1:${port}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
