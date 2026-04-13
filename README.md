# LicitMASA

Builder para Builder: este documento existe para acelerar onboarding, reduzir regressao em areas criticas e preservar a inteligencia de negocio do projeto.

## Visao Geral

O LicitMASA e uma ferramenta de inteligencia para licitantes que monitora publicacoes do PNCP, organiza filtros por palavra-chave e UF, salva preferencias do usuario e dispara alertas quando novas oportunidades aparecem.

Na pratica, o produto combina:

- busca e leitura de publicacoes do PNCP;
- persistencia de filtros e estado do usuario no Supabase;
- envio de notificacoes push via OneSignal;
- upgrade de assinatura premium com Google Play;
- superficie web otimizada para uso no navegador, TWA Android e indexacao organica.

Dominio oficial de producao:

- `https://www.licitmasa.com.br`

Status de producao:

- o app Android/TWA do LicitMASA esta **LIVE na Google Play Store**;
- o pacote Android principal e `br.com.licitmasa`;
- o site em producao e servido no dominio `www.licitmasa.com.br`.

## Stack Tecnica

### Runtime e Frontend

- Next.js 15
- React 18
- TypeScript
- Tailwind CSS

### Backend e Dados

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Row Level Security (RLS) nas tabelas de usuario

### Integracoes externas

- PNCP (Portal Nacional de Contratacoes Publicas)
- OneSignal para push
- Google Play Android Publisher API para validacao de assinatura
- Trusted Web Activity (TWA) para distribuicao Android

## Estrutura do Projeto

```text
app/
  api/
    billing/validate/route.ts         -> valida assinatura na Google Play
    cron/run-check-alerts/route.ts    -> ponte HTTP para a Edge Function do robo
    pncp/contratacoes/route.ts        -> proxy interno da API do PNCP
    profile/sync-subscription/route.ts-> grava subscription_id do OneSignal
  layout.tsx                          -> metadata global, OneSignal e PWA/TWA
  opengraph-image.png                 -> imagem OG automatica do App Router

components/
  ServiceWorkerRegister.tsx           -> bootstrap do OneSignal + sync com Supabase

lib/
  pncp.ts                             -> cliente compartilhado de consulta PNCP
  supabaseClient.ts                   -> cliente Supabase do app web

public/
  guia.html                           -> guia estatico para SEO e educacao do licitante
  robots.txt                          -> controle de indexacao
  sitemap.xml                         -> sitemap estatico oficial
  OneSignalSDKWorker.js               -> service worker do OneSignal

supabase/
  functions/check-alerts/index.ts     -> robo principal de busca e alertas
  sql/                                -> tabelas e politicas RLS

twa-licitmasa/
  app/build.gradle                    -> pacote Android/TWA e versao Play Store
```

## Fluxo de Produto

1. O usuario autentica no app web/TWA.
2. O app garante a existencia de `profiles` no Supabase.
3. O usuario salva filtros em `search_alerts`.
4. O OneSignal gera um `subscription_id`.
5. O endpoint `api/profile/sync-subscription` persiste esse vinculo no profile.
6. A Edge Function `check-alerts` consulta o PNCP, cruza os filtros premium e identifica novidades.
7. O sistema evita duplicidade via `sent_alerts`.
8. O envio acontece preferencialmente em lote via OneSignal.
9. Cada ciclo fica auditado em `alert_runs`.
10. Se houver compra valida na Play Store, o profile sobe para premium.

## Guia de Instalacao

### 1. Requisitos

- Node.js 20+
- npm
- conta Supabase
- conta OneSignal
- credenciais Google Play para validacao de assinatura
- Java + Android SDK para build do TWA

### 2. Instalar dependencias do app web

