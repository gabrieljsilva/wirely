import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { CircularDependencyError } from "../errors/errors";
import { forwardRef } from "../forward-ref/forward-ref";
import { createContainer } from "./create-container";

describe("Container — circular dependencies", () => {
	it("throws CircularDependencyError when two providers depend on each other directly", () => {
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

	it("resolves a cycle when one side uses forwardRef", () => {
		class A {
			constructor(public b: B) {}
			whoB() {
				return this.b.label();
			}
		}
		class B {
			constructor(public a: A) {}
			label() {
				return "B";
			}
		}

		const container = createContainer(
			defineModule({
				providers: [
					defineProvider({ useClass: A, inject: [forwardRef(() => B)] }),
					defineProvider({ useClass: B, inject: [A] }),
				],
			}),
		);
		const a = container.get(A);

		expect(a).toBeInstanceOf(A);
		expect(a.whoB()).toBe("B");
		expect(a.b.a).toBe(a);
	});
});
