import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { geminiModel } from '@/app/lib/gemini';
import { SchemaType, Schema } from '@google/generative-ai'; // Import SchemaType and Schema

// This function will be triggered by Recall.ai
export async function POST(request: Request) {
  // --- ADD THIS LOG ---
  console.log('Webhook /api/webhook/recall received a request!');
  // --- END LOG ---

  try {
    // 1. Get the meeting ID from the query parameters
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('id');

    // --- ADD THIS LOG ---
    console.log(`Webhook triggered for meetingId: ${meetingId}`);
    // --- END LOG ---

    if (!meetingId) {
      console.error('Webhook Error: Meeting ID is missing from query parameters.');
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    // 2. Parse the event data from Recall.ai
    const event = await request.json();
    const meetingRef = doc(db, 'meetings', meetingId);

    // Log the received event type
    console.log(`Received Recall event type: ${event.type}`);

    // 3. Handle different types of events
    switch (event.type) {
      case 'transcript.word':
        // Optional: Log word events if needed for debugging
        // console.log('Word received:', event.data.text);
        break;

      case 'transcript.sentence':
        // A full sentence has been transcribed. Let's save it.
        const transcriptData = event.data;
        console.log(`Adding sentence for speaker ${transcriptData.speaker_id || 'Unknown'}: "${transcriptData.text}"`);
        await updateDoc(meetingRef, {
          status: 'TRANSCRIBING',
          // Add the new transcript object to our array in Firestore
          transcript: arrayUnion({
            speaker: transcriptData.speaker_id || 'Unknown',
            text: transcriptData.text,
            timestamp: transcriptData.start_timestamp, // Use start_timestamp
          }),
        });
        break;

      case 'meeting.ended':
        // The meeting is over! Time to generate the summary.
        console.log(`Meeting ${meetingId} has ended. Generating summary...`);

        // Update status
        await updateDoc(meetingRef, {
          status: 'SUMMARIZING',
        });

        // Get the full transcript text (Recall provides this in meeting.ended)
        const fullTranscript = event.data.transcript_text;

        if (!fullTranscript) {
           console.error('Meeting ended but no transcript text was provided by Recall.');
           await updateDoc(meetingRef, {
               status: 'ERROR',
               error: 'Meeting ended, but transcript text was missing.',
           });
           break; // Exit the switch
        }

        // 4. Send the full transcript to Gemini for analysis
        const prompt = `
          Analyze the following meeting transcript. Provide a response in JSON format.
          Ensure the JSON strictly adheres to this schema:
          {
            "type": "object",
            "properties": {
              "title": { "type": "string", "description": "A concise, engaging title for the meeting." },
              "summary_points": { "type": "array", "description": "Bullet points summarizing key discussion topics.", "items": { "type": "string" } },
              "action_items": { "type": "array", "description": "List of specific tasks assigned.", "items": { "type": "string" } },
              "sentiment": { "type": "string", "description": "Overall sentiment (e.g., Positive, Negative, Neutral)." },
              "participant_analysis": { "type": "array", "description": "Analysis per participant (if speakers identified).", "items": { "type": "object", "properties": { "speaker": { "type": "string" }, "contribution": { "type": "string", "description": "Brief summary of speaker's main points." } } } }
            },
            "required": ["title", "summary_points", "action_items", "sentiment"]
          }

          Transcript:
          ---
          ${fullTranscript}
          ---
        `;

         // Define the schema for Gemini
         // Annotate with the library's Schema type so TS understands this is the expected shape.
         const schema: Schema = {
           type: SchemaType.OBJECT,
           properties: {
             title: { type: SchemaType.STRING, description: "A concise, engaging title for the meeting." },
             summary_points: { type: SchemaType.ARRAY, description: "Bullet points summarizing key discussion topics.", items: { type: SchemaType.STRING } },
             action_items: { type: SchemaType.ARRAY, description: "List of specific tasks assigned.", items: { type: SchemaType.STRING } },
             sentiment: { type: SchemaType.STRING, description: "Overall sentiment (e.g., Positive, Negative, Neutral)." },
             participant_analysis: {
               type: SchemaType.ARRAY,
               description: "Analysis per participant (if speakers identified).",
               items: {
                 type: SchemaType.OBJECT,
                 properties: {
                   speaker: { type: SchemaType.STRING },
                   contribution: { type: SchemaType.STRING, description: "Brief summary of speaker's main points." }
                 },
                 required: ["speaker", "contribution"]
               }
             }
           },
           required: ["title", "summary_points", "action_items", "sentiment"]
         };


        console.log("Sending transcript to Gemini...");
        const result = await geminiModel.generateContent(
           {
              contents: [{ role: "user", parts:[{ text: prompt }] }],
              generationConfig: {
                 responseMimeType: "application/json",
                 responseSchema: schema,
              },
           }
        );
        console.log("Received response from Gemini.");

        const responseText = result.response.text();
        const summaryData = JSON.parse(responseText);

        // 5. Save the final summary to Firestore
        await updateDoc(meetingRef, {
          status: 'COMPLETED',
          summary: summaryData,
        });

        console.log(`Summary for ${meetingId} saved successfully.`);
        break;

      case 'meeting.error':
        // Handle errors, e.g., bot was kicked
        console.error('Meeting error event received:', event.data.error_message);
        await updateDoc(meetingRef, {
          status: 'ERROR',
          error: event.data.error_message,
        });
        break;

      default:
        // Log other events we might not be handling
        console.log('Received unhandled Recall event type:', event.type);
    }

    // 6. Send a 200 OK response back to Recall.ai
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error('Error processing Recall webhook:', error);
    // Log the request body if possible for debugging
     try {
       const rawBody = await request.text(); // Try reading body again if parsing failed
       console.error("Webhook Raw Body:", rawBody);
     } catch (bodyError) {
       console.error("Could not read webhook body:", bodyError);
     }
    return NextResponse.json(
      { error: `Webhook processing failed: ${error.message}` },
      { status: 500 }
    );
  }
}

