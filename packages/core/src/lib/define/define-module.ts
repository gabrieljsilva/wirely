import type { ModuleConfig, ModuleDefinition } from "../types/module.types";

/**
 * Declares a module: its imported modules, owned providers, the tokens it exports
 * (encapsulation boundary) and whether it is global.
 */
export function defineModule(config: ModuleConfig): ModuleDefinition {
	return Object.freeze({
		__wirelyModule: true as const,
		imports: config.imports ?? [],
		providers: config.providers ?? [],
		exports: config.exports ?? [],
		global: config.global ?? false,
	});
}
