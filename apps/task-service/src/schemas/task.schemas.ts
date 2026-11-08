import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(5, "Title is required"),
});

export const taskIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
