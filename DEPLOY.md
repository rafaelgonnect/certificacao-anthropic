# Deploy no Easypanel (App + build do repositório)

Topologia: **1 serviço** do tipo **App**, buildado direto do repositório pelo
`Dockerfile` (multi-stage). O backend Node serve a API **e** o frontend buildado
(em `backend/public`). No start roda `prisma db push` (sincroniza o schema, sem
migrações) e sobe na porta `3001`.

O **banco é externo e gerenciado por você** — pode ser um serviço PostgreSQL
separado no próprio Easypanel ou um Postgres em outro lugar. Você informa a
conexão pela variável `DATABASE_URL`. (Não há mais Postgres embutido nem imagem
no GHCR — o deploy é 100% build a partir do código.)

## Passo a passo

1. (Se ainda não tiver um banco) crie um **PostgreSQL** no Easypanel ou use um
   externo. Anote host, porta, usuário, senha e nome do banco.
2. No Easypanel, criar um serviço do tipo **App**.
3. Em **Source**, conectar ao repositório **`rafaelgonnect/certificacao-anthropic`**,
   branch **`master`**. Em **Build**, escolher **Dockerfile** (caminho `Dockerfile`
   na raiz). O Easypanel clona o repo e builda o `Dockerfile` — sem imagem pronta.
4. Em **Environment Variables**, definir:
   - `DATABASE_URL` = string de conexão do **seu** Postgres, ex.:
     `postgresql://USUARIO:SENHA@HOST:5432/certificacao?schema=public`
   - `JWT_SECRET` = string aleatória forte
   - `PORT` = `3001`
   - (opcional) `ANTHROPIC_API_KEY` para ligar a correção de labs por IA
5. Em **Ports / Domínio**, exponha a porta `3001` via domínio do Easypanel.
6. Deploy. A primeira vez leva alguns minutos (instala deps + builda frontend e
   backend). No start o app aplica o schema sozinho (`prisma db push`).
7. **Seed (uma vez)** no terminal do serviço: `npx prisma db seed`
   — cria o admin (`admin@colaborativa.dev` / `admin12345`) e a Foundations.

## Redeploys automáticos (depois)
O Easypanel gera um **Deploy Webhook** por serviço. Me passe essa URL: a cada push
na `master`, eu disparo o webhook (`curl -X POST <webhook-url>`) e o Easypanel
reconstrói e republica a partir do repo.

> **Atenção ao banco:** o start roda `prisma db push --accept-data-loss`. Em base
> greenfield isso é inofensivo, mas se você apontar `DATABASE_URL` para um banco
> com dados que divergem do schema do Prisma, o `db push` pode dropar colunas/tabelas.
> Use um banco dedicado a esta aplicação.
