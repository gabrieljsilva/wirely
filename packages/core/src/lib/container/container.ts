import {
	CircularDependencyError,
	ContainerDisposedError,
	EncapsulationError,
	InvalidProviderError,
	ResolutionDepthError,
	TokenCollisionError,
	TokenNotFoundError,
} from "../errors/errors";
import { createLazyProxy, isForwardRef } from "../forward-ref/forward-ref";
import type { Container, ContainerOptions } from "../types/container.types";
import type { ModuleDefinition } from "../types/module.types";
import type { InjectDep } from "../types/provider.types";
import type { Token } from "../types/token.types";
import { type ProviderRecord, toProviderRecord } from "./provider-record";

/** Guards against unbounded recursion (deep linear graphs) turning into a native stack overflow. */
const MAX_RESOLUTION_DEPTH = 1000;

interface OnInitLike {
	onInit(): void | Promise<void>;
}
interface OnDestroyLike {
	onDestroy(): void | Promise<void>;
}

export class WirelyContainer implements Container {
	public readonly name: string;

	private readonly registry = new Map<Token, ProviderRecord>();
	private readonly globalTokens = new Set<Token>();
	private readonly moduleExports = new Map<ModuleDefinition, Set<Token>>();
	private readonly modules: ModuleDefinition[] = [];
	private readonly rootModule: ModuleDefinition;

	private readonly singletons = new Map<Token, any>();
	private readonly constructionOrder: any[] = [];
	private readonly resolutionStack: Token[] = [];
	private initialized = false;
	private disposed = false;

	constructor(rootModule: ModuleDefinition, options: ContainerOptions = {}) {
		this.name = options.name ?? "wirely";
		this.rootModule = rootModule;

		this.collectModules(rootModule);
		this.registerGlobalProviders(rootModule, options);
		for (const mod of this.modules) this.registerModuleProviders(mod);
		for (const mod of this.modules) this.moduleExports.set(mod, new Set(mod.exports ?? []));
	}

	private collectModules(mod: ModuleDefinition): void {
		if (this.modules.includes(mod)) return;
		this.modules.push(mod);
		for (const imported of mod.imports ?? []) this.collectModules(imported);
	}

	private registerGlobalProviders(rootModule: ModuleDefinition, options: ContainerOptions): void {
		for (const input of options.global ?? []) {
			const record = toProviderRecord(input, rootModule, true);
			this.register(record);
		}
	}

	private registerModuleProviders(mod: ModuleDefinition): void {
		const isGlobalModule = Boolean(mod.global);
		const exported = new Set(mod.exports ?? []);
		for (const input of mod.providers ?? []) {
			const record = toProviderRecord(input, mod, false);
			if (isGlobalModule && exported.has(record.token)) record.global = true;
			this.register(record);
		}
	}

	private register(record: ProviderRecord): void {
		if (this.registry.has(record.token)) throw new TokenCollisionError(record.token);
		this.registry.set(record.token, record);
		if (record.global) this.globalTokens.add(record.token);
		if (record.kind === "value") this.singletons.set(record.token, record.useValue);
	}

	private isVisible(token: Token, requester: ModuleDefinition): boolean {
		if (this.globalTokens.has(token)) return true;
		const record = this.registry.get(token);
		if (record && record.ownerModule === requester) return true;
		for (const imported of requester.imports ?? []) {
			const exported = this.moduleExports.get(imported);
			if (exported?.has(token)) return true;
		}
		return false;
	}

	public has(token: Token): boolean {
		return this.registry.has(token);
	}

	public get<T>(token: Token<T>): T {
		if (this.disposed) throw new ContainerDisposedError(this.name);
		return this.resolve(token, this.rootModule) as T;
	}

	private resolve(token: Token, requester: ModuleDefinition, requestedBy?: Token): any {
		const record = this.registry.get(token);
		if (!record) throw new TokenNotFoundError(token, requestedBy);
		if (!this.isVisible(token, requester)) throw new EncapsulationError(token, requestedBy);

		if (record.scope === "singleton" && this.singletons.has(token)) {
			return this.singletons.get(token);
		}

		if (this.resolutionStack.includes(token)) {
			throw new CircularDependencyError([...this.resolutionStack, token]);
		}

		if (this.resolutionStack.length >= MAX_RESOLUTION_DEPTH) {
			throw new ResolutionDepthError(token, MAX_RESOLUTION_DEPTH);
		}

		this.resolutionStack.push(token);
		try {
			const instance = this.instantiate(record);
			if (record.scope === "singleton") {
				this.singletons.set(token, instance);
				this.constructionOrder.push(instance);
			}
			return instance;
		} finally {
			this.resolutionStack.pop();
		}
	}

	private instantiate(record: ProviderRecord): any {
		if (record.kind === "value") return record.useValue;
		const deps = record.inject.map((dep) => this.resolveDependency(dep, record));
		if (record.kind === "factory" && record.useFactory) return record.useFactory(...deps);
		if (record.useClass) return new record.useClass(...deps);
		throw new InvalidProviderError(record.token);
	}

	private resolveDependency(dep: InjectDep, owner: ProviderRecord): any {
		if (isForwardRef(dep)) {
			return createLazyProxy(() => this.resolve(dep.resolve(), owner.ownerModule, owner.token));
		}
		return this.resolve(dep, owner.ownerModule, owner.token);
	}

	public async init(): Promise<void> {
		if (this.disposed) throw new ContainerDisposedError(this.name);
		if (this.initialized) return;
		for (const record of this.registry.values()) {
			if (record.scope === "singleton" && record.kind !== "value") {
				this.resolve(record.token, record.ownerModule);
			}
		}
		for (const instance of this.constructionOrder) {
			if (this.hasOnInit(instance)) await instance.onInit();
		}
		// Only mark initialized after every hook succeeded; a thrown hook leaves it false.
		this.initialized = true;
	}

	public async dispose(): Promise<void> {
		if (this.disposed) return;
		// Flip first so a concurrent get/init during an awaited onDestroy is rejected.
		this.disposed = true;
		for (let i = this.constructionOrder.length - 1; i >= 0; i--) {
			const instance = this.constructionOrder[i];
			if (this.hasOnDestroy(instance)) await instance.onDestroy();
		}
		this.singletons.clear();
		this.constructionOrder.length = 0;
	}

	private hasOnInit(instance: unknown): instance is OnInitLike {
		return typeof (instance as any)?.onInit === "function";
	}

	private hasOnDestroy(instance: unknown): instance is OnDestroyLike {
		return typeof (instance as any)?.onDestroy === "function";
	}
}
