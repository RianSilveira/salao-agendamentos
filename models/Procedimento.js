const mongoose = require('mongoose');
const ProcedimentoSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  data_criacao: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Procedimento', ProcedimentoSchema);