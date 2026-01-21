import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export const getAIResponse = async (conversation, step) => {
  const systemPrompt = `
You are a JCB service call agent for Rajesh Motors.

Current step: ${step}

STRICT RULES:
- Ask ONLY for the current step
- Ask ONLY ONE question
- Never close the call unless step is "done"
- Never ask two questions
- Never explain anything

Steps and questions:
- chassis: Ask for chassis number
- owner: Ask owner or company name
- mobile: Ask mobile number and confirm
- location: Ask machine location
- engineerBase: Ask nearest engineer base
- complaint: Ask complaint details
- confirm: Ask if all details are correct
- done: Politely close the call

Language:
- Polite Hindi-English
- Very short sentences
`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversation.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text
    }))
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.2,
    max_tokens: 60
  });

  return response.choices[0].message.content.trim();
};
