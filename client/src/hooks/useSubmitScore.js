// client/src/hooks/useSubmitScore.js
// Submits a completed round score to the backend using the custom auth JWT.

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../constants/constans";

/**
 * @returns {{ submit, loading, error }}
 *   submit({ table, correctCount }) → Promise<void>
 *   loading: boolean
 *   error: string | null
 */
const useSubmitScore = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async ({ table, correctCount }) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${BASE_URL}/api/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ table, correctCount }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired — please log in again.");
        }
        if (res.status === 404) {
          throw new Error("Account not found — please log out and back in.");
        }
        throw new Error(data?.message || "Could not save score.");
      }

      return data;
    } catch (err) {
      setError(err.message || "Could not save score.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { submit, loading, error };
};

export default useSubmitScore;
