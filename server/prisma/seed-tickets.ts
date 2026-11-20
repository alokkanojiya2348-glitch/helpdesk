import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TicketStatus, TicketCategory, SenderType } from "../src/generated/prisma/client";
import { AI_AGENT_ID } from "core/constants/ai-agent.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding sample tickets and analytics data...");

  // Clear any partial tickets first
  await prisma.reply.deleteMany({});
  await prisma.ticket.deleteMany({});

  const admin = await prisma.user.findFirst({
    where: { email: process.env.SEED_ADMIN_EMAIL || "admin@example.com" },
  });

  const now = new Date();
  const subDays = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const sampleTickets = [
    {
      subject: "Refund request for duplicate course purchase",
      body: "Hi support team, I accidentally purchased the Full-Stack Developer bundle twice on my credit card. Could you please process a refund for the duplicate transaction?",
      status: TicketStatus.open,
      category: TicketCategory.refund_request,
      senderName: "Rahul Sharma",
      senderEmail: "rahul.sharma@example.com",
      assignedToId: admin?.id,
      createdAt: subDays(1),
    },
    {
      subject: "Login issue with Two-Factor Authentication (2FA)",
      body: "Hello, I am not receiving the 6-digit SMS verification code on my registered mobile number (+91 98765 43210). Please help me regain access.",
      status: TicketStatus.new,
      category: TicketCategory.technical_question,
      senderName: "Sneha Patel",
      senderEmail: "sneha.p@outlook.com",
      assignedToId: null,
      createdAt: subDays(2),
    },
    {
      subject: "Inquiry about Enterprise Team License & Invoice",
      body: "We have an engineering team of 35 developers and would like to know about corporate billing, GST invoices, and SAML SSO integration.",
      status: TicketStatus.resolved,
      category: TicketCategory.general_question,
      senderName: "Vikram Malhotra",
      senderEmail: "vikram@techcorp.io",
      assignedToId: admin?.id,
      createdAt: subDays(4),
    },
    {
      subject: "Video player buffering on Chapter 4 (Docker Networking)",
      body: "The video keeps buffering and stops playback around the 04:15 mark in Chapter 4. I tried clearing browser cache and using Chrome Incognito, but the problem persists.",
      status: TicketStatus.processing,
      category: TicketCategory.technical_question,
      senderName: "Amit Verma",
      senderEmail: "amit.verma@yahoo.com",
      assignedToId: AI_AGENT_ID,
      createdAt: subDays(5),
    },
    {
      subject: "Certificate of Completion spelling correction",
      body: "My certificate was issued with 'Pooja Redy' instead of 'Pooja Reddy'. Could you please re-issue the certificate with the corrected spelling?",
      status: TicketStatus.resolved,
      category: TicketCategory.general_question,
      senderName: "Pooja Reddy",
      senderEmail: "pooja.reddy@gmail.com",
      assignedToId: AI_AGENT_ID,
      createdAt: subDays(7),
    },
    {
      subject: "API Rate Limit exceeded during batch webhook testing",
      body: "We are getting 429 Too Many Requests when stress-testing our inbound webhooks. Can our organization get a temporary rate limit tier increase?",
      status: TicketStatus.open,
      category: TicketCategory.technical_question,
      senderName: "Kunal Mehta",
      senderEmail: "kunal@innovate.dev",
      assignedToId: admin?.id,
      createdAt: subDays(3),
    },
  ];

  for (const t of sampleTickets) {
    const createdTicket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        body: t.body,
        bodyHtml: `<p>${t.body}</p>`,
        status: t.status,
        category: t.category,
        senderName: t.senderName,
        senderEmail: t.senderEmail,
        assignedToId: t.assignedToId,
        createdAt: t.createdAt,
        updatedAt: t.createdAt,
      },
    });

    // Customer initial inquiry reply
    await prisma.reply.create({
      data: {
        ticketId: createdTicket.id,
        body: t.body,
        bodyHtml: `<p>${t.body}</p>`,
        senderType: SenderType.customer,
        createdAt: t.createdAt,
      },
    });

    // Agent / AI reply for resolved tickets
    if (t.status === TicketStatus.resolved) {
      await prisma.reply.create({
        data: {
          ticketId: createdTicket.id,
          body: "Hello! We have reviewed your request and resolved the issue. Please check your email for the confirmation details.",
          bodyHtml: "<p>Hello! We have reviewed your request and resolved the issue. Please check your email for the confirmation details.</p>",
          senderType: SenderType.agent,
          userId: t.assignedToId || admin?.id || null,
          createdAt: new Date(t.createdAt.getTime() + 2 * 60 * 60 * 1000), // 2 hours later
        },
      });
    }
  }

  console.log("Successfully seeded 6 realistic tickets with full reply threads and analytics!");
}

main()
  .catch((e) => {
    console.error("Error seeding sample tickets:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
