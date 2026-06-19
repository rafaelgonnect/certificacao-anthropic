import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

type PluginRow = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  version: string;
  category: string | null;
  keywords: string[];
  author: string | null;
  published: boolean;
  skillCount: number;
  updatedAt: string;
};
type SkillFile = { path: string; content: string };
type Skill = { id: string; slug: string; skillMd: string; files: SkillFile[] };
type PluginDetail = PluginRow & { skills: Skill[] };

const SKILL_TEMPLATE = "---\nname: \ndescription: \n---\n\n";

export function SkillsAdminPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ["admin-plugins"], queryFn: () => api<PluginRow[]>("/admin/plugins") });

  const publish = useMutation({ mutationFn: () => api("/admin/marketplace/publish", { method: "POST" }) });

  if (list.isLoading) return <main><p className="state">Carregando…</p></main>;
  if (list.error) return <main><p role="alert">Erro ao carregar</p></main>;

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Claude Code · Admin</div>
        <h1>Gestão de Skills</h1>
        <p>Cadastre pacotes e suas skills. Depois clique em <strong>Publicar</strong> para gerar o marketplace que os usuários instalam.</p>
      </div>

      <div className="toolbar">
        <button className="btn-sm" onClick={() => { setCreating(true); setSelected(null); }}>+ Novo pacote</button>
        <button className="btn-sm btn-secondary" onClick={() => publish.mutate()} disabled={publish.isPending}>
          {publish.isPending ? "Publicando…" : "↻ Publicar alterações"}
        </button>
        <span className="grow" />
        {publish.isSuccess && <span className="status-pill active">Publicado ✓</span>}
        {publish.isError && <span role="alert">Falha ao publicar (git)</span>}
      </div>

      <div className="mkt-admin">
        <div className="plugin-list">
          {list.data?.length === 0 && <p className="muted-note">Nenhum pacote ainda.</p>}
          {list.data?.map((p) => (
            <button
              key={p.id}
              className={"plugin-list-item" + (selected === p.id ? " is-active" : "")}
              onClick={() => { setSelected(p.id); setCreating(false); }}
            >
              <span className="pli-name">{p.displayName}</span>
              <span className="pli-meta">
                <span className={"pli-dot" + (p.published ? " on" : "")} />
                {p.slug} · v{p.version} · {p.skillCount} skill(s)
              </span>
            </button>
          ))}
        </div>

        <div>
          {creating ? (
            <CreatePlugin
              onCancel={() => setCreating(false)}
              onCreated={(id) => { qc.invalidateQueries({ queryKey: ["admin-plugins"] }); setCreating(false); setSelected(id); }}
            />
          ) : selected ? (
            <PluginEditor id={selected} onDeleted={() => setSelected(null)} />
          ) : (
            <div className="empty"><span className="emoji">🧩</span><p>Selecione um pacote à esquerda ou crie um novo.</p></div>
          )}
        </div>
      </div>
    </main>
  );
}

