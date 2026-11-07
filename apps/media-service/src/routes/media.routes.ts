import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import * as attachmentController from "../controllers/media.controllers";
import { uploadImage } from "../middleware/upload.middleware";
import { AppError, createRateLimiter } from "shared";

//rate limiter middleware to limit the number of requests per IP address
const attachmentRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // limit each IP to 20 requests per windowMs
  message:
    "Too many requests from this IP, please try again after 15 minutes.",
});

const router = Router();

function handleUpload(req: Request, res: Response, next: NextFunction) {
  uploadImage(req, res, (err: unknown) => {
    if (!err) {
      return next();
    }

    if (err instanceof AppError) {
      return next(err);
    }

    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      err.code === "LIMIT_FILE_SIZE"
    ) {
      return next(new AppError(400, "Image must be 10mb or smaller"));
    }

    return next(new AppError(400, "Invalid image upload"));
  });
}

// http://localhost:3000/tasks/244/attachments

router.post(
  "/:taskId/attachments",
  attachmentRateLimiter,
  handleUpload,
  attachmentController.uploadAttachment,
);

router.get("/:taskId/attachments", attachmentController.listAttachments);

export default router;
