// client/src/Pages/Profile/Profile.jsx
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import AuthLayout from "../../components/AuthLayout/AuthLayout";
import { uploadImage } from "../../components/Upload/uploadService";
import useUpdateProfile from "../../hooks/useUpdateProfile";
import "./profile.styles.scss";

const Profile = () => {
  const { user } = useAuth();
  const { update, loading, error, fieldErrors } = useUpdateProfile();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    displayName: "",
    profileImage: "",
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize form from user data
  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        username: user.username || "",
        displayName: user.displayName || "",
        profileImage: user.profileImage || "",
      });
      setImagePreview(user.profileImage || null);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      setForm((prev) => ({ ...prev, profileImage: "" })); // Clear until uploaded
    }
  };

  const handleImageUpload = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const url = await uploadImage(file, "luna-ninjas/avatars");
      setForm((prev) => ({ ...prev, profileImage: url }));
      setImagePreview(url);
    } catch (err) {
      console.error("Upload failed");
      // Revert preview
      setImagePreview(user?.profileImage || null);
      setForm((prev) => ({ ...prev, profileImage: user?.profileImage || "" }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(false);

    // Upload image if selected but not yet uploaded
    if (fileInputRef.current?.files[0] && !form.profileImage) {
      await handleImageUpload();
    }

    try {
      await update(form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      // Error handled in hook
    }
  };

  const hasChanges = () => {
    if (!user) return false;
    return (
      form.fullName !== (user.fullName || "") ||
      form.username !== (user.username || "") ||
      form.displayName !== (user.displayName || "") ||
      form.profileImage !== (user.profileImage || "")
    );
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AuthLayout title="Your Profile" subtitle="Update your information">
      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="profile-form__error" role="alert">
            {error}
          </div>
        )}

        {success && (
          <div className="profile-form__success" role="alert">
            Profile updated successfully!
          </div>
        )}

        {/* Avatar Section */}
        <div className="profile-avatar">
          <div className="profile-avatar__image">
            {imagePreview ? (
              <img src={imagePreview} alt="Profile" />
            ) : (
              <div className="profile-avatar__placeholder">
                {getInitials(user?.fullName || "")}
              </div>
            )}
            {uploadingImage && (
              <div className="profile-avatar__loading">Uploading...</div>
            )}
          </div>
          <button
            type="button"
            className="profile-avatar__change"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
          >
            Change photo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageSelect}
            style={{ display: "none" }}
          />
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat__label">Total Score</span>
            <span className="profile-stat__value">{user?.totalScore || 0}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat__label">Games Played</span>
            <span className="profile-stat__value">
              {user?.gamesPlayed || 0}
            </span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="profile-field">
          <label className="profile-field__label" htmlFor="profile-fullName">
            Full name
          </label>
          <input
            className={`profile-field__input${fieldErrors.fullName ? " has-error" : ""}`}
            id="profile-fullName"
            type="text"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            placeholder="Jane Doe"
            autoComplete="name"
            required
          />
          {fieldErrors.fullName && (
            <span className="profile-field__error">{fieldErrors.fullName}</span>
          )}
        </div>

        <div className="profile-field">
          <label className="profile-field__label" htmlFor="profile-email">
            Email
          </label>
          <input
            className={`profile-field__input`}
            id="profile-email"
            type="email"
            value={user?.email || ""}
            disabled
            readOnly
          />
        </div>

        <div className="profile-field">
          <label className="profile-field__label" htmlFor="profile-username">
            Username
          </label>
          <input
            className={`profile-field__input${fieldErrors.username ? " has-error" : ""}`}
            id="profile-username"
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            placeholder="ninja42"
            autoComplete="username"
          />
          {fieldErrors.username && (
            <span className="profile-field__error">{fieldErrors.username}</span>
          )}
        </div>

        <div className="profile-field">
          <label className="profile-field__label" htmlFor="profile-displayName">
            Display name
          </label>
          <input
            className={`profile-field__input`}
            id="profile-displayName"
            type="text"
            name="displayName"
            value={form.displayName}
            onChange={handleChange}
            placeholder="Jane"
            autoComplete="nickname"
          />
        </div>

        <button
          type="submit"
          className="profile-submit"
          disabled={loading || uploadingImage || !hasChanges()}
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Profile;
