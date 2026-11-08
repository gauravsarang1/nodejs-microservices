import { getPool, runDatabaseQuery } from "shared";
import type { Task } from "../utils/types";

export async function createTask(input: {
  title: string;
  createdBy: string;
}): Promise<Task> {
  const result = await runDatabaseQuery("create", "task", () =>
    getPool().query<Task>(
      `
        INSERT INTO tasks (title, created_by)
        VALUES ($1, $2)
        RETURNING id, title, status, created_by, created_at, updated_at
        `,
      [input.title, input.createdBy],
    ),
  );

  return result.rows[0];
}

// user and admin - in this same function
// created 2 separate function one for admin and one for user
// listAdminTasks
// listUserTasks
// manage in all places

export async function listTasks(input: {
  userId: string;
  role: string;
}): Promise<Task[]> {
  if (input.role === "ADMIN") {
    const result = await runDatabaseQuery("list", "task", () =>
      getPool().query<Task>(
        `
        SELECT id, title, status, created_by,  created_at, updated_at
        FROM tasks
        ORDER BY created_at DESC
        `,
      ),
    );

    return result.rows;
  }

  const result = await runDatabaseQuery("list_by_owner", "task", () =>
    getPool().query<Task>(
      `
        SELECT id, title, status, created_by,  created_at, updated_at
        FROM tasks
        WHERE created_by = $1
        ORDER BY created_at DESC
        `,
      [input.userId],
    ),
  );

  return result.rows;
}

// 3000/tasks/2
//:id

export async function findSingleTaskById(id: string): Promise<Task | null> {
  const result = await runDatabaseQuery("find_by_id", "task", () =>
    getPool().query<Task>(
      `
        SELECT id, title, status, created_by, created_at, updated_at
        FROM tasks
        WHERE id = $1
        `,
      [id],
    ),
  );

  return result.rows[0] ?? null;
}

export async function deleteSingleTaskById(id: string): Promise<boolean> {
  const result = await runDatabaseQuery("delete", "task", () =>
    getPool().query(`DELETE FROM tasks WHERE id = $1`, [id]),
  );

  return (result.rowCount ?? 0) > 0;
}
