/**
 * A concrete class usable both as a constructor and as its own injection token.
 */
export interface ClassConstructor<T = any> {
	new (...args: any[]): T;
	readonly name: string;
}

/**
 * An abstract class usable as an injection token (a contract). It cannot be instantiated,
 * so it is only a token/type, never a `useClass` target.
 */
export interface AbstractConstructor<T = any> {
	prototype: T;
	readonly name: string;
}

/**
 * A token identifies a provider inside a container. It can be a concrete class (which
 * doubles as the produced type), an abstract class used as a contract, or a plain
 * `string` / `symbol` for value/factory providers.
 */
export type Token<T = any> = string | symbol | ClassConstructor<T> | AbstractConstructor<T>;

/**
 * Resolves the instance type a token produces.
 */
export type TokenValue<TToken> = TToken extends ClassConstructor<infer T>
	? T
	: TToken extends AbstractConstructor<infer T>
		? T
		: any;
