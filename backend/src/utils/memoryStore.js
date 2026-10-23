import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { generateToken } from "./token.js";

// In-Memory store for degraded database mode
export const memoryStore = {
  users: [
    {
      _id: "demo-analyst-1",
      email: "analyst@riskprotect.soc",
      name: "Alex Vance",
      role: "admin",
      organizationId: "demo-org-1",
      status: "active",
      passwordHash: bcrypt.hashSync("ThreatGuard#2026", 10),
      createdAt: new Date(),
    },
  ],
  organizations: [
    {
      _id: "demo-org-1",
      name: "CyberDefense Corp",
      slug: "cyberdefense-corp",
      status: "active",
      createdAt: new Date(),
    },
  ],
  brands: [
    {
      _id: "demo-brand-1",
      organizationId: "demo-org-1",
      name: "Apex Bank",
      description: "Tier-1 Retail and Digital Banking Platform",
      officialDomains: ["apexbank.com", "portal.apexbank.com"],
      officialSocialHandles: [
        { platform: "instagram", handle: "apexbank", verified: true },
        { platform: "facebook", handle: "ApexBankOfficial", verified: true },
      ],
      officialAppPackages: ["com.apexbank.mobile", "com.apexbank.auth"],
      officialDevelopers: ["Apex Bank NA"],
      status: "active",
      createdAt: new Date(),
    },
  ],
  detections: [],
  alerts: [],
  cases: [],
};
