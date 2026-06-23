import type { Provider } from "../types/provider.types";

/**
 * Normalizes a provider definition, applying defaults (singleton scope). Accepts the
 * `useClass` / `useValue` / `useFactory` shapes.
 */
export function defineProvider<T>(provider: Provider<T>): Provider<T> {
	if ("useValue" in provider) return provider;
	return { scope: "singleton", ...provider };
}
