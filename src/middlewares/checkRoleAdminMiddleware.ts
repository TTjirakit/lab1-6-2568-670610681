import { type Request, type Response, type NextFunction } from "express";
import { type CustomRequest, type User } from "../libs/types.js";
import { users } from "../db/db.js";

export const checkRoleAdmin = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const payload = req.user;
  const token = req.token;

  const user = users.find((u: User) => u.username === payload?.username);
  if (!user || user.role !== "ADMIN") {
    return res.status(401).json({
      success: false,
      message: "Unauthorized user",
    });
  }
  
  next();
};