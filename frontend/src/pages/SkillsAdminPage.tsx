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
type Skill = { id: string; slug: string; skillMd: string };
type PluginDetail = PluginRow & { skills: Skill[] };

export function SkillsAdminPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["admin-plugins"], queryFn: () => api<PluginRow[]>("/admin/plugins") });

  const create = useMutation({
    mutationFn: (v: { slug: string; displayName: string; description: string }) =>
      api<{ id: string }>("/admin/plugins", { method: "POST", body: JSON.stringify(v) }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["admin-plugins"] }); setSelected(r.id); },
  });

  const publish = useMutation({
    mutationFn: () => api("/admin/marketplace/publish", { method: "POST" }),
  });

  function novoPacote() {
    const slug = prompt("Slug do pacote (kebab-case, ex: git-helpers):")?.trim();
    if (!slug) return;
    const displayName = prompt("Nome de exibição:")?.trim() || slug;
    const description = prompt("Descrição:")?.trim() || "Sem descrição";
    create.mutate({ slug, displayName, description });
  }

  if (list.isLoading) return <main><p className="state">Carregando…</p></main>;
  if (list.error) return <main><p role="alert">Erro ao carregar</p></main>;

  return (
    <main>
      <div className="page-head">
        <div className="eyebrow">Claude Code · Admin</div>
        <h1>Gestão de Skills</h1>
        <p>Cadastre pacotes e suas skills. Clique em <strong>Publicar</strong> para gerar o marketplace que os usuários instalam.</p>
      </div>

      <div className="row-actions" style={{ marginBottom: 16 }}>
        <button className="btn-sm" onClick={novoPacote} disabled={create.isPending}>+ Novo pacote</button>
        <button className="btn-sm" onClick={() => publish.mutate()} disabled={publish.isPending}>
          {publish.isPending ? "Publicando…" : "Publicar alterações"}
        </button>
        {publish.isSuccess && <span style={{ color: "var(--ok, green)" }}>Publicado ✓</span>}
        {publish.isError && <span role="alert">Falha ao publicar (git)</span>}
      </div>

      <div className="split">
        <div className="table-wrap" style={{ maxWidth: 360 }}>
          <table>
            <thead><tr><th>Pacote</th><th>Skills</th><th>Pub.</th></tr></thead>
            <tbody>
              {list.data?.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p.id)} style={{ cursor: "pointer", background: selected === p.id ? "var(--surface-2, #f0f0f0)" : undefined }}>
                  <td><strong>{p.displayName}</strong><br /><small style={{ color: "var(--muted)" }}>{p.slug} · v{p.version}</small></td>
                  <td>{p.skillCount}</td>
                  <td>{p.published ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1 }}>
          {selected ? <PluginEditor id={selected} onDeleted={() => setSelected(null)} /> : <p className="state">Selecione um pacote.</p>}
        </div>
      </div>
    </main>
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
    <div className="card">
      <div className="card-head">
        <h2 style={{ margin: 0 }}>{data.displayName}</h2>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={data.published}
            onChange={(e) => update.mutate({ published: e.target.checked })}
          />
          Publicado
        </label>
      </div>

      <FieldRow label="Nome" value={data.displayName} onSave={(v) => update.mutate({ displayName: v })} />
      <FieldRow label="Descrição" value={data.description} onSave={(v) => update.mutate({ description: v })} />
      <FieldRow label="Versão" value={data.version} onSave={(v) => update.mutate({ version: v })} />
      <FieldRow label="Categoria" value={data.category ?? ""} onSave={(v) => update.mutate({ category: v })} />
      <FieldRow label="Keywords (vírgula)" value={data.keywords.join(", ")} onSave={(v) => update.mutate({ keywords: v.split(",").map((s) => s.trim()).filter(Boolean) })} />
      <FieldRow label="Autor" value={data.author ?? ""} onSave={(v) => update.mutate({ author: v })} />

      <h3>Skills</h3>
      {data.skills.map((s) => <SkillEditor key={s.id} pluginId={id} skill={s} onChange={invalidate} />)}
      <NewSkill onAdd={(slug, skillMd) => addSkill.mutate({ slug, skillMd })} pending={addSkill.isPending} />

      <div style={{ marginTop: 24 }}>
        <button className="btn-sm btn-ghost" onClick={() => { if (confirm("Excluir o pacote inteiro?")) remove.mutate(); }}>Excluir pacote</button>
      </div>
    </div>
  );
}

function FieldRow({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  const dirty = v !== value;
  return (
    <div className="field-row" style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
      <label style={{ width: 150, color: "var(--muted)", fontSize: 14 }}>{label}</label>
      <input value={v} onChange={(e) => setV(e.target.value)} style={{ flex: 1 }} />
      {dirty && <button className="btn-sm" onClick={() => onSave(v)}>Salvar</button>}
    </div>
  );
}

function SkillEditor({ pluginId, skill, onChange }: { pluginId: string; skill: Skill; onChange: () => void }) {
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
  return (
    <div className="card" style={{ background: "var(--surface-2, #fafafa)", margin: "8px 0" }}>
      <div className="card-head">
        <button className="btn-sm btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? "▼" : "▶"} {skill.slug}/SKILL.md</button>
        <button className="btn-sm btn-ghost" onClick={() => { if (confirm("Excluir skill?")) del.mutate(); }}>Excluir</button>
      </div>
      {open && (
        <>
          <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={14} style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }} />
          {md !== skill.skillMd && <button className="btn-sm" disabled={save.isPending} onClick={() => save.mutate()}>Salvar SKILL.md</button>}
        </>
      )}
    </div>
  );
}

function NewSkill({ onAdd, pending }: { onAdd: (slug: string, skillMd: string) => void; pending: boolean }) {
  const [slug, setSlug] = useState("");
  const [md, setMd] = useState("---\nname: \ndescription: \n---\n\n");
  return (
    <div className="card" style={{ borderStyle: "dashed", margin: "8px 0" }}>
      <h4 style={{ marginTop: 0 }}>Nova skill</h4>
      <input placeholder="slug (kebab-case)" value={slug} onChange={(e) => setSlug(e.target.value)} style={{ width: "100%", marginBottom: 6 }} />
      <textarea value={md} onChange={(e) => setMd(e.target.value)} rows={8} style={{ width: "100%", fontFamily: "monospace", fontSize: 13 }} />
      <button className="btn-sm" disabled={pending || !slug.trim() || !md.trim()} onClick={() => { onAdd(slug.trim(), md); setSlug(""); setMd("---\nname: \ndescription: \n---\n\n"); }}>+ Adicionar skill</button>
    </div>
  );
}
