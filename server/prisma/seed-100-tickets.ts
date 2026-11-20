import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TicketStatus, TicketCategory, SenderType } from "../src/generated/prisma/client";
import { AI_AGENT_ID } from "core/constants/ai-agent.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SENDER_NAMES = [
  "Alice Johnson", "Marcus Chen", "Sarah Williams", "David Miller", "Elena Rostova",
  "James Wilson", "Priya Sharma", "Carlos Rodriguez", "Amina Yusuf", "Liam O'Connor",
  "Mei-Ling Wang", "Alexander Wright", "Chloe Dubois", "Vikram Malhotra", "Fatima Al-Mansoor",
  "Oliver Smith", "Ananya Deshmukh", "Lucas Silva", "Hanna Becker", "Tariq Aziz",
  "Emily Davis", "Kenji Sato", "Nadia Petrova", "Gabriel Santos", "Zoe Taylor"
];

const SUBJECTS_TECHNICAL = [
  "App crashes when uploading large files",
  "Two-factor authentication not sending SMS",
  "Video player buffering on Chapter 4",
  "API Rate Limit exceeded during batch webhook testing",
  "WebSocket connection drops randomly every 5 minutes",
  "Dark mode toggle flickers on Safari browser",
  "Database connection pool exhausted during peak hours",
  "Push notifications delayed on iOS 18",
  "Export to CSV fails when records exceed 10,000",
  "Docker container memory leak in background worker",
  "CSS styles not loading properly behind Cloudflare proxy",
  "GraphQL query returns 500 error for nested relations",
  "OAuth redirect URI mismatch in production environment",
  "Session invalidated immediately after browser restart",
  "Page scroll locks up when modal closes",
  "Cannot upload profile picture larger than 2MB",
  "Search filter resets when navigating to page 2",
  "Audio stream cutting out on mobile app",
  "SSL certificate warning on custom domain",
  "Form validation error message not clearing after fix"
];

const SUBJECTS_REFUND = [
  "Refund request for duplicate course purchase",
  "Accidental subscription renewal charge",
  "Charged twice for the Annual Pro plan",
  "Course content does not match syllabus description - refund request",
  "Requesting refund within the 30-day money-back guarantee window",
  "Payment debited from bank account but subscription not activated",
  "Duplicate invoice generated for team license",
  "Student discount was not applied during checkout",
  "Credit card charged after subscription cancellation",
  "Coupon code expired error during checkout - need difference refund"
];

const SUBJECTS_GENERAL = [
  "Inquiry about Enterprise Team License & Invoice",
  "Certificate of Completion spelling correction",
  "Question about course prerequisites and roadmap",
  "Can I transfer my course license to another email address?",
  "Requesting VAT / GST invoice with company tax registration",
  "Do you offer discounts for educational institutions?",
  "How to change my primary account email address?",
  "Requesting permission to use course materials for internal team training",
  "Inquiry about upcoming React 19 and Next.js course updates",
  "How to download video lessons for offline viewing?"
];

