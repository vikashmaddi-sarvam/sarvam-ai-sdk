/**
 * Smoke test for sarvam-ai-sdk (local package name resolves to this repo).
 * Run: npm test  (loads .env via package.json script)
 */
import { generateText } from "ai";
import { sarvam } from "sarvam-ai-sdk";

if (!process.env.SARVAM_API_KEY?.trim()) {
	console.error(
		"Missing SARVAM_API_KEY. Node does not load .env on its own.\n" +
			"  From the repo root run:  npm test\n" +
			"  Or:  npx tsx --env-file=.env test/index.ts\n" +
			"  Or set the variable in your shell:  export SARVAM_API_KEY=...",
	);
	process.exit(1);
}

async function check(modelId: string, settings?: Parameters<typeof sarvam>[1]) {
	console.log(`Calling ${modelId} via AI SDK /v2…`);

	const { text, usage } = await generateText({
		model: sarvam(modelId, settings),
		prompt: 'Reply with exactly one word: "ok"',
	});

	console.log(`${modelId} response:`, text?.slice(0, 500) ?? "(empty)");
	console.log(`${modelId} usage:`, usage);

	if (!text?.trim()) {
		throw new Error(`${modelId} returned an empty response`);
	}
}

await check("sarvam-105b");
await check("glm5.3", { reasoning_effort: "low" });

console.log("Smoke test passed.");
