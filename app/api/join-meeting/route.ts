import { NextResponse } from 'next/server';
import { db } from '../../lib/firebase';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';

// Get the Recall API Key from environment variables
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';

// Get the public URL from environment variables (this is your localtunnel URL)
const PUBLIC_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function POST(request: Request) {
  try {
    const { meetingUrl, botName } = await request.json();

    if (!meetingUrl) {
      return NextResponse.json(
        { error: 'Meeting URL is required' },
        { status: 400 }
      );
    }

    if (!RECALL_API_KEY) {
      console.error('RECALL_API_KEY is not defined in .env.local');
      return NextResponse.json(
        { error: 'Recall API key not configured' },
        { status: 500 }
      );
    }
    
    // --- THIS IS THE CRITICAL DEBUGGING STEP ---
    if (!PUBLIC_URL) {
      console.error('NEXT_PUBLIC_APP_URL is not defined in .env.local');
      return NextResponse.json(
        { error: 'Public app URL not configured' },
        { status: 500 }
      );
    }
    // --- END DEBUGGING STEP ---


    // 1. Create a document in Firestore to track this meeting
    const meetingRef = await addDoc(collection(db, 'meetings'), {
      meetingUrl: meetingUrl,
      botName: botName,
      status: 'JOINING',
      createdAt: new Date().toISOString(),
      transcript: [], // Initialize as empty array
      summary: null, // Initialize as null
    });

    const meetingId = meetingRef.id;
    console.log(`Created Firestore document: ${meetingId}`);

    // 2. Define the webhook URL that Recall.ai will send data to
    const webhookUrl = `${PUBLIC_URL}/api/webhook/recall?id=${meetingId}`;

    // --- THIS IS THE LOG WE NEED TO SEE ---
    console.log(`Configuring webhook for Recall.ai: ${webhookUrl}`);
    // --- --- --- --- --- --- --- --- --- ---

    // 3. Define the payload for Recall.ai
    // This matches the 'curl' command structure
    const payload = {
      meeting_url: meetingUrl,
      bot_name: botName,
      event_webhook_url: webhookUrl,
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              mode: 'prioritize_low_latency',
              language_code: 'en',
            },
          },
        },
      },
    };

    // 4. Call the Recall.ai API to create and send the bot
    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Token ${RECALL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Recall API Error:', errorData);
      // Update Firestore with the error
      await updateDoc(doc(db, 'meetings', meetingId), {
        status: 'ERROR',
        error: errorData.detail || 'Failed to send bot to meeting.',
      });
      return NextResponse.json(
        { error: errorData.detail || 'Failed to send bot to meeting.' },
        { status: response.status }
      );
    }

    const botData = await response.json();
    console.log(`Bot created successfully: ${botData.id}`);

    // 5. Update our Firestore doc with the Recall Bot ID
    await updateDoc(doc(db, 'meetings', meetingId), {
      recallBotId: botData.id,
    });

    // 6. Send the new meeting's ID back to the frontend
    return NextResponse.json({ id: meetingId }, { status: 200 });
  } catch (error: any) {
    console.error('Error in /api/join-meeting:', error);
    // Update Firestore with the error
    // We might not have a meetingId if the error was very early, so check
    // This part is complex, so we'll just log it for now.
    return NextResponse.json(
      { error: error.message || 'Failed to join meeting' },
      { status: 500 }
    );
  }
}

