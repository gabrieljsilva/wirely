# @kyros/core

Function based Dependency Injection for TypeScript and pure JavaScript. It takes ideas from
NestJS, but it has no decorators and no reflection in the core. You write plain classes, and
you wire them in modules.

## Introduction

Kyros is a small container for Dependency Injection (DI). DI means you do not create your
dependencies by hand. You declare them, and the container builds them for you.

The main goal of Kyros is simple. Your classes stay pure. They do not import anything from
Kyros. All the wiring lives in the module file. Because of this:

- The same code works in TypeScript and in plain JavaScript.
- There is no decorator and no `reflect-metadata`.
- Your classes are easy to test, because they are only classes.

If you know NestJS, the ideas are close: providers, modules, scopes, lifecycle hooks, and a
way to break circular dependencies. The difference is that here you declare everything with
plain functions, not decorators.

## Installation

Install the package with npm:

```bash
npm install @kyros/core
```

You need Node.js 18 or newer. TypeScript is optional. If you use TypeScript, you get full
types and autocomplete. If you use plain JavaScript, the same API still works.

The smallest program looks like this:

```ts
import { createContainer, defineModule } from "@kyros/core";

class Greeter {
	hello() {
		return "hi";
	}
}

const AppModule = defineModule({ providers: [Greeter] });

const container = createContainer(AppModule);
container.get(Greeter).hello(); // "hi"
```

## Providers

A provider is something the container can build and give to you. Most of the time a provider
is a class (a service, a repository, a use case). But it can also be a value or a factory.

You declare a provider with `defineProvider`, inside the `providers` list of a module. A
class without dependencies can be added directly, without `defineProvider`.

### Class provider (`useClass`)

Use it for a class that has dependencies. You pass the dependencies in `inject`, in the same
order as the constructor.

```ts
class UserRepository {}

class UserService {
	constructor(private readonly repo: UserRepository) {}
}

defineProvider({ useClass: UserService, inject: [UserRepository] });
```

The class stays pure. It does not import Kyros. Only the module knows about `defineProvider`.

### Value provider (`useValue`)

Use it for a ready value, like a config object or a constant. Here you must give a `provide`
token.

```ts
defineProvider({ provide: "CONFIG", useValue: { region: "br" } });
```

### Factory provider (`useFactory`)

Use it when you need to compute the value. The factory can also receive dependencies through
`inject`. This is good to pick one implementation at runtime.

```ts
defineProvider({
	provide: "PAYMENT",
	inject: ["CONFIG", StripeGateway, PixGateway],
	useFactory: (config, stripe, pix) => (config.region === "br" ? pix : stripe),
});
```

### Tokens

A token is the key that the container uses to find a provider. A token can be:

- a class, which is also its own token (this is the common case),
- a `string`,
- a `symbol`.

You use the class for normal services. You use a `string` or `symbol` for values and
factories, where there is no class.

Every token must be unique in the container. If the same token is registered twice, you get
a `TokenCollisionError` at registration time. This is on purpose, so two providers never
fight for the same token.

## Modules

A module groups providers that belong together. You declare a module with `defineModule`.

```ts
import { defineModule, defineProvider } from "@kyros/core";

export const UsersModule = defineModule({
	providers: [
		UserRepository,
		defineProvider({ useClass: UserService, inject: [UserRepository] }),
	],
	exports: [UserService],
});
```

### Feature modules

Put each feature in its own module. For example a `UsersModule`, a `BillingModule`, and so
on. This keeps the code organized and easy to find.

### Shared modules and exports

A module is private by default. Other modules can only use what the module puts in `exports`.
In the example above, `UserService` is exported, but `UserRepository` stays inside. If another
module imports `UsersModule`, it can use `UserService` but not `UserRepository`.

If you try to read a provider that is not exported, you get an `EncapsulationError`.

### The root module

You can pass a feature module straight to `createContainer`. But in a bigger app it is better
to have one root `AppModule` that imports the feature modules:

```ts
const AppModule = defineModule({ imports: [UsersModule, BillingModule] });

const container = createContainer(AppModule);
```

### Global modules

