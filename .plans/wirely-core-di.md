---
title: Wirely — esqueleto do monorepo + core de DI
state: pr
created: 2026-06-22
updated: 2026-06-22
clickup: —
---

## Contexto de negócio

Wirely é uma lib/framework de Dependency Injection baseada em funções, inspirada no
NestJS, mas **sem decorators no core** e sem reflection/auto-wiring. O objetivo é uma
DI **fortemente tipada em TS** e ao mesmo tempo **usável em JS puro**, simples porém
poderosa, para substituir a DI de outra lib do autor. Decorators (TC39 nativos e legacy
+ reflect-metadata), reactividade e auto-wiring ficam como **extensões/plugins** futuros,
mantendo o core enxuto e agnóstico de ambiente.

Esta primeira tarefa entrega **apenas** o esqueleto do monorepo + o core de DI funcional
(opção A). Exemplos (auth/users/farms) e pacotes de plugin ficam para tarefas seguintes.

## Comportamento esperado

API funcional principal:
- `createContainer(...)` — instancia um **container** nomeado (não "app").
- `defineModule({ imports, providers, exports })` — módulo com **encapsulamento real**:
  só o que está em `exports` fica visível a quem importa.
- `defineProvider({ provide?, useClass | useValue | useFactory, scope? })` —
  lifetime `singleton` (padrão) ou `transient`.
- `defineProvider({ useClass, inject: [...], scope })` — declara dependências sem decorator, DENTRO de `defineModule`. Classe permanece pura (sem import do wirely). (Decisão revista: `defineInjectable` foi removido.)
- **Token**: derivado da própria classe (usar a classe como token) **ou** string/symbol.
- **Globals**: providers/módulos marcados como globais ficam visíveis a todos os módulos.
- **Hooks** de ciclo de vida do container/módulos.
- **Ciclos**: detecção de dependência circular com erro claro + mecanismo explícito de
  **referência tardia** (estilo `forwardRef`, sem decorator) para contorná-los.

Critérios transversais: DX em primeiro lugar (mensagens de erro acionáveis, autocomplete,
inferência de tipos), e a mesma API rodando em JS puro.

## Testes de aceitação

Feature: Resolver dependências entre módulos
  As a Dev TS consumidor do Wirely
  I want to declarar módulos com providers e importá-los
  So that minhas dependências são montadas automaticamente e tipadas

  Scenario: Provider singleton compartilhado
    Given um módulo com um provider singleton
    When resolvo o mesmo token duas vezes
    Then recebo exatamente a mesma instância

  Scenario: Provider transient recriado
    Given um provider declarado como transient
    When resolvo o mesmo token duas vezes
    Then recebo instâncias distintas

  Scenario: Injeção de dependências via inject
    Given um service que depende de um repositório
    And o repositório registrado no módulo
    When resolvo o service
    Then ele recebe o repositório já construído no construtor

  Scenario: Token a partir da própria classe
    Given um provider registrado usando a classe como token
    When resolvo passando a classe
    Then recebo a instância correta sem precisar de string/symbol

  Scenario: Token por string/symbol
    Given um provider registrado sob uma string/symbol
    When resolvo por essa string/symbol
    Then recebo o valor/instância correspondente

Feature: Encapsulamento de módulos
  As a Dev consumidor do Wirely
  I want to controlar o que cada módulo expõe
  So that módulos não vazam detalhes internos

  Scenario: Acessar provider exportado
    Given o módulo A exporta um provider
    And o módulo B importa A
    When B resolve esse provider
    Then a resolução tem sucesso

  Scenario: Acessar provider não exportado
    Given o módulo A tem um provider interno não exportado
    And o módulo B importa A
    When B tenta resolver o provider interno
    Then recebo um erro de encapsulamento claro indicando o token e o módulo

Feature: Globais
  As a Dev consumidor do Wirely
  I want to registrar providers/módulos globais
  So that ficam disponíveis sem reimportar em todo lugar

  Scenario: Provider global visível sem import explícito
    Given um provider registrado como global
    When qualquer módulo o resolve sem importá-lo
    Then a resolução tem sucesso

  Scenario: Colisão entre global e local
    Given um token já registrado como global
    When um módulo registra um provider sob o mesmo token
    Then recebo um erro de colisão de token no momento do registro

Feature: Erros acionáveis (DX)
  As a Dev consumidor do Wirely
  I want to mensagens de erro claras
  So that identifico o problema sem depurar o framework

  Scenario: Token não registrado
    Given um token que nunca foi registrado
    When tento resolvê-lo
    Then recebo um erro nomeando o token e quem o solicitou

  Scenario: Dependência circular detectada
    Given dois providers que dependem um do outro sem referência tardia
    When o container monta o grafo
    Then recebo um erro explícito mostrando o caminho do ciclo

  Scenario: Ciclo resolvido por referência tardia
    Given dois providers em ciclo usando o mecanismo de referência tardia
    When o container os resolve
    Then ambos são construídos com sucesso

Feature: Ciclo de vida
  As a Dev consumidor do Wirely
  I want to hooks de ciclo de vida
  So that posso inicializar e finalizar recursos

  Scenario: Hook de inicialização
    Given um provider com hook de init
    When o container inicializa
    Then o hook é chamado após as dependências estarem prontas

  Scenario: Hook de finalização
    Given um provider com hook de shutdown
    When o container é encerrado
    Then o hook é chamado para liberar recursos

## Plano técnico

