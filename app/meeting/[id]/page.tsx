'use client';

// FIX: Import useParams from next/navigation
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// FIX: Use relative path for lib import
import { db, setupAuth } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// This interface defines the shape of our data in Firestore
interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

interface SummaryData {
  summary: string;
  actionItems: string[];
  keyTopics: { topic: string; description: string }[];
  sentiment: string;
}

interface MeetingData {
  meetingUrl: string;
  botName: string;
  createdAt: string;
  status: 'JOINING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'COMPLETED' | 'ERROR';
  transcript: TranscriptEntry[];
  summary: SummaryData | null;
  error?: string;
}

// A simple loading spinner component
const LoadingSpinner = ({ status }: { status: string }) => {
  let statusText = 'Loading...';
  switch (status) {
    case 'JOINING':
      statusText = 'Bot is joining the meeting...';
      break;
    case 'TRANSCRIBING':
      statusText = 'Live transcription in progress...';
      break;
    case 'SUMMARIZING':
      statusText = 'Summarizing the meeting...';
      break;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <svg
        className="w-16 h-16 animate-spin text-cyan-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p className="mt-4 text-xl text-gray-300">{statusText}</p>
    </div>
  );
};

// FIX: Remove 'params' prop from the function signature
export default function MeetingPage() {
  // FIX: Get params using the hook
  const params = useParams();
  // Ensure meetingId is a string, as useParams can return string | string[]
  const meetingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Effect to set up Firebase auth
  useEffect(() => {
    // This logs in the user anonymously so we can access Firestore
    setupAuth().catch((error) => {
      console.error("Auth setup failed:", error);
      // Handle auth error (e.g., show a message)
      // This is likely the "configuration-not-found" error
      // if you haven't enabled Anonymous Auth in Firebase
    });
  }, []);

  // Effect to listen for real-time data from Firestore
  useEffect(() => {
    // Don't run until we have the ID and auth is ready
    if (!meetingId) return;

    const docRef = doc(db, 'meetings', meetingId);

    // onSnapshot creates a real-time listener
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as MeetingData;
          setMeeting(data);

          // If the status is 'COMPLETED' or 'ERROR', we can stop the loading spinner
          if (data.status === 'COMPLETED' || data.status === 'ERROR') {
            setLoading(false);
          }
        } else {
          // Document doesn't exist, show an error or redirect
          console.error('No such document!');
          setLoading(false);
          setMeeting(null);
        }
      },
      (error) => {
        console.error('Firestore snapshot error:', error);
        setLoading(false);
      }
    );

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [meetingId]); // Re-run this effect if the meetingId changes

  if (loading || !meeting) {
    return <LoadingSpinner status={meeting?.status || 'Loading...'} />;
  }

  if (meeting.status === 'ERROR') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <h1 className="text-3xl font-bold text-red-500">Meeting Error</h1>
        <p className="mt-4 text-xl text-gray-300">{meeting.error}</p>
        <button
          onClick={() => router.push('/')}
          className="mt-6 px-4 py-2 font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Render the COMPLETED meeting summary
  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <header className="bg-gray-800 shadow-lg">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.push('/')}
            className="text-cyan-400 hover:text-cyan-300"
          >
            &larr; Back to Home
          </button>
          <h1 className="text-3xl font-bold text-white mt-2">
            Meeting Summary
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {meeting.meetingUrl}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main content: Summary and Transcript */}
          <div className="lg:col-span-2 space-y-8">
            {/* Key Topics */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Key Topics
              </h2>
              <ul className="space-y-4">
                {meeting.summary?.keyTopics.map((item, index) => (
                  <li key={index}>
                    <h3 className="text-lg font-medium text-cyan-400">
                      {item.topic}
                    </h3>
                    <p className="text-gray-300">{item.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Full Transcript */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Transcript
              </h2>
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                {meeting.transcript.map((entry, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="font-semibold text-cyan-400">
                      {entry.speaker}
                    </span>
                    <p className="text-gray-300">{entry.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar: Summary and Action Items */}
          <div className="lg:col-span-1 space-y-8">
            {/* Summary */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Summary
              </h2>
              <p className="text-gray-300">{meeting.summary?.summary}</p>
            </div>
            
            {/* Sentiment */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Overall Sentiment
              </h2>
              <p className="text-3xl font-bold text-cyan-400">
                {meeting.summary?.sentiment}
              </p>
            </div>

            {/* Action Items */}
            <div className="bg-gray-800 shadow-md rounded-lg p-6">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Action Items
              </h2>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                {meeting.summary?.actionItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}


