# Wirely

A function based Dependency Injection framework for TypeScript and pure JavaScript. It takes
ideas from NestJS, but it has **no decorators in the core** and no reflection or auto wiring.

Strongly typed when you want it, and friendly to plain JavaScript when you do not.

## Packages

| Package | Description |
| --- | --- |
| [`@wirely/core`](./packages/core) | The DI core: container, modules, providers, lifecycle. See its README for the full guide. |

## Core ideas

- **No decorators, no reflection** in the core. Decorator helpers can come later as optional plugins.
- **Container**, not "app". It is named, and it has global providers, global modules, and lifecycle hooks.
- **Modules** with real encapsulation. A module only exposes what it puts in `exports`.
- **Providers** as `useClass`, `useValue`, or `useFactory`, with `singleton` or `transient` scope.
- **Tokens** from the class itself, or from a plain `string` or `symbol`.
- **Explicit late references** (`forwardRef`) to break circular dependencies, with no decorators.

Classes stay pure. The wiring lives in the module, through `defineProvider`.

```ts
import { createContainer, defineModule, defineProvider } from "@wirely/core";

class UserRepository {}

class UserService {
	constructor(public readonly repo: UserRepository) {}
}

const UsersModule = defineModule({
	providers: [UserRepository, defineProvider({ useClass: UserService, inject: [UserRepository] })],
	exports: [UserService],
});

// A root AppModule imports the feature modules. This is the convention for larger apps.
const AppModule = defineModule({ imports: [UsersModule] });

const container = createContainer(AppModule);
const users = container.get(UserService);
```

## License

MIT, Gabriel de Jesus Silva.
