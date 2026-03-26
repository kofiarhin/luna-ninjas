import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BASE_URL } from "../../constants/constans";
import AuthLayout from "../../components/AuthLayout/AuthLayout";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "invalid_credentials") {
          throw new Error("Invalid email or password");
        }
        throw new Error(data.message || "Login failed");
      }

      login(data.token, data.user);
      navigate("/game");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your account to continue"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="auth-form__error" role="alert">
            {error}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="login-email">
            Email address
          </label>
          <input
            className="auth-field__input"
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="login-password">
            Password
          </label>
          <input
            className="auth-field__input"
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </div>

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={loading}
        >
          {loading && <span className="auth-btn__spinner" />}
          {loading ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>

      <p className="auth-footer">
        Don&apos;t have an account?{" "}
        <Link className="auth-footer__link" to="/register">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
