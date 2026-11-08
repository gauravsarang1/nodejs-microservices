import { getPool, runDatabaseQuery } from "shared";
import type { Attachment } from "../utils/types";

export async function findTaskAccess(taskId: string): Promise<{
  id: string;
  created_by: string;
} | null> {
  const result = await runDatabaseQuery("find_task_access", "task", () =>
    getPool().query<{ id: string; created_by: string }>(
      `
    SELECT id, created_by FROM tasks WHERE id = $1
    `,
      [taskId],
    ),
  );

  return result.rows[0] ?? null;
}

export async function createAttachment(input: {
  taskId: string;
  imageUrl: string;
  publicId: string;
  uploadedBy: string;
}): Promise<Attachment> {
  const result = await runDatabaseQuery("create", "attachment", () =>
    getPool().query<Attachment>(
      `
     INSERT INTO attachments (task_id, image_url, public_id, uploaded_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, task_id, image_url, public_id, uploaded_by, created_at
     `,
      [input.taskId, input.imageUrl, input.publicId, input.uploadedBy],
    ),
  );

  return result.rows[0];
}

export async function listByTaskId(taskId: string): Promise<Attachment[]> {
  const result = await runDatabaseQuery("list_by_task", "attachment", () =>
    getPool().query<Attachment>(
      `
        SELECT id, task_id, image_url, public_id, uploaded_by, created_at
        FROM attachments
        WHERE task_id = $1
        ORDER BY created_at DESC
        `,
      [taskId],
    ),
  );

  return result.rows;
}
