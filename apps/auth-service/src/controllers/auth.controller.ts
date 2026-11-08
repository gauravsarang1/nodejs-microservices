import type { Request, Response } from "express";
import * as authservice from "../services/auth.service";
import { AppError, successResponse } from "shared";

export async function register(
  req: Request,
  res: Response,
) {
  const user = await authservice.register(req.body);
  successResponse(res, { user }, 201);
}

export async function login(req: Request, res: Response) {
  const result = await authservice.login(req.body);
  successResponse(res, result);
}

export async function getMe(req: Request, res: Response) {
  const userId = req.header("x-user-id");
  if (!userId) {
    throw new AppError(401, "Missing user identity", true, {
      code: "MISSING_USER_IDENTITY",
    });
  }

  const user = await authservice.getMe(userId);
  successResponse(res, { user });
}
