import { CreateTaskInput } from "../schemas/task.schemas";
import * as taskRepo from "../repositories/task.repository";
import { convertToPublicTask } from "../utils/task.utils";
import { AppError } from "shared";
import { publishTaskEvent } from "../kafka";

export async function createTask(
  input: CreateTaskInput,
  userId: string,
  requestId: string,
) {
  const newlyCreatedTask = await taskRepo.createTask({
    title: input.title,
    createdBy: userId,
  });

  try {
    await publishTaskEvent(newlyCreatedTask.id, userId, requestId);
  } catch (cause) {
    throw new AppError(
      503,
      "Task was created, but its event could not be published",
      true,
      {
        code: "TASK_EVENT_PUBLISH_FAILED",
        cause,
        details: {
          taskId: newlyCreatedTask.id,
          operation: "publish_task_created_event",
          databaseWriteCompleted: true,
        },
      },
    );
  }

  return convertToPublicTask(newlyCreatedTask);
}

export async function listTasks(userId: string, role: string) {
  if (!userId || !role) {
    throw new AppError(401, "Missing user identity", true, {
      code: "MISSING_USER_IDENTITY",
    });
  }

  const tasks = await taskRepo.listTasks({ userId, role });

  return tasks.map(convertToPublicTask);
}

export async function getSingleTask(id: string, userId: string, role: string) {
  const task = await taskRepo.findSingleTaskById(id);

  if (!task) {
    throw new AppError(404, "Task not found", true, {
      code: "TASK_NOT_FOUND",
      details: { taskId: id },
    });
  }

  if (role !== "ADMIN" && task.created_by !== userId) {
    throw new AppError(403, "You cannot access this task", true, {
      code: "TASK_ACCESS_DENIED",
      details: { taskId: id },
    });
  }

  return convertToPublicTask(task);
}

export async function deleteSingleTask(id: string, role: string) {
  if (role !== "ADMIN") {
    throw new AppError(403, "Only administrators can delete tasks", true, {
      code: "TASK_DELETE_FORBIDDEN",
    });
  }

  const task = await taskRepo.findSingleTaskById(id);

  if (!task) {
    throw new AppError(404, "Task not found", true, {
      code: "TASK_NOT_FOUND",
      details: { taskId: id },
    });
  }

  await taskRepo.deleteSingleTaskById(id);

  return { id };
}
