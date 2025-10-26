'use client';

import { useEffect, useState } from 'react';
import { db, setupAuth } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

// Define types for our data
interface Summary {
  title: string;
  summary: string;
  action_items: { item: string; owner: string }[];
  key_topics: { topic: string; sentiment: string }[];
  participants: { speaker_label: string; sentiment: string }[];
}

interface Meeting {
  id: string;
  meetingUrl: string;
  status: 'joining' | 'in-progress' | 'processing' | 'completed' | 'failed';
  summary?: Summary;
  transcript?: any[];
  error?: string;
}

export default function MeetingPage({ params }: { params: { id: string } }) {
  const { id: meetingId } = params;
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Authenticate the user first
    setupAuth().then(() => {
      if (!meetingId) return;

      const meetingRef = doc(db, 'meetings', String(meetingId));

      // Use onSnapshot to listen for real-time changes
      const unsubscribe = onSnapshot(
        meetingRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setMeeting(docSnap.data() as Meeting);
          } else {
            setMeeting(null); // Or set an error state
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching meeting:', error);
          setLoading(false);
        }
      );

      // Clean up the listener on unmount
      return () => unsubscribe();
    });
  }, [meetingId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Loading meeting data...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Meeting not found.
      </div>
    );
  }
  
  const getStatusMessage = (status: string) => {
    switch (status) {
      case 'joining':
        return 'Bot is joining the call...';
      case 'in-progress':
        return 'Meeting is live. Bot is listening...';
      case 'processing':
        return 'Meeting has ended. Generating summary with Gemini...';
      case 'failed':
        return `Processing failed: ${meeting.error || 'Unknown error'}`;
      default:
        return 'Loading...';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {meeting.status !== 'completed' && (
          <div className="p-4 mb-6 text-center text-cyan-200 bg-gray-800 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold">{getStatusMessage(meeting.status)}</h2>
          </div>
        )}

        {meeting.summary ? (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-center text-cyan-400">
              {meeting.summary.title}
            </h1>
            
            {/* Summary */}
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Meeting Summary</h2>
              <p className="text-gray-300 leading-relaxed">{meeting.summary.summary}</p>
            </div>

            {/* Action Items */}
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Action Items</h2>
              <ul className="list-disc list-inside space-y-2">
                {meeting.summary.action_items.map((item, index) => (
                  <li key={index} className="text-gray-300">
                    <strong>{item.owner}:</strong> {item.item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Topics & Participants */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Key Topics</h2>
                <ul className="space-y-2">
                  {meeting.summary.key_topics.map((topic, index) => (
                    <li key={index} className="flex justify-between items-center text-gray-300">
                      <span>{topic.topic}</span>
                      <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
                        topic.sentiment === 'Positive' ? 'bg-green-700 text-green-200' :
                        topic.sentiment === 'Negative' ? 'bg-red-700 text-red-200' :
                        'bg-gray-600 text-gray-200'
                      }`}>
                        {topic.sentiment}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
                <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Participants</h2>
                <ul className="space-y-2">
                  {meeting.summary.participants.map((p, index) => (
                    <li key={index} className="flex justify-between items-center text-gray-300">
                      <span>{p.speaker_label}</span>
                       <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
                        p.sentiment === 'Positive' ? 'bg-green-700 text-green-200' :
                        p.sentiment === 'Negative' ? 'bg-red-700 text-red-200' :
                        'bg-gray-600 text-gray-200'
                      }`}>
                        {p.sentiment}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* Full Transcript */}
            <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
              <h2 className="text-2xl font-semibold mb-3 text-cyan-300">Full Transcript</h2>
              <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                {meeting.transcript?.map((chunk, index) => (
                  <div key={index} className="text-gray-300">
                    <span className="font-bold text-cyan-400">{chunk.speaker_label || 'Unknown'}: </span>
                    <span>{chunk.transcript}</span>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        ) : (
           meeting.status === 'completed' && <div className="text-center text-xl">Summary is empty.</div>
        )}
      </div>
    </div>
  );
}