async function seed() {
  console.log("Starting full 100-ticket database seed...");

  // 1. Clean existing replies and tickets
  await prisma.reply.deleteMany({});
  await prisma.ticket.deleteMany({});

  const admin = await prisma.user.findFirst({
    where: { email: process.env.SEED_ADMIN_EMAIL || "admin@example.com" },
  });
  const adminId = admin?.id || null;

  const now = new Date();
  const subDays = (d: number, h: number = 0) => new Date(now.getTime() - (d * 24 + h) * 3600 * 1000);

  // We want exactly 100 tickets
  const ticketsData: any[] = [];

  // Ticket 1 (Alice Johnson - exact match to user's screenshot)
  ticketsData.push({
    subject: "App crashes when uploading large files",
    body: "Whenever I try to upload a file larger than 50 MB the app crashes with an out-of-memory error.",
    bodyHtml: "<p>Whenever I try to upload a file larger than 50 MB the app crashes with an out-of-memory error.</p>",
    status: TicketStatus.open,
    category: TicketCategory.technical_question,
    senderName: "Alice Johnson",
    senderEmail: "alice.johnson@example.com",
    assignedToId: adminId,
    createdAt: subDays(1, 2),
    updatedAt: subDays(1, 1),
  });

  // Ticket 2 (Marcus Chen - exact match to user's screenshot)
  ticketsData.push({
    subject: "Two-factor authentication not sending SMS",
    body: "I enabled 2FA but I never receive the SMS code. I've tried multiple times.",
    bodyHtml: "<p>I enabled 2FA but I never receive the SMS code. I've tried multiple times.</p>",
    status: TicketStatus.open,
    category: TicketCategory.technical_question,
    senderName: "Marcus Chen",
    senderEmail: "marcus.chen@techcorp.io",
    assignedToId: null,
    createdAt: subDays(1, 5),
    updatedAt: subDays(1, 4),
  });

  // Now generate remaining 98 tickets distributed across last 28 days
  const statuses = [
    TicketStatus.open, TicketStatus.open, TicketStatus.open, TicketStatus.open,
    TicketStatus.resolved, TicketStatus.resolved, TicketStatus.resolved,
    TicketStatus.closed,
    TicketStatus.new,
    TicketStatus.processing,
  ];

  for (let i = 3; i <= 100; i++) {
    const sender = SENDER_NAMES[i % SENDER_NAMES.length];
    const emailDomain = sender.toLowerCase().includes("tech") || i % 3 === 0 ? "corp.com" : "example.com";
    const senderEmail = `${sender.toLowerCase().replace(/[^a-z]/g, "")}@${emailDomain}`;

    const typeRoll = i % 3;
    let subject = "";
    let category = TicketCategory.technical_question;
    let body = "";

    if (typeRoll === 0) {
      subject = SUBJECTS_TECHNICAL[i % SUBJECTS_TECHNICAL.length] + (i > 30 ? ` (#${i})` : "");
      category = TicketCategory.technical_question;
      body = `Hello support, we encountered an issue: ${subject.toLowerCase()}. Could you please investigate this promptly?`;
    } else if (typeRoll === 1) {
      subject = SUBJECTS_REFUND[i % SUBJECTS_REFUND.length] + (i > 30 ? ` (#${i})` : "");
      category = TicketCategory.refund_request;
      body = `Hi billing team, I am writing regarding: ${subject.toLowerCase()}. Please check the billing records and update me.`;
    } else {
      subject = SUBJECTS_GENERAL[i % SUBJECTS_GENERAL.length] + (i > 30 ? ` (#${i})` : "");
      category = TicketCategory.general_question;
      body = `Greetings, I have a quick question: ${subject.toLowerCase()}. Thanks for your assistance!`;
    }

    // Distribute across last 28 days (roughly 3-4 per day)
    const dayAgo = Math.floor((i - 3) / 3.5); // 0 to 27 days ago
    const hourAgo = (i * 7) % 20;
    const createdAt = subDays(dayAgo, hourAgo);

    const status = statuses[i % statuses.length];
    let assignedToId: string | null = null;
    let updatedAt = createdAt;

    if (status === TicketStatus.resolved) {
      // Half resolved by AI, half by Admin
      if (i % 2 === 0) {
        assignedToId = AI_AGENT_ID;
      } else {
        assignedToId = adminId;
      }
      // Resolved 1 to 4 hours after creation
      updatedAt = new Date(createdAt.getTime() + ((i % 4) + 1) * 3600 * 1000);
    } else if (status === TicketStatus.open) {
      assignedToId = (i % 2 === 0) ? adminId : null;
    } else if (status === TicketStatus.closed) {
      assignedToId = adminId;
      updatedAt = new Date(createdAt.getTime() + 12 * 3600 * 1000);
    }

    ticketsData.push({
      subject,
      body,
      bodyHtml: `<p>${body}</p>`,
      status,
      category,
      senderName: sender,
      senderEmail,
      assignedToId,
      createdAt,
      updatedAt,
    });
  }

  // Insert all 100 tickets
  console.log(`Inserting ${ticketsData.length} tickets...`);
  const createdTickets = [];
  for (const t of ticketsData) {
    const item = await prisma.ticket.create({ data: t });
    createdTickets.push(item);
  }

  console.log(`Created ${createdTickets.length} tickets successfully!`);

  // Now seed 20-25 realistic replies
  console.log("Seeding thread replies...");
  const replySamples = [
    {
      body: "Thank you for reaching out! We are currently looking into the error logs for your upload issue.",
      senderType: SenderType.agent,
      userId: adminId,
    },
    {
      body: "I've uploaded a sample 60MB MP4 file to test on my end. It gave HTTP 413 Payload Too Large.",
      senderType: SenderType.customer,
      userId: null,
    },
    {
      body: "We have increased the server upload limit to 100MB and deployed the fix. Please try again!",
      senderType: SenderType.agent,
      userId: adminId,
    },
    {
      body: "Hello! Our automated AI assistant has verified your email address and triggered a fresh 2FA SMS code to your registered number.",
      senderType: SenderType.agent,
      userId: AI_AGENT_ID,
    },
    {
      body: "Got the SMS code now! Successfully logged in. Thank you for the quick resolution!",
      senderType: SenderType.customer,
      userId: null,
    },
    {
      body: "Your duplicate transaction has been refunded back to your original payment method. Please allow 3-5 business days for it to reflect.",
      senderType: SenderType.agent,
      userId: adminId,
    },
    {
      body: "Hi team, any update on our enterprise SAML SSO setup request?",
      senderType: SenderType.customer,
      userId: null,
    },
    {
      body: "Our enterprise solutions team will reach out to you directly with the contract and onboarding schedule.",
      senderType: SenderType.agent,
      userId: adminId,
    }
  ];

  for (let r = 0; r < 20; r++) {
    const targetTicket = createdTickets[r % 10]; // distribute on the first 10 tickets
    const sample = replySamples[r % replySamples.length];

    await prisma.reply.create({
      data: {
        ticketId: targetTicket.id,
        body: sample.body,
        bodyHtml: `<p>${sample.body}</p>`,
        senderType: sample.senderType,
        userId: sample.userId,
        createdAt: new Date(targetTicket.createdAt.getTime() + (r + 1) * 1800 * 1000),
      }
    });
  }

  console.log("Seeded 20 replies successfully!");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
