# LOGIC.md

Builder para Builder: este arquivo descreve a inteligencia de negocio do LicitMASA e os contratos invisiveis que mantem o robo util em producao.

## 1. Objetivo Central

O LicitMASA nao e apenas um buscador de editais. O valor do produto esta em transformar o fluxo bruto do PNCP em um mecanismo de vigilancia orientado a oportunidade:

- o usuario define interesse por palavra-chave e, opcionalmente, UF;
- o sistema roda buscas recorrentes em janelas curtas de tempo;
- cada resultado novo e comparado com o historico ja notificado;
- o usuario recebe push apenas quando existe novidade real.

O ativo principal do projeto e essa camada de inteligencia operacional, nao a tela.

## 2. Arquitetura Logica

### Camadas

1. **Next.js App Router**
   - UI, autenticacao, rotas API, metadata e integracoes do navegador.

2. **Supabase**
   - identidade, banco relacional, persistencia de filtros e historico.

3. **Edge Function `check-alerts`**
   - motor de busca, deduplicacao e notificacao.

4. **OneSignal**
   - entrega push para web/TWA/Android.

5. **Google Play**
   - valida assinatura e sobe o usuario para premium.

### Arquivos que sustentam a logica

- `lib/pncp.ts`
- `app/api/pncp/contratacoes/route.ts`
- `supabase/functions/check-alerts/index.ts`
- `app/api/cron/run-check-alerts/route.ts`
- `app/api/profile/sync-subscription/route.ts`
- `app/api/billing/validate/route.ts`
- `components/ServiceWorkerRegister.tsx`

## 3. Integracao PNCP

### 3.1 Como o PNCP entra no sistema

Existem dois caminhos de consulta:

- **UI / backend web**: o frontend chama `app/api/pncp/contratacoes/route.ts`, que atua como proxy do PNCP.
- **robo de alertas**: a Edge Function `supabase/functions/check-alerts/index.ts` consulta o PNCP diretamente.

Essa separacao reduz acoplamento:

- a UI usa um payload normalizado e nao precisa conhecer a instabilidade do PNCP;
- o robo nao depende do App Router para executar buscas periodicas.

### 3.2 Normalizacao da busca

O endpoint do PNCP pode responder em formatos diferentes (`content`, `items`, `data` ou array simples). O LicitMASA normaliza isso para um contrato unico.

No proxy do Next:

- preenche janela padrao de datas quando o cliente nao informa;
- consulta varias modalidades em paralelo;
- aplica filtro textual consolidado em campos como objeto, descricao, resumo e orgao;
- devolve `items`, `totalPages`, `totalElements`, `number` e `size`.

No cliente compartilhado (`lib/pncp.ts`):

- a busca simples alimenta telas;
- a busca paginada alimenta telas e rotinas internas;
- `buildEditalUrlFromItem()` reconstrui links canonicos do PNCP;
- `fetchRaioxInfo()` faz enriquecimento leve por HTML quando faltam dados operacionais.

### 3.3 Racional de negocio

O PNCP e a fonte publica de dados. O LicitMASA nao representa o Governo Federal. O papel do produto e:

- agregar;
- filtrar;
- priorizar;
- alertar.

## 4. Filtros e Alertas

### 4.1 Modelo mental

O filtro persistido minimo e:

- `keyword`
- `uf` opcional
- `user_id`
- `active`

Esses registros vivem em `search_alerts`.

### 4.2 O que o robo faz em cada ciclo

Fluxo principal da Edge Function `check-alerts`:

1. Carrega todos os filtros ativos.
2. Restringe o conjunto a usuarios premium.
3. Agrupa filtros iguais por `keyword + UF`.
4. Faz uma busca consolidada por UF no PNCP.
5. Converte cada item retornado em texto pesquisavel.
6. Aplica match por inclusao textual da palavra-chave.
7. Gera IDs estaveis por `numeroControlePNCP` ou fallback.
8. Consulta `sent_alerts` para descobrir o que ja foi entregue.
9. Monta a lista de novidades por usuario.
10. Dispara push em lote via OneSignal.
11. Registra auditoria em `alert_runs`.

### 4.3 Por que o agrupamento existe

Sem agrupamento, o sistema repetiria chamadas para o PNCP e envios para o OneSignal para filtros equivalentes entre usuarios diferentes.

O agrupamento preserva:

- menor latencia;
- menos custo operacional;
- menor chance de rate limit;
- consistencia de entrega.

### 4.4 Exemplo pratico

Quando analisamos oportunidades grandes, como um edital na faixa de R$ 1,6M, a logica nao depende do valor em si para alertar. O valor aparece como contexto de leitura, mas o gatilho principal continua sendo:

- palavra-chave relevante no texto do item;
- janela de publicacao recente;
- combinacao com UF quando aplicavel;
- ausencia de registro previo em `sent_alerts`.

Ou seja: o robo nao "adivinha" oportunidades; ele encontra publicacoes novas que batem com a intencao cadastrada pelo usuario.

### 4.5 Canais de entrega

Ordem de preferencia:

1. push em lote para `subscription_id`
2. push individual por `external_user_id`
3. fallback por e-mail quando aplicavel

O envio em lote e preferencial porque varias pessoas podem compartilhar o mesmo filtro.

## 5. Sincronizacao de Dados

### 5.1 Problema que precisa ser evitado

