'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [meetingUrl, setMeetingUrl] = useState('');
  // This is the "Bot's Name" input you are missing
  const [botName, setBotName] = useState('AI Assistant');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingUrl) {
      setError('Please enter a meeting link.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // This sends the botName and meetingUrl to the correct API route
      const response = await fetch('/api/join-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingUrl, botName }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to start the bot.');
      }

      const { id } = await response.json();

      // Redirect to the meeting page
      router.push(`/meeting/${id}`);

    } catch (err: any) {
      setError(err.message);
      
    }
    finally{
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-cyan-400">
          AI Meeting Bot
        </h1>
        <p className="text-center text-gray-300">
          Paste your Zoom, Google Meet, or Teams link to have the AI bot
          join, record, and summarize the call.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            {/* This input field will now appear on your page */}
            <label
              htmlFor="botName"
              className="block mb-2 text-sm font-medium text-gray-400"
            >
              Bot's Name
            </label>
            <input
              id="botName"
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label
              htmlFor="meetingUrl"
              className="block mb-2 text-sm font-medium text-gray-400"
            >
              Meeting Link
            </label>
            <input
              id="meetingUrl"
              type="url"
              value={meetingUrl}
              // FIX: Removed the incorrect "e.g." typo
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.google.com/..."
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 font-semibold text-white bg-cyan-600 rounded-md
              hover:bg-cyan-700 focus:outline-none focus:ring-2
              focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Joining...' : 'Join Meeting'}
          </button>
          
          {error && <p className="text-sm text-center text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}

