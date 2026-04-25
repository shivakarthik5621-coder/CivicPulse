const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const isConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (!isConfigured) {
  console.warn('⚠️  Cloudinary credentials not found. Photo uploads will use base64 data URLs.');
}

/**
 * Upload an image buffer to Cloudinary or return a base64 data URL as fallback.
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<string>} - CDN URL or base64 data URL
 */
async function uploadImage(buffer, filename) {
  if (!isConfigured) {
    // Demo mode: return base64 data URL
    const base64 = buffer.toString('base64');
    const ext = filename.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'civicpulse',
        resource_type: 'image',
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(buffer);
  });
}

module.exports = { uploadImage, isConfigured };
