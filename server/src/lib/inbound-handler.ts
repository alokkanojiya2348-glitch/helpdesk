import prisma from "../db";
import { sendClassifyJob } from "./classify-ticket";
import { sendAutoResolveJob } from "./auto-resolve-ticket";
import { AI_AGENT_ID } from "core/constants/ai-agent.ts";
import Sentry from "./sentry";

export function stripSubjectPrefixes(subject: string): string {
  return subject.replace(/^(Re:\s*|Fwd:\s*)+/i, "").trim();
}

export function parseFromField(from: string): { email: string; name: string } {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1]!.trim() || match[2]!, email: match[2]! };
  }
  return { name: from, email: from };
}

export interface InboundEmailPayload {
  from: string;
  fromName?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
}

export async function processInboundEmail(data: InboundEmailPayload) {
  const normalizedSubject = stripSubjectPrefixes(data.subject);

  // Check for existing open ticket from same sender with matching subject
  const existingTicket = await prisma.ticket.findFirst({
    where: {
      senderEmail: data.from,
      status: { notIn: ["resolved", "closed"] },
      subject: { equals: normalizedSubject, mode: "insensitive" },
    },
  });

  if (existingTicket) {
    const reply = await prisma.reply.create({
      data: {
        body: data.body || "(No message body)",
        bodyHtml: data.bodyHtml ?? null,
        senderType: "customer",
        ticketId: existingTicket.id,
        userId: null,
      },
    });
    console.log(`[Inbound] Added customer reply to Ticket #${existingTicket.id} ("${normalizedSubject}") from ${data.from}`);
    return { action: "reply" as const, ticket: existingTicket, reply };
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject: normalizedSubject || "No Subject",
      body: data.body || "(No message body)",
      bodyHtml: data.bodyHtml ?? null,
      senderName: data.fromName || data.from,
      senderEmail: data.from,
      assignedToId: AI_AGENT_ID,
    },
  });

  console.log(`[Inbound] Created new Ticket #${ticket.id}: "${normalizedSubject}" from ${data.from}`);

  sendClassifyJob(ticket).catch((error) => {
    Sentry.captureException(error, { tags: { step: "enqueue-classify", ticketId: ticket.id } });
    console.error(`Failed to enqueue classify job for ticket ${ticket.id}:`, error);
  });

  sendAutoResolveJob(ticket).catch((error) => {
    Sentry.captureException(error, { tags: { step: "enqueue-auto-resolve", ticketId: ticket.id } });
    console.error(`Failed to enqueue auto-resolve job for ticket ${ticket.id}:`, error);
  });

  return { action: "ticket" as const, ticket };
}
