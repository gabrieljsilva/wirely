import type { Container, ContainerOptions } from "../types/container.types";
import type { ModuleDefinition } from "../types/module.types";
import { WirelyContainer } from "./container";

/**
 * Builds a container from a root module. Registers every module reachable through
 * `imports`, validates token uniqueness, and wires global providers. Singletons are
 * constructed lazily on `get`, or eagerly via `init`.
 */
export function createContainer(rootModule: ModuleDefinition, options: ContainerOptions = {}): Container {
	return new WirelyContainer(rootModule, options);
}
