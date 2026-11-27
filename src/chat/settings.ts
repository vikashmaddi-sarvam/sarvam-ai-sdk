import {
	type InferSchema,
	lazySchema,
	zodSchema,
} from "@ai-sdk/provider-utils";
import { z } from "zod";
import { sarvamErrorDataZodSchema } from "../error";

/**
 * @description Production models
 * @see https://docs.sarvam.ai/api-reference-docs/chat/chat-completions
 */
export type SarvamChatModelId = "sarvam-105b" | "sarvam-105b-conversations";

/**
 * @description Serverless open-weight models. Provisioned Throughput models
 * (enabled per organisation) can still be passed as a string.
 * @see https://docs.sarvam.ai/api/token-factory/models
 */
export type OpenWeightModelId =
	| "glm5.3"
	| "glm5.3-flash"
	| "gemma4"
	| "deepseekv4.1-flash-1017"
	| "deepseekv4.1-flash-1017-interactive";

export type ChatModelId = SarvamChatModelId | OpenWeightModelId | (string & {});

export type ChatSettings<T extends ChatModelId = ChatModelId> = {
	/**
	 * Chat API version.
	 *
	 * Every chat model, Sarvam and open-weight, is served on the OpenAI-compatible
	 * `/v2` endpoint. `/v1` is the legacy endpoint and serves only `sarvam-105b`
	 * and `sarvam-105b-conversations`.
	 *
	 * @see https://docs.sarvam.ai/api/token-factory/models
	 *
	 * @default "v2"
	 */
	version?: T extends OpenWeightModelId ? "v2" : "v1" | "v2";
	/**
	 * The effort to use for reasoning.
	 *
	 * Supported values vary by model. `"none"` turns reasoning off on models
	 * that allow it (`sarvam-105b`, `deepseekv4.1-flash-1017`). `"max"` is
	 * accepted by the GLM, Gemma and DeepSeek models.
	 *
	 * Leave it unset to use the model's default effort.
	 *
	 * @see https://docs.sarvam.ai/api/token-factory/models#reasoning
	 */
	reasoning_effort?: "none" | "low" | "medium" | "high" | "max";

	/**
	 * If set to true, the model response will be wiki grounded.
	 */
	wiki_grounding?: boolean;

	/**
	 * How many chat completion choices to generate for each input message.
	 *
	 * Note that you will be charged based on the number of generated tokens across all of the choices.
	 * Keep `n` as `1` to minimize costs.
	 */
	n?: number;

	/**
	 * Extra body to be sent to the model.
	 *
	 * Only available on v2.
	 *
	 * @default {}
	 */
	extra_body?: Record<string, any>;

	/**
	 * Enables structured outputs, with or without a specified JSON schema.
	 *
	 * Early & Experimental, Sarvam model might not perform well.
	 *
	 * @example
	 * true: JSON is generated with response_format
	 * false: JSON is generated through tool calling argument
	 *
	 * @default false
	 */
	experimental_json_mode?: boolean;
};

export const chatSettingsSchema = lazySchema(() =>
	zodSchema(
		z.object({
			reasoning_effort: z
				.enum(["none", "low", "medium", "high", "max"])
				.nullish(),
			wiki_grounding: z.boolean().nullish(),
			n: z.number().min(1).max(128).nullish(),
			extra_body: z.record(z.string(), z.any()).nullish(),
		}),
	),
);

export type ChatSettingsSchema = InferSchema<typeof chatSettingsSchema>;

export const chatResponseSchema = lazySchema(() =>
	zodSchema(
		z.object({
			id: z.string().nullish(),
			created: z.number().nullish(),
			model: z.string().nullish(),
			object: z.string().nullish(),
			service_tier: z.string().nullish(),
			system_fingerprint: z.string().nullish(),
			choices: z.array(
				z.object({
					index: z.number(),
					finish_reason: z.string().nullish(),
					logprobs: z.object({}).nullish(),
					message: z.object({
						content: z.string().nullish(),
						reasoning_content: z.string().nullish(),
						refusal: z.string().nullish(),
						tool_calls: z
							.array(
								z.object({
									id: z.string().nullish(),
									type: z.literal("function"),
									function: z.object({
										name: z.string(),
										arguments: z.string(),
									}),
								}),
							)
							.nullish(),
					}),
				}),
			),
			usage: z
				.object({
					completion_tokens: z.number().nullish(),
					prompt_tokens: z.number().nullish(),
					total_tokens: z.number().nullish(),
				})
				.nullish(),
		}),
	),
);

export const chatChunkSchema = lazySchema(() =>
	zodSchema(
		z.union([
			z.object({
				id: z.string().nullish(),
				created: z.number().nullish(),
				model: z.string().nullish(),
				choices: z.array(
					z.object({
						delta: z
							.object({
								content: z.string().nullish(),
								reasoning: z.string().nullish(),
								tool_calls: z
									.array(
										z.object({
											index: z.number(),
											id: z.string().nullish(),
											type: z.literal("function").optional(),
											function: z.object({
												name: z.string().nullish(),
												arguments: z.string().nullish(),
											}),
										}),
									)
									.nullish(),
							})
							.nullish(),
						finish_reason: z.string().nullable().optional(),
						index: z.number(),
					}),
				),
				x_sarvam: z
					.object({
						usage: z
							.object({
								prompt_tokens: z.number().nullish(),
								completion_tokens: z.number().nullish(),
							})
							.nullish(),
					})
					.nullish(),
			}),
			sarvamErrorDataZodSchema,
		]),
	),
);

export type ChatChunk = InferSchema<typeof chatChunkSchema>;
