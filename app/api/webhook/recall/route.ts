import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { geminiModel } from '@/app/lib/gemini';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// This function will be triggered by Recall.ai
export async function POST(request: Request) {
  try {
    // 1. Get the meeting ID from the query parameters
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('id');

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    // 2. Parse the event data from Recall.ai
    const event = await request.json();
    const meetingRef = doc(db, 'meetings', meetingId);

    // 3. Handle different types of events
    switch (event.type) {
      case 'transcript.sentence':
        // A full sentence has been transcribed. Let's save it.
        const transcriptData = event.data;
        await updateDoc(meetingRef, {
          status: 'TRANSCRIBING',
          // Add the new transcript object to our array in Firestore
          transcript: arrayUnion({
            speaker: transcriptData.speaker_id || 'Unknown',
            text: transcriptData.text,
            timestamp: transcriptData.start_timestamp,
          }),
        });
        break;

      case 'meeting.ended':
        // The meeting is over! Time to generate the summary.
        console.log(`Meeting ${meetingId} has ended. Generating summary...`);
        
        await updateDoc(meetingRef, {
          status: 'SUMMARIZING',
        });
        
        // This is the full transcript text sent by Recall
        const fullTranscript = event.data.transcript_text;

        if (!fullTranscript) {
           throw new Error('Meeting ended but no transcript text was provided.');
        }

        // 4. Send the full transcript to Gemini for analysis
        console.log('Sending transcript to Gemini for summarization...');
        const prompt = `
          Analyze the following meeting transcript. Provide a response in the
          required JSON format.
          Transcript:
          ---
          ${fullTranscript}
          ---
        `;

        const result = await geminiModel.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

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
        console.error('Meeting error:', event.data.error_message);
        await updateDoc(meetingRef, {
          status: 'ERROR',
          error: event.data.error_message,
        });
        break;
      
      default:
        // Log other events we might not be handling
        console.log('Received Recall event:', event.type);
    }

    // 6. Send a 200 OK response back to Recall.ai
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error('Error in Recall webhook:', error);
    const meetingId = new URL(request.url).searchParams.get('id');
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        status: 'ERROR',
        error: error.message,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
