import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { ContainerDisposedError, InvalidProviderError, ResolutionDepthError } from "../errors/errors";
import { createContainer } from "./create-container";

describe("Container — robustness", () => {
	it("throws a controlled ResolutionDepthError instead of overflowing the stack", () => {
		const tokens: any[] = [];
		let previous: any = null;
		for (let i = 0; i < 1100; i++) {
			class Node {}
			const provider = previous ? defineProvider({ useClass: Node, inject: [previous] }) : Node;
			tokens.push(provider);
			previous = Node;
		}
		const container = createContainer(defineModule({ providers: tokens }));

		expect(() => container.get(previous)).toThrow(ResolutionDepthError);
	});

	it("leaves the container uninitialized when an onInit hook throws", async () => {
		class Bad {
			onInit() {
				throw new Error("boom");
			}
		}
		const container = createContainer(defineModule({ providers: [Bad] }));

		await expect(container.init()).rejects.toThrow("boom");
		// if init() had been masked as done, a second call would resolve instead of re-throwing
		await expect(container.init()).rejects.toThrow("boom");
	});

	it("marks itself disposed before running onDestroy hooks", async () => {
		let caught: unknown;
		class Service {
			onDestroy() {
				try {
					container.get(Service);
				} catch (error) {
					caught = error;
				}
			}
		}
		const container = createContainer(defineModule({ providers: [Service] }));
		await container.init();
		await container.dispose();

		expect(caught).toBeInstanceOf(ContainerDisposedError);
	});

	it("builds an error for a malformed provider without invoking the token's toString", () => {
		const evil = {
			toString() {
				throw new Error("toString must not run while formatting the error");
			},
		};

		expect(() => createContainer(defineModule({ providers: [{ provide: evil } as any] }))).toThrow(InvalidProviderError);
	});
});
