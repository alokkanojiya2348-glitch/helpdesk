import express from 'express';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5555;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/helpdesk',
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Get database statistics & table counts
app.get('/api/stats', async (req, res) => {
  try {
    const [tickets, users, replies, sessions, accounts] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as count FROM public.ticket').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM public.user').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM public.reply').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM public.session').catch(() => ({ rows: [{ count: 0 }] })),
      pool.query('SELECT COUNT(*)::int as count FROM public.account').catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    res.json({
      connected: true,
      counts: {
        ticket: tickets.rows[0].count,
        user: users.rows[0].count,
        reply: replies.rows[0].count,
        session: sessions.rows[0].count,
        account: accounts.rows[0].count,
      },
    });
  } catch (err: any) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// 2. Fetch records from a specific table
app.get('/api/table/:name', async (req, res) => {
  const allowed = ['ticket', 'user', 'reply', 'session', 'account'];
  const tableName = req.params.name.toLowerCase();

  if (!allowed.includes(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    const result = await pool.query(`SELECT * FROM public."${tableName}" ORDER BY 1 DESC LIMIT 100`);
    res.json({
      table: tableName,
      count: result.rows.length,
      fields: result.fields.map((f) => f.name),
      rows: result.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Execute custom SQL query (Console / Runner)
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'SQL query string required' });
  }

  const startTime = Date.now();
  try {
    const result = await pool.query(sql);
    const duration = Date.now() - startTime;

    res.json({
      success: true,
      durationMs: duration,
      rowCount: result.rowCount ?? result.rows.length,
      command: result.command,
      fields: result.fields?.map((f) => f.name) || [],
      rows: result.rows,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`⚡ Helpdesk Database Studio running on http://localhost:${PORT}`);
});
