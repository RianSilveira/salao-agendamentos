const mongoose = require('mongoose');
const AgendamentoSchema = new mongoose.Schema({
  nome_cliente: { type: String, required: true },
  telefone: { type: String, required: true },
  procedimentos: { type: [String], required: true },
  horario_marcacao: { type: Date, required: true },
  observacoes: { type: String, default: '' },
  lembrete_enviado: { type: Boolean, default: false },
  data_criacao: { type: Date, default: Date.now }
}, { timestamps: true });
AgendamentoSchema.index({ horario_marcacao: 1 });
module.exports = mongoose.model('Agendamento', AgendamentoSchema);