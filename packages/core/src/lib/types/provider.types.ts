import type { ForwardRef } from "../forward-ref/forward-ref";
import type { ClassConstructor, Token } from "./token.types";

export type Lifetime = "singleton" | "transient";

/**
 * A dependency reference in an `inject` list: a direct token, or a `forwardRef`
 * wrapper used to break circular dependencies.
 */
export type InjectDep = Token | ForwardRef;

export interface ClassProvider<T = any> {
	provide?: Token<T>;
	useClass: ClassConstructor<T>;
	inject?: InjectDep[];
	scope?: Lifetime;
	global?: boolean;
}

export interface ValueProvider<T = any> {
	provide: Token<T>;
	useValue: T;
	global?: boolean;
}

export interface FactoryProvider<T = any> {
	provide: Token<T>;
	useFactory: (...deps: any[]) => T;
	inject?: InjectDep[];
	scope?: Lifetime;
	global?: boolean;
}

export type Provider<T = any> = ClassProvider<T> | ValueProvider<T> | FactoryProvider<T>;

/**
 * Anything accepted in a module's `providers` list: a full provider definition (via
 * `defineProvider`), or a bare zero-dependency class (which is its own token).
 */
export type ProviderInput<T = any> = Provider<T> | ClassConstructor<T>;
