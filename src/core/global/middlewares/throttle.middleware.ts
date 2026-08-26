import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const throttleMiddleware = (limit = 60, timeFrameInMinutes = 1) => {
  return rateLimit({
    windowMs: timeFrameInMinutes * 60 * 1000,
    max: limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as any).jwtPayload?.id || ipKeyGenerator(req.ip || "unknown"),
    message: {
      status: 429,
      message: "Too many requests from this IP, please try again after few minutes",
    },
  });
};
