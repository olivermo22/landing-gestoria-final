
const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configurar sesiones en memoria (válidas mientras el navegador esté abierto)
app.use(session({
  secret: 'gestoria_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: null // Se borra cuando se cierra el navegador
  }
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/message', async (req, res) => {
  try {
    const userMessage = req.body.message;

    // Si no hay thread asociado a la sesión, crear uno nuevo
    if (!req.session.threadId) {
      const thread = await openai.beta.threads.create();
      req.session.threadId = thread.id;
      console.log('Nuevo thread para sesión:', req.session.threadId);
    }

    // Añadir mensaje del usuario al thread
    await openai.beta.threads.messages.create(req.session.threadId, {
      role: "user",
      content: userMessage,
    });

    // Ejecutar el asistente
    const run = await openai.beta.threads.runs.create(req.session.threadId, {
      assistant_id: "asst_zW2PFxbqvj7MmHRjff65zZfo"
    });

    // Esperar a que termine la ejecución
    let completed = false;
    let replyText = '...';
    while (!completed) {
      const runStatus = await openai.beta.threads.runs.retrieve(req.session.threadId, run.id);
      if (runStatus.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(req.session.threadId);
        const lastMessage = messages.data.find(m => m.role === 'assistant');
        replyText = lastMessage ? lastMessage.content[0].text.value : 'Sin respuesta';
        completed = true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    res.json({ reply: replyText });

  } catch (error) {
    console.error('Error en /api/message:', error);
    res.status(500).json({ error: 'Error procesando el mensaje' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
