import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";
import { Mermaid } from "./Mermaid.js";

// Links externos (http/https) abrem em nova aba com rel seguro; internos seguem normais.
function MdLink({ href, children }: ComponentProps<"a">) {
  const external = !!href && /^https?:\/\//i.test(href);
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

// Blocos ```mermaid viram diagrama; os demais blocos/inline seguem como código.
function MdCode({ className, children, ...props }: ComponentProps<"code">) {
  if (/\blanguage-mermaid\b/.test(className ?? "")) {
    return <Mermaid chart={String(children).trim()} />;
  }
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

/**
 * Renderiza markdown com GFM ativo — em especial o auto-link de URLs cruas
 * (ex.: "Leitura oficial: https://docs.anthropic.com/…" vira link clicável que
 * leva ao site oficial real).
 */
export function Prose({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={{ a: MdLink, code: MdCode }}>
      {children}
    </Markdown>
  );
}
