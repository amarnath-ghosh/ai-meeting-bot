import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Get the Recall API Key from environment variables
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';

export async function POST(request: Request) {
  if (!RECALL_API_KEY) {
    return NextResponse.json(
      { error: 'Recall API key not configured' },
      { status: 500 }
    );
  }

  try {
    const { meetingId } = await request.json();

    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    console.log(`Attempting to make bot leave meeting: ${meetingId}`);

    // 1. Get the meeting document from Firestore
    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingDoc = await getDoc(meetingRef);

    if (!meetingDoc.exists()) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    const recallBotId = meetingDoc.data()?.recallBotId;

    if (!recallBotId) {
      return NextResponse.json(
        { error: 'Bot ID not found for this meeting.' },
        { status: 400 }
      );
    }

    // 2. Call the Recall.ai API to make the bot leave
    const response = await fetch(`${RECALL_API_URL}/${recallBotId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Token ${RECALL_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Recall API error (leave meeting):', errorData);
      throw new Error(
        errorData.detail || 'Failed to make the bot leave the meeting.'
      );
    }

    console.log(`Bot ${recallBotId} successfully told to leave.`);

    // 3. (Optional but recommended) Update the status in Firestore
    // The webhook will *also* do this, but this is faster.
    await updateDoc(meetingRef, {
      status: 'COMPLETED',
    });

    return NextResponse.json({ success: true, botId: recallBotId });
  } catch (error: any) {
    console.error('Error in /api/leave-meeting:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to leave meeting' },
      { status: 500 }
    );
  }
}
