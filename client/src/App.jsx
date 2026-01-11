// client/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

import Header from "./components/Header/Header";
import Home from "./Pages/Home/Home";
import Game from "./Pages/Game/Game";
import Login from "./Pages/Login/Login";
import Register from "./Pages/Register/Register";
import PostSignUp from "./Pages/PostSignUp/PostSignUp";

const App = () => {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />
        <Route path="/post-signup" element={<PostSignUp />} />

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

        <Route path="/login/*" element={<Login />} />
        <Route path="/register/*" element={<Register />} />
      </Routes>
    </>
  );
};

export default App;
