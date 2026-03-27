import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../constants/constans";

const useRecordInsights = () => {
  const { token } = useAuth();

  const record = (questionLog) => {
    if (!token || !questionLog || questionLog.length === 0) return;

    const facts = questionLog.map((q) => ({
      a: q.a,
      b: q.b,
      isCorrect: q.isCorrect,
    }));

    fetch(`${BASE_URL}/api/insights/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ facts }),
    }).catch(() => {
      // silent — fire-and-forget
    });
  };

  return { record };
};

export default useRecordInsights;
