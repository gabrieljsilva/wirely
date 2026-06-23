import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { EncapsulationError } from "../errors/errors";
import { createContainer } from "./create-container";

describe("Container — module encapsulation", () => {
	it("resolves a provider exported by an imported module", () => {
		class Shared {}
		const ModuleA = defineModule({ providers: [Shared], exports: [Shared] });

		class Consumer {}
		const ModuleB = defineModule({
			imports: [ModuleA],
			providers: [defineProvider({ useClass: Consumer, inject: [Shared] })],
		});

		const container = createContainer(ModuleB);

		expect(container.get(Consumer)).toBeInstanceOf(Consumer);
		expect(container.get(Shared)).toBeInstanceOf(Shared);
	});

	it("hides a provider that the imported module does not export", () => {
		class Internal {}
		const ModuleA = defineModule({ providers: [Internal] });

		class Consumer {}
		const ModuleB = defineModule({
			imports: [ModuleA],
			providers: [defineProvider({ useClass: Consumer, inject: [Internal] })],
		});

		const container = createContainer(ModuleB);

		expect(() => container.get(Consumer)).toThrow(EncapsulationError);
	});
});
