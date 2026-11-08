import { z } from "zod";

export const attachmentParamsSchema = z.object({
  taskId: z.string().uuid(),
});
