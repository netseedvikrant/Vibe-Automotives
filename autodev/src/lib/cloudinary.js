/**
 * Cloudinary Helper Client for AutoDev
 * Allows direct unsigned client-side uploads of CAD models, drawings, and images.
 */

const CLOUDINARY_CLOUD_NAME = 'dczonryp7';
const CLOUDINARY_UPLOAD_PRESET = 'cad_files';

export const uploadToCloudinary = async (file) => {
  if (!file) throw new Error('No file provided for upload.');

  // Determine the Cloudinary resource type:
  // Images (png, jpg, jpeg, svg, webp) must use 'image', whereas CAD files (step, stl, dwg, pdf) use 'raw'
  const fileExt = file.name.split('.').pop().toLowerCase();
  const isImageExt = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(fileExt);
  const resourceType = (file.type.startsWith('image/') || isImageExt) ? 'image' : 'raw';

  console.log(`Cloudinary Upload: File '${file.name}' resolved to resource type '${resourceType}'`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Cloudinary upload failed.');
  }

  const data = await response.json();
  return {
    url: data.secure_url, // Direct high-availability HTTPS link
    publicId: data.public_id,
    sizeBytes: data.bytes,
  };
};
