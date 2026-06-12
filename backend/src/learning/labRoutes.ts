import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../auth/middleware.js";
import { aiEnabled, gradeWithClaude } from "../ai/claude.js";
import { buildGradingPrompt, parseGradingResponse, selfAssessmentFeedback } from "../ai/labGrader.js";

export const labRoutes = Router();

// Todas as rotas de labs exigem autenticação
labRoutes.use(requireAuth);

// GET /labs/:id → enunciado do lab (NÃO vaza a resposta-modelo)
labRoutes.get("/labs/:id", async (req, res) => {
  const lab = await prisma.lab.findUnique({
    where: { id: req.params.id },
    select: { id: true, title: true, promptMd: true, rubric: true },
  });
  if (!lab) return res.status(404).json({ error: "not found" });
  res.json(lab);
});

// GET /lessons/:id/labs → lista os labs de uma lição
labRoutes.get("/lessons/:id/labs", async (req, res) => {
  const labs = await prisma.lab.findMany({
    where: { lessonId: req.params.id },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(labs);
});

// POST /labs/:id/submit → corrige a submissão (IA quando habilitada; senão auto-avaliação).
// Nunca retorna 500 por causa da IA: qualquer falha cai no modo self.
const submitSchema = z.object({ submission: z.string() });
labRoutes.post("/labs/:id/submit", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid body" });

  const lab = await prisma.lab.findUnique({ where: { id: req.params.id } });
  if (!lab) return res.status(404).json({ error: "not found" });

  // agora que o aluno submeteu, a resposta-modelo pode ser revelada
  if (aiEnabled()) {
    try {
      const prompt = buildGradingPrompt(lab, parsed.data.submission);
      const text = await gradeWithClaude(prompt);
      const graded = parseGradingResponse(text);
      return res.json({
        mode: "ai",
        score: graded.score,
        passed: graded.passed,
        feedback: graded.feedback,
        rubric: lab.rubric,
        modelAnswer: lab.modelAnswer,
      });
    } catch (err) {
      // falha na chamada/parse da IA → cai na auto-avaliação (ainda 200)
      console.error("lab grading via Claude failed, falling back to self mode:", err);
    }
  }

  res.json({ ...selfAssessmentFeedback(lab), modelAnswer: lab.modelAnswer });
});
