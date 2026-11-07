import { Router } from "express";
import { validateBody } from "shared";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";
import * as authController from "../controllers/auth.controller";
import * as authRateLimiter from "../utils/rateLimiter.utils";

const router = Router();

router.post("/register", validateBody(registerSchema), authRateLimiter.registerRateLimiter, authController.register);
router.post("/login", validateBody(loginSchema), authRateLimiter.loginRateLimiter, authController.login);
router.get("/me", authRateLimiter.meRateLimiter, authController.getMe);

export default router;
