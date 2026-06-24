declare namespace Express {
  interface Request {
    rawBody?: Buffer;
    user?: {
      userId: string;
    };
    admin?: {
      adminId: string;
      email: string;
      permissions: string[];
    };
  }
}
