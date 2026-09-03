import { Router } from "express";

import IdempotencyMiddleware from "core/global/middlewares/idempotency.middleware";
import AuthController from "../controller/auth.controller";
import { validateLogin, validateRegister } from "../validations/auth.validations";

const router: Router = Router();
const idempotency = new IdempotencyMiddleware(3, 300);
const im = idempotency.middleware();

router.post("/register", [im, validateRegister], AuthController.register);
router.post("/login", [validateLogin], AuthController.login);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/logout", AuthController.logout);

export default router;
