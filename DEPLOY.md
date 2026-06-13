# Deploy no Easypanel (Compose + build do repositório)

Topologia: **2 serviços** no `docker-compose.yml`:
- `postgres` — PostgreSQL 16 (volume `pgdata` persistente).
- `app` — buildado pelo `Dockerfile` (multi-stage). O backend Node serve a API
  **e** o frontend buildado (em `backend/public`). No start roda `prisma db push`
  (sincroniza o schema, sem migrações) e sobe na porta `3001`.

## Passo a passo

1. No Easypanel, criar um serviço do tipo **Compose**.
2. Em **Source**, conectar ao repositório **`rafaelgonnect/certificacao-anthropic`**,
   branch **`master`**, arquivo `docker-compose.yml`. (O repo está público, então
   não precisa de credenciais para o clone.) O Easypanel clona o repo e builda o
   `Dockerfile` — não é "colar YAML"; é o build a partir do código.
3. Em **Environment Variables**, definir:
   - `JWT_SECRET` = string aleatória forte
   - `POSTGRES_PASSWORD` = senha forte
   - (opcional) `ANTHROPIC_API_KEY` para ligar a correção de labs por IA
4. Deploy. A primeira vez leva alguns minutos (instala deps + builda frontend e
   backend). O `app` aplica o schema sozinho e fica na porta `3001` — exponha via
   domínio do Easypanel.
5. **Seed (uma vez)** no terminal do serviço `app`: `npx prisma db seed`
   — cria o admin (`admin@colaborativa.dev` / `admin12345`) e a Foundations.

## Redeploys automáticos (depois)
O Easypanel gera um **Deploy Webhook** por serviço. Me passe essa URL: a cada push
na `master`, eu disparo o webhook (`curl -X POST <webhook-url>`) e o Easypanel
reconstrói e republica.

> A `DATABASE_URL` é montada pelo compose apontando para o serviço `postgres`
> interno — o banco não precisa ser exposto publicamente.
