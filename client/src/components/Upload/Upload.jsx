import "./upload.styles.scss";
import { useState } from "react";
import { FiImage, FiCopy, FiCheck } from "react-icons/fi";
import { uploadImage } from "./uploadService";
import Spinner from "./Spinner";
const Upload = () => {
  const [file, setFile] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type.startsWith("image/")) {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid image file.");
      setFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setImgUrl(url);
    } catch (err) {
      console.error(err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (imgUrl) {
      navigator.clipboard.writeText(imgUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-card">
        <h1 className="upload-title">Upload Image</h1>
        <div className="upload-dropzone">
          <div className="upload-icon">
            <FiImage size={48} />
          </div>
          <p>Drag and drop your image here</p>
          <label htmlFor="file-upload" className="upload-btn">
            Select from computer
          </label>
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleChange}
            hidden
          />
        </div>

        {file && (
          <button className="upload-submit" onClick={handleSubmit}>
            Upload Now
          </button>
        )}

        {error && <p className="upload-error">{error}</p>}
        {isLoading && <Spinner />}
        {imgUrl && (
          <div className="upload-preview">
            <h3>Uploaded Image:</h3>
            <img src={imgUrl} alt="Uploaded" />
            <div className="upload-url">
              <p>{imgUrl}</p>
              <button
                onClick={handleCopy}
                className="copy-btn"
                title="Copy URL"
              >
                {copied ? <FiCheck size={18} /> : <FiCopy size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;
