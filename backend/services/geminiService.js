import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getAIResponse = async (conversation) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

  const systemPrompt = `
You are a JCB customer support call agent for Rajesh Motors.

Language:
- Speak in polite Hindi-English mix.
- Short, clear sentences.

Your job:
- Register machine service complaints.
- Ask questions one by one.
- Do not explain anything extra.

Conversation flow:
1. Greet the customer.
2. Ask for chassis number.
3. Confirm owner or company name.
4. Ask for mobile number.
5. Ask machine location.
6. Ask engineer base location.
7. Ask complaint details.
8. Ask if there is any other problem.
9. Close the call politely.

Rules:
- Never ask two questions at once.
- Never speak more than 2 sentences.
- If user is confused, ask one clarification.
- If user asks something unrelated, redirect to complaint process.
- If user says agent/human, immediately transfer.

End every call politely.
`;


  const history = conversation
    .map(m => `${m.role}: ${m.text}`)
    .join('\n');

  const prompt = `${systemPrompt}\nConversation:\n${history}\nAI:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};