Stack: TypeScript **strict**, npm workspaces + turbo + vitest + biome + changesets,
build rollup dual (cjs/esm/d.ts) — espelhando `outros/orquestra`, sem `reflect-metadata`/`dotenv`.

Decisões de design:
- Resolução **síncrona**; injeção real por construtor (`inject` posicional).
- Token = `Function` (classe) | `string` | `symbol`.
- Lifetime `singleton` (cache no container) | `transient` (recria a cada resolução).
- Encapsulamento por `exports`; provider não exportado é invisível a quem importa.
- Globals visíveis a todos; **qualquer colisão de token (global×local ou local×local) = erro**.
- Ciclo: pilha de resolução detecta e lança erro com o caminho; `forwardRef(() => Token)`
  injeta um **proxy lazy** que resolve no primeiro acesso, quebrando o ciclo.
- Hooks duck-typed `onInit`/`onDestroy`; `dispose()` chama `onDestroy` em ordem reversa.

Execução em **TDD red→green**, por blocos (sub-agentes isolados/paralelos quando houver ganho):

1. **Esqueleto do monorepo** — `package.json` (workspaces), `turbo.json`, `tsconfig` raiz strict,
   `biome.json`, `vitest.config.ts`, `.npmrc`, `.gitignore`, `.changeset/`, `LICENSE`, `README`.
2. **Pacote `@wirely/core`** — `package.json`, `rollup.config.mjs`, `tsconfig.json` + `tsconfig.build.json`, `src/index.ts`.
3. **Tipos** (`src/lib/types`) — `Token`, `Provider` (Class/Value/Factory), `ModuleDefinition`,
   `InjectableDefinition`, `Lifecycle`, `ContainerOptions`, interfaces públicas.
4. **`defineProvider` / `defineModule`** — factories puras que produzem definições tipadas (red: specs de forma/tipo primeiro).
5. **`forwardRef` + proxy lazy** — wrapper de token + proxy de resolução tardia.
6. **`Container`** — registro, resolução síncrona com pilha (detecção de ciclo), cache singleton,
   transient, encapsulamento por exports, globals, colisão→erro, hooks `onInit`/`dispose`.
7. **`createContainer`** — entrypoint público que monta o grafo a partir do módulo raiz + globals.
8. **Barrel `src/index.ts`** — superfície pública: `createContainer`, `defineModule`,
   `defineProvider`, `forwardRef` + tipos.
9. **Verde geral** — rodar toda a suíte (15 cenários de aceitação cobertos por unit specs) + build.

## Arquivos

Criar (monorepo):
- `package.json` — workspaces (`packages/core`) + scripts (test/build/changeset) + devDeps.
- `turbo.json` — pipeline build/dev/test/lint (molde orquestra).
- `tsconfig.json` (raiz) — base **strict** compartilhada.
- `biome.json` — lint/format (lineWidth 120), molde orquestra.
- `vitest.config.ts` — include `**/*.spec.ts`, globals, coverage v8.
- `.npmrc`, `.gitignore`, `LICENSE`, `README.md`, `.changeset/config.json`.

Criar (`packages/core`):
- `packages/core/package.json` — `@wirely/core`, build rollup, exports cjs/esm/types.
- `packages/core/rollup.config.mjs` — entrada `src/index.ts`, saída dual.
- `packages/core/tsconfig.json` + `tsconfig.build.json` — strict, sem reflect-metadata.
- `packages/core/src/index.ts` — barrel público.
- `packages/core/src/lib/types/*` — `token`, `provider`, `module`, `injectable`, `lifecycle`, `container` types (+ barrels).
- `packages/core/src/lib/define/define-provider.ts` (+ `define-injectable.ts`, `define-module.ts`).
- `packages/core/src/lib/forward-ref/forward-ref.ts` — wrapper + proxy lazy.
- `packages/core/src/lib/container/container.ts` — classe `Container` (núcleo de resolução).
- `packages/core/src/lib/container/create-container.ts` — entrypoint `createContainer`.
- `packages/core/src/lib/errors/*` — erros nomeados (TokenNotFound, CircularDependency, TokenCollision, Encapsulation).
- Specs `*.spec.ts` colocadas junto a cada unidade (TDD).

## ADR

—

## Notas de execução

- Token globalmente único (colisão = erro) permite cache singleton por token único no container.
- `get()` resolve lazy; `init()` instancia eager + roda `onInit` em ordem de construção; `dispose()` roda `onDestroy` reverso.
- Hooks aplicam-se a singletons construídos (class/factory); value/transient fora do tracking de ciclo de vida.
- `forwardRef` injeta proxy lazy (Reflect-based) que resolve no 1º acesso — quebra ciclo sem reflection.
- Deps de um provider resolvem na visibilidade do **módulo dono**, não do solicitante.
- Mensagens de erro propagam o token solicitante (`requestedBy`) para DX.
- TDD red→green: 17 specs cobrindo os 15 cenários. Lint (biome) limpo, `tsc` strict OK, build rollup cjs/esm/d.ts OK.
- **Revisão de API (pós-fases):** `defineInjectable` removido. Classes ficam puras (sem import do wirely); toda fiação (`inject`/`scope`) vai em `defineProvider` dentro de `defineModule`. Eliminou a metadata-no-protótipo e o vetor do `Symbol.for`. Specs migrados (incl. 8 via sub-agentes paralelos); 55 testes verdes, typecheck/lint/build OK. Doc atualizada + seção de organização modular (src/modules/<module>/[*.service.ts, *.module.ts, use-cases/]).

## PR

—
