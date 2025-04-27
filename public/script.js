// Notificações
function showNotification(type, msg) {
  const n = document.getElementById('notification');
  n.className = `notification ${type}`;
  n.textContent = msg;
  n.classList.remove('hidden');
  setTimeout(() => n.classList.add('hidden'), 3000);
}

// Atualiza ano no rodapé
document.getElementById('current-year').textContent = new Date().getFullYear();

// Formatar telefone
function formatarTelefone(tel) {
  if (!tel) return '';
  const ddd = tel.substring(0, 2);
  const parte1 = tel.substring(2, tel.length-4);
  const parte2 = tel.substring(tel.length-4);
  return `(${ddd}) ${parte1}-${parte2}`;
}

// Formatar data com dia da semana
function formatarDataComDia(dataISO) {
  const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const data = new Date(dataISO);
  const diaSemana = diasSemana[data.getDay()];
  const dataFormatada = data.toLocaleDateString('pt-BR');
  return `${diaSemana}, ${dataFormatada}`;
}

// Carrega procedimentos (listas e select)
async function carregarProcedimentos() {
  try {
    const res = await fetch('/procedimentos');
    const items = await res.json();
    const ul    = document.getElementById('listaProcedimentos');
    const cb    = document.getElementById('procedimentosCheckboxes');
    const editCb= document.getElementById('editProcedimentosCheckboxes');
    
    ul.innerHTML = '';
    cb.innerHTML = '';
    editCb.innerHTML = '';
    
    items.forEach(p => {
      // lista simples
      const li = document.createElement('li');
      li.textContent = p.nome;
      ul.appendChild(li);
      
      // checkbox no form principal
      const lbl = document.createElement('label');
      lbl.innerHTML = `<input type="checkbox" value="${p.nome}"><span>${p.nome}</span>`;
      cb.appendChild(lbl);
      
      // checkbox no modal
      const lbl2 = lbl.cloneNode(true);
      editCb.appendChild(lbl2);
    });
  } catch {
    showNotification('error', 'Erro ao carregar procedimentos');
  }
}


// Adicionar procedimento
document.getElementById('procedimentoForm').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('novoProcedimento').value.trim();
  if (!nome) return showNotification('error', 'Informe o nome do procedimento');
  try {
    const res = await fetch('/procedimentos', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ nome })
    });
    if (!res.ok) throw new Error();
    showNotification('success', 'Procedimento adicionado');
    document.getElementById('procedimentoForm').reset();
    carregarProcedimentos();
  } catch {
    showNotification('error', 'Erro ao adicionar procedimento');
  }
});

// Carrega datas disponíveis
async function carregarDatas() {
  try {
    const res = await fetch('/agendamentos/datas');
    const datas = await res.json();
    const tabs = document.getElementById('dateTabs');
    tabs.innerHTML = '';
    
    datas.forEach(d => {
      const [ano, mes, dia] = d.split('-');
      const dataObj = new Date(ano, mes-1, dia);
      const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][dataObj.getDay()];
      const dataFormatada = `${dia}/${mes}`;
      
      const btn = document.createElement('button');
      btn.innerHTML = `
        <span class="dia-semana">${diaSemana}</span>
        <span class="dia-mes">${dataFormatada}</span>
      `;
      
      btn.addEventListener('click', () => carregarPorData(d, btn));
      tabs.appendChild(btn);
      
      // Seleciona a data atual por padrão
      const hoje = new Date().toISOString().split('T')[0];
      if (d === hoje) {
        btn.click();
      }
    });
  } catch {
    showNotification('error', 'Erro ao carregar datas');
  }
}

// Carrega agendamentos por data
async function carregarPorData(data, btn) {
  document.querySelectorAll('.date-tabs button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  try {
    const res = await fetch(`/agendamentos/${data}`);
    const items = await res.json();
    const cont = document.getElementById('listaAgendamentos');
    
    if (!items.length) {
      cont.innerHTML = '<p>Nenhum agendamento para esta data.</p>';
      return;
    }
    
    cont.innerHTML = items.map(a => {
      const horario = new Date(a.horario_marcacao);
      const horaFormatada = horario.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
      const dataFormatada = formatarDataComDia(a.horario_marcacao);
      
      return `
      <div class="agendamento-item">
        <div class="agendamento-header">
          <h3>${a.nome_cliente}</h3>
          <div class="agendamento-actions">
            <button class="edit-btn" onclick="editarAgendamento('${a._id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="delete-btn" onclick="excluirAgendamento('${a._id}')">
              <i class="fas fa-trash"></i> Excluir
            </button>
          </div>
        </div>
        <p class="agendamento-data">${dataFormatada} às ${horaFormatada}</p>
        <p><strong>Procedimentos:</strong> ${a.procedimentos.join(', ')}</p>
        ${a.observacoes ? `<p><strong>Observações:</strong> ${a.observacoes}</p>` : ''}
        <p><strong>Telefone:</strong> ${formatarTelefone(a.telefone)}</p>
      </div>
      `;
    }).join('');
  } catch {
    showNotification('error', 'Erro ao buscar agendamentos');
  }
}

