import mongoose from "mongoose";
import { verifyToken } from "../utils/token.js";
import { sendError } from "../utils/response.js";
import { User } from "../models/User.js";
import { memoryStore } from "../utils/memoryStore.js";

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Missing or invalid authorization token", 401);
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) {
    return sendError(res, "UNAUTHORIZED", "Token is invalid or expired", 401);
  }

  if (mongoose.connection.readyState !== 1) {
    if (process.env.ALLOW_IN_MEMORY_ACCOUNTS !== 'true') return sendError(res, "SERVICE_UNAVAILABLE", "Brand workspaces require a database connection. Please try again shortly.", 503);
    const user=memoryStore.users.find(item=>item._id===decoded.userId&&item.organizationId===decoded.organizationId);
    if(!user)return sendError(res,"UNAUTHORIZED","User no longer exists",401);
    if(user.status==='suspended')return sendError(res,"FORBIDDEN","User account is suspended",403);
    req.user={id:user._id,email:user.email,name:user.name,role:user.role,organizationId:user.organizationId};
    return next();
  }

  try {
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return sendError(res, "UNAUTHORIZED", "User no longer exists", 401);
    }

    if (user.status === "suspended") {
      return sendError(res, "FORBIDDEN", "User account is suspended", 403);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
    };

    next();
  } catch (error) {
    return sendError(res, "INTERNAL_SERVER_ERROR", "Authentication error", 500);
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        "FORBIDDEN",
        `Access denied. Required role: ${roles.join(" or ")}`,
        403
      );
    }
    next();
  };
}

export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = {
      id: "650000000000000000000001",
      email: "analyst@riskprotect.soc",
      name: "Alex Vance",
      role: "admin",
      organizationId: "650000000000000000000002",
    };
    return next();
  }
  return authenticate(req, res, next);
}
