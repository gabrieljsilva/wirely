import { describe, expect, it } from "vitest";
import {
	CircularDependencyError,
	EncapsulationError,
	TokenCollisionError,
	createContainer,
	defineModule,
	defineProvider,
	forwardRef,
} from "../src/index";

/**
 * End-to-end failure and edge flows: a circular dependency spanning two modules broken
 * with forwardRef, a token collision across modules, an encapsulation breach, and a
 * per-request transient resolved alongside shared singletons.
 */

describe("cross-module cycle (e2e)", () => {
	it("wires two modules that reference each other once forwardRef breaks the cycle", () => {
		class InvoiceService {
			constructor(public billing: any) {}
			describe() {
				return `invoice via ${this.billing.label()}`;
			}
		}
		class BillingService {
			constructor(public invoice: InvoiceService) {}
			label() {
				return "billing";
			}
			summary() {
				return this.invoice.describe();
			}
		}

		const InvoiceModule = defineModule({
			providers: [defineProvider({ useClass: InvoiceService, inject: [forwardRef(() => BillingService)] })],
			exports: [InvoiceService],
		});

		// BillingModule is global so its service is reachable from InvoiceModule (which it
		// imports) without a forbidden back-import — the realistic way to span a cycle.
		const BillingModule = defineModule({
			global: true,
			imports: [InvoiceModule],
			providers: [defineProvider({ useClass: BillingService, inject: [InvoiceService] })],
			exports: [BillingService],
		});

		const container = createContainer(defineModule({ imports: [BillingModule] }));
		const billing = container.get(BillingService);

		expect(billing.summary()).toBe("invoice via billing");
		// the forward-referenced side is reached through a lazy proxy, so assert behavior
		expect(billing.invoice.billing.label()).toBe("billing");
	});

	it("still reports a genuine cycle when no side uses forwardRef", () => {
		class A {
			constructor(public b: any) {}
		}
		class B {
			constructor(public a: any) {}
		}
		const Soft = defineModule({
			providers: [
				defineProvider({ useClass: A, inject: [forwardRef(() => B)] }),
				defineProvider({ useClass: B, inject: [A] }),
			],
		});

		// sanity: with forwardRef it resolves; the negative case below keeps a direct cycle
		expect(() => createContainer(Soft).get(A)).not.toThrow();

		class C {
			constructor(public d: any) {}
		}
		class D {
			constructor(public c: any) {}
		}
		const container = createContainer(
			defineModule({
				providers: [defineProvider({ useClass: C, inject: [D] }), defineProvider({ useClass: D, inject: [C] })],
			}),
		);

		expect(() => container.get(C)).toThrow(CircularDependencyError);
	});
});

describe("registration safety (e2e)", () => {
	it("rejects the same token registered by two different modules", () => {
		const TOKEN = "SHARED";
		const ModuleA = defineModule({ providers: [defineProvider({ provide: TOKEN, useValue: "a" })] });
		const ModuleB = defineModule({ providers: [defineProvider({ provide: TOKEN, useValue: "b" })] });

		expect(() => createContainer(defineModule({ imports: [ModuleA, ModuleB] }))).toThrow(TokenCollisionError);
	});

	it("blocks a consumer from reaching a provider its imported module keeps internal", () => {
		class Secret {}
		const VaultModule = defineModule({ providers: [Secret] });

		class Thief {
			constructor(public secret: unknown) {}
		}
		const ThiefModule = defineModule({
			imports: [VaultModule],
			providers: [defineProvider({ useClass: Thief, inject: [Secret] })],
		});

		const container = createContainer(ThiefModule);

		expect(() => container.get(Thief)).toThrow(EncapsulationError);
	});
});

describe("scopes in a live container (e2e)", () => {
	it("hands out a fresh transient per request while sharing the singleton store", () => {
		let counter = 0;
		class RequestContext {
			readonly id = ++counter;
		}
		class SessionStore {
			readonly opened: number[] = [];
		}

		const container = createContainer(
			defineModule({
				providers: [defineProvider({ useClass: RequestContext, scope: "transient" }), SessionStore],
			}),
		);

		const first = container.get(RequestContext);
		const second = container.get(RequestContext);
		container.get(SessionStore).opened.push(first.id, second.id);

		expect(first).not.toBe(second);
		expect(first.id).not.toBe(second.id);
		expect(container.get(SessionStore)).toBe(container.get(SessionStore));
		expect(container.get(SessionStore).opened).toEqual([first.id, second.id]);
	});
});
