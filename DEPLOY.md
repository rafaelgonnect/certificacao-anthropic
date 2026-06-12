# Deploy no Easypanel

Topologia: **2 serviços** definidos em `docker-compose.yml`:

- `postgres` — banco PostgreSQL 16 (volume `pgdata` persistente).
- `app` — imagem buildada pelo `Dockerfile` (multi-stage). O backend Node serve
  a API **e** os arquivos estáticos do frontend (React buildado em `backend/public`).
  No start, roda `prisma db push` (sincroniza o schema, sem migrações) e sobe a API na porta `3001`.

## Primeiro deploy (manual, feito por você)

1. No Easypanel, criar um projeto e um serviço do tipo **Compose**.
2. Apontar para o repositório `rafaelgonnect/certificacao-anthropic`, branch `master`,
   arquivo `docker-compose.yml`.
3. Em **Environment Variables** do serviço, definir:
   - `JWT_SECRET` = (uma string aleatória forte)
   - `POSTGRES_PASSWORD` = (uma senha forte)
4. Deploy. O `app` aplica as migrações sozinho e fica disponível na porta `3001`
   (exponha via domínio do Easypanel).
5. Rodar o seed uma vez (terminal do serviço `app`): `npx prisma db seed`
   — cria o admin (`admin@colaborativa.dev`) e a certificação Foundations.

## Redeploys automáticos (depois)

O Easypanel gera um **Deploy Webhook** por serviço (Settings → Deploy → Webhook).
Me passe essa URL: a cada `git push` na `master`, eu disparo o webhook
(`curl -X POST <webhook-url>`) e o Easypanel reconstrói e republica.

> Observação: a `DATABASE_URL` em produção é montada pelo compose apontando para o
> serviço `postgres` interno — você não precisa expor o banco publicamente.
