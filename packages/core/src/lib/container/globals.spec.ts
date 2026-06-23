import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { TokenCollisionError } from "../errors/errors";
import { createContainer } from "./create-container";

describe("Container — globals", () => {
	it("resolves a global provider without importing its module", () => {
		class Logger {}
		const GlobalModule = defineModule({ providers: [Logger], exports: [Logger], global: true });

		class Consumer {}
		const FeatureModule = defineModule({
			imports: [GlobalModule],
			providers: [defineProvider({ useClass: Consumer, inject: [Logger] })],
		});

		const container = createContainer(FeatureModule);

		expect(container.get(Consumer)).toBeInstanceOf(Consumer);
	});

	it("resolves a container-level global provider", () => {
		const CONFIG = "CONFIG";
		const container = createContainer(defineModule({}), {
			global: [defineProvider({ provide: CONFIG, useValue: { region: "br" } })],
		});

		expect(container.get<{ region: string }>(CONFIG)).toEqual({ region: "br" });
	});

	it("throws TokenCollisionError when a token is registered as global and locally", () => {
		const CONFIG = "CONFIG";

		expect(() =>
			createContainer(defineModule({ providers: [defineProvider({ provide: CONFIG, useValue: 1 })] }), {
				global: [defineProvider({ provide: CONFIG, useValue: 2 })],
			}),
		).toThrow(TokenCollisionError);
	});

	it("throws TokenCollisionError on a duplicate local token", () => {
		const TOKEN = "DUP";

		expect(() =>
			createContainer(
				defineModule({
					providers: [defineProvider({ provide: TOKEN, useValue: 1 }), defineProvider({ provide: TOKEN, useValue: 2 })],
				}),
			),
		).toThrow(TokenCollisionError);
	});
});
