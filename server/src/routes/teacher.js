import { Router } from "express";
import { prisma } from "../db.js";
import { handleErr } from "../handleErr.js";

// server/src/app.js'de requireAuth + requireRole("TEACHER") ile mount edilir.
export const teacherRouter = Router();

teacherRouter.get("/students", async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { teacherId: req.userId, role: "STUDENT" },
      select: { id: true, name: true, email: true, className: true, gradeLevel: true, banned: true },
      orderBy: { name: "asc" },
    });
    res.json({ students });
  } catch (e) {
    handleErr(res, e);
  }
});
