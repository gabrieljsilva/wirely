import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { ContainerDisposedError, InvalidProviderError } from "../errors/errors";
import { createContainer } from "./create-container";

describe("Container — edge cases", () => {
	it("reports registration via has()", () => {
		class Service {}
		const container = createContainer(defineModule({ providers: [Service] }));

		expect(container.has(Service)).toBe(true);
		expect(container.has("UNKNOWN")).toBe(false);
	});

	it("shares a singleton dependency across transient instances", () => {
		class Repo {}

		class Service {
			constructor(public repo: unknown) {}
		}

		const container = createContainer(
			defineModule({
				providers: [Repo, defineProvider({ useClass: Service, inject: [Repo], scope: "transient" })],
			}),
		);
		const a = container.get(Service);
		const b = container.get(Service);

		expect(a).not.toBe(b);
		expect(a.repo).toBe(b.repo);
	});

	it("shares one singleton instance across modules that import the same provider", () => {
		class Shared {}
		const SharedModule = defineModule({ providers: [Shared], exports: [Shared] });

		class ConsumerA {
			constructor(public shared: unknown) {}
		}
		const ModuleA = defineModule({
			imports: [SharedModule],
			providers: [defineProvider({ useClass: ConsumerA, inject: [Shared] })],
			exports: [ConsumerA],
		});

		class ConsumerB {
			constructor(public shared: unknown) {}
		}
		const ModuleB = defineModule({
			imports: [SharedModule],
			providers: [defineProvider({ useClass: ConsumerB, inject: [Shared] })],
			exports: [ConsumerB],
		});

		const container = createContainer(defineModule({ imports: [ModuleA, ModuleB] }));

		expect((container.get(ConsumerA) as any).shared).toBe((container.get(ConsumerB) as any).shared);
	});

	it("resolves a class provider under a token different from its class", () => {
		const TOKEN = "SERVICE";
		class Service {}
		const container = createContainer(
			defineModule({ providers: [defineProvider({ provide: TOKEN, useClass: Service })] }),
		);

		expect(container.get(TOKEN)).toBeInstanceOf(Service);
		expect(container.has(Service)).toBe(false);
	});

	it("honors a provider-level global flag without a global module", () => {
		const TOKEN = "FLAG";
		const GlobalHolder = defineModule({
			providers: [defineProvider({ provide: TOKEN, useValue: "on", global: true })],
		});

		class Consumer {
			constructor(public flag: unknown) {}
		}
		const Feature = defineModule({
			imports: [GlobalHolder],
			providers: [defineProvider({ useClass: Consumer, inject: [TOKEN] })],
		});

		const container = createContainer(Feature);

		expect((container.get(Consumer) as any).flag).toBe("on");
	});

	it("rejects use after dispose", async () => {
		class Service {}
		const container = createContainer(defineModule({ providers: [Service] }));

		container.get(Service);
		await container.dispose();

		expect(() => container.get(Service)).toThrow(ContainerDisposedError);
		await expect(container.init()).rejects.toThrow(ContainerDisposedError);
	});

	it("rejects a malformed provider with no useClass/useValue/useFactory", () => {
		expect(() => createContainer(defineModule({ providers: [{ provide: "BAD" } as any] }))).toThrow(InvalidProviderError);
	});

	it("treats a second dispose as a no-op", async () => {
		let destroys = 0;
		class Service {
			onDestroy() {
				destroys++;
			}
		}
		const container = createContainer(defineModule({ providers: [Service] }));
		await container.init();
		await container.dispose();
		await container.dispose();

		expect(destroys).toBe(1);
	});
});
