import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BASE_URL } from "../../constants/constans";
import AuthLayout from "../../components/AuthLayout/AuthLayout";

const PENDING_KEY = "luna_pending_result";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pendingSaveError, setPendingSaveError] = useState(null);
  const [savingPending, setSavingPending] = useState(false);
  const retryDataRef = useRef(null);
  const isSavingRef = useRef(false);

  const attemptPendingSave = async (token, pending) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSavingPending(true);
    setPendingSaveError(null);

    try {
      const res = await fetch(`${BASE_URL}/api/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          table: pending.table,
          correctCount: pending.correctCount,
          operation: pending.operation,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.message || "Could not save score.");
      }

      // Fire-and-forget insights
      fetch(`${BASE_URL}/api/insights/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          facts: pending.questionLog.map((q) => ({
            a: q.a,
            b: q.b,
            isCorrect: q.isCorrect,
            operation: q.operation || "multiplication",
          })),
        }),
      }).catch(() => {});

      sessionStorage.removeItem(PENDING_KEY);
      navigate("/game");
    } catch (err) {
      setPendingSaveError(err.message || "Could not save score.");
    } finally {
      isSavingRef.current = false;
      setSavingPending(false);
    }
  };

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

      let pending = null;
      try {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (raw) pending = JSON.parse(raw);
      } catch {
        // malformed JSON — skip pending save
      }

      if (pending) {
        retryDataRef.current = { token: data.token, pending };
        await attemptPendingSave(data.token, pending);
        return;
      }

      navigate("/game");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPendingSave = () => {
    if (!retryDataRef.current) return;
    const { token, pending } = retryDataRef.current;
    attemptPendingSave(token, pending);
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
          disabled={loading || savingPending}
        >
          {loading && <span className="auth-btn__spinner" />}
          {loading ? "Signing in\u2026" : "Sign in"}
        </button>
      </form>

      {savingPending && !pendingSaveError && (
        <p className="auth-footer">Saving your score&hellip;</p>
      )}

      {pendingSaveError && (
        <div className="auth-form__error" role="alert">
          <p>{pendingSaveError}</p>
          <button
            className="auth-btn auth-btn--primary"
            onClick={handleRetryPendingSave}
            disabled={savingPending}
          >
            {savingPending && <span className="auth-btn__spinner" />}
            {savingPending ? "Saving\u2026" : "Retry save"}
          </button>
        </div>
      )}

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
