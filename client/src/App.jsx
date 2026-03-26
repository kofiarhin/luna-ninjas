// client/src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Header from "./components/Header/Header";
import Home from "./Pages/Home/Home";
import Game from "./Pages/Game/Game";
import Login from "./Pages/Login/Login";
import Register from "./Pages/Register/Register";

const PrivateRoute = ({ children }) => {
  const { user, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

const App = () => {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<Home />} />

        <Route
          path="/game"
          element={
            <PrivateRoute>
              <Game />
            </PrivateRoute>
          }
        />

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </>
  );
};

export default App;
