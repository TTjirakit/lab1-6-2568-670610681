import { Router, type Request, type Response } from "express";
import { DB, reset_enrollments } from "../db/db.js"; 
import type { Student } from "../libs/types.js";

const router = Router();

function isAdmin(req: any) {
  return req.user?.role === "ADMIN";
}

function isStudent(req: any) {
  return req.user?.role === "STUDENT";
}

//1.1
router.get("/", (req: any, res: Response) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Only ADMIN can access this resource" });
  }
  res.json(DB.students);
});

//1.2
router.post("/reset", (req: any, res: Response) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ message: "Only ADMIN can reset enrollments" });
  }
  reset_enrollments();
  res.json({ message: "Enrollments reset to default" });
});

//2.1 & 2.2
router.get("/:studentId", (req: any, res: Response) => {
  const { studentId } = req.params;
  const student = DB.students.find((s: Student) => s.studentId === studentId);

  if (!student) return res.status(404).json({ message: "Student not found" });

  if (isAdmin(req) || (isStudent(req) && req.user.studentId === studentId)) {
    return res.json(student);
  }

  return res.status(403).json({ message: "Permission denied" });
});

//3.1
router.post("/:studentId", (req: any, res: Response) => {
  const { studentId } = req.params;
  const { courseId } = req.body;
  const student = DB.students.find((s: Student) => s.studentId === studentId);

  if (!student) return res.status(404).json({ message: "Student not found" });

  if (!isStudent(req) || req.user.studentId !== studentId) {
    return res.status(403).json({ message: "Only the student can add enrollment" });
  }

  if (student.courses?.includes(courseId)) {
    return res.status(400).json({ message: "Course already enrolled" });
  }

  student.courses = student.courses ? [...student.courses, courseId] : [courseId];
  res.json({ message: "Course added successfully", student });
});

//3.2
router.delete("/:studentId", (req: any, res: Response) => {
  const { studentId } = req.params;
  const { courseId } = req.body;
  const student = DB.students.find((s: Student) => s.studentId === studentId);

  if (!student) return res.status(404).json({ message: "Student not found" });

  if (!isStudent(req) || req.user.studentId !== studentId) {
    return res.status(403).json({ message: "Only the student can drop enrollment" });
  }

  if (!student.courses?.includes(courseId)) {
    return res.status(400).json({ message: "Course not found in enrollment" });
  }

  student.courses = student.courses.filter((c: string) => c !== courseId);
  res.json({ message: "Course dropped successfully", student });
});

export default router;