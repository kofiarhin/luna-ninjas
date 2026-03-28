import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BASE_URL } from "../../constants/constans";
import AuthLayout from "../../components/AuthLayout/AuthLayout";

const PENDING_KEY = "luna_pending_result";

const Register = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
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

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => ({ ...prev, [e.target.name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
          return;
        }
        if (data.error === "email_taken") {
          setFieldErrors({ email: "This email is already registered" });
          return;
        }
        throw new Error(data.message || "Registration failed");
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
      setApiError(err.message);
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
      title="Create your account"
      subtitle="Start playing now — set your username later in Profile"
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {apiError && (
          <div className="auth-form__error" role="alert">
            {apiError}
          </div>
        )}

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reg-fullName">
            Full name
          </label>
          <input
            className={`auth-field__input${fieldErrors.fullName ? " has-error" : ""}`}
            id="reg-fullName"
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
          {fieldErrors.fullName && (
            <span className="auth-field__error">{fieldErrors.fullName}</span>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reg-email">
            Email address
          </label>
          <input
            className={`auth-field__input${fieldErrors.email ? " has-error" : ""}`}
            id="reg-email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          {fieldErrors.email && (
            <span className="auth-field__error">{fieldErrors.email}</span>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reg-password">
            Password
          </label>
          <input
            className={`auth-field__input${fieldErrors.password ? " has-error" : ""}`}
            id="reg-password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
          />
          {fieldErrors.password && (
            <span className="auth-field__error">{fieldErrors.password}</span>
          )}
        </div>

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={loading || savingPending}
        >
          {loading && <span className="auth-btn__spinner" />}
          {loading ? "Creating account\u2026" : "Create account"}
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
        Already have an account?{" "}
        <Link className="auth-footer__link" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
