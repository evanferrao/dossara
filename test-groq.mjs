import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

const groq = createGroq({ apiKey: 'gsk_123', dangerouslyAllowBrowser: true });
async function test() {
  const result = await streamText({
    model: groq('openai/gpt-oss-20b'),
    messages: [{ role: 'user', content: 'hello' }]
  });
  console.log(typeof result.toUIMessageStreamResponse);
}
test().catch(console.error);
