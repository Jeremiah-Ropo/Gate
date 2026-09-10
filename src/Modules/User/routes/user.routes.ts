import { Router } from "express";

import AuthGuardMiddleware, { rolePolicies } from "core/global/middlewares/auth-guard.middleware";
import UserController from "../controller/user.controller";
import { validateChangePassword, validateSearchUsers, validateUpdateUser } from "../validations/user.validations";

const router: Router = Router();
const organizerOnly = AuthGuardMiddleware.authorize(rolePolicies.organizer);

router.get("/search", [organizerOnly, validateSearchUsers], UserController.searchUsers);
router.get("/me", UserController.me);
router.put("/me", [validateUpdateUser], UserController.updateUser);
router.put("/change-password", [validateChangePassword], UserController.changePassword);

export default router;
