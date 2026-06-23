import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { createContainer } from "./create-container";

describe("Container — lifecycle edge cases", () => {
	it("awaits async onInit hooks in dependency order", async () => {
		const order: string[] = [];

		class Repo {
			async onInit() {
				await Promise.resolve();
				order.push("repo");
			}
		}

		class Service {
			constructor(public repo: Repo) {}
			async onInit() {
				await Promise.resolve();
				order.push("service");
			}
		}

		const container = createContainer(
			defineModule({ providers: [Repo, defineProvider({ useClass: Service, inject: [Repo] })] }),
		);
		await container.init();

		expect(order).toEqual(["repo", "service"]);
	});

	it("runs onInit only once across repeated init calls", async () => {
		let count = 0;
		class Service {
			onInit() {
				count++;
			}
		}

		const container = createContainer(defineModule({ providers: [Service] }));
		await container.init();
		await container.init();

		expect(count).toBe(1);
	});

	it("does not run hooks on value providers", async () => {
		let called = false;
		const value = {
			onInit() {
				called = true;
			},
		};
		const container = createContainer(defineModule({ providers: [{ provide: "VAL", useValue: value }] }));
		await container.init();

		expect(called).toBe(false);
	});
});
