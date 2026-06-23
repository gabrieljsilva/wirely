import type { Token } from "../types/token.types";

const FORWARD_REF = Symbol("wirely:forwardRef");

export interface ForwardRef {
	readonly [FORWARD_REF]: true;
	readonly resolve: () => Token;
}

/**
 * Wraps a token behind a thunk so the container can defer its resolution and break a
 * circular dependency. The dependent receives a lazy proxy that resolves the real
 * instance on first property access.
 *
 * @example
 * defineProvider({ useClass: A, inject: [forwardRef(() => B)] })
 */
export function forwardRef(resolve: () => Token): ForwardRef {
	return { [FORWARD_REF]: true, resolve };
}

export function isForwardRef(value: unknown): value is ForwardRef {
	return typeof value === "object" && value !== null && (value as any)[FORWARD_REF] === true;
}

/**
 * A proxy that resolves the underlying instance lazily, on first access. Used to satisfy
 * a constructor dependency before the depended-upon instance physically exists.
 *
 * Known limitation: because the proxy target is a placeholder object, enumerating a
 * forward-referenced dependency that is frozen or has non-configurable own properties
 * (e.g. `Object.keys`, spread, `JSON.stringify`) can throw a proxy invariant `TypeError`.
 * Access by property/method works normally; avoid enumerating across a forwardRef boundary.
 */
export function createLazyProxy<T extends object>(factory: () => T): T {
	let resolved = false;
	let instance: T;
	const target = (): object => {
		if (!resolved) {
			instance = factory();
			resolved = true;
		}
		return instance as object;
	};
	return new Proxy({} as T, {
		get(_t, prop, receiver) {
			return Reflect.get(target(), prop, receiver);
		},
		set(_t, prop, value) {
			return Reflect.set(target(), prop, value);
		},
		has(_t, prop) {
			return Reflect.has(target(), prop);
		},
		deleteProperty(_t, prop) {
			return Reflect.deleteProperty(target(), prop);
		},
		defineProperty(_t, prop, descriptor) {
			return Reflect.defineProperty(target(), prop, descriptor);
		},
		getPrototypeOf() {
			return Reflect.getPrototypeOf(target());
		},
		setPrototypeOf(_t, proto) {
			return Reflect.setPrototypeOf(target(), proto);
		},
		ownKeys() {
			return Reflect.ownKeys(target());
		},
		getOwnPropertyDescriptor(_t, prop) {
			return Reflect.getOwnPropertyDescriptor(target(), prop);
		},
	});
}
