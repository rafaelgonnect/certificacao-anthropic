# Deploy no Easypanel (Compose + imagem do GHCR)

Fluxo: a imagem do app é **buildada no GitHub Actions** e publicada no **GHCR**
(`ghcr.io/rafaelgonnect/certificacao-anthropic`). No Easypanel você só **cola o
`docker-compose.yml`** num serviço Compose e roda — não é preciso código-fonte lá.

Topologia: **2 serviços** no `docker-compose.yml`:
- `postgres` — PostgreSQL 16 (volume `pgdata` persistente).
- `app` — imagem pronta do GHCR. O backend Node serve a API **e** o frontend
  buildado (em `backend/public`). No start roda `prisma db push` (sincroniza o
  schema, sem migrações) e sobe na porta `3001`.

## Passo a passo

### 1. Garantir a imagem publicada
A cada push na `master`, o workflow `.github/workflows/docker-image.yml` builda e
publica `ghcr.io/rafaelgonnect/certificacao-anthropic:latest`. Verifique em
GitHub → Actions que o build passou (a primeira vez pode levar alguns minutos).

### 2. Acesso à imagem (registry privado)
O package do GHCR herda a visibilidade do repo (privado). Para o Easypanel puxar:
- **Opção A (mais simples):** tornar o package público — GitHub → repo → aba
  *Packages* → o package → *Package settings* → *Change visibility* → Public.
- **Opção B:** manter privado e cadastrar as credenciais do registry no Easypanel
  (usuário = seu login do GitHub, senha = um PAT com escopo `read:packages`),
  apontando para `ghcr.io`.

### 3. Criar o serviço Compose
1. No Easypanel, criar um serviço **Compose** e **colar** o conteúdo do
   `docker-compose.yml`.
2. Em **Environment Variables**, definir:
   - `JWT_SECRET` = string aleatória forte
   - `POSTGRES_PASSWORD` = senha forte
   - (opcional) `ANTHROPIC_API_KEY` para ligar a correção de labs por IA
3. Subir. O `app` aplica o schema sozinho (`prisma db push`) e fica disponível na
   porta `3001` — exponha via domínio do Easypanel.

### 4. Seed (uma vez)
No terminal do serviço `app`: `npx prisma db seed` — cria o admin
(`admin@colaborativa.dev` / `admin12345`) e a certificação Foundations.

## Redeploys automáticos (depois)
O Easypanel gera um **Deploy Webhook** por serviço. Me passe essa URL: a cada push
na `master`, o GitHub Actions republica a imagem e eu disparo o webhook
(`curl -X POST <webhook-url>`) para o Easypanel puxar a nova `:latest`.

> A `DATABASE_URL` é montada pelo compose apontando para o serviço `postgres`
> interno — o banco não precisa ser exposto publicamente.
