import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 jam
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email / NISN / NIP", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          throw new Error("Email/NISN/NIP dan Password wajib diisi.");
        }

        const identifier = credentials.identifier.trim();

        // Find user by email or nisn_nip
        const user = await db.user.findFirst({
          where: {
            OR: [
              { email: identifier.toLowerCase() },
              { nisn_nip: identifier },
            ],
          },
        });

        if (!user) {
          throw new Error("Pengguna tidak ditemukan.");
        }

        if (user.status !== "ACTIVE") {
          throw new Error("Akun Anda sedang dinonaktifkan. Hubungi Administrator.");
        }

        // Verify password hash
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isPasswordValid) {
          throw new Error("Password tidak cocok.");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as Role,
          nisn_nip: user.nisn_nip,
          class_or_dept: user.class_or_dept,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.nisn_nip = user.nisn_nip;
        token.class_or_dept = user.class_or_dept;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.nisn_nip = token.nisn_nip;
        session.user.class_or_dept = token.class_or_dept;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
