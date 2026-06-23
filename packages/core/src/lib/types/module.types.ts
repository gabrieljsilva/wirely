import type { ProviderInput } from "./provider.types";
import type { Token } from "./token.types";

export interface ModuleConfig {
	imports?: ModuleDefinition[];
	providers?: ProviderInput[];
	exports?: Token[];
	/**
	 * When true, everything this module exports becomes visible to every module in the
	 * container, without an explicit import.
	 */
	global?: boolean;
}

/**
 * The frozen result of `defineModule`. Carries a brand so the container can tell a
 * module apart from a plain config object.
 */
export interface ModuleDefinition extends ModuleConfig {
	readonly __wirelyModule: true;
}
