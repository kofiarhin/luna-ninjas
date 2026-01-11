// client/src/App.jsx  (SIMPLE)
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

import Header from "./components/Header/Header";
import Home from "./Pages/Home/Home";
import Game from "./Pages/Game/Game";
import Login from "./Pages/Login/Login";
import Register from "./Pages/Register/Register";

const App = () => {
  return (
    <Router>
      <Header />

      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />

        {/* protect game */}
        <Route
          path="/game"
          element={
            <>
              <SignedIn>
                <Game />
              </SignedIn>
              <SignedOut>
                <Navigate to="/login" replace />
              </SignedOut>
            </>
          }
        />

        {/* IMPORTANT: * fixes /login/sso-callback */}
        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={<Register />} />
      </Routes>
    </Router>
  );
};

export default App;
