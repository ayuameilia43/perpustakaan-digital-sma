import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      nisn_nip: string | null;
      class_or_dept?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    nisn_nip: string | null;
    class_or_dept?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    nisn_nip: string | null;
    class_or_dept?: string | null;
  }
}
