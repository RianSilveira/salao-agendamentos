require('dotenv').config();
const express   = require('express');
const mongoose  = require('mongoose');
const cron      = require('node-cron');
const path      = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode    = require('qrcode-terminal');

const Agendamento  = require('./models/Agendamento');
const Procedimento = require('./models/Procedimento');

const app  = express();
const PORT = process.env.PORT || 3000;

// WhatsApp setup
const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] }
});
let clientReady = false;
whatsappClient.on('qr', qr => qrcode.generate(qr,{ small:true }));
whatsappClient.on('ready', () => clientReady = true);
whatsappClient.on('auth_failure', () => clientReady = false);
whatsappClient.on('disconnected', ()    => clientReady = false);
whatsappClient.initialize();

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB conectado'))
.catch(err => console.error('Erro MongoDB:', err));

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas de Procedimentos
app.get('/procedimentos', async (req, res) => {
  try {
    const list = await Procedimento.find().sort('nome');
    res.json(list);
  } catch {
    res.status(500).json({ error:'Erro ao buscar procedimentos' });
  }
});
app.post('/procedimentos', async (req, res) => {
  try {
    const { nome } = req.body;
    const p = new Procedimento({ nome });
    await p.save();
    res.status(201).json(p);
  } catch {
    res.status(500).json({ error:'Erro ao criar procedimento' });
  }
});

// Rotas de Agendamentos
// Datas disponíveis
app.get('/agendamentos/datas', async (req, res) => {
  try {
    const datas = await Agendamento.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$horario_marcacao' } } } },
      { $sort: { '_id': 1 } }
    ]);
    res.json(datas.map(d => d._id));
  } catch {
    res.status(500).json({ error:'Erro ao buscar datas' });
  }
});

// Listar todos
app.get('/agendamentos', async (req, res) => {
  try {
    const list = await Agendamento.find().sort({ horario_marcacao: -1 });
    res.json(list);
  } catch {
    res.status(500).json({ error:'Erro ao buscar agendamentos' });
  }
});

// Listar por data
app.get('/agendamentos/:data', async (req, res) => {
  try {
    const [y,m,d] = req.params.data.split('-');
    const start = new Date(y, m-1, d);
    const end   = new Date(y, m-1, d, 23, 59, 59);
    const list  = await Agendamento.find({
      horario_marcacao: { $gte: start, $lte: end }
    }).sort({ horario_marcacao: 1 });
    res.json(list);
  } catch {
    res.status(500).json({ error:'Erro ao buscar por data' });
  }
});

// Obter único (edição)
app.get('/agendamentos/single/:id', async (req, res) => {
  try {
    const ag = await Agendamento.findById(req.params.id);
    if (!ag) return res.status(404).json({ error:'Não encontrado' });
    res.json(ag);
  } catch {
    res.status(500).json({ error:'Erro ao buscar agendamento' });
  }
});

// Criar (sem confirmação imediata via WhatsApp)
app.post('/agendamentos', async (req, res) => {
  try {
    const { nome_cliente, telefone, procedimentos, horario_marcacao, observacoes } = req.body;
    const digits = telefone.replace(/\D/g, '');

    if (digits.length < 10 || digits.length > 11)
      return res.status(400).json({ error:'Telefone inválido' });
    if (await Agendamento.findOne({ horario_marcacao }))
      return res.status(400).json({ error:'Horário indisponível' });

    const newAg = await new Agendamento({
      nome_cliente,
      telefone: digits,
      procedimentos,
      horario_marcacao,
      observacoes
    }).save();

    // **Bloco de confirmação pelo WhatsApp removido**

    res.status(201).json(newAg);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Atualizar
app.put('/agendamentos/:id', async (req, res) => {
  try {
    const updated = await Agendamento.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error:'Não encontrado' });
    res.json(updated);
  } catch {
    res.status(500).json({ error:'Erro ao atualizar' });
  }
});

// Excluir
app.delete('/agendamentos/:id', async (req, res) => {
  try {
    const del = await Agendamento.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ error:'Não encontrado' });
    res.json({ message:'Excluído com sucesso' });
  } catch {
    res.status(500).json({ error:'Erro ao excluir' });
  }
});

// Cron: lembrete 1h antes
cron.schedule('* * * * *', async () => {
  const now      = new Date();
  const nextHour = new Date(now.getTime() + 3600000);
  const list = await Agendamento.find({
    horario_marcacao: { $gte: now, $lt: nextHour },
    lembrete_enviado: false
  });
  for (let ag of list) {
    if (clientReady) {s
      const num = `55${ag.telefone}@c.us`;
      if (await whatsappClient.isRegisteredUser(num)) {
        const msg = `⏰ *Lembrete de Agendamento* ⏰

Olá *${ag.nome_cliente}*,
Hoje às *${ag.horario_marcacao.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}*
Procedimento: *${ag.procedimentos.join(', ')}*`;
        await whatsappClient.sendMessage(num, msg);
      }
    }
    ag.lembrete_enviado = true;
    await ag.save();
  }
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
