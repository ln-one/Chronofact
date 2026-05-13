import { startServer } from "./app.js";

const port = process.env.PORT ?? 3001;

startServer({ port })
  .then(() => {
    console.log(`Chronofact API listening on http://localhost:${port}`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
