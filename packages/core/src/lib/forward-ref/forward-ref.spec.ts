import { describe, expect, it } from "vitest";
import { createContainer } from "../container/create-container";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { createLazyProxy, forwardRef, isForwardRef } from "./forward-ref";

describe("forwardRef", () => {
	it("identifies forwardRef wrappers", () => {
		expect(isForwardRef(forwardRef(() => "T"))).toBe(true);
		expect(isForwardRef("T")).toBe(false);
		expect(isForwardRef(null)).toBe(false);
		expect(isForwardRef({})).toBe(false);
	});
});

describe("createLazyProxy", () => {
	it("defers the factory until first access", () => {
		let built = 0;
		const proxy = createLazyProxy(() => {
			built++;
			return { value: 7 };
		});

		expect(built).toBe(0);
		expect(proxy.value).toBe(7);
		expect(built).toBe(1);
		expect(proxy.value).toBe(7);
		expect(built).toBe(1);
	});

	it("supports the in operator and deleteProperty through the proxy", () => {
		const proxy = createLazyProxy(() => ({ a: 1 }) as Record<string, number>);

		expect("a" in proxy).toBe(true);
		expect("b" in proxy).toBe(false);
		delete proxy.a;
		expect("a" in proxy).toBe(false);
	});

	it("caches even when the factory resolves to a property holding undefined", () => {
		let built = 0;
		const proxy = createLazyProxy(() => {
			built++;
			return { value: undefined } as { value: undefined };
		});

		expect(proxy.value).toBeUndefined();
		expect(proxy.value).toBeUndefined();
		expect(built).toBe(1);
	});

	it("writes through set to the real instance", () => {
		const real: Record<string, unknown> = {};
		const proxy = createLazyProxy(() => real);

		proxy.tag = "written";
		expect(real.tag).toBe("written");
	});

	it("delegates defineProperty and setPrototypeOf to the real instance", () => {
		const real: Record<string, unknown> = {};
		const proxy = createLazyProxy(() => real);

		Object.defineProperty(proxy, "x", { value: 9, enumerable: true });
		expect(real.x).toBe(9);

		const proto = { tag: "proto" };
		Object.setPrototypeOf(proxy, proto);
		expect(Object.getPrototypeOf(real)).toBe(proto);
	});
});

describe("Container — forwardRef integration", () => {
	it("does not construct the forward-referenced provider until accessed", () => {
		let bBuilt = 0;

		class A {
			constructor(public b: any) {}
		}
		class B {
			constructor() {
				bBuilt++;
			}
		}
		const container = createContainer(
			defineModule({
				providers: [defineProvider({ useClass: A, inject: [forwardRef(() => B)] }), B],
			}),
		);
		const a = container.get(A);

		expect(bBuilt).toBe(0);
		void a.b.constructor;
		expect(bBuilt).toBe(1);
	});

	it("resolves a forwardRef dependency injected into a factory provider", () => {
		const LATE = "LATE";
		class Holder {
			constructor(public late: any) {}
		}
		const container = createContainer(
			defineModule({
				providers: [
					defineProvider({ useClass: Holder, inject: [forwardRef(() => LATE)] }),
					defineProvider({ provide: LATE, useFactory: () => ({ name: "late" }) }),
				],
			}),
		);

		expect(container.get(Holder).late.name).toBe("late");
	});
});
