import assert from "node:assert/strict";
import type { FetchFunction } from "@ai-sdk/provider-utils";
import { generateText } from "ai";
import { createSarvam } from "../src";

type CapturedRequest = {
	url: string;
	init?: RequestInit;
};

function createMockFetch(captured: CapturedRequest[]): FetchFunction {
	return async (input, init) => {
		captured.push({ url: String(input), init });

		return new Response(
			JSON.stringify({
				id: "chatcmpl-test",
				object: "chat.completion",
				created: 0,
				model: "sarvam-105b",
				choices: [
					{
						index: 0,
						finish_reason: "stop",
						message: { role: "assistant", content: "ok" },
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			}),
			{
				status: 200,
				headers: { "content-type": "application/json" },
			},
		);
	};
}

function bodyOf(request: CapturedRequest) {
	return JSON.parse(String(request.init?.body));
}

async function run() {
	const defaultRequests: CapturedRequest[] = [];
	const defaultProvider = createSarvam({
		apiKey: "test-key",
		fetch: createMockFetch(defaultRequests),
	});

	const defaultResult = await generateText({
		model: defaultProvider("sarvam-105b"),
		prompt: "hi",
	});

	assert.equal(defaultResult.text, "ok");
	assert.equal(defaultRequests.length, 1);
	assert.equal(
		defaultRequests[0].url,
		"https://api.sarvam.ai/v2/chat/completions",
	);

	const defaultBody = bodyOf(defaultRequests[0]);
	assert.equal(defaultBody.model, "sarvam-105b");
	assert.deepEqual(defaultBody.messages, [{ role: "user", content: "hi" }]);

	const defaultHeaders = new Headers(defaultRequests[0].init?.headers);
	assert.equal(defaultHeaders.get("authorization"), "Bearer test-key");
	assert.equal(defaultHeaders.get("api-subscription-key"), "test-key");
	assert.equal(defaultHeaders.get("x-sarvam-integration"), "sarvam-vercel-sdk");
	assert.ok(defaultHeaders.get("user-agent"));

	const v1Requests: CapturedRequest[] = [];
	const v1 = createSarvam({
		apiKey: "test-key",
		chatBaseURL: "https://api.sarvam.ai/v1",
		fetch: createMockFetch(v1Requests),
	});

	await generateText({
		model: v1("sarvam-105b"),
		prompt: "hi",
	});

	assert.equal(v1Requests[0].url, "https://api.sarvam.ai/v1/chat/completions");

	const tokenFactoryRequests: CapturedRequest[] = [];
	const tokenFactory = createSarvam({
		apiKey: "test-key",
		fetch: createMockFetch(tokenFactoryRequests),
	});

	await generateText({
		model: tokenFactory("glm5.3", { reasoning_effort: "max" }),
		prompt: "hi",
	});

	assert.equal(
		tokenFactoryRequests[0].url,
		"https://api.sarvam.ai/v2/chat/completions",
	);

	const tokenFactoryBody = bodyOf(tokenFactoryRequests[0]);
	assert.equal(tokenFactoryBody.model, "glm5.3");
	assert.equal(tokenFactoryBody.reasoning_effort, "max");

	const customRequests: CapturedRequest[] = [];
	const custom = createSarvam({
		apiKey: "test-key",
		baseURL: "https://gateway.example.com/sarvam",
		fetch: createMockFetch(customRequests),
	});

	await generateText({ model: custom("gemma4"), prompt: "hi" });

	assert.equal(
		customRequests[0].url,
		"https://gateway.example.com/sarvam/v2/chat/completions",
	);

	const customV1Requests: CapturedRequest[] = [];
	const customV1 = createSarvam({
		apiKey: "test-key",
		baseURL: "https://gateway.example.com/sarvam",
		chatBaseURL: "https://gateway.example.com/sarvam/v1",
		fetch: createMockFetch(customV1Requests),
	});

	await generateText({ model: customV1("sarvam-105b"), prompt: "hi" });

	assert.equal(
		customV1Requests[0].url,
		"https://gateway.example.com/sarvam/v1/chat/completions",
	);

	console.log("unit tests passed");
}

run().catch((error) => {
	console.error(error);
	process.exit(1);
});
