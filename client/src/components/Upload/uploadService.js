// upload image to cloudinary

// upload images
export const uploadImage = async (file, folder = "luna-ninjas") => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_UPLOAD_PRESET);
  formData.append("folder", folder);

  const url = "https://api.cloudinary.com/v1_1/dlsiabgiw/image/upload";

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("something went wrong");
  }

  const data = await response.json();
  return data.secure_url;
};
