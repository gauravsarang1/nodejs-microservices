import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import * as attachmentController from "../controllers/media.controllers";
import { uploadImage } from "../middleware/upload.middleware";
import { AppError, createRateLimiter, validateParams } from "shared";
import { MulterError } from "multer";
import { attachmentParamsSchema } from "../schemas/media.schemas";

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

    if (err instanceof MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(413, "Uploaded image must be 10 MB or smaller", true, {
            code: "UPLOAD_TOO_LARGE",
          }),
        );
      }

      return next(
        new AppError(400, "Invalid image upload", true, {
          code: "INVALID_IMAGE_UPLOAD",
          details: { uploadError: err.code },
        }),
      );
    }

    return next(err);
  });
}

// http://localhost:3000/tasks/244/attachments

router.post(
  "/:taskId/attachments",
  attachmentRateLimiter,
  validateParams(attachmentParamsSchema),
  handleUpload,
  attachmentController.uploadAttachment,
);

router.get(
  "/:taskId/attachments",
  validateParams(attachmentParamsSchema),
  attachmentController.listAttachments,
);

export default router;
