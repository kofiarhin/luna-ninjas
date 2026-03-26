import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { BASE_URL } from "../../constants/constans";
import AuthLayout from "../../components/AuthLayout/AuthLayout";

const Register = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    username: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(false);

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
        if (data.error === "username_taken") {
          setFieldErrors({ username: "This username is already taken" });
          return;
        }
        throw new Error(data.message || "Registration failed");
      }

      login(data.token, data.user);
      navigate("/game");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start playing and climb the leaderboard"
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

        <div className="auth-field">
          <label className="auth-field__label" htmlFor="reg-username">
            Username
            <span className="auth-field__hint" style={{ marginLeft: 6 }}>
              (optional)
            </span>
          </label>
          <input
            className={`auth-field__input${fieldErrors.username ? " has-error" : ""}`}
            id="reg-username"
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="ninja42"
            autoComplete="username"
          />
          {fieldErrors.username && (
            <span className="auth-field__error">{fieldErrors.username}</span>
          )}
        </div>

        <button
          className="auth-btn auth-btn--primary"
          type="submit"
          disabled={loading}
        >
          {loading && <span className="auth-btn__spinner" />}
          {loading ? "Creating account\u2026" : "Create account"}
        </button>
      </form>

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
