import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';

// This is the URL that Recall.ai will call with transcript data
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/recall`;
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';
const RECALL_API_KEY = process.env.RECALL_API_KEY;

if (!WEBHOOK_URL || !RECALL_API_KEY) {
  throw new Error("Environment variables RECALL_API_KEY or NEXT_PUBLIC_APP_URL are not set.");
}

export async function POST(request: Request) {
  let meetingId: string | null = null;
  try {
    const body = await request.json();
    const { meetingUrl, botName } = body;

    if (!meetingUrl) {
      console.error('Validation failed: meetingUrl is empty or missing.');
      return NextResponse.json({ error: 'Meeting URL is required' }, { status: 400 });
    }

    // 1. Create a new document in Firestore to track this meeting
    const meetingRef = await addDoc(collection(db, 'meetings'), {
      meetingUrl: meetingUrl,
      botName: botName,
      status: 'JOINING',
      createdAt: new Date().toISOString(),
      transcript: [],
      summary: null,
    });

    meetingId = meetingRef.id;
    console.log(`Created Firestore document: ${meetingId}`);

    // 2. Define the webhook URL. Recall will send all data here.
    const webhookUrl = `${WEBHOOK_URL}?id=${meetingId}`;

    // 3. This is the CORRECT payload, matching your 'curl' command
    const botPayload = {
      meeting_url: meetingUrl,
      bot_name: botName,
      // This is the correct configuration for transcription
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              mode: "prioritize_low_latency",
              language_code: "en"
            }
          }
        }
      },
      // This is the webhook Recall will send all events to
      event_webhook_url: webhookUrl,
    };

    // 4. Make the API call to Recall.ai using 'fetch'
    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
      body: JSON.stringify(botPayload),
    });

    // 5. Check if the bot was created successfully
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Recall API Error:', errorData);
      
      // Update Firestore with the error
      if (meetingId) {
        await updateDoc(doc(db, 'meetings', meetingId), {
          status: 'ERROR',
          error: errorData.detail || 'Failed to send bot to meeting.'
        });
      }
      
      return NextResponse.json(
        { error: errorData.detail || 'Failed to send bot to meeting.' },
        { status: response.status }
      );
    }

    const botData = await response.json();
    console.log(`Bot created successfully: ${botData.id}`);

    // 6. Update our Firestore doc with the Recall bot ID
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        recallBotId: botData.id,
      });
    }

    // 7. Send the new meeting's ID back to the frontend
    return NextResponse.json({ id: meetingId }, { status: 200 });

  } catch (error: any) {
    console.error('Error in /api/join-meeting:', error);
    
    // If an error happens before meetingId is set, we can't update Firestore
    if (meetingId) {
      await updateDoc(doc(db, 'meetings', meetingId), {
        status: 'ERROR',
        error: error.message || 'An unexpected error occurred'
      });
    }
    
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