// Novo agendamento
document
  .getElementById('agendamentoForm')
  .addEventListener('submit', async e => {
    e.preventDefault();

    // 1) Captura os procedimentos marcados
    const procedimentos = Array.from(
      document.querySelectorAll('#procedimentosCheckboxes input:checked')
    ).map(inp => inp.value);

    // 2) Validação básica
    const nome = document.getElementById('nome_cliente').value.trim();
    const tel  = document.getElementById('telefone').value.trim();
    const hora = document.getElementById('horario_marcacao').value;
    if (!nome || !tel || procedimentos.length === 0 || !hora) {
      return showNotification('error', 'Preencha todos os campos obrigatórios');
    }

    // 3) Monta o payload usando a variável já definida
    const payload = {
      nome_cliente: nome,
      telefone: tel,
      procedimentos,       // <- aqui usa o const procedimentos
      horario_marcacao: hora,
      observacoes: document.getElementById('observacoes').value.trim()
    };

    // 4) Envia para o servidor
    try {
      const res = await fetch('/agendamentos', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar agendamento');
      }
      showNotification('success', 'Agendamento criado com sucesso');
      document.getElementById('agendamentoForm').reset();
      carregarDatas();
    } catch (err) {
      showNotification('error', err.message);
    }
  });

// Modal de Edição
let currentEditId = null;

async function editarAgendamento(id) {
  try {
    currentEditId = id;
    const res = await fetch(`/agendamentos/single/${id}`);
    if (!res.ok) throw new Error('Não encontrado');
    const ag = await res.json();

    // Preenche os campos de texto
    document.getElementById('edit_id').value           = id;
    document.getElementById('edit_nome_cliente').value = ag.nome_cliente;
    document.getElementById('edit_telefone').value     = ag.telefone;
    document.getElementById('edit_horario').value      = new Date(ag.horario_marcacao)
      .toISOString().slice(0,16);
    document.getElementById('edit_observacoes').value  = ag.observacoes || '';

    // Preenche os checkboxes de procedimentos
    document
      .querySelectorAll('#editProcedimentosCheckboxes input[type="checkbox"]')
      .forEach(cb => {
        cb.checked = ag.procedimentos.includes(cb.value);
      });

    // Abre o modal
    document.getElementById('editModal').style.display = 'block';

  } catch (err) {
    console.error(err);
    showNotification('error', 'Erro ao carregar dados para edição');
  }
}

// Fechar modal
document.getElementById('editCloseBtn').addEventListener('click', () => {
  document.getElementById('editModal').style.display = 'none';
});

document.getElementById('editCancelBtn').addEventListener('click', () => {
  document.getElementById('editModal').style.display = 'none';
});

// Enviar edição
document
  .getElementById('editForm')
  .addEventListener('submit', async e => {
    e.preventDefault();

    // 1) Captura procedimentos via checkboxes
    const procedimentos = Array.from(
      document.querySelectorAll('#editProcedimentosCheckboxes input:checked')
    ).map(inp => inp.value);

    // 2) Validação básica
    const nome = document.getElementById('edit_nome_cliente').value.trim();
    const tel  = document.getElementById('edit_telefone').value.trim();
    const hora = document.getElementById('edit_horario').value;
    if (!nome || !tel || procedimentos.length === 0 || !hora) {
      return showNotification('error', 'Preencha todos os campos obrigatórios');
    }

    // 3) Monta o payload
    const payload = {
      nome_cliente: nome,
      telefone: tel,
      procedimentos,
      horario_marcacao: hora,
      observacoes: document.getElementById('edit_observacoes').value.trim()
    };

    // 4) Envia a requisição PUT e trata a resposta
    try {
      const res = await fetch(`/agendamentos/${currentEditId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao atualizar agendamento');
      }

      showNotification('success', 'Agendamento atualizado com sucesso');
      document.getElementById('editModal').style.display = 'none';
      carregarDatas();

    } catch (err) {
      showNotification('error', err.message);
    }
  });

// Excluir agendamento
async function excluirAgendamento(id) {
  try {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    
    const res = await fetch(`/agendamentos/${id}`, { 
      method: 'DELETE',
      headers: {'Content-Type': 'application/json'}
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao excluir');
    }
    
    showNotification('success', 'Agendamento excluído com sucesso');
    carregarDatas();
  } catch (err) {
    showNotification('error', err.message || 'Erro ao excluir agendamento');
  }
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
  carregarProcedimentos();
  carregarDatas();
});