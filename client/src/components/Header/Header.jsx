// client/src/components/Header/Header.jsx
import { NavLink } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import "./header.styles.scss";

const Header = () => {
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

          <SignedIn>
            <NavLink
              to="/game"
              className={({ isActive }) =>
                `header-link ${isActive ? "is-active" : ""}`
              }
            >
              Game
            </NavLink>

            <div className="header-user">
              <UserButton
                afterSignOutUrl="/home"
                appearance={{
                  elements: {
                    avatarBox: "header-avatar",
                  },
                }}
              />
            </div>
          </SignedIn>

          <SignedOut>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                `header-link ${isActive ? "is-active" : ""}`
              }
            >
              Login
            </NavLink>

            <NavLink
              to="/register"
              className={({ isActive }) =>
                `header-link ${isActive ? "is-active" : ""}`
              }
            >
              Register
            </NavLink>
          </SignedOut>
        </nav>
      </div>
    </header>
  );
};

export default Header;
