import { getPool, runDatabaseQuery } from "shared";
import type { User, UserRole } from "../types/user";

export async function findByEmail(email: string): Promise<User | null> {
  const result = await runDatabaseQuery("find_by_email", "user", () =>
    getPool().query<User>(
      `
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE email = $1
        `,
      [email],
    ),
  );

  return result.rows[0] ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const result = await runDatabaseQuery("find_by_id", "user", () =>
    getPool().query<User>(
      `
        SELECT id, name, email, password_hash, role, created_at
        FROM users
        WHERE id = $1
        `,
      [id],
    ),
  );

  return result.rows[0] ?? null;
}

export async function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
}): Promise<User> {
  const result = await runDatabaseQuery("create", "user", () =>
    getPool().query<User>(
      `
        INSERT INTO users (name, email, password_hash, role)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, password_hash, role, created_at
        `,
      [input.name, input.email, input.passwordHash, input.role ?? "USER"],
    ),
  );

  return result.rows[0];
}
