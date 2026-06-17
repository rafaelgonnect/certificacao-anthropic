// Registro central de todas as trilhas/certificações disponíveis na plataforma.
//
// Adicionar uma nova trilha = importar o pack e incluí-lo no array `packs`.
// A Foundations recebe módulos extras (cca-foundations-extra) concatenados aos
// módulos base, e tem a versão bumpada para forçar o re-seed por versão no boot.
import type { CertificationPack } from "./pack.js";
import { ccaFoundations } from "./cca-foundations.js";
import { foundationsExtraModules } from "./cca-foundations-extra.js";
import { aiFluency } from "./ai-fluency.js";
import { buildWithClaude } from "./build-with-claude.js";
import { ccaDeveloperPrep } from "./cca-developer-prep.js";
import { ccaSellerPrep } from "./cca-seller-prep.js";

// Foundations = módulos base + módulos de aprofundamento. version bumpada (2 -> 3)
// para que o seed por versão atualize o conteúdo no próximo deploy.
const foundations: CertificationPack = {
  ...ccaFoundations,
  version: 3,
  modules: [...ccaFoundations.modules, ...foundationsExtraModules],
};

export const packs: CertificationPack[] = [
  foundations,
  aiFluency,
  buildWithClaude,
  ccaDeveloperPrep,
  ccaSellerPrep,
];
