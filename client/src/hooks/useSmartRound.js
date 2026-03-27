import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../constants/constans";

const useSmartRound = () => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSmartRound = async ({ operation, table }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        operation,
        table: String(table),
      });

      const res = await fetch(`${BASE_URL}/api/insights/smart-round?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired — please log in again.");
        }
        throw new Error(data?.message || "Could not load Smart Practice round.");
      }

      return data;
    } catch (err) {
      setError(err.message || "Could not load Smart Practice round.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { fetchSmartRound, loading, error };
};

export default useSmartRound;
