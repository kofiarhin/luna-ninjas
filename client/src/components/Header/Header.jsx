import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./header.styles.scss";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/home");
  };

  return (
    <header className="header">
      <div className="header-container">
        <NavLink to="/home" className="header-logo">
          Luna Ninjas
        </NavLink>

        <nav className="header-nav">
          <NavLink
            to="/home"
            className={({ isActive }) =>
              `header-link ${isActive ? "is-active" : ""}`
            }
          >
            Home
          </NavLink>

          {user && (
            <>
              <NavLink
                to="/game"
                className={({ isActive }) =>
                  `header-link ${isActive ? "is-active" : ""}`
                }
              >
                Game
              </NavLink>

              <div className="header-user">
                {user.profileImage && (
                  <img
                    src={user.profileImage}
                    alt="Profile"
                    className="header-avatar"
                  />
                )}
                <NavLink to="/profile" className="header-display-name">
                  {user.displayName}
                </NavLink>
                <button className="header-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </>
          )}

          {!user && (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `header-link ${isActive ? "is-active" : ""}`
                }
              >
                Sign in
              </NavLink>

              <NavLink to="/register" className="header-cta">
                Get started
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
