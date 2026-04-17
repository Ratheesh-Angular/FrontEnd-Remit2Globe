import "next-auth";
import "next-auth/jwt";

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    kycStatus?: string;
    createdAt?: string;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
      kycStatus?: string;
      createdAt?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: string;
    kycStatus?: string;
    createdAt?: Date;
    emailVerified?: boolean;
    phoneVerified?: boolean;
  }
}
