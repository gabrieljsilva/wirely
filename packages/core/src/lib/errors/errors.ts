import type { Token } from "../types";

export function tokenName(token: Token): string {
	if (typeof token === "function") return token.name || "AnonymousClass";
	if (typeof token === "symbol") return token.toString();
	if (typeof token === "string") return token;
	// Defensive: a non-token value (passed via cast) must not run its own toString/Symbol.toPrimitive here.
	return typeof token;
}

export class WirelyError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class TokenNotFoundError extends WirelyError {
	constructor(token: Token, requestedBy?: Token) {
		const by = requestedBy ? ` (requested by ${tokenName(requestedBy)})` : "";
		super(`No provider registered for token "${tokenName(token)}"${by}.`);
	}
}

export class TokenCollisionError extends WirelyError {
	constructor(token: Token) {
		super(
			`Token "${tokenName(token)}" is already registered. Each token must be unique across the container (globals and module providers included).`,
		);
	}
}

export class CircularDependencyError extends WirelyError {
	constructor(path: Token[]) {
		const trail = path.map(tokenName).join(" -> ");
		super(`Circular dependency detected: ${trail}. Break the cycle with forwardRef(() => Token) on one side.`);
	}
}

export class InvalidProviderError extends WirelyError {
	constructor(token: Token) {
		super(`Provider for token "${tokenName(token)}" is malformed: it has no useClass, useValue or useFactory.`);
	}
}

export class ContainerDisposedError extends WirelyError {
	constructor(name: string) {
		super(`Container "${name}" has been disposed and can no longer be used.`);
	}
}

export class ResolutionDepthError extends WirelyError {
	constructor(token: Token, maxDepth: number) {
		super(
			`Resolution depth exceeded ${maxDepth} while resolving "${tokenName(token)}". The dependency graph is too deep or recursing unexpectedly.`,
		);
	}
}

export class EncapsulationError extends WirelyError {
	constructor(token: Token, requestedBy?: Token) {
		const by = requestedBy ? ` by "${tokenName(requestedBy)}"` : "";
		super(
			`Token "${tokenName(token)}" is registered but not visible${by}. Export it from its module (and import that module) to make it reachable.`,
		);
	}
}
