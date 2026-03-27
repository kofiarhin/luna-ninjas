// client/src/hooks/useLeaderboard.js
// Fetches the public leaderboard from the backend on every mount.

import { useState, useEffect, useCallback } from "react";
import { BASE_URL } from "../constants/constans";

/**
 * @returns {{ leaders, loading, error, refetch }}
 *   leaders: Array<{ rank, name, totalScore, gamesPlayed }>
 *   loading: boolean
 *   error: string | null
 *   refetch: () => void
 */
const useLeaderboard = () => {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/api/leaderboard`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || "Could not load leaderboard.");
      }

      setLeaders(data.leaderboard || []);
    } catch (err) {
      setError(err.message || "Could not load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on every mount — component unmounts/remounts on navigation, so
  // this ensures the leaderboard is always fresh when the user returns home.
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaders, loading, error, refetch: fetchLeaderboard };
};

export default useLeaderboard;
