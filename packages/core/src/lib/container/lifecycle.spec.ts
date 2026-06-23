import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { createContainer } from "./create-container";

describe("Container — lifecycle hooks", () => {
	it("calls onInit after dependencies are ready, deps first", async () => {
		const order: string[] = [];

		class Repo {
			onInit() {
				order.push("repo");
			}
		}

		class Service {
			constructor(public repo: Repo) {}
			onInit() {
				order.push("service");
			}
		}

		const container = createContainer(
			defineModule({ providers: [Repo, defineProvider({ useClass: Service, inject: [Repo] })] }),
		);
		await container.init();

		expect(order).toEqual(["repo", "service"]);
	});

	it("calls onDestroy in reverse construction order on dispose", async () => {
		const order: string[] = [];

		class Repo {
			onDestroy() {
				order.push("repo");
			}
		}

		class Service {
			constructor(public repo: Repo) {}
			onDestroy() {
				order.push("service");
			}
		}

		const container = createContainer(
			defineModule({ providers: [Repo, defineProvider({ useClass: Service, inject: [Repo] })] }),
		);
		await container.init();
		await container.dispose();

		expect(order).toEqual(["service", "repo"]);
	});
});
