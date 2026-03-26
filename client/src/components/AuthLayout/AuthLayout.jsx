import { Link } from "react-router-dom";
import "./auth-layout.styles.scss";

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="auth-page">
      <div className="auth-page__glow auth-page__glow--top" />
      <div className="auth-page__glow auth-page__glow--bottom" />

      <div className="auth-card">
        <div className="auth-card__header">
          <Link to="/home" className="auth-card__brand">
            Luna Ninjas
          </Link>
          <h1 className="auth-card__title">{title}</h1>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
        </div>

        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
