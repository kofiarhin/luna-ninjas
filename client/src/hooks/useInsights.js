import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../constants/constans";

const useInsights = () => {
  const { token } = useAuth();
  const [facts, setFacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchInsights = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Failed to load insights");

        const data = await res.json();
        setFacts(data.facts || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();
  }, [token]);

  return { facts, loading, error };
};

export default useInsights;
