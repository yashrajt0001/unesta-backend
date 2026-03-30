declare namespace Express {
  interface Request {
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
