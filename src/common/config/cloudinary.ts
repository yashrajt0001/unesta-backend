import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

if (env.CLOUDINARY_URL) {
  cloudinary.config({ url: env.CLOUDINARY_URL });
  logger.info('Cloudinary configured');
}

export { cloudinary };
