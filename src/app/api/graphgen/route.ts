/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Resource } from 'sst';
import OpenAI from 'openai';

/** ------------- helpers ------------- */
async function streamToString(stream: any) {
  const chunks: any[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

/** ------------- shared ------------- */
const bucketName = Resource.GraphsBucket.name;          // <- make sure you linked your bucket in sst.config.ts
const s3         = new S3Client({});
const openai     = new OpenAI();

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 });

  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: `${key}.json` }));
    const body = await streamToString(data.Body);
    return NextResponse.json({ config: JSON.parse(body) });
  } catch (err: any) {
    console.error('failed to fetch graph:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { prompt, history = [] } = await req.json();

  if (!prompt) return NextResponse.json({ error: 'missing prompt' }, { status: 400 });

  /* ---- 1. call LLM ---- */
  const messages = [
    { role: 'system', content: 'You are an assistant that outputs ONLY valid JSON – a complete Chart.js v4 configuration object (type, data, options).' },
    ...history.map((h: string) => ({ role: 'user', content: h })),
    { role: 'user', content: prompt }
  ];

  const completion = await openai.chat.completions.create({
    model: 'gemma3:4b',          
    temperature: 0,
    messages,
    response_format: { type: "json_object" }
  });

  const raw = (completion.choices[0].message.content || '').trim();

  let chartConfig: any;
  try {
    /* the model should output JSON only */
    chartConfig = JSON.parse(raw);
  } catch (err) {
    console.error('LLM did not return valid JSON:', err);
    return NextResponse.json({ error: 'LLM did not return valid JSON' }, { status: 500 });
  }

  /* ---- 2. save to S3 ---- */
  const id   = randomUUID();
  const key  = `${id}.json`;
  await s3.send(new PutObjectCommand({
    Bucket      : bucketName,
    Key         : key,
    Body        : JSON.stringify(chartConfig),
    ContentType : 'application/json'
  }));

  /* ---- 3. respond ---- */
  return NextResponse.json({ id, config: chartConfig });
}