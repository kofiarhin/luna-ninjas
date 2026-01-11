// client/src/Pages/Login/Login.jsx
import { SignIn } from "@clerk/clerk-react";

const Login = () => {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          afterSignInUrl="/game"
        />
      </div>
    </div>
  );
};

export default Login;
