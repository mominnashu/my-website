import { Router } from "express";
import authRoutes from "./auth.routes.js";
import brandRoutes from "./brand.routes.js";
import detectionRoutes from "./detection.routes.js";
import alertRoutes from "./alert.routes.js";
import caseRoutes from "./case.routes.js";
import systemRoutes from "./system.routes.js";

import workspaceRoutes from "./workspace.routes.js";
import billingRoutes from "./billing.routes.js";
import chatbotRoutes from "./chatbot.routes.js";
const apiRouter = Router();
apiRouter.use("/workspace", workspaceRoutes);
apiRouter.use("/billing", billingRoutes);
apiRouter.use("/chatbot", chatbotRoutes);

apiRouter.use("/auth", authRoutes);
apiRouter.use("/brands", brandRoutes);
apiRouter.use("/detections", detectionRoutes);
apiRouter.use("/alerts", alertRoutes);
apiRouter.use("/cases", caseRoutes);
apiRouter.use("/system", systemRoutes);

export default apiRouter;
