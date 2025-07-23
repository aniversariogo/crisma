// script aqui
(() => {
  /* ----------  util ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  // URL base da sua API (onde o server.js está rodando)
  const API_BASE_URL = 'https://crisma-app.onrender.com/api';

  /* ----------  dados base (serão populados pelo servidor, não mais via localStorage) ---------- */
  // As listas iniciais de alunos e encontros serão buscadas da API

  /* ----------  página INDEX (faltas e crismandos) ---------- */
  if (document.body.classList.contains('page-index')) {
    const tbody = $('#alunosTbody');
    const qtdEncontrosEl = $('#qtdEncontros');
    const qtdAlunosEl = $('#qtdAlunos'); // CORRECTED: Changed from $('#0') to $('#qtdAlunos')
    const btnNovoCrismando = $('#novoCrismandoBtn');
    const crismandoDialog = $('#crismandoFormDialog');
    const crismandoForm = $('#crismandoForm');
    const nomeCrismandoInput = $('#nomeCrismandoInput');
    const faltasCrismandoInput = $('#faltasCrismandoInput');
    const presencasCrismandoInput = $('#presencasCrismandoInput'); // NEW: Input for presencas
    const crismandoFormTitulo = $('#crismandoFormTitulo');
    const cancelarCrismandoBtn = $('#cancelarCrismandoBtn');

    let alunos = []; // Vazio no início, será preenchido pela API
    let encontros = []; // Vazio no início, será preenchido pela API
    let editCrismandoId = null; // Agora armazenamos o ID do crismando a ser editado

    // Carrega os dados iniciais
    fetchAndRenderData();

    async function fetchAndRenderData() {
        try {
            const [alunosResponse, encontrosResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/crismandos`), // Corrigido para /crismandos
                fetch(`${API_BASE_URL}/encontros`)
            ]);

            alunos = await alunosResponse.json();
            encontros = await encontrosResponse.json();

            renderTabelaAlunos(); // Chama a função que renderiza e ordena
            qtdEncontrosEl.textContent = encontros.length;
            qtdAlunosEl.textContent = alunos.length;
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            alert('Erro ao carregar dados do servidor. Verifique se o servidor está rodando.');
        }
    }

    /* ---- eventos da tabela de alunos (faltas e edição) ---- */
    tbody.addEventListener('click', async e => {
      const target = e.target;
      const row = target.closest('tr');
      if (!row) return;

      const crismandoId = row.dataset.id; // Usamos o ID do banco de dados

      if (!crismandoId) return; // Garante que a linha tem um ID válido

      const crismando = alunos.find(a => a.id == crismandoId); // Encontra o crismando pelo ID
      if (!crismando) return;

      if (target.matches('button[data-op="+"]')) {
        crismando.faltas++;
        // Certifique-se de passar o valor de presenças também, mesmo que não alterado
        await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
      } else if (target.matches('button[data-op="-"]')) {
        if (crismando.faltas > 0) {
          crismando.faltas--;
          // Certifique-se de passar o valor de presenças também, mesmo que não alterado
          await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
        }
      } else if (target.matches('button[data-op="++"]')) { // NEW: Increment presence
        crismando.presencas++;
        await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
      } else if (target.matches('button[data-op="--"]')) { // NEW: Decrement presence
        if (crismando.presencas > 0) {
          crismando.presencas--;
          await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
        }
      } else if (target.matches('.edit-aluno-btn')) { // Adicionei -btn para maior especificidade
          openCrismandoModal(crismandoId);
      } else if (target.matches('.del-aluno-btn')) { // Adicionei -btn para maior especificidade
        if (confirm(`Tem certeza que deseja remover ${crismando.nome}?`)) {
          await deleteCrismando(crismandoId);
        }
      }
    });

    /* ---- Funções de comunicação com a API para Crismandos ---- */
    // A função updateCrismando agora aceita presencas
    async function updateCrismando(id, nome, faltas, presencas) {
        try {
            const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, { // Corrigido para /crismandos
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, faltas, presencas }) // Inclui presencas
            });
            if (!response.ok) throw new Error('Falha ao atualizar crismando');
            await fetchAndRenderData(); // Recarrega e renderiza a tabela
        } catch (error) {
            console.error('Erro ao atualizar crismando:', error);
            alert('Erro ao atualizar crismando.');
        }
    }

    async function deleteCrismando(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, { // Corrigido para /crismandos
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Falha ao remover crismando');
            await fetchAndRenderData(); // Recarrega e renderiza a tabela
        } catch (error) {
            console.error('Erro ao remover crismando:', error);
            alert('Erro ao remover crismando.');
        }
    }

    /* ---- Eventos para adicionar/editar crismando ---- */
    btnNovoCrismando.addEventListener('click', () => {
      openCrismandoModal(); // Abre o modal para novo crismando
    });

    crismandoForm.addEventListener('submit', async e => {
      e.preventDefault();
      const nome = nomeCrismandoInput.value.trim();
      // O campo faltasCrismandoInput é para edição. Para novo, pode ser 0.
      const faltas = parseInt(faltasCrismandoInput.value) || 0;
      const presencas = parseInt(presencasCrismandoInput.value) || 0; // NEW: Get presencas from input


      if (!nome) {
        alert("O nome do crismando é obrigatório!");
        return;
      }

      try {
        let response;
        if (editCrismandoId === null) {
          // Novo crismando
          response = await fetch(`${API_BASE_URL}/crismandos`, { // Corrigido para /crismandos
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, faltas: 0, presencas: 0 }) // Novo crismando começa com 0 faltas e 0 presenças
          });
        } else {
          // Editar crismando
          response = await fetch(`${API_BASE_URL}/crismandos/${editCrismandoId}`, { // Corrigido para /crismandos
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, faltas, presencas }) // Usa os valores editados
          });
        }
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Falha ao salvar crismando');
        }

        await fetchAndRenderData(); // Recarrega e renderiza a tabela
        crismandoDialog.close();
      } catch (error) {
        console.error('Erro ao salvar crismando:', error);
        alert('Erro ao salvar crismando: ' + error.message);
      }
    });

    cancelarCrismandoBtn.addEventListener('click', () => {
      crismandoForm.reset();
      crismandoDialog.close();
    });

    crismandoDialog.addEventListener('cancel', () => {
      crismandoForm.reset();
    });

    // Função para abrir o modal de crismando
    function openCrismandoModal(id = null) {
      editCrismandoId = id;
      if (id === null) {
        crismandoForm.reset();
        crismandoFormTitulo.textContent = 'Novo Crismando';
        faltasCrismandoInput.value = 0;
        presencasCrismandoInput.value = 0; // NEW: Initialize presencas for new crismando
      } else {
        const crismando = alunos.find(a => a.id == id);
        if (crismando) {
          nomeCrismandoInput.value = crismando.nome;
          faltasCrismandoInput.value = crismando.faltas;
          presencasCrismandoInput.value = crismando.presencas; // NEW: Populate presencas for editing
          crismandoFormTitulo.textContent = 'Editar Crismando';
        } else {
          alert('Crismando não encontrado para edição.');
          crismandoDialog.close();
          return;
        }
      }
      crismandoDialog.showModal();
    }

    /* ---- funções auxiliares da tabela de alunos ---- */
    function renderTabelaAlunos() {
        const tbody = $('#alunosTbody');
        const qtdAlunosSpan = $('#qtdAlunos'); // Pega o elemento correto para qtdAlunos

        // Ordenar os alunos por nome (alfabética)
        const alunosOrdenados = [...alunos].sort((a, b) => { // Cria uma cópia para não modificar o array original
            const nomeA = a.nome.toLowerCase();
            const nomeB = b.nome.toLowerCase();
            if (nomeA < nomeB) return -1;
            if (nomeA > nomeB) return 1;
            return 0;
        });

        tbody.innerHTML = ''; // Limpa a tabela antes de preencher

        if (alunosOrdenados.length === 0) {
            tbody.insertAdjacentHTML('beforeend', `
                <tr class="tr-1">
                    <td colspan="4">Nenhum crismando cadastrado.</td>
                </tr>
            `);
        } else {
            alunosOrdenados.forEach((aluno, i) => {
                const trClass = i % 2 === 0 ? 'tr-2' : 'tr-1'; // Alterna classes para linhas
                tbody.insertAdjacentHTML('beforeend', `
                    <tr data-id="${aluno.id}" class="${trClass}">
                        <td>${aluno.nome}</td>
                        <td>
                            <button class="icon" data-op="+">+</button>
                            ${aluno.faltas}
                            <button class="icon" data-op="-">-</button>
                        </td>
                        <td>
                            <button class="icon" data-op="++">+</button>
                            ${aluno.presencas}
                            <button class="icon" data-op="--">-</button>
                        </td>
                        <td>
                            <button class="icon edit-aluno-btn" data-id="${aluno.id}">✏️</button>
                            <button class="icon del-aluno-btn" data-id="${aluno.id}">🗑️</button>
                        </td>
                    </tr>
                `);
            });
        }
        qtdAlunosSpan.textContent = alunosOrdenados.length;
    }
  }

  /* ----------  página ENCONTROS ---------- */
  if (document.body.classList.contains('page-encontros')) {
    const tbody = $('#encontrosTbody');
    const dialog  = $('#formDialog');
    const form    = $('#encontroForm');
    const dataPreview = $('#dataPreview');
    const tituloForm  = $('#formTitulo');
    const btnNovo = $('#novoEncontroBtn');
    const cancelarBtn = $('#cancelarBtn');

    let encontros = []; // Vazio no início, será preenchido pela API
    let editEncontroId = null; // Armazena o ID do encontro a ser editado

    // Carrega os dados iniciais
    fetchAndRenderEncontros();

    async function fetchAndRenderEncontros() {
        try {
            const response = await fetch(`${API_BASE_URL}/encontros`);
            encontros = await response.json();
            renderEncontros(); // Chama a função que renderiza e ordena
        } catch (error) {
            console.error('Erro ao carregar encontros:', error);
            alert('Erro ao carregar encontros do servidor. Verifique se o servidor está rodando.');
        }
    }

    /* ---- abrir modal ---- */
    btnNovo.addEventListener('click', () => {
      openModal();
    });

    /* ---- submit ---- */
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const assunto = $('#assuntoInput').value.trim();
      const local   = $('#localInput').value.trim();
      const dataInput = $('#dataInput').value;
      const horaInput = $('#horaInput').value;

      let dataISO;
      if (dataInput && horaInput) {
        dataISO = new Date(`${dataInput}T${horaInput}`).toISOString();
      } else {
        // Se data/hora não for informada, pega a data/hora atual
        dataISO = new Date().toISOString();
      }

      if (!assunto || !local) {
          alert("Assunto e local são obrigatórios!");
          return;
      }

      try {
        let response;
        if (editEncontroId === null) {
          // Novo encontro
          response = await fetch(`${API_BASE_URL}/encontros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataISO, assunto, local })
          });
        } else {
          // Editar encontro
          response = await fetch(`${API_BASE_URL}/encontros/${editEncontroId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataISO, assunto, local })
          });
        }
        if (!response.ok) throw new Error('Falha ao salvar encontro');

        await fetchAndRenderEncontros(); // Recarrega e renderiza
        dialog.close();
      } catch (error) {
        console.error('Erro ao salvar encontro:', error);
        alert('Erro ao salvar encontro.');
      }
    });

    /* ---- ações da tabela (editar / remover) ---- */
    tbody.addEventListener('click', async e => {
      const target = e.target;
      const row = target.closest('tr');
      if (!row) return;

      const encontroId = row.dataset.id; // Usamos o ID do banco de dados
      if (!encontroId) return;

      if (target.matches('.edit')) {
        openModal(encontroId);
      } else if (target.matches('.del')) {
        if (confirm(`Tem certeza que deseja remover este encontro?`)) {
          try {
            const response = await fetch(`${API_BASE_URL}/encontros/${encontroId}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('Falha ao remover encontro');
            await fetchAndRenderEncontros(); // Recarrega e renderiza
          } catch (error) {
            console.error('Erro ao remover encontro:', error);
            alert('Erro ao remover encontro.');
          }
        }
      }
    });

    /* ---- Fechar modal ao clicar em Cancelar ---- */
    cancelarBtn.addEventListener('click', () => {
      form.reset();
      dialog.close();
    });

    /* ---- Fechar modal ao clicar fora ou usar Esc ---- */
    dialog.addEventListener('cancel', () => {
      form.reset();
    });

    /* ---- helpers ---- */
    function openModal(id = null){
      editEncontroId = id;
      if (id === null){
        form.reset();
        tituloForm.textContent = 'Novo Encontro';
        dataPreview.textContent = '* OBS: Se a data/hora não for informada, será gerada automaticamente no momento do cadastro.';
        $('#dataInput').value = '';
        $('#horaInput').value = '';
      } else {
        const enc = encontros.find(e => e.id == id);
        if (enc) {
            $('#assuntoInput').value = enc.assunto;
            $('#localInput').value   = enc.local;
            tituloForm.textContent   = 'Editar Encontro';

            const encDate = new Date(enc.data);
            // Formata a data para os inputs type="date" e type="time"
            const formattedDate = encDate.toISOString().split('T')[0];
            const formattedTime = encDate.toTimeString().split(' ')[0].substring(0, 5);

            $('#dataInput').value = formattedDate;
            $('#horaInput').value = formattedTime;
            dataPreview.textContent = `Data/Hora atual: ${formatDate(encDate)}`;
        } else {
            alert('Encontro não encontrado para edição.');
            dialog.close();
            return;
        }
      }
      dialog.showModal();
    }

    function renderEncontros(){
      const tbody = $('#encontrosTbody');

      // Ordenar os encontros por data (do mais antigo para o mais novo)
      // O server.js já ordena por data, mas reordenar no cliente garante consistência
      const encontrosOrdenados = [...encontros].sort((a, b) => { // Cria uma cópia para não modificar o array original
          const dateA = new Date(a.data);
          const dateB = new Date(b.data);
          return dateA.getTime() - dateB.getTime(); // Ordena do mais antigo para o mais novo
      });

      tbody.innerHTML='';
      if (encontrosOrdenados.length === 0) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr class="tr-1">
            <td colspan="4">Nenhum encontro cadastrado.</td>
          </tr>
        `);
        return;
      }
      encontrosOrdenados.forEach((e, i) => { // Use 'i' para alternar as classes tr-1/tr-2
        const trClass = i % 2 === 0 ? 'tr-2' : 'tr-1';
        tbody.insertAdjacentHTML('beforeend',`
          <tr data-id="${e.id}" class="${trClass}">
            <td>${formatDate(new Date(e.data))}</td>
            <td>${e.assunto}</td>
            <td>${e.local}</td>
            <td>
              <button class="icon edit" data-id="${e.id}">✏️</button>
              <button class="icon del" data-id="${e.id}">🗑️</button>
            </td>
          </tr>
        `);
      });
    }

    function formatDate(d){
      if (!d || isNaN(d.getTime())) {
        return 'Data Inválida';
      }
      return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
             +' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }
  }

  /* ----------  sincronia entre abas (não é mais necessário com API) ---------- */
  // window.addEventListener('storage', e => {
  //  location.reload();
  // });
})();

// --- Lógica para o tema persistente ---
document.addEventListener('DOMContentLoaded', () => {
    let themeButton = document.getElementById('theme');
    let elementosParaAlterar = document.querySelectorAll('a, body, label, th, td, .titulo, .tr-1, .tr-2, .td2, .circle, .moon-icon, .sun-icon, .encont-label, #crismandoFormDialog, #formDialog, #dataPreview'); 

    const savedTheme = localStorage.getItem('themePreference');

    // Aplica o tema salvo ao carregar a página
    if (savedTheme === 'dark') {
        themeButton.classList.add('dark');
        elementosParaAlterar.forEach(elemento => {
            elemento.classList.add('dark');
        });
    } else { // Garante que, se não houver tema salvo ou for 'light', o tema 'light' seja o padrão
        themeButton.classList.remove('dark');
        elementosParaAlterar.forEach(elemento => {
            elemento.classList.remove('dark');
        });
    }

    // Adiciona o evento de clique para alternar e salvar o tema
    themeButton.addEventListener('click', () => {
        themeButton.classList.toggle('dark');
        elementosParaAlterar.forEach(elemento => {
            elemento.classList.toggle('dark');
        });

        // Salva a preferência atual no localStorage
        if (themeButton.classList.contains('dark')) {
            localStorage.setItem('themePreference', 'dark');
        } else {
            localStorage.setItem('themePreference', 'light');
        }
    });
});