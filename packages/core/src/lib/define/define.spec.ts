import { describe, expect, it } from "vitest";
import { defineModule } from "./define-module";
import { defineProvider } from "./define-provider";

describe("defineProvider", () => {
	it("defaults class and factory providers to singleton scope", () => {
		const classProvider = defineProvider({ useClass: class A {} });
		const factoryProvider = defineProvider({ provide: "B", useFactory: () => 1 });

		expect(classProvider).toMatchObject({ scope: "singleton" });
		expect(factoryProvider).toMatchObject({ scope: "singleton" });
	});

	it("keeps the class as its own token and carries inject", () => {
		class Dep {}
		class Service {}
		const provider = defineProvider({ useClass: Service, inject: [Dep] });

		expect(provider).toMatchObject({ useClass: Service, inject: [Dep] });
	});

	it("preserves an explicit transient scope", () => {
		const provider = defineProvider({ useClass: class A {}, scope: "transient" });

		expect(provider).toMatchObject({ scope: "transient" });
	});

	it("leaves value providers untouched (no scope added)", () => {
		const provider = defineProvider({ provide: "A", useValue: 42 });

		expect(provider).toEqual({ provide: "A", useValue: 42 });
	});
});

describe("defineModule", () => {
	it("brands the module and defaults empty collections", () => {
		const mod = defineModule({});

		expect(mod.__wirelyModule).toBe(true);
		expect(mod.imports).toEqual([]);
		expect(mod.providers).toEqual([]);
		expect(mod.exports).toEqual([]);
		expect(mod.global).toBe(false);
	});

	it("freezes the returned definition", () => {
		const mod = defineModule({});

		expect(Object.isFrozen(mod)).toBe(true);
	});
});
