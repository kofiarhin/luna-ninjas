// client/src/pages/PostSignUp.jsx
import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { BASE_URL } from "../../constants/constans";

export default function PostSignUp() {
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const register = async () => {
      const payload = {
        clerkUserId: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        imageUrl: user.imageUrl || "",
      };

      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Register failed");

      // optional: redirect after save
      window.location.href = "/";
    };

    register().catch((e) => console.error(e.message));
  }, [isLoaded, isSignedIn, user]);

  return null;
}