```bash
npm install
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

### 4. Validar build local

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

### 5. Build Android/TWA

No Windows:

```powershell
cd twa-licitmasa
.\gradlew.bat clean bundleRelease
```

Artefato esperado:

- `twa-licitmasa/app/build/outputs/bundle/release/app-release.aab`

## Variaveis de Ambiente

### Essenciais para rodar o app web

| Variavel | Uso |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL canonica do site |
| `NEXT_PUBLIC_SUPABASE_URL` | projeto Supabase do frontend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anonima do frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | operacoes administrativas e cron |

### Auth, push e automacao

| Variavel | Uso |
| --- | --- |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | inicializacao do SDK web |
| `ONESIGNAL_APP_ID` | envio server-side |
| `ONESIGNAL_REST_API_KEY` | chave preferencial para notificacoes |
| `ONESIGNAL_API_KEY` | fallback legado para notificacoes |
| `ADMIN_TOKEN` | diagnosticos e rotas administrativas |
| `ADMIN_TARGETS` | destinatarios de push operacional em caso de falha |

### Premium e Google Play

| Variavel | Uso |
| --- | --- |
| `NEXT_PUBLIC_PLAY_PRODUCT_ID` | product id da assinatura |
| `GOOGLE_PLAY_PACKAGE_NAME` | pacote publicado na Play |
| `ANDROID_PACKAGE_ID` | fallback do pacote Android |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | credencial principal recomendada |
| `GOOGLE_APPLICATION_CREDENTIALS` | caminho alternativo da credencial |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | email da service account |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | chave privada da service account |
| `GOOGLE_CLIENT_ID` | fallback OAuth2 |
| `GOOGLE_CLIENT_SECRET` | fallback OAuth2 |
| `GOOGLE_REFRESH_TOKEN` | fallback OAuth2 |

### Frontend comercial

| Variavel | Uso |
| --- | --- |
| `NEXT_PUBLIC_PLAN_PRICE` | preco exibido no frontend |
| `NEXT_PUBLIC_PREMIUM_EMAILS` | allowlist de premium para testes |
| `NEXT_PUBLIC_PAYMENT_URL` | fallback de rota comercial |

### Firebase Web Push

| Variavel | Uso |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | config Firebase |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | VAPID do web push |

### Build do TWA

| Variavel | Uso |
| --- | --- |
| `ANDROID_KEYSTORE_PATH` | caminho do keystore |
| `ANDROID_KEYSTORE_ALIAS` | alias de assinatura |
| `ANDROID_KEYSTORE_STORE_PASSWORD` | senha do keystore |
| `ANDROID_KEYSTORE_KEY_PASSWORD` | senha da chave |

## Banco de Dados

Tabelas mais importantes:

- `profiles`: identidade, premium, plano e `subscription_id`
- `search_alerts`: filtros persistidos por usuario
- `sent_alerts`: deduplicacao por usuario + publicacao
- `alert_runs`: trilha de execucao do robo
- `user_certificates`: vencimentos de certidoes

Scripts SQL base:

- `supabase/sql/search_alerts.sql`
- `supabase/sql/sent_alerts.sql`
- `supabase/sql/alert_runs.sql`
- `supabase/sql/user_certificates.sql`

## SEO e Superficie Web

O projeto mistura App Router com paginas estaticas voltadas a descoberta organica:

- `index.html`: landing page estatica de aquisicao
- `public/guia.html`: guia educativo para indexacao e compartilhamento
- `public/sitemap.xml`: sitemap estatico com dominio oficial
- `public/robots.txt`: bloqueio de rotas privadas e referencia ao sitemap
- `app/opengraph-image.png`: imagem OG automatica do site

## Operacao e Suporte

Os fluxos abaixo sustentam a operacao diaria do push, diagnostico e reconciliacao de dados:

- `components/ServiceWorkerRegister.tsx`: inicializa OneSignal no cliente, garante `profiles` e sincroniza `subscription_id`
- `app/api/profile/sync-subscription/route.ts`: persiste `subscription_id` do device autenticado
- `app/api/admin/sync-onesignal/route.ts`: corrige manualmente o vinculo entre usuario e OneSignal
- `app/api/admin/onesignal/sync-players/route.ts`: reconcilia players do OneSignal com `profiles`
- `app/api/notifications/onesignal-test/route.ts`: dispara push de teste com payload direto
- `app/api/notifications/test/route.ts`: rota de suporte com varios fallbacks para resolver destino
- `app/api/diagnostics/supabase-role/route.ts`: confirma que o servidor consegue operar com service role
- `app/api/diagnostics/env-billing/route.ts`: valida presenca do ambiente necessario para billing

Sequencia operacional que deve ser preservada:

1. autenticar usuario;
2. garantir `profiles`;
3. obter `subscription_id` no cliente;
4. gravar esse ID no Supabase;
5. usar o robo server-side para buscar oportunidades;
6. entregar notificacoes evitando duplicidade com `sent_alerts`.

## Regras de Ouro para Builders

1. Nao quebre autenticacao Supabase/Google sem plano de impacto.
2. Nao altere validacao da assinatura Play sem entender o fluxo de premium.
3. Nao remova o sync entre OneSignal e `profiles.subscription_id`.
4. Nao troque `sitemap.xml`, `robots.txt`, `guia.html` e assets SEO por geracao automatica sem revisar indexacao e dominio oficial.
5. Nao altere a deduplicacao de `sent_alerts` sem preservar idempotencia do robo.

## Comandos Uteis

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run pncp:once
```

## Hand-off Rapido

Se voce esta chegando agora, leia nesta ordem:

1. `README.md`
2. `LOGIC.md`
3. `lib/pncp.ts`
4. `app/api/pncp/contratacoes/route.ts`
5. `supabase/functions/check-alerts/index.ts`
6. `app/api/profile/sync-subscription/route.ts`
7. `app/api/billing/validate/route.ts`

Esse conjunto cobre a arquitetura, a inteligencia do robo, a persistencia de filtros, o push e o billing premium.
