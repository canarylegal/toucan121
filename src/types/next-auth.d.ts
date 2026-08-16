import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    hostId?: string;
    hostSlug?: string;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      hostId?: string;
      hostSlug?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    hostId?: string;
    hostSlug?: string;
  }
}
