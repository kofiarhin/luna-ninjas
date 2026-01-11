// client/src/Pages/Register/Register.jsx
import { SignUp } from "@clerk/clerk-react";

const Register = () => {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <SignUp
          routing="path"
          path="/register"
          signInUrl="/login"
          afterSignUpUrl="/game"
        />
      </div>
    </div>
  );
};

export default Register;
