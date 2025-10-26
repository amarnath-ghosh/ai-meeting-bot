import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

// This webhook receives data from the bot service (e.g., Deepgram)
export async function POST(request: Request) {
  try {
    // 1. Get the meetingId from the query parameters
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json(
        { message: 'meetingId is required' },
        { status: 400 }
      );
    }

    // 2. Parse the transcript data from the bot
    // The structure of this body will depend on your service
    // e.g., { speaker: 0, text: "Hello world", timestamp: 1234.56 }
    const transcriptChunk = await request.json();

    // 3. Save the chunk to the database
    const meetingRef = doc(db, 'meetings', meetingId);
    await updateDoc(meetingRef, {
      transcript: arrayUnion(transcriptChunk),
    });

    // 4. *** REAL-TIME Q&A LOGIC ***
    // This is where you would check for a "wake word"
    if (transcriptChunk.text.toLowerCase().includes("hey bot")) {
      // In a real app, you would:
      // 1. Get the full query (e.g., "Hey bot, what was action item 3?")
      // 2. Get the transcript history from the database.
      // 3. Call the Gemini API with the history + query.
      // 4. Get the text response from Gemini.
      // 5. Call a Text-to-Speech (TTS) API (like Google TTS).
      // 6. Tell your bot service (Deepgram/Recall) to "speak" the resulting audio file back into the meeting.
      // This is the most complex part of the entire project.
      console.log(`WAKE WORD DETECTED in meeting ${meetingId}!`);
    }
    
    // 5. Check if the meeting has ended
    if (transcriptChunk.type === 'meeting_ended') {
       await setDoc(meetingRef, { status: 'processing' }, { merge: true });
       // After ending, trigger the summarization
       // We do this 'fire and forget' style, not awaiting it
       fetch(`${process.env.VERCEL_URL}/api/summarize`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ meetingId }),
       });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
}
