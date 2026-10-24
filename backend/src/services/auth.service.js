import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";
import { generateToken } from "../utils/token.js";
import { memoryStore } from "../utils/memoryStore.js";
import { v4 as uuidv4 } from "uuid";
import { getPlan, recommendedPlanId, subscriptionFor } from "./billing.service.js";
import { AuditLog } from "../models/AuditLog.js";

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

export const authService = {
  async register({ email, password, name, organizationName, audience = "brand", planId, billingCycle = "monthly" }) {
    if (mongoose.connection.readyState !== 1) throw Object.assign(new Error("Company accounts require a database connection. Please try again shortly."), { statusCode: 503 });
    if (mongoose.connection.readyState !== 1) {
      const existing = memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        const error = new Error("A user with this email address already exists");
        error.statusCode = 409;
        throw error;
      }

      const orgId = "org-" + uuidv4().slice(0, 8);
      const orgName = organizationName || `${name.split(" ")[0]}'s Org`;
      const org = {
        _id: orgId,
        name: orgName,
        slug: slugify(orgName),
        status: "active",
      };
      memoryStore.organizations.push(org);

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = "user-" + uuidv4().slice(0, 8);
      const user = {
        _id: userId,
        email: email.toLowerCase(),
        passwordHash,
        name,
        role: "admin",
        organizationId: orgId,
        status: "active",
        createdAt: new Date(),
      };
      memoryStore.users.push(user);

      const token = generateToken({
        userId,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: orgId,
      });

      return {
        token,
        user: {
          id: userId,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: orgId,
          organizationName: org.name,
          audience: audience || "organization",
        },
      };
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      const error = new Error("A user with this email address already exists");
      error.statusCode = 409;
      error.code = "EMAIL_ALREADY_EXISTS";
      throw error;
    }

    const defaultPlanId = recommendedPlanId(audience);
    const selectedPlan = getPlan(planId || defaultPlanId);
    if (!selectedPlan || selectedPlan.audience !== audience) {
      const error = new Error("Choose a plan available for your account type"); error.statusCode = 400; throw error;
    }
    const orgName = organizationName || `${name.split(" ")[0]}'s Brand`;
    let baseSlug = slugify(orgName);
    let slug = baseSlug;
    let count = 1;
    while (await Organization.findOne({ slug })) {
      slug = `${baseSlug}-${count++}`;
    }

    const organization = await Organization.create({
      name: orgName,
      slug,
      status: "active",
      audience,
      subscription: subscriptionFor(selectedPlan, new Date(), billingCycle),
    });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name,
      role: "admin",
      organizationId: organization._id,
      status: "active",
    });

    organization.createdBy = user._id;
    await organization.save();
    await AuditLog.create({ organizationId: organization._id, actorId: user._id, action: "USER_REGISTER", resourceType: "User", resourceId: user._id.toString(), details: { audience, planId: selectedPlan.id, billingCycle: organization.subscription.billingCycle } });

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: organization._id.toString(),
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: organization._id.toString(),
        organizationName: organization.name,
        brandId: organization._id.toString(),
        brandName: organization.name,
        audience: "brand",
      },
    };
  },

  async login({ email, password }) {
    if (mongoose.connection.readyState !== 1) throw Object.assign(new Error("Company accounts require a database connection. Please try again shortly."), { statusCode: 503 });
    if (mongoose.connection.readyState !== 1) {
      const user = memoryStore.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        const error = new Error("Invalid email or password");
        error.statusCode = 401;
        throw error;
      }

      const org = memoryStore.organizations.find((o) => o._id === user.organizationId);

      const token = generateToken({
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      });

      return {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: org ? org.name : "CyberDefense Corp",
          audience: org?.audience || "organization",
        },
      };
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    if (user.status === "suspended") {
      const error = new Error("This account is currently suspended");
      error.statusCode = 403;
      error.code = "ACCOUNT_SUSPENDED";
      throw error;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const error = new Error("Invalid email or password");
      error.statusCode = 401;
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const org = await Organization.findById(user.organizationId);

    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId.toString(),
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId.toString(),
        organizationName: org ? org.name : "Brand",
        brandId: user.organizationId.toString(),
        brandName: org ? org.name : "Brand",
        audience: "brand",
      },
    };
  },

  async getCurrentUser(userId) {
    if (mongoose.connection.readyState !== 1) {
      const user = memoryStore.users.find((u) => u._id === userId);
      if (!user) {
        return {
          id: userId,
          email: "analyst@riskprotect.soc",
          name: "Alex Vance",
          role: "admin",
          organizationId: "demo-org-1",
          organizationName: "CyberDefense Corp",
        };
      }
      const org = memoryStore.organizations.find((o) => o._id === user.organizationId);
      return {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: org ? org.name : "CyberDefense Corp",
      };
    }

    const user = await User.findById(userId).select("-passwordHash");
    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 404;
      error.code = "USER_NOT_FOUND";
      throw error;
    }
    const org = await Organization.findById(user.organizationId);
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId ? user.organizationId.toString() : null,
      organizationName: org ? org.name : null,
      brandId: user.organizationId ? user.organizationId.toString() : null,
      brandName: org ? org.name : null,
      audience: "brand",
      createdAt: user.createdAt,
    };
  },
};
