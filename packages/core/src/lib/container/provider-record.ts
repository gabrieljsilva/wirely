import { InvalidProviderError } from "../errors/errors";
import type { ModuleDefinition } from "../types/module.types";
import type { InjectDep, Lifetime, Provider, ProviderInput } from "../types/provider.types";
import type { ClassConstructor, Token } from "../types/token.types";

export interface ProviderRecord {
	token: Token;
	scope: Lifetime;
	global: boolean;
	ownerModule: ModuleDefinition;
	kind: "class" | "value" | "factory";
	useClass?: ClassConstructor;
	useFactory?: (...deps: any[]) => any;
	useValue?: any;
	inject: InjectDep[];
}

function isProviderObject(input: ProviderInput): input is Provider {
	return typeof input !== "function";
}

/**
 * Normalizes any `providers` entry into a uniform record. A bare class is a zero-dependency
 * class provider (its own token); dependencies and scope are declared explicitly through
 * `defineProvider`, never attached to the class itself.
 */
export function toProviderRecord(
	input: ProviderInput,
	ownerModule: ModuleDefinition,
	globalFromModule: boolean,
): ProviderRecord {
	if (!isProviderObject(input)) {
		return {
			token: input,
			scope: "singleton",
			global: globalFromModule,
			ownerModule,
			kind: "class",
			useClass: input,
			inject: [],
		};
	}

	if ("useValue" in input) {
		return {
			token: input.provide,
			scope: "singleton",
			global: globalFromModule || Boolean(input.global),
			ownerModule,
			kind: "value",
			useValue: input.useValue,
			inject: [],
		};
	}

	if ("useFactory" in input) {
		return {
			token: input.provide,
			scope: input.scope ?? "singleton",
			global: globalFromModule || Boolean(input.global),
			ownerModule,
			kind: "factory",
			useFactory: input.useFactory,
			inject: input.inject ?? [],
		};
	}

	if (!("useClass" in input) || !input.useClass) {
		throw new InvalidProviderError(input.provide ?? "unknown");
	}

	return {
		token: input.provide ?? input.useClass,
		scope: input.scope ?? "singleton",
		global: globalFromModule || Boolean(input.global),
		ownerModule,
		kind: "class",
		useClass: input.useClass,
		inject: input.inject ?? [],
	};
}
