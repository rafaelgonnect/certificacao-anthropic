import { createApp } from "./server.js";
import { loadEnv } from "./env.js";
import { materialize } from "./marketplace/materialize.js";
const env = loadEnv();
createApp().listen(env.PORT, () => {
  console.log(`API on http://localhost:${env.PORT}`);
  // Regenera o repo git do marketplace a partir do banco (fonte da verdade).
  // Tolerante a falha: não derruba a API se o git não estiver disponível.
  materialize()
    .then(() => console.log("marketplace git materializado"))
    .catch((e) => console.error("materialize no boot falhou:", e));
});
