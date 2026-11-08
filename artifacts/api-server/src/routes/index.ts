import { Router, type IRouter } from "express";
import healthRouter from "./health";
import growthEngineRouter from "./growth-engine";

const router: IRouter = Router();

router.use(healthRouter);
router.use(growthEngineRouter);

export default router;
