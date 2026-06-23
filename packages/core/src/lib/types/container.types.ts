import type { ProviderInput } from "./provider.types";
import type { AbstractConstructor, ClassConstructor, Token } from "./token.types";

export interface ContainerOptions {
	/** Optional name, used in error messages and debugging. */
	name?: string;
	/** Providers registered as global — visible to every module without an import. */
	global?: ProviderInput[];
}

export interface Container {
	readonly name: string;
	/** Resolve a token to its instance/value, constructing singletons on first access. */
	get<T>(token: ClassConstructor<T>): T;
	get<T>(token: AbstractConstructor<T>): T;
	get<T>(token: Token<T>): T;
	/**
	 * True if the token is registered anywhere in the container. Reflects registration, not
	 * visibility — a token may be registered yet not resolvable from the root due to module
	 * encapsulation.
	 */
	has(token: Token): boolean;
	/**
	 * Eagerly instantiate all singletons and run their `onInit` hooks in dependency order.
	 * Transient providers are not instantiated here, so their lifecycle hooks never run.
	 */
	init(): Promise<void>;
	/**
	 * Run `onDestroy` hooks in reverse construction order, then mark the container disposed —
	 * further `get`/`init` calls throw. Only singletons are tracked; transient instances are not.
	 */
	dispose(): Promise<void>;
}
