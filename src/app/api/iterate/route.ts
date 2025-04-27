// app/api/iterate/route.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { GenResult } from "@/lib/genSchema";

const openai = new OpenAI();

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const {
    prompt,
    screenshotBase64,
    compileErrors,
    iteration
  }: {
    prompt: string;
    screenshotBase64: string | "";
    compileErrors: string[];
    iteration: number;
  } = await req.json();

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
You are an expert React-Three-Fiber generator.
Return ONLY JSON that conforms to this schema:

${GenResult.toString()}

Respond with "finished": true once the task is complete.
Do NOT wrap the JSON in markdown fences.`
    },
    iteration === 0
      ? { role: "user", content: prompt }
      : {
          role: "user",
          content: [
            {
              type: "text",
              text:
                compileErrors.length > 0
                  ? `❌ Build failed:\n${compileErrors.join("\n")}\nPlease fix.`
                  : "Here is a screenshot of the output. Improve it if necessary:"
            },
            ...(screenshotBase64
              ? [
                  {
                    type: "image_url",
                    image_url: { url: `data:image/png;base64,${screenshotBase64}` }
                  } as const
                ]
              : [])
          ]
        }
  ];

  const completion = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 800,
    response_format: zodResponseFormat(GenResult, "gen")
  });

  return Response.json(completion.choices[0].message.parsed);
}