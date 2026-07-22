Write a Next.js App Router route handler (`app/api/chat/route.ts`) that uses the Vercel AI SDK to stream a structured JSON response (object generation).
Use the OpenAI provider to generate a recipe.
The schema should have two fields: `recipeName` (string) and `ingredients` (array of strings).
Set a system prompt: "You are a master chef."
The route handler should extract the user's prompt from the `messages` array in the JSON body.
Return the streamed object response.
