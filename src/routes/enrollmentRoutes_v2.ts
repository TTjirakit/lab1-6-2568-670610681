import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv"
dotenv.config()

import { zStudentId, zEnrollmentBody } from "../libs/zodValidators.js";
import type { 
  User, 
  CustomRequest,
  Enrollment,
  Student,
} from "../libs/types.js"

import {
  students,
  enrollments,
  reset_enrollments,
  courses,
  users,
} from "../db/db.js"

import { authenticateToken } from "../middlewares/authenMiddleware.js";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminMiddleware.js";
import { checkRoleStudent } from "../middlewares/checkRoleStudentMiddleware.js"
import { checkAllRole } from "../middlewares/checkRoleAllMiddleware copy.js";

const router = Router();

//1.1
router.get("/", authenticateToken, checkRoleAdmin, (req: CustomRequest, res: Response) => {
  try {
    const allEnrollments = students.map((std) => {
      const courseList = enrollments
        .filter((en) => en.studentId === std.studentId)
        .map((item) => ({ courseId: item.courseId }));
      return { studentId: std.studentId, courses: courseList };
    });

    res.status(200).json({
      success: true,
      message: "Enrollments Infomation", 
      data: allEnrollments, 
    });

  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Something is wrong, please try again",
      error: err, 
    });
  }
});

//1.2
router.post("/reset",authenticateToken, checkRoleAdmin, (req: CustomRequest, res: Response) => {
  try {
    reset_enrollments();
    res.status(200).json({ 
      success: true,
      message: "Enrollments database has been reset",
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

//2.1 & 2.2
router.get("/:studentId", authenticateToken, checkAllRole, (req: CustomRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const parsed = zStudentId.safeParse(studentId);

    if (!parsed.success) {
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        error: parsed.error.issues[0]?.message, 
      });
    }

    const stdIndex = students.findIndex((s: Student) => s.studentId === studentId);
    if (stdIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Student does not exists",
      });
    }

    const userData = users.find((u: User) => u.username === req.user?.username);
    if (!userData) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (userData.role === "ADMIN" || (userData.role === "STUDENT" && userData.studentId === studentId)) {
      return res.status(200).json({
        success: true,
        message: "Student Information",
        data: students[stdIndex],
      });
    }

    return res.status(403).json({
      success: false,
      message: "Forbidden access",
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

//3.1
router.post("/:studentId", authenticateToken, checkRoleStudent, (req: CustomRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const body = req.body as Enrollment;

    const checkId = zStudentId.safeParse(studentId);
    const checkBody = zEnrollmentBody.safeParse(body);

    if (!checkId.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: checkId.error.issues[0]?.message,
      });
    }
    if (!checkBody.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: checkBody.error.issues[0]?.message,
      });
    }

    const std = users.find((u: User) => u.username === req.user?.username);
    if (std?.studentId !== body.studentId || std?.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden access",
      });
    }

    const exists = enrollments.find(
      (en) => en.studentId === body.studentId && en.courseId === body.courseId
    );

    if (exists) {
      return res.status(409).json({
        success: false,
        message: "studentId && courseId is already exists",
      });
    }

    enrollments.push(body);

    const studentIndex = students.findIndex((s) => s.studentId === studentId);
    if (studentIndex !== -1) {
      students[studentIndex]?.courses?.push(body.courseId);
    }

    return res.status(200).json({
      success: true,
      message: `Student ${studentId} && course ${body.courseId} has been added successfully`,
      data: body,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

//3.2
router.delete("/:studentId", authenticateToken, checkRoleStudent, (req: CustomRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const body = req.body as Enrollment;

    const parsedId = zStudentId.safeParse(studentId);
    const parsedBody = zEnrollmentBody.safeParse(body);

    if (!parsedId.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsedId.error.issues[0]?.message,
      });
    }
    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsedBody.error.issues[0]?.message,
      });
    }

    const currentUser = users.find((u: User) => u.username === req.user?.username);
    if (currentUser?.studentId !== studentId) {
      return res.status(403).json({
        success: false,
        message: "You are not allow to modify another student's data",
      });
    }

    const enrollIndex = enrollments.findIndex(
      (en) => en.studentId === studentId && en.courseId === body.courseId
    );

    if (enrollIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Enrollment does not exists",
      });
    }

    enrollments.splice(enrollIndex, 1);

    const stdIndex = students.findIndex((s) => s.studentId === studentId);
    if (stdIndex !== -1) {
      const cIndex = students[stdIndex]?.courses?.findIndex((c) => c === body.courseId) ?? -1;
      if (cIndex !== -1) {
        students[stdIndex]?.courses?.splice(cIndex, 1);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Student ${studentId} && Course ${body.courseId} has been deleted successfully`,
      data: enrollments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Something is wrong, please try again",
      error: err,
    });
  }
});

export default router;