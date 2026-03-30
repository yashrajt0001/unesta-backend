import { cloudinary } from '../config/cloudinary.js';
import { AppError } from '../middleware/error-handler.js';

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string = 'listings',
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: `unesta/${folder}`, resource_type: 'image' }, (error, result) => {
        if (error || !result) {
          reject(new AppError('Image upload failed', 500));
        } else {
          resolve(result.secure_url);
        }
      })
      .end(fileBuffer);
  });
};
