// client/src/hooks/useUpdateProfile.js
// Updates the current user's profile via PATCH /api/auth/profile.

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { BASE_URL } from "../constants/constans";

/**
 * @returns {{ update, loading, error, fieldErrors }}
 *   update(updates) → Promise<void>
 *   loading: boolean
 *   error: string | null
 *   fieldErrors: object
 */
const useUpdateProfile = () => {
  const { token, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const update = async (updates) => {
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      const res = await fetch(`${BASE_URL}/api/auth/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired — please log in again.");
        }
        if (res.status === 409 && data.error === "username_taken") {
          setFieldErrors({ username: "This username is already taken" });
          return;
        }
        if (data.errors) {
          setFieldErrors(data.errors);
          return;
        }
        throw new Error(data?.message || "Could not update profile.");
      }

      updateUser(data);
      return data;
    } catch (err) {
      setError(err.message || "Could not update profile.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { update, loading, error, fieldErrors };
};

export default useUpdateProfile;
