import { Router } from "express";

import UserController from "../controller/user.controller";
import { validateChangePassword, validateUpdateUser } from "../validations/user.validations";

const router: Router = Router();

router.get("/me", UserController.me);
router.put("/me", [validateUpdateUser], UserController.updateUser);
router.put("/change-password", [validateChangePassword], UserController.changePassword);

export default router;
