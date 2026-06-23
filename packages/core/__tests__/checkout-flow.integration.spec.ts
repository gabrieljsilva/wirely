import { describe, expect, it } from "vitest";
import { createContainer, defineModule, defineProvider } from "../src/index";

/**
 * End-to-end flow exercising, through the public API only, a small but realistic app:
 * a global platform module (logger / clock / config), a payments module whose service is
 * assembled by a factory that picks a gateway, and an orders module with an internal
 * repository and a checkout use-case. Combines globals, encapsulation, factory/value
 * providers, singleton sharing and lifecycle hooks in one wiring.
 */

const CONFIG = "APP_CONFIG";
const CLOCK = Symbol("CLOCK");
const PAYMENT_SERVICE = "PAYMENT_SERVICE";

interface AppConfig {
	currency: string;
	primaryGateway: "stripe" | "pix";
}

class Logger {
	readonly events: string[] = [];
	log(event: string) {
		this.events.push(event);
	}
}

class StripeGateway {
	readonly name = "stripe";
	charge(amount: number) {
		return { gateway: this.name, amount, ok: true };
	}
}

class PixGateway {
	readonly name = "pix";
	charge(amount: number) {
		return { gateway: this.name, amount, ok: true };
	}
}

interface PaymentService {
	charge(amount: number): { gateway: string; amount: number; ok: boolean };
}

class OrderRepository {
	connected = false;
	readonly saved: Array<Record<string, unknown>> = [];

	constructor(private readonly logger: Logger) {}

	onInit() {
		this.connected = true;
		this.logger.log("orders:connect");
	}

	onDestroy() {
		this.connected = false;
		this.logger.log("orders:disconnect");
	}

	save<T extends Record<string, unknown>>(order: T): T & { id: number } {
		if (!this.connected) throw new Error("repository is not connected");
		const persisted = { id: this.saved.length + 1, ...order };
		this.saved.push(persisted);
		return persisted;
	}
}

interface OrderInput {
	items: Array<{ price: number; qty: number }>;
}

class CheckoutUseCase {
	constructor(
		private readonly payment: PaymentService,
		private readonly orders: OrderRepository,
		private readonly logger: Logger,
	) {}

	onDestroy() {
		this.logger.log("checkout:dispose");
	}

	execute(order: OrderInput) {
		this.logger.log("checkout:start");
		const total = order.items.reduce((sum, item) => sum + item.price * item.qty, 0);
		const receipt = this.payment.charge(total);
		const saved = this.orders.save({ total, receipt });
		this.logger.log("checkout:done");
		return { ...saved, receipt };
	}
}

function buildApp(config: AppConfig) {
	const PlatformModule = defineModule({
		global: true,
		providers: [
			Logger,
			defineProvider({ provide: CONFIG, useValue: config }),
			defineProvider({ provide: CLOCK, useFactory: () => ({ now: () => 1_700_000_000 }) }),
		],
		exports: [Logger, CONFIG, CLOCK],
	});

	const PaymentsModule = defineModule({
		providers: [
			StripeGateway,
			PixGateway,
			defineProvider({
				provide: PAYMENT_SERVICE,
				inject: [CONFIG, StripeGateway, PixGateway, Logger],
				useFactory: (cfg: AppConfig, stripe: StripeGateway, pix: PixGateway, logger: Logger): PaymentService => {
					const chosen = cfg.primaryGateway === "pix" ? pix : stripe;
					logger.log(`payments:using:${chosen.name}`);
					return {
						charge(amount) {
							logger.log(`payments:charge:${chosen.name}:${amount}`);
							return chosen.charge(amount);
						},
					};
				},
			}),
		],
		exports: [PAYMENT_SERVICE],
	});

	const OrdersModule = defineModule({
		imports: [PaymentsModule],
		providers: [
			defineProvider({ useClass: OrderRepository, inject: [Logger] }),
			defineProvider({ useClass: CheckoutUseCase, inject: [PAYMENT_SERVICE, OrderRepository, Logger] }),
		],
		exports: [CheckoutUseCase],
	});

	const AppModule = defineModule({ imports: [PlatformModule, OrdersModule] });

	return createContainer(AppModule, { name: "shop" });
}

describe("checkout flow (e2e)", () => {
	it("runs a full checkout charging the configured primary gateway", async () => {
		const container = buildApp({ currency: "BRL", primaryGateway: "stripe" });
		await container.init();

		const checkout = container.get(CheckoutUseCase);
		const result = checkout.execute({
			items: [
				{ price: 100, qty: 2 },
				{ price: 50, qty: 1 },
			],
		});

		expect(result.total).toBe(250);
		expect(result.receipt).toEqual({ gateway: "stripe", amount: 250, ok: true });
		expect(result.id).toBe(1);
	});

	it("switches the gateway when the config selects a fallback (pix)", async () => {
		const container = buildApp({ currency: "BRL", primaryGateway: "pix" });
		await container.init();

		const result = container.get(CheckoutUseCase).execute({ items: [{ price: 30, qty: 1 }] });

		expect(result.receipt.gateway).toBe("pix");
	});

	it("shares one global Logger instance across every module and records the flow in order", async () => {
		const container = buildApp({ currency: "BRL", primaryGateway: "stripe" });
		await container.init();
		const logger = container.get(Logger);

		expect(logger.events).toContain("orders:connect");
		expect(logger.events).toContain("payments:using:stripe");

		logger.events.length = 0;
		container.get(CheckoutUseCase).execute({ items: [{ price: 10, qty: 1 }] });

		expect(logger.events).toEqual(["checkout:start", "payments:charge:stripe:10", "checkout:done"]);
	});

	it("runs lifecycle hooks: connects on init, tears down in reverse on dispose", async () => {
		const container = buildApp({ currency: "BRL", primaryGateway: "stripe" });
		await container.init();

		const logger = container.get(Logger);
		expect(logger.events).toContain("orders:connect");

		await container.dispose();

		const checkoutDisposed = logger.events.indexOf("checkout:dispose");
		const ordersDisconnected = logger.events.indexOf("orders:disconnect");
		expect(checkoutDisposed).toBeGreaterThanOrEqual(0);
		expect(checkoutDisposed).toBeLessThan(ordersDisconnected);
	});
});