Sometimes one module is needed almost everywhere, like a logger. Mark it with `global: true`,
and the tokens it exports become visible to every module, without an import. The global module
still needs to be imported one time, so the container can register it.

```ts
const PlatformModule = defineModule({
	global: true,
	providers: [Logger],
	exports: [Logger],
});
```

## Injection scopes

A scope decides how many times the container builds a provider.

- `singleton` is the default. The container builds it one time and gives the same instance to
  everybody.
- `transient` builds a new instance every time you ask for it.

```ts
defineProvider({ useClass: RequestContext, scope: "transient" });
```

If you do not set a scope, it is `singleton`.

## Circular dependency

A circular dependency is when class A needs class B, and class B also needs class A. With
plain constructor injection this cannot work, because neither one can be built first.

When there is a real cycle and you do nothing, the container throws a
`CircularDependencyError` and shows you the full path.

To break the cycle, wrap one side with `forwardRef`. The class that uses it receives a small
proxy. The proxy resolves the real instance the first time you touch it, so both classes can
be built.

```ts
import { forwardRef } from "@kyros/core";

defineProvider({ useClass: ServiceA, inject: [forwardRef(() => ServiceB)] });
defineProvider({ useClass: ServiceB, inject: [ServiceA] });
```

Small note. The dependency behind `forwardRef` is a proxy. It works like the real object, but
it is not the same reference. Also, if you enumerate it (`Object.keys`, spread) and the object
is frozen, you can get a proxy error. Access by property or method is always fine.

## Lifecycle events

The container has three phases: starting, running, and stopping. You can run code in the
start phase and in the stop phase, with two hooks. The hooks are duck typed, so you only add
the method on your class.

| Hook | Phase | When it runs |
| --- | --- | --- |
| `onInit()` | starting | after the dependencies of the provider are ready |
| `onDestroy()` | stopping | when the container is disposed, in reverse order |

```ts
class OrderRepository {
	onInit() {
		// open a connection
	}
	onDestroy() {
		// close the connection
	}
}
```

You drive the lifecycle with two methods:

- `await container.init()` builds all singletons and runs `onInit` in dependency order, so a
  dependency starts before the class that uses it. If a hook throws, the container stays not
  initialized.
- `await container.dispose()` runs `onDestroy` in reverse order, and then marks the container
  as disposed. After that, `get` and `init` throw a `ContainerDisposedError`.

The hooks can be async. The container waits for them. Only singletons run hooks. Value and
transient providers are not tracked.

## Container reference

The container has a small surface:

- `container.get(token)` builds (if needed) and returns the instance for a token.
- `container.has(token)` tells you if the token is registered. Note that `has` looks only at
  registration, not at visibility. A token can be registered but still not reachable from the
  root, because of module encapsulation.
- `await container.init()` and `await container.dispose()` drive the lifecycle.

## Errors

All errors extend `KyrosError`, so you can catch them in one place.

| Error | When it happens |
| --- | --- |
| `TokenNotFoundError` | you ask for a token that was never registered |
| `TokenCollisionError` | the same token is registered more than one time |
| `EncapsulationError` | you ask for a token that is registered but not visible to you |
| `CircularDependencyError` | there is a cycle and no side uses `forwardRef` |
| `InvalidProviderError` | a provider has no `useClass`, `useValue`, or `useFactory` |
| `ContainerDisposedError` | you use the container after `dispose()` |
| `ResolutionDepthError` | the dependency graph is too deep (guard against runaway recursion) |

## Suggested project structure

Kyros does not force a layout, but a feature first layout works well. Keep the classes pure
and put all the wiring in the `*.module.ts` file:

```
src/
  modules/
    users/
      users.module.ts        # defineModule and defineProvider (the only Kyros imports)
      user.service.ts        # pure class
      user.repository.ts     # pure class
      use-cases/
        register-user.use-case.ts   # pure class
    billing/
      billing.module.ts
      billing.service.ts
      use-cases/
  app.module.ts              # imports the feature modules
  main.ts                    # createContainer(AppModule)
```

## License

MIT, Gabriel de Jesus Silva.
