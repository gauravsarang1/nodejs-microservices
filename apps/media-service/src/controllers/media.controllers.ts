import type { Request, Response } from "express";
import { AppError, successResponse } from "shared";
import * as attachmentService from "../services/media.services";

function requireIdentity(req: Request) {
  const userId = req.header("x-user-id");
  const role = req.header("x-user-role");

  if (!role || !userId) {
    throw new AppError(401, "Missing user identity", true, {
      code: "MISSING_USER_IDENTITY",
    });
  }

  return { userId, role };
}

export async function uploadAttachment(
  req: Request,
  res: Response,
) {
  const { userId, role } = requireIdentity(req);
  const taskId = String(req.params.taskId);
  const attachment = await attachmentService.uploadAttachment({
    taskId,
    userId,
    role,
    requestId: String(req.id),
    file: req.file,
  });

  successResponse(res, { attachment }, 201);
}

export async function listAttachments(
  req: Request,
  res: Response,
) {
  const { userId, role } = requireIdentity(req);
  const taskId = String(req.params.taskId);
  const extractAttachments = await attachmentService.listAttachments(
    taskId,
    userId,
    role,
  );
  successResponse(res, { extractAttachments });
}
