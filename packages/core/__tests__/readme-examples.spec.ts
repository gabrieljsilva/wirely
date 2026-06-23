import { describe, expect, it } from "vitest";
import {
	CircularDependencyError,
	ContainerDisposedError,
	EncapsulationError,
	KyrosError,
	TokenCollisionError,
	TokenNotFoundError,
	createContainer,
	defineModule,
	defineProvider,
	forwardRef,
} from "../src/index";

// Each test mirrors a snippet from packages/core/README.md, to prove the docs are feasible.

describe("README — Installation (smallest program)", () => {
	it("builds a bare class and resolves it", () => {
		class Greeter {
			hello() {
				return "hi";
			}
		}
		const AppModule = defineModule({ providers: [Greeter] });
		const container = createContainer(AppModule);

		expect(container.get(Greeter).hello()).toBe("hi");
	});
});

describe("README — Providers", () => {
	it("class provider with inject", () => {
		class UserRepository {}
		class UserService {
			constructor(public readonly repo: UserRepository) {}
		}
		const container = createContainer(
			defineModule({
				providers: [UserRepository, defineProvider({ useClass: UserService, inject: [UserRepository] })],
			}),
		);

		expect(container.get(UserService).repo).toBeInstanceOf(UserRepository);
	});

	it("value provider needs a token", () => {
		const container = createContainer(
			defineModule({ providers: [defineProvider({ provide: "CONFIG", useValue: { region: "br" } })] }),
		);

		expect(container.get<{ region: string }>("CONFIG")).toEqual({ region: "br" });
	});

	it("factory provider picks an implementation at runtime", () => {
		class StripeGateway {
			readonly name = "stripe";
		}
		class PixGateway {
			readonly name = "pix";
		}
		const container = createContainer(
			defineModule({
				providers: [
					StripeGateway,
					PixGateway,
					defineProvider({ provide: "CONFIG", useValue: { region: "br" } }),
					defineProvider({
						provide: "PAYMENT",
						inject: ["CONFIG", StripeGateway, PixGateway],
						useFactory: (config: any, stripe: StripeGateway, pix: PixGateway) => (config.region === "br" ? pix : stripe),
					}),
				],
			}),
		);

		expect(container.get<{ name: string }>("PAYMENT").name).toBe("pix");
	});

	it("rejects a duplicated token", () => {
		expect(() =>
			createContainer(
				defineModule({
					providers: [defineProvider({ provide: "X", useValue: 1 }), defineProvider({ provide: "X", useValue: 2 })],
				}),
			),
		).toThrow(TokenCollisionError);
	});
});

describe("README — Modules", () => {
	it("exports make a provider visible, internals stay private", () => {
		class UserRepository {}
		class UserService {
			constructor(public readonly repo: UserRepository) {}
		}
		const UsersModule = defineModule({
			providers: [UserRepository, defineProvider({ useClass: UserService, inject: [UserRepository] })],
			exports: [UserService],
		});
		const AppModule = defineModule({ imports: [UsersModule] });
		const container = createContainer(AppModule);

		expect(container.get(UserService)).toBeInstanceOf(UserService);
		expect(() => container.get(UserRepository)).toThrow(EncapsulationError);
	});

	it("a global module is visible without an import", () => {
		class Logger {}
		const PlatformModule = defineModule({ global: true, providers: [Logger], exports: [Logger] });
		class Service {}
		const FeatureModule = defineModule({
			imports: [PlatformModule],
			providers: [defineProvider({ useClass: Service, inject: [Logger] })],
		});
		const container = createContainer(FeatureModule);

		expect(container.get(Service)).toBeInstanceOf(Service);
	});
});

describe("README — Injection scopes", () => {
	it("singleton is shared, transient is fresh", () => {
		class Singleton {}
		class Transient {}
		const container = createContainer(
			defineModule({
				providers: [Singleton, defineProvider({ useClass: Transient, scope: "transient" })],
			}),
		);

		expect(container.get(Singleton)).toBe(container.get(Singleton));
		expect(container.get(Transient)).not.toBe(container.get(Transient));
	});
});

describe("README — Circular dependency", () => {
	it("a real cycle throws", () => {
		class A {
			constructor(public b: any) {}
		}
		class B {
			constructor(public a: any) {}
		}
		const container = createContainer(
			defineModule({
				providers: [defineProvider({ useClass: A, inject: [B] }), defineProvider({ useClass: B, inject: [A] })],
			}),
		);

		expect(() => container.get(A)).toThrow(CircularDependencyError);
	});

	it("forwardRef breaks the cycle", () => {
		class ServiceA {
			constructor(public b: any) {}
		}
		class ServiceB {
			constructor(public a: ServiceA) {}
			tag() {
				return "B";
			}
		}
		const container = createContainer(
			defineModule({
				providers: [
					defineProvider({ useClass: ServiceA, inject: [forwardRef(() => ServiceB)] }),
					defineProvider({ useClass: ServiceB, inject: [ServiceA] }),
				],
			}),
		);

		expect(container.get(ServiceA).b.tag()).toBe("B");
	});
});

describe("README — Lifecycle events", () => {
	it("runs onInit on start and onDestroy in reverse on dispose, then blocks reuse", async () => {
		const order: string[] = [];
		class Repo {
			onInit() {
				order.push("repo:init");
			}
			onDestroy() {
				order.push("repo:destroy");
			}
		}
		class Service {
			constructor(public repo: Repo) {}
			onInit() {
				order.push("service:init");
			}
			onDestroy() {
				order.push("service:destroy");
			}
		}
		const container = createContainer(
			defineModule({ providers: [Repo, defineProvider({ useClass: Service, inject: [Repo] })] }),
		);

		await container.init();
		await container.dispose();

		expect(order).toEqual(["repo:init", "service:init", "service:destroy", "repo:destroy"]);
		expect(() => container.get(Repo)).toThrow(ContainerDisposedError);
	});
});

describe("README — Container reference and Errors", () => {
	it("has reflects registration, get throws TokenNotFoundError for unknown", () => {
		class Service {}
		const container = createContainer(defineModule({ providers: [Service] }));

		expect(container.has(Service)).toBe(true);
		expect(container.has("NOPE")).toBe(false);
		expect(() => container.get("NOPE")).toThrow(TokenNotFoundError);
	});

	it("every documented error extends KyrosError", () => {
		const cases = [
			new TokenNotFoundError("x"),
			new TokenCollisionError("x"),
			new EncapsulationError("x"),
			new CircularDependencyError(["x"]),
			new ContainerDisposedError("kyros"),
		];
		for (const error of cases) expect(error).toBeInstanceOf(KyrosError);
	});
});
