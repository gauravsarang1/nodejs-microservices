import { Router } from "express";
import { validateBody, validateParams } from "shared";
import { createTaskSchema, taskIdParamsSchema } from "../schemas/task.schemas";
import * as taskController from "../controllers/task.controllers";

import {
  createTaskRateLimiter,
  listTasksRateLimiter,
  getSingleTaskRateLimiter,
  deleteTaskRateLimiter,
} from "../utils/rateLimiter.utils";

const router = Router();

router.post(
  "/",
  createTaskRateLimiter,
  validateBody(createTaskSchema),
  taskController.createTask,
);

router.get(
  "/",
  listTasksRateLimiter,
  taskController.listTasks,
);

router.get(
  "/:id",
  validateParams(taskIdParamsSchema),
  getSingleTaskRateLimiter,
  taskController.getSingleTask,
);

router.delete(
  "/:id",
  validateParams(taskIdParamsSchema),
  deleteTaskRateLimiter,
  taskController.deleteSingleTask,
);

export default router;