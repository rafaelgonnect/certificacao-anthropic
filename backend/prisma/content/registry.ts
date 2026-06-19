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

// Foundations = módulos base + módulos de aprofundamento. A versão efetiva é
// definida AQUI (sobrepõe a do pack base) e precisa ser bumpada a cada mudança
// de conteúdo da Foundations para o seed por versão atualizar no boot.
// 4: adiciona diagramas Mermaid (loop de tool-use, arquitetura MCP).
// 5: revisão acadêmica — lição de raciocínio migrada de extended thinking
//    (budget_tokens, legado) para adaptive thinking + effort; IDs de exemplo
//    atualizados para claude-sonnet-4-6.
const foundations: CertificationPack = {
  ...ccaFoundations,
  version: 5,
  modules: [...ccaFoundations.modules, ...foundationsExtraModules],
};

export const packs: CertificationPack[] = [
  foundations,
  aiFluency,
  buildWithClaude,
  ccaDeveloperPrep,
  ccaSellerPrep,
];
