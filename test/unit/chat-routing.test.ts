import { strict as assert } from "node:assert";
import test from "node:test";
import { generateText } from "ai";
import { createSarvam } from "@/provider";

type Captured = { url: string; body: Record<string, unknown> };

function recordingProvider() {
	const calls: Captured[] = [];
	const sarvam = createSarvam({
		apiKey: "test-api-key",
		fetch: async (url, init) => {
			calls.push({
				url: String(url),
				body: JSON.parse(String(init?.body)),
			});
			return new Response(
				JSON.stringify({
					choices: [
						{
							index: 0,
							finish_reason: "stop",
							message: { role: "assistant", content: "ok" },
						},
					],
					usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
				}),
				{ headers: { "content-type": "application/json" } },
			);
		},
	});
	return { sarvam, calls };
}

test("chat defaults to the /v2 endpoint", async () => {
	const { sarvam, calls } = recordingProvider();

	await generateText({ model: sarvam("glm5.3"), prompt: "hi" });
	await generateText({ model: sarvam("sarvam-105b"), prompt: "hi" });
	await generateText({
		model: sarvam("sarvam-105b-conversations"),
		prompt: "hi",
	});

	assert.deepEqual(
		calls.map((call) => call.url),
		[
			"https://api.sarvam.ai/v2/chat/completions",
			"https://api.sarvam.ai/v2/chat/completions",
			"https://api.sarvam.ai/v2/chat/completions",
		],
	);
});

test('version: "v1" keeps the legacy endpoint', async () => {
	const { sarvam, calls } = recordingProvider();

	await generateText({
		model: sarvam("sarvam-105b", { version: "v1" }),
		prompt: "hi",
	});

	assert.equal(calls[0]?.url, "https://api.sarvam.ai/v1/chat/completions");
});

test("a custom baseURL keeps the /v2 default", async () => {
	const calls: string[] = [];
	const sarvam = createSarvam({
		apiKey: "test-api-key",
		baseURL: "https://gateway.example.com/sarvam/",
		fetch: async (url) => {
			calls.push(String(url));
			return new Response(
				JSON.stringify({
					choices: [
						{
							index: 0,
							finish_reason: "stop",
							message: { role: "assistant", content: "ok" },
						},
					],
				}),
				{ headers: { "content-type": "application/json" } },
			);
		},
	});

	await generateText({ model: sarvam("glm5.3"), prompt: "hi" });

	assert.equal(
		calls[0],
		"https://gateway.example.com/sarvam/v2/chat/completions",
	);
});

test('reasoning_effort "none" is sent as "none", not null', async () => {
	const { sarvam, calls } = recordingProvider();

	await generateText({
		model: sarvam("sarvam-105b", { reasoning_effort: "none" }),
		prompt: "hi",
	});

	assert.equal(calls[0]?.body.reasoning_effort, "none");
});

test('reasoning_effort accepts "max"', async () => {
	const { sarvam, calls } = recordingProvider();

	await generateText({
		model: sarvam("glm5.3", { reasoning_effort: "max" }),
		prompt: "hi",
	});

	assert.equal(calls[0]?.body.reasoning_effort, "max");
});

test("the AI SDK reasoning option maps onto reasoning_effort", async () => {
	const { sarvam, calls } = recordingProvider();
	const cases = [
		["provider-default", undefined],
		["none", "none"],
		["minimal", "low"],
		["low", "low"],
		["medium", "medium"],
		["high", "high"],
		["xhigh", "max"],
		["max", "max"],
	] as const;

	for (const [reasoning] of cases) {
		await generateText({ model: sarvam("glm5.3"), reasoning, prompt: "hi" });
	}

	assert.deepEqual(
		calls.map((call) => call.body.reasoning_effort),
		cases.map(([, expected]) => expected),
	);
});

test("model settings override the AI SDK reasoning option", async () => {
	const { sarvam, calls } = recordingProvider();

	await generateText({
		model: sarvam("sarvam-105b", { reasoning_effort: "low" }),
		reasoning: "high",
		prompt: "hi",
	});

	assert.equal(calls[0]?.body.reasoning_effort, "low");
});

test("unsupported AI SDK reasoning levels return a compatibility warning", async () => {
	const { sarvam } = recordingProvider();

	const result = await generateText({
		model: sarvam("glm5.3"),
		reasoning: "xhigh",
		prompt: "hi",
	});

	assert.ok(
		result.warnings?.some(
			(warning) =>
				warning.type === "compatibility" && warning.feature === "reasoning",
		),
	);
});
