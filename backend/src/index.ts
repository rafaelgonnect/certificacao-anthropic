import { createApp } from "./server.js";
import { loadEnv } from "./env.js";
const env = loadEnv();
createApp().listen(env.PORT, () => { console.log(`API on http://localhost:${env.PORT}`); });