function CreatePlugin({ onCancel, onCreated }: { onCancel: () => void; onCreated: (id: string) => void }) {
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const create = useMutation({
    mutationFn: () => api<{ id: string }>("/admin/plugins", { method: "POST", body: JSON.stringify({ slug, displayName, description }) }),
    onSuccess: (r) => onCreated(r.id),
  });
  return (
    <div className="card card-pad">
      <h2 style={{ marginTop: 0 }}>Novo pacote</h2>
      <label>Slug (kebab-case)
        <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: superset" />
      </label>
      <label>Nome de exibição
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="ex: Superset (Colaborativa)" />
      </label>
      <label>Descrição
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Para que serve este pacote?" />
      </label>
      {create.isError && <p role="alert">{(create.error as Error).message}</p>}
      <div className="toolbar">
        <button className="btn-sm" disabled={create.isPending || !slug.trim() || !displayName.trim() || !description.trim()} onClick={() => create.mutate()}>
          {create.isPending ? "Criando…" : "Criar pacote"}
        </button>
        <button className="btn-sm btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function PluginEditor({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-plugin", id], queryFn: () => api<PluginDetail>(`/admin/plugins/${id}`) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["admin-plugin", id] }); qc.invalidateQueries({ queryKey: ["admin-plugins"] }); };

  const update = useMutation({
    mutationFn: (v: Partial<PluginRow>) => api(`/admin/plugins/${id}`, { method: "PUT", body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/plugins/${id}`, { method: "DELETE" }),
    onSuccess: () => { invalidate(); onDeleted(); },
  });
  const addSkill = useMutation({
    mutationFn: (v: { slug: string; skillMd: string }) => api(`/admin/plugins/${id}/skills`, { method: "POST", body: JSON.stringify(v) }),
    onSuccess: invalidate,
  });

  if (isLoading || !data) return <p className="state">Carregando pacote…</p>;

  return (
    <div className="card card-pad">
      <div className="toolbar" style={{ marginBottom: "0.4rem" }}>
        <h2 style={{ margin: 0 }}>{data.displayName}</h2>
        <span className="grow" />
        <label style={{ display: "flex", gap: 6, alignItems: "center", margin: 0 }}>
          <input type="checkbox" style={{ width: "auto", margin: 0 }} checked={data.published} onChange={(e) => update.mutate({ published: e.target.checked })} />
          Publicado
        </label>
      </div>
      <p className="muted-note">Edite um campo e clique em <em>Salvar</em>. As mudanças só vão pro marketplace depois de <strong>Publicar</strong>.</p>

      <div className="editor-grid">
        <Field label="Nome" value={data.displayName} onSave={(v) => update.mutate({ displayName: v })} />
        <Field label="Versão" value={data.version} onSave={(v) => update.mutate({ version: v })} />
        <Field label="Categoria" value={data.category ?? ""} onSave={(v) => update.mutate({ category: v })} />
        <Field label="Autor" value={data.author ?? ""} onSave={(v) => update.mutate({ author: v })} />
        <Field label="Keywords (vírgula)" value={data.keywords.join(", ")} onSave={(v) => update.mutate({ keywords: v.split(",").map((s) => s.trim()).filter(Boolean) })} wide />
        <Field label="Descrição" value={data.description} onSave={(v) => update.mutate({ description: v })} wide textarea />
      </div>

      <h3 style={{ marginTop: "1.4rem" }}>Skills ({data.skills.length})</h3>
      {data.skills.map((s) => <SkillBlock key={s.id} pluginId={id} skill={s} onChange={invalidate} />)}
      <NewSkill onAdd={(slug, skillMd) => addSkill.mutate({ slug, skillMd })} pending={addSkill.isPending} />

      <div style={{ marginTop: "1.4rem" }}>
        <button className="btn-sm btn-ghost" onClick={() => { if (confirm("Excluir o pacote inteiro?")) remove.mutate(); }}>Excluir pacote</button>
      </div>
    </div>
  );
}

function Field({ label, value, onSave, wide, textarea }: { label: string; value: string; onSave: (v: string) => void; wide?: boolean; textarea?: boolean }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <label style={wide ? { gridColumn: "1 / -1" } : undefined}>
      {label}
      {textarea
        ? <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} />
        : <input value={v} onChange={(e) => setV(e.target.value)} />}
      {dirty && <button className="btn-sm" style={{ marginTop: "0.4rem" }} onClick={() => onSave(v)}>Salvar</button>}
    </label>
  );
}

function SkillBlock({ pluginId, skill, onChange }: { pluginId: string; skill: Skill; onChange: () => void }) {
  const [md, setMd] = useState(skill.skillMd);
  const [open, setOpen] = useState(false);
  const save = useMutation({
    mutationFn: () => api(`/admin/plugins/${pluginId}/skills/${skill.id}`, { method: "PUT", body: JSON.stringify({ skillMd: md }) }),
    onSuccess: onChange,
  });
  const del = useMutation({
    mutationFn: () => api(`/admin/plugins/${pluginId}/skills/${skill.id}`, { method: "DELETE" }),
    onSuccess: onChange,
  });
  const files = Array.isArray(skill.files) ? skill.files : [];
  return (
    <div className="skill-block">
      <div className="skill-block-head">
        <button className="sb-title" onClick={() => setOpen((o) => !o)}>{open ? "▼" : "▶"} {skill.slug}/SKILL.md</button>
        <button className="btn-sm btn-ghost" onClick={() => { if (confirm("Excluir skill?")) del.mutate(); }}>Excluir</button>
      </div>
      {open && (
        <div className="skill-block-body">
          <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={16} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: "0.82rem" }} />
          {md !== skill.skillMd && <button className="btn-sm" style={{ marginTop: "0.5rem" }} disabled={save.isPending} onClick={() => save.mutate()}>Salvar SKILL.md</button>}
          {files.length > 0 && (
            <>
              <p className="muted-note" style={{ marginTop: "0.8rem" }}>Arquivos de apoio (somente leitura aqui):</p>
              <div className="chip-row">
                {files.map((f) => <span key={f.path} className="file-chip">📄 {f.path}</span>)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function NewSkill({ onAdd, pending }: { onAdd: (slug: string, skillMd: string) => void; pending: boolean }) {
  const [slug, setSlug] = useState("");
  const [md, setMd] = useState(SKILL_TEMPLATE);
  return (
    <div className="skill-block" style={{ borderStyle: "dashed" }}>
      <div className="skill-block-body" style={{ paddingTop: "0.85rem" }}>
        <h4 style={{ margin: "0 0 0.6rem" }}>Nova skill</h4>
        <label>Slug (kebab-case)
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: minha-skill" />
        </label>
        <label>SKILL.md
          <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={8} style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: "0.82rem" }} />
        </label>
        <button className="btn-sm" disabled={pending || !slug.trim() || !md.trim()} onClick={() => { onAdd(slug.trim(), md); setSlug(""); setMd(SKILL_TEMPLATE); }}>+ Adicionar skill</button>
      </div>
    </div>
  );
}
