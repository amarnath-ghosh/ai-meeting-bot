import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { generativeModel } from '@/app/lib/gemini';

export async function POST(request: Request) {
  try {
    const { meetingId } = await request.json();
    if (!meetingId) {
      return NextResponse.json(
        { message: 'meetingId is required' },
        { status: 400 }
      );
    }

    // 1. Get the full meeting document from Firestore
    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingSnap = await getDoc(meetingRef);

    if (!meetingSnap.exists()) {
      return NextResponse.json(
        { message: 'Meeting not found' },
        { status: 404 }
      );
    }

    const meetingData = meetingSnap.data();
    const fullTranscript = meetingData.transcript || []; // This is an array of chunks

    // Format the transcript for the LLM
    const transcriptText = fullTranscript
      .map(
        (chunk: any) =>
          `[${chunk.speaker_label || 'Unknown'} at ${new Date(chunk.start_time * 1000).toISOString().substr(11, 8)}]: ${chunk.transcript}`
      )
      .join('\n');

    if (transcriptText.length < 50) {
       await setDoc(meetingRef, { status: 'failed', error: 'Transcript too short' }, { merge: true });
       return NextResponse.json({ message: 'Transcript too short' }, { status: 400 });
    }

    // 2. Define the prompt and JSON schema for Gemini
    const prompt = `
      You are an expert meeting summarizer. Analyze the following meeting transcript
      and provide a summary in the following JSON format.
      
      Transcript:
      ${transcriptText}
      
      JSON Output Schema:
      {
        "title": "A concise, 5-10 word title for the meeting.",
        "summary": "A one-paragraph overview of the meeting's purpose and key outcomes.",
        "action_items": [
          { "item": "A specific, actionable task.", "owner": "The person or group responsible (e.g., 'Speaker 1', 'Marketing Team', or 'All')." }
        ],
        "key_topics": [
          { "topic": "The main topic discussed.", "sentiment": "Positive, Negative, or Neutral" }
        ],
        "participants": [
          { s"peaker_label": "The speaker's identifier (e.g., 'Speaker 0', 'Speaker 1').", "sentiment": "The overall sentiment of this speaker's contributions (Positive, Negative, Neutral)." }
        ]
      }
    `;

    // 3. Call the Gemini API
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = result.response.candidates?.[0].content.parts[0].text;
    if (!responseText) {
      throw new Error('No response from Gemini.');
    }

    const summaryJson = JSON.parse(responseText);

    // 4. Save the summary back to Firestore
    await setDoc(
      meetingRef,
      {
        summary: summaryJson,
        status: 'completed',
        processedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, summary: summaryJson });
  } catch (error: any) {
    console.error('Summarization error:', error);
    // Save error to DB
    if (request.body && (await request.json()).meetingId) {
       const { meetingId } = await request.json();
       const meetingRef = doc(db, 'meetings', meetingId);
       await setDoc(meetingRef, { status: 'failed', error: error.message }, { merge: true });
    }
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message },
      { status: 500 }
    );
  }
}
