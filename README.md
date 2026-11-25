<div align="center">
<img width="1672" height="941" alt="ChatGPT Image Jun 30, 2026, 12_19_12 PM" src="https://github.com/user-attachments/assets/f5913cc1-3d1a-4345-8237-8fd8109b4c48" />
</div>

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

This project was created by Google AI Studio!


## Environment variables

Configure the following values in the deployment environment:

- `VITE_SUPABASE_URL`: Supabase project URL (browser).
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon key (browser).
- `DEEPL_API_KEY`: DeepL API key (server only).
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key (server only; required for trusted writes to the shared translation cache).

Never prefix `DEEPL_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` with `VITE_`, and never expose either secret to browser code. The translation API validates the user's access token before using the server-only service-role credential to persist a translation.
