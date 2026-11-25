import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import { validate } from "../lib/validate";
import { parseId } from "../lib/parse-id";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createReplySchema, polishReplySchema } from "core/schemas/replies.ts";
import prisma from "../db";
import { sendEmailJob } from "../lib/send-email";
import Sentry from "../lib/sentry";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });

  res.json({ replies });
});

router.post("/", requireAuth, async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const data = validate(createReplySchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const reply = await prisma.reply.create({
    data: {
      body: data.body,
      senderType: "agent",
      ticketId,
      userId: req.user.id,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await sendEmailJob({
    to: ticket.senderEmail,
    subject: `Re: ${ticket.subject}`,
    body: data.body,
  });

  res.status(201).json(reply);
});

router.post("/summarize", requireAuth, async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    if (process.env.MOCK_AI === "true") {
      res.json({
        summary: `Customer ${ticket.senderName} inquired about "${ticket.subject}". The support team has responded and the ticket is currently being handled.`,
      });
      return;
    }
    res.status(400).json({
      error: "OpenAI API key is missing. Please set OPENAI_API_KEY in server/.env to use AI Summarize.",
    });
    return;
  }

  const replies = await prisma.reply.findMany({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });

  const conversation = replies
    .map((r) => {
      const sender =
        r.senderType === "agent" ? (r.user?.name ?? "Agent") : ticket.senderName;
      return `${sender}: ${r.body}`;
    })
    .join("\n\n");

  const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const { text } = await generateText({
      model: openai(modelName),
      system:
        "You are a helpful assistant that summarizes support ticket conversations. " +
        "Provide a clear, concise summary that captures the customer's issue, any actions taken, and the current status. " +
        "Keep the summary to 2-4 sentences. Return only the summary with no preamble.",
      prompt:
        `Subject: ${ticket.subject}\n\n` +
        `Customer message:\n${ticket.body}\n\n` +
        (conversation ? `Conversation:\n${conversation}` : "No replies yet."),
    });

    res.json({ summary: text });
  } catch (error: any) {
    Sentry.captureException(error, { tags: { route: "replies", action: "summarize", ticketId } });
    console.error("Failed to generate summary:", error);
    res.status(500).json({
      error: error?.message || "Failed to generate summary with AI",
    });
  }
});

router.post("/polish", requireAuth, async (req, res) => {
  const ticketId = parseId(req.params.ticketId);
  if (!ticketId) {
    res.status(400).json({ error: "Invalid ticket ID" });
    return;
  }

  const data = validate(polishReplySchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const agentName = req.user.name;
  const customerName = ticket.senderName.split(" ")[0];

  if (!process.env.OPENAI_API_KEY) {
    if (process.env.MOCK_AI === "true") {
      const polishedFallback = `Hi ${customerName},\n\nThank you for reaching out. ${data.body.trim()}\n\nBest regards,\n${agentName}`;
      res.json({ body: polishedFallback });
      return;
    }
    res.status(400).json({
      error: "OpenAI API key is missing. Please set OPENAI_API_KEY in server/.env to use Polish.",
    });
    return;
  }

  const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const { text } = await generateText({
      model: openai(modelName),
      system:
        "You are a helpful writing assistant for a customer support team. " +
        "Improve the given reply for clarity, professional tone, and grammar. " +
        "Preserve the original meaning and keep the response concise. " +
        "Return only the improved text with no preamble or explanation. " +
        `Address the customer by their name: ${customerName}. ` +
        `End the reply with a sign-off using the agent's name: ${agentName}.`,
      prompt: data.body,
    });

    res.json({ body: text });
  } catch (error: any) {
    Sentry.captureException(error, { tags: { route: "replies", action: "polish", ticketId } });
    console.error("Failed to polish reply:", error);
    res.status(500).json({
      error: error?.message || "Failed to polish reply with AI",
    });
  }
});

export default router;
