// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "jsr:@openai/openai";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Database } from "../database.types.ts";
import { Console } from "node:console";

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
  apiKey:
    , // This is the default and can be omitted
});

Deno.serve(async (req) => {
  // Get the email content
  const data: WebhookPayload = await req.json();

  // 1. Get all categories from the database
  const { data: categories, error } = await supabase.from("categories").select(
    "*",
  );

  // console.log(categories)

  /*
  Classify the email content into one of of the following categories:

  ID: 1, Name: "Tech Support", Description: "Help with technical issues"
  ID: 2, Name: "Sales", Description: "Help with purchasing products"

  Return the ID of the category that best fits the email content.
  */

  // 2. Create a prompt for the AI to understand the existing categories
  let content =
    "Classify the email content into one of of the following categories: ";

  const categoryListString = categories?.map((category) =>
    `ID: ${category.id}, Name: "${category.name}", Description: "${category.description}"`
  ).join("\n");

  content += categoryListString;
  content +=
    "\n Return the ID of the category that best fits the email content.";

  console.log(content);

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "developer",
        content: content,
      },
      {
        role: "user",
        content:
          "Let me start with a question: Are you having trouble generating leads and experiencing low website traffic?",
      },
    ],
  });

  console.log(completion.choices[0].message.content);
  // 3. AI spits out strucutred IDs

  // 4. Get AI generate title and description for email

  // 5. Save the data to `classified_emails` and `email_categories` tables

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
