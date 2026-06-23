import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { TokenNotFoundError } from "../errors/errors";
import { createContainer } from "./create-container";

describe("Container — resolution", () => {
	it("returns the same instance for a singleton resolved twice", () => {
		class Service {}
		const container = createContainer(defineModule({ providers: [Service] }));

		expect(container.get(Service)).toBe(container.get(Service));
	});

	it("returns distinct instances for a transient resolved twice", () => {
		class Service {}
		const container = createContainer(
			defineModule({ providers: [defineProvider({ useClass: Service, scope: "transient" })] }),
		);

		expect(container.get(Service)).not.toBe(container.get(Service));
	});

	it("injects declared dependencies into the constructor", () => {
		class UserRepository {
			findById(id: number) {
				return { id, name: "Ada" };
			}
		}

		class UserService {
			constructor(public readonly repo: UserRepository) {}
		}

		const container = createContainer(
			defineModule({
				providers: [UserRepository, defineProvider({ useClass: UserService, inject: [UserRepository] })],
			}),
		);
		const service = container.get(UserService);

		expect(service).toBeInstanceOf(UserService);
		expect(service.repo).toBeInstanceOf(UserRepository);
		expect(service.repo.findById(1)).toEqual({ id: 1, name: "Ada" });
	});

	it("resolves a provider by its class token", () => {
		class Service {}
		const container = createContainer(defineModule({ providers: [Service] }));

		expect(container.get(Service)).toBeInstanceOf(Service);
	});

	it("resolves value and factory providers by string/symbol token", () => {
		const CONFIG = "CONFIG";
		const CLOCK = Symbol("CLOCK");
		const container = createContainer(
			defineModule({
				providers: [
					defineProvider({ provide: CONFIG, useValue: { env: "test" } }),
					defineProvider({ provide: CLOCK, useFactory: () => ({ now: () => 42 }) }),
				],
			}),
		);

		expect(container.get<{ env: string }>(CONFIG)).toEqual({ env: "test" });
		expect(container.get<{ now: () => number }>(CLOCK).now()).toBe(42);
	});

	it("injects a factory provider with its own dependencies", () => {
		class Repo {}
		const SERVICE = "SERVICE";
		const container = createContainer(
			defineModule({
				providers: [
					Repo,
					defineProvider({
						provide: SERVICE,
						useFactory: (repo: any) => ({ repo }),
						inject: [Repo],
					}),
				],
			}),
		);

		expect(container.get<{ repo: unknown }>(SERVICE).repo).toBeInstanceOf(Repo);
	});

	it("throws TokenNotFoundError for an unregistered token", () => {
		const container = createContainer(defineModule({}));

		expect(() => container.get("NOPE")).toThrow(TokenNotFoundError);
	});
});
