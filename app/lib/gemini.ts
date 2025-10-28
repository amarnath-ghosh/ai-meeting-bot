import { GoogleGenerativeAI } from "@google/generative-ai";

// Get the API key from your .env.local file
const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  throw new Error("GOOGLE_API_KEY is not defined in .env.local");
}

// Initialize the Google AI client
const genAI = new GoogleGenerativeAI(apiKey);

// "Create" the specific model you want to use
export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-preview-09-2025",
  generationConfig: {
    // We want a JSON response for our summary
    responseMimeType: "application/json",
  },
});

