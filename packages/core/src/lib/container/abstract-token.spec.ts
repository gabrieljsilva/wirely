import { describe, expect, it } from "vitest";
import { defineModule } from "../define/define-module";
import { defineProvider } from "../define/define-provider";
import { createContainer } from "./create-container";

describe("Container — abstract class token (contract)", () => {
	it("binds an abstract contract token to a concrete implementation", () => {
		abstract class ChatRepository {
			abstract findById(id: string): { id: string };
		}

		class PrismaChatRepository extends ChatRepository {
			findById(id: string) {
				return { id };
			}
		}

		class ChatService {
			constructor(private readonly repo: ChatRepository) {}
			get(id: string) {
				return this.repo.findById(id);
			}
		}

		const container = createContainer(
			defineModule({
				providers: [
					defineProvider({ provide: ChatRepository, useClass: PrismaChatRepository }),
					defineProvider({ useClass: ChatService, inject: [ChatRepository] }),
				],
			}),
		);

		const repo = container.get(ChatRepository);
		expect(repo).toBeInstanceOf(PrismaChatRepository);
		expect(container.get(ChatService).get("c1")).toEqual({ id: "c1" });
	});
});