Sem sincronizacao correta, o sistema perde um dos tres elos abaixo:

- identidade do usuario;
- filtros salvos;
- destino de notificacao.

Se qualquer elo quebrar, o usuario pode continuar premium e com filtros ativos, mas nao receber nada.

### 5.2 Tabelas centrais

#### `profiles`

Guarda:

- `id`
- `email`
- `is_premium`
- `plan`
- `subscription_id`

Essa tabela e o centro de identidade operacional.

#### `search_alerts`

Guarda os filtros ativos do usuario. Sem ela o robo nao tem o que monitorar.

#### `sent_alerts`

Impede duplicidade de notificacao por combinacao `user_id + pncp_id`.

#### `alert_runs`

Serve como trilha de auditoria, observabilidade e suporte.

#### `user_certificates`

Permite alertas proativos de vencimento de certidoes.

### 5.3 Como o subscription_id e mantido

`components/ServiceWorkerRegister.tsx` executa o bootstrap do OneSignal no navegador/TWA e tenta:

- garantir a existencia do `profile`;
- ler ou recuperar o `subscription_id` com retry;
- chamar `api/profile/sync-subscription`;
- persistir `subscription_id` em `profiles`.

Esse passo e obrigatorio para que o robo saiba para qual device entregar push.

### 5.4 Como evitamos perda de filtros

Os filtros nao ficam apenas em estado local do browser. O estado canonico mora no Supabase, em `search_alerts`.

Isso garante:

- continuidade entre sessoes;
- continuidade entre dispositivos;
- recuperacao apos reinstalacao do app;
- execucao server-side independente do frontend.

## 6. Premium e Google Play

### 6.1 Regra de negocio

O robo principal considera apenas usuarios premium no fluxo automatizado de alertas.

### 6.2 Como a validacao acontece

O endpoint `app/api/billing/validate/route.ts`:

1. recebe `productId`, `purchaseToken` e `userId`;
2. autentica na Google Play Android Publisher API;
3. consulta `purchases.subscriptionsv2.get`;
4. verifica `subscriptionState`, expiracao, acknowledgement e auto renew;
5. faz `acknowledge` quando necessario;
6. faz upsert no `profiles` com `is_premium=true` e `plan='premium'`.

### 6.3 O que nao pode ser quebrado

- fallback entre service account e OAuth2;
- uso do package name correto;
- upsert administrativo do premium em `profiles`.

## 7. SEO e Web

### 7.1 Por que existem paginas estaticas fora do App Router

O LicitMASA usa duas superficies web de aquisicao/indexacao:

- `index.html`: landing page estatica de descoberta
- `public/guia.html`: conteudo educativo para busca organica

Essas paginas existem porque:

- sao simples de rastrear;
- permitem copy comercial e educativa fora da area logada;
- ajudam a capturar buscas do topo e meio do funil;
- funcionam como ponte entre pesquisa organica e instalacao do app.

### 7.2 Ativos de indexacao

- `public/sitemap.xml`: sitemap estatico oficial com o dominio `https://www.licitmasa.com.br`
- `public/robots.txt`: bloqueia paginas privadas como login, perfil e favoritos
- `app/opengraph-image.png`: imagem de compartilhamento automatica do App Router
- `middleware.ts`: redireciona `licitmasa.com.br` para `www.licitmasa.com.br` em producao

### 7.3 Intencao de negocio

SEO aqui nao e enfeite. E canal de aquisicao.

Landing e guia existem para:

- atrair pequenos licitantes em fase de descoberta;
- ranquear por termos relacionados a PNCP, certidoes, SICAF e preparo para licitar;
- empurrar o usuario para instalacao na Play Store;
- fortalecer autoridade organica do dominio.

## 8. Observabilidade e Suporte

O projeto possui rotas e logs de diagnostico porque o robo depende de varias integracoes externas.

Pontos relevantes:

- `app/api/cron/run-check-alerts/route.ts` encapsula a Edge Function e notifica admin em falha;
- `alert_runs` registra resultado de cada ciclo;
- a Edge Function tem modos `inspect`, `runs`, `preview` e `test`;
- logs mascaram chaves sensiveis, mas preservam status e corpo bruto para suporte.

## 9. Contratos que Futuros Builders Devem Preservar

1. O dominio canonico e `https://www.licitmasa.com.br`.
2. O robo nao pode depender de estado local do navegador para funcionar.
3. `profiles.subscription_id` e parte critica do fluxo de entrega.
4. `sent_alerts` e obrigatorio para idempotencia.
5. `search_alerts` e o estado canonico dos filtros.
6. Premium precisa continuar vindo da validacao real da Google Play.
7. Paginas privadas nao devem entrar no sitemap nem no robots como paginas indexaveis.
8. Landing e guia devem permanecer publicos, rastreaveis e coerentes com o dominio oficial.

## 10. Ordem Recomendada de Leitura do Codigo

1. `README.md`
2. `lib/pncp.ts`
3. `app/api/pncp/contratacoes/route.ts`
4. `components/ServiceWorkerRegister.tsx`
5. `app/api/profile/sync-subscription/route.ts`
6. `supabase/functions/check-alerts/index.ts`
7. `app/api/cron/run-check-alerts/route.ts`
8. `app/api/billing/validate/route.ts`

Se voce entender bem esse conjunto, voce entende a espinha dorsal do LicitMASA.
