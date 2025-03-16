// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "jsr:@openai/openai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Database } from "../database.types.ts";

interface EmailQueue {
  id: number;
  content: string;
}

interface WebhookPayload {
  type: "INSERT";
  table: string;
  record: EmailQueue;
  schema: "public";
}

const supabase = createClient<Database>(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const client = new OpenAI({
  apiKey: "", // This is the default and can be omitted
});

Deno.serve(async (req) => {
  const data: WebhookPayload = await req.json();
  const { data: categories } = await supabase.from("categories").select(
    "*",
  );

  let content =
    "You are an email classifier. Below are the only categories you can classify the email into:\n\n";

  const categoryListString = categories?.map((category) =>
    `ID: ${category.id}, Name: "${category.name}"`
  ).join("\n");

  console.log(categoryListString);

  content += categoryListString;

  content +=
    "\n\nClassify the email strictly into one of the above categories." +
    " Do not create new categories or modify category names. Only use the given IDs and names." +
    " Simplify the email content to 50% of its original length and store it as 'description'." +
    "\n\nReturn the result in the following JSON format. Don't include any other text as I will parse it directly:\n" +
    'e.g. { "id": category.id, "title": "[A summarised title of the email]", "description": "[A summarised description of the email]" }';

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: content,
      },
      {
        role: "user",
        content: data.record.content,
      },
    ],
  });

  const jsonContent = JSON.parse(completion.choices[0].message.content!);

  await supabase.from(
    "classified_emails",
  ).insert({
    id: data.record.id,
    title: jsonContent.title,
    description: jsonContent.description,
    status: "not_started",
  });

  await supabase.from("email_categories").insert({
    email_id: data.record.id,
    category_id: jsonContent.id,
  });

  return new Response(
    null,
    { headers: { "Content-Type": "application/json" } },
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/email-classifier' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
