// app/api/iterate/route.ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { GenResult } from "@/lib/genSchema";

const openai = new OpenAI(
  {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: '/api/v1',
  }
);

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const {
    prompt,
    screenshotBase64,
    compileErrors,
    iteration,
    cadFormat
  }: {
    prompt: string;
    screenshotBase64: string | "";
    compileErrors: string[];
    iteration: number;
    cadFormat?: boolean;
  } = await req.json();

  const systemPrompt = cadFormat 
    ? `You are an expert ReplicaCAD component generator.
       Return ONLY JSON that conforms to the schema. Focus on creating valid ReplicaCAD code.
       
       The code should:
       1. Import needed replicad functions at the top
       2. Create a 3D CAD model using ReplicaCAD APIs (draw, extrude, revolve, etc)
       3. Export the final model as default export
       
       Use features like:
       - sketch, extrude, revolve for basic shapes
       - loft, shell for advanced operations
       - fillet, chamfer for finishing touches
       - boolean operations (fuse, cut, intersect)
       
       Always write clean, well-commented code with sensible measurements.
       Return "finished": true once you've fixed all errors and the model is complete.`
    : `You are an expert React-Three-Fiber component generator. Generate a React component that renders a 3D scene or model according to the user's prompt using React-Three-Fiber and tailwind.
       You are only allowed to edit the included file, so all your code should be in the file.
       Return ONLY JSON that conforms to the schema.
       Respond with "finished": true once the task is complete.`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `
${systemPrompt}

Return ONLY JSON that conforms to this schema:

${GenResult.toString()}

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
