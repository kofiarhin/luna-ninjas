// client/src/context/AuthContext.jsx
// Provides authentication state across the app.
// On mount, verifies any persisted token via GET /api/auth/me — never by
// decoding the JWT client-side.

import { createContext, useContext, useEffect, useState } from "react";
import { BASE_URL } from "../constants/constans";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // On mount: verify persisted token through the server
  useEffect(() => {
    const stored = localStorage.getItem("luna_token");

    if (!stored) {
      setIsLoaded(true);
      return;
    }

    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((userData) => {
        setUser(userData);
        setToken(stored);
      })
      .catch(() => {
        localStorage.removeItem("luna_token");
        setUser(null);
        setToken(null);
      })
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  const login = (newToken, userData) => {
    localStorage.setItem("luna_token", newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("luna_token");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updatedFields) => {
    setUser((prev) => ({ ...prev, ...updatedFields }));
  };

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, updateUser, isLoaded }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
