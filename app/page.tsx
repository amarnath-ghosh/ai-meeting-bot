'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingUrl) {
      setError('Please enter a meeting URL.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/join-meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: meetingUrl }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to start the bot.');
      }

      const { meetingId } = await response.json();
      
      // Redirect to the new meeting's dashboard page
      router.push(`/meeting/${meetingId}`);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center text-cyan-400">
          AI Meeting Assistant
        </h1>
        <p className="text-center text-gray-300">
          Enter a meeting link to have the AI bot join, record, and summarize the
          conversation.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="meetingUrl" className="block text-sm font-medium text-gray-300">
              Meeting URL
            </label>
            <input
              id="meetingUrl"
              type="url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.trim())}
              placeholder="https://meet.google.com/..."
              required
              className="w-full px-3 py-2 mt-1 text-gray-900 bg-gray-100 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 font-bold text-white bg-cyan-600 rounded-md shadow-lg hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Joining...' : 'Deploy Bot'}
          </button>
          {error && <p className="text-sm text-center text-red-400">{error}</p>}
        </form>
      </div>
    </div>
  );
}

