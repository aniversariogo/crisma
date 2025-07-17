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
    const qtdAlunosEl = $('#qtdAlunos');
    const btnNovoCrismando = $('#novoCrismandoBtn');
    const crismandoDialog = $('#crismandoFormDialog');
    const crismandoForm = $('#crismandoForm');
    const nomeCrismandoInput = $('#nomeCrismandoInput');
    const faltasCrismandoInput = $('#faltasCrismandoInput');
    // REMOVIDO: const presencasCrismandoInput = $('#presencasCrismandoInput'); // NEW: Input for presencas
    const crismandoFormTitulo = $('#crismandoFormTitulo');
    const cancelarCrismandoBtn = $('#cancelarCrismandoBtn');

    let alunos = []; // Vazio no início, será preenchido pela API
    let encontros = []; // Vazio no início, será preenchido pela API

    // Função para buscar e renderizar todos os dados
    async function fetchAndRenderData() {
      try {
        const [alunosResponse, encontrosResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/crismandos`),
          fetch(`${API_BASE_URL}/encontros`)
        ]);

        if (!alunosResponse.ok) throw new Error('Erro ao carregar crismandos');
        if (!encontrosResponse.ok) throw new Error('Erro ao carregar encontros');

        alunos = await alunosResponse.json();
        encontros = await encontrosResponse.json();

        renderTabelaAlunos();
        qtdEncontrosEl.textContent = encontros.length;
        qtdAlunosEl.textContent = alunos.length;

      } catch (error) {
        console.error('Erro ao carregar dados do servidor:', error);
        alert('Erro ao carregar dados do servidor. Verifique se o servidor está rodando e a conexão com o banco de dados.');
      }
    }

    // Renderiza a tabela de alunos
    function renderTabelaAlunos() {
      tbody.innerHTML = ''; // Limpa a tabela
      if (alunos.length === 0) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr><td colspan="4">Nenhum crismando cadastrado.</td></tr>
        `);
        return;
      }

      alunos.forEach((aluno, i) => {
        // Calcular presenças com base em encontros e faltas
        const presencasCalculadas = encontros.length - aluno.faltas;
        const linhaClass = i % 2 ? 'tr-1' : 'tr-2';

        tbody.insertAdjacentHTML('beforeend', `
          <tr data-id="${aluno.id}" class="${linhaClass}">
            <td>${aluno.nome}</td>
            <td>
              <button class="icon diminuir-faltas" ${aluno.faltas <= 0 ? 'disabled' : ''}>-</button>
              <span class="faltas-valor">${aluno.faltas}</span>
              <button class="icon aumentar-faltas">+</button>
            </td>
            <td>${Math.max(0, presencasCalculadas)}</td>
            <td>
              <button class="icon edit-crismando">✏️</button>
              <button class="icon del-crismando">🗑️</button>
            </td>
          </tr>
        `);
      });
    }

    // Abre o formulário para adicionar/editar crismando
    btnNovoCrismando.addEventListener('click', () => {
      crismandoForm.reset();
      crismandoFormTitulo.textContent = 'Novo Crismando';
      crismandoForm.dataset.id = ''; // Limpa o ID para indicar novo crismando
      // Define faltas iniciais como 0 (presenças serão calculadas)
      faltasCrismandoInput.value = 0;
      // Removido: presencasCrismandoInput.value = 0;
      crismandoDialog.showModal();
    });

    // Salva Crismando (novo ou edição)
    crismandoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = crismandoForm.dataset.id;
      const nome = nomeCrismandoInput.value.trim();
      let faltas = parseInt(faltasCrismandoInput.value, 10) || 0;

      // Presenças não são mais inseridas diretamente, mas calculadas.
      // Ao criar, as presenças são o total de encontros menos as faltas iniciais.
      // Ao editar, as presenças são recalculadas com base nas faltas existentes.
      let presencas = encontros.length - faltas; // Lógica para novo crismando ou ao editar faltas

      if (!nome) {
        alert('O nome do crismando é obrigatório!');
        return;
      }

      try {
        let response;
        if (id) {
          // Edição de crismando
          response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, faltas, presencas }) // Envia presenças atualizadas
          });
        } else {
          // Novo crismando
          response = await fetch(`${API_BASE_URL}/crismandos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, faltas, presencas }) // Envia presenças calculadas
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        crismandoDialog.close();
        await fetchAndRenderData(); // Recarrega os dados após salvar
      } catch (error) {
        console.error('Erro ao salvar crismando:', error);
        alert(`Erro ao salvar crismando: ${error.message}`);
      }
    });

    // Cancelar formulário
    cancelarCrismandoBtn.addEventListener('click', () => {
      crismandoDialog.close();
    });

    // Lidar com ações na tabela (aumentar/diminuir faltas, editar, deletar)
    tbody.addEventListener('click', async (event) => {
      const target = event.target;
      const row = target.closest('tr');
      if (!row) return;

      const crismandoId = row.dataset.id;
      const crismando = alunos.find(a => a.id == crismandoId);
      if (!crismando) return;

      if (target.classList.contains('aumentar-faltas')) {
        crismando.faltas++;
        // Presenças são (total de encontros - faltas)
        crismando.presencas = encontros.length - crismando.faltas;
        await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
      } else if (target.classList.contains('diminuir-faltas')) {
        if (crismando.faltas > 0) {
          crismando.faltas--;
          // Presenças são (total de encontros - faltas)
          crismando.presencas = encontros.length - crismando.faltas;
          await updateCrismando(crismandoId, crismando.nome, crismando.faltas, crismando.presencas);
        }
      } else if (target.classList.contains('edit-crismando')) {
        crismandoFormTitulo.textContent = 'Editar Crismando';
        crismandoForm.dataset.id = crismando.id;
        nomeCrismandoInput.value = crismando.nome;
        faltasCrismandoInput.value = crismando.faltas;
        // Removido: presencasCrismandoInput.value = crismando.presencas; // Presenças não são editáveis diretamente
        crismandoDialog.showModal();
      } else if (target.classList.contains('del-crismando')) {
        if (confirm(`Tem certeza que deseja deletar o crismando ${crismando.nome}?`)) {
          await deleteCrismando(crismandoId);
        }
      }
    });

    // Funções de API
    async function updateCrismando(id, nome, faltas, presencas) {
      try {
        const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, faltas, presencas })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderData(); // Recarrega os dados após atualização
      } catch (error) {
        console.error('Erro ao atualizar crismando:', error);
        alert(`Erro ao atualizar crismando: ${error.message}`);
      }
    }

    async function deleteCrismando(id) {
      try {
        const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderData(); // Recarrega os dados após exclusão
      } catch (error) {
        console.error('Erro ao deletar crismando:', error);
        alert(`Erro ao deletar crismando: ${error.message}`);
      }
    }

    // Inicia o carregamento dos dados ao entrar na página
    fetchAndRenderData();

    // Adiciona listener para a página de encontros avisar sobre mudanças
    window.addEventListener('storage', (event) => {
      if (event.key === 'crisma_encontros' || !event.key) { // Disparar se 'crisma_encontros' mudar ou se for um evento genérico
        fetchAndRenderData();
      }
    });

  } // Fim da página INDEX


  /* ----------  página ENCONTROS ---------- */
  if (document.body.classList.contains('page-encontros')) {
    const tbody = $('#encontrosTbody');
    const btnNovoEncontro = $('#novoEncontroBtn');
    const dialog = $('#formDialog');
    const encontroForm = $('#encontroForm');
    const assuntoInput = $('#assuntoInput');
    const localInput = $('#localInput');
    const dataInput = $('#dataInput');
    const horaInput = $('#horaInput');
    const dataPreview = $('#dataPreview');
    const formTitulo = $('#formTitulo');
    const cancelarBtn = $('#cancelarBtn');
    const qtdEncontrosEncontrosPageEl = $('#qtdEncontrosEncontrosPage'); // ADICIONE ESTA LINHA

    let encontros = []; // Vazio no início, será preenchido pela API

    // Função para buscar e renderizar encontros
    async function fetchAndRenderEncontros() {
      try {
        const response = await fetch(`${API_BASE_URL}/encontros`);
        if (!response.ok) throw new Error('Erro ao carregar encontros');
        encontros = await response.json();
        renderEncontros();
        qtdEncontrosEncontrosPageEl.textContent = encontros.length; // ADICIONE ESTA LINHA
      } catch (error) {
        console.error('Erro ao carregar encontros:', error);
        alert('Erro ao carregar encontros do servidor. Verifique se o servidor está rodando.');
      }
    }

    // Abre o formulário para adicionar/editar encontro
    btnNovoEncontro.addEventListener('click', () => {
      encontroForm.reset();
      formTitulo.textContent = 'Novo Encontro';
      encontroForm.dataset.id = ''; // Limpa o ID para indicar novo encontro
      dataPreview.textContent = '* OBS: caso não seja escolhido uma data/hora, é gerado um automática no momento do cadastro do encontro!';
      dialog.showModal();
    });

    // Salva Encontro (novo ou edição)
    encontroForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = encontroForm.dataset.id;
      const assunto = assuntoInput.value.trim();
      const local = localInput.value.trim();
      let data = dataInput.value;
      let hora = horaInput.value;

      if (!data) { // Se a data não for preenchida, usa a data e hora atuais
        const now = new Date();
        data = now.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        hora = now.toTimeString().split(' ')[0].substring(0, 5); // Formato HH:MM
      }

      // Combina data e hora para um timestamp completo
      const dataHoraCompleta = `${data}T${hora}:00`; // Adiciona segundos para formato ISO

      if (!assunto || !local) {
        alert('Assunto e Local são obrigatórios!');
        return;
      }

      try {
        let response;
        if (id) {
          // Edição de encontro
          response = await fetch(`${API_BASE_URL}/encontros/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataHoraCompleta, assunto, local })
          });
        } else {
          // Novo encontro
          response = await fetch(`${API_BASE_URL}/encontros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: dataHoraCompleta, assunto, local })
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        dialog.close();
        await fetchAndRenderEncontros(); // Recarrega os encontros
        // Informa a outra página (index) que a lista de encontros mudou
        window.dispatchEvent(new Event('storage'));
      } catch (error) {
        console.error('Erro ao salvar encontro:', error);
        alert(`Erro ao salvar encontro: ${error.message}`);
      }
    });

    // Cancelar formulário de encontro
    cancelarBtn.addEventListener('click', () => {
      dialog.close();
    });

    // Lidar com ações na tabela (editar, deletar)
    tbody.addEventListener('click', async (event) => {
      const target = event.target;
      const row = target.closest('tr');
      if (!row) return;

      const encontroId = row.dataset.id;
      const encontro = encontros.find(e => e.id == encontroId);
      if (!encontro) return;

      if (target.classList.contains('edit')) {
        formTitulo.textContent = 'Editar Encontro';
        encontroForm.dataset.id = encontro.id;
        assuntoInput.value = encontro.assunto;
        localInput.value = encontro.local;

        const encontroDate = new Date(encontro.data);
        const formattedDate = encontroDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const formattedTime = encontroDate.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

        dataInput.value = formattedDate;
        horaInput.value = formattedTime;
        dataPreview.textContent = `Data/Hora atual: ${formatDate(encontroDate)}`;
        dialog.showModal();
      } else if (target.classList.contains('del')) {
        if (confirm(`Tem certeza que deseja deletar o encontro sobre "${encontro.assunto}"?`)) {
          await deleteEncontro(encontro.id);
        }
      }
    });

    // Função para renderizar encontros
    function renderEncontros() {
      tbody.innerHTML = '';
      if (encontros.length === 0) {
        tbody.insertAdjacentHTML('beforeend', `
          <tr><td colspan="4">Nenhum encontro cadastrado.</td></tr>
        `);
        return;
      }
      encontros.forEach((e, i) => {
        const linhaClass = i % 2 ? 'tr-1' : 'tr-2'; // Adicionado para manter o estilo alternado da tabela
        tbody.insertAdjacentHTML('beforeend', `
          <tr data-id="${e.id}" class="${linhaClass}">
            <td>${formatDate(new Date(e.data))}</td>
            <td>${e.assunto}</td>
            <td>${e.local}</td>
            <td>
              <button class="icon edit">✏️</button>
              <button class="icon del">🗑️</button>
            </td>
          </tr>
        `);
      });
    }

    // Funções de API para Encontros
    async function deleteEncontro(id) {
      try {
        const response = await fetch(`${API_BASE_URL}/encontros/${id}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderEncontros(); // Recarrega os encontros
        // Informa a outra página (index) que a lista de encontros mudou
        window.dispatchEvent(new Event('storage'));
      } catch (error) {
        console.error('Erro ao deletar encontro:', error);
        alert(`Erro ao deletar encontro: ${error.message}`);
      }
    }

    // Função auxiliar para formatar data
    function formatDate(d) {
      if (!d || isNaN(d.getTime())) { // Verifica se a data é inválida
        return 'Automático';
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // Inicia o carregamento dos encontros ao entrar na página
    fetchAndRenderEncontros();

    // Adiciona listener para a página de index avisar sobre mudanças de alunos
    window.addEventListener('storage', (event) => {
      // Isso não é necessário na página de encontros se ela só lida com encontros,
      // mas se houver alguma interação cruzada, pode ser mantido.
      // fetchAndRenderEncontros(); // Removido, pois a página de encontros só precisa atualizar se os próprios encontros mudarem, o que já é feito no save/delete.
    });
  } // Fim da página ENCONTROS


  // --- Lógica para o tema persistente ---
  document.addEventListener('DOMContentLoaded', () => {
    let themeButton = document.getElementById('theme');
    let elementosParaAlterar = document.querySelectorAll('a, body, label, th, td, .titulo, .tr-1, .tr-2, .td2, .circle, .moon-icon, .sun-icon, .encont-label, #crismandoFormDialog, #formDialog, #dataPreview, #qtdAlunos');

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

})();