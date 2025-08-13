// script aqui
(() => {
  /* ----------  util ---------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // URL base da sua API (onde o server.js está rodando)
  const API_BASE_URL = "https://crisma-app.onrender.com/api";

  /* ----------  dados base (serão populados pelo servidor, não mais via localStorage) ---------- */
  // As listas iniciais de alunos e encontros serão buscadas da API

  /* ---------- Lógica de Autenticação ---------- */
  function checkAuth() {
    const isLoggedIn = localStorage.getItem("loggedIn");
    // Se a página atual NÃO é a de login e o usuário NÃO está logado, redireciona para o login
    if (
      window.location.pathname !== "/" &&
      window.location.pathname !== "/index.html" &&
      !isLoggedIn
    ) {
      window.location.href = "/"; // Redireciona para a página de login
      return false;
    }
    // Se a página atual É a de login e o usuário ESTÁ logado, redireciona para inicio
    if (
      (window.location.pathname === "/" ||
        window.location.pathname === "/index.html") &&
      isLoggedIn
    ) {
      window.location.href = "/assets/pages/inicio.html";
      return false;
    }
    return true; // Retorna true se a autenticação estiver ok para prosseguir na página
  }

  // Chamar checkAuth imediatamente para proteger as páginas
  if (!checkAuth()) {
    // Se checkAuth retornar false (redirecionamento), não precisamos executar o resto do script.
    // A lógica de tema já foi executada acima.
    return;
  }

  /* ---------- Página de Login (index.html) ---------- */
  if (document.body.classList.contains("page-login")) {
    const loginForm = $("#loginForm");
    const errorMessageEl = $("#errorMessage");
    const passwordInput = $("#password");
    const togglePassword = $("#passwordToggleIcon");

    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = $("#username").value;
        const password = $("#password").value;

        errorMessageEl.textContent = ""; // Limpa mensagens de erro anteriores

        try {
          const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ username, password }),
          });

          const data = await response.json();

          if (data.success) {
            localStorage.setItem("loggedIn", "true"); // Marca o usuário como logado
            window.location.href = "/assets/pages/inicio.html"; // Redireciona para a página principal
          } else {
            errorMessageEl.textContent =
              data.message || "Erro no login. Tente novamente.";
          }
        } catch (error) {
          console.error("Erro de rede ou servidor:", error);
          errorMessageEl.textContent =
            "Erro ao conectar com o servidor. Tente novamente.";
        }
      });
    }

    // Lógica para alternar visibilidade da senha - INÍCIO DA ADIÇÃO
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener("click", function () {
        // Altera o tipo do input entre 'password' e 'text'
        const type =
          passwordInput.getAttribute("type") === "password"
            ? "text"
            : "password";
        passwordInput.setAttribute("type", type);

        // Altera o ícone com base no tipo
        if (type === "password") {
          this.src = "/assets/images/icons/eye-close-icon.svg";
        } else {
          this.src = "/assets/images/icons/eye-open-icon.svg";
        }
      });
    }
    // Lógica para alternar visibilidade da senha - FIM DA ADIÇÃO
    // Não há 'return;' aqui, pois a lógica de autenticação já tratou os redirecionamentos
    // e o tema já foi aplicado.
  }

  /* ---------- Lógica de Logout (Para inicio.html e encontros.html) ---------- */
  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      // Adiciona o alerta de confirmação
      const confirmLogout = confirm("Tem certeza que deseja sair?");

      // Se o usuário clicou em "OK" (confirmou)
      if (confirmLogout) {
        localStorage.removeItem("loggedIn"); // Remove o estado de login
        window.location.href = "/"; // Redireciona para a página de login
      }
      // Se o usuário clicou em "Cancelar", nada acontece e ele permanece na página
    });
  }

  /* ----------  página INDEX (faltas e crismandos) ---------- */
  if (document.body.classList.contains("page-index")) {
    const tbody = $("#alunosTbody");
    const qtdEncontrosEl = $("#qtdEncontros");
    const qtdAlunosEl = $("#qtdAlunos");
    const btnNovoCrismando = $("#novoCrismandoBtn");
    const crismandoDialog = $("#crismandoFormDialog");
    const crismandoForm = $("#crismandoForm");
    const nomeCrismandoInput = $("#nomeCrismandoInput");

    const faltasCrismandoInput = $("#faltasCrismandoInput");

    const crismandoFormTitulo = $("#crismandoFormTitulo");
    const cancelarCrismandoBtn = $("#cancelarCrismandoBtn");
    const generateReportBtn = $("#generateReportBtn");

    // Modal para seleção de encontros (para adicionar/remover falta)
    const encontroSelectionModal = document.getElementById(
      "encontroSelectionModal"
    );
    const closeEncontroSelectionButton =
      encontroSelectionModal.querySelector(".close-button");
    const encontrosCheckboxesDiv = document.getElementById(
      "encontrosCheckboxes"
    );

    const confirmSelectionBtn = document.getElementById("confirmSelectionBtn");
    const encontroSelectionModalTitle =
      encontroSelectionModal.querySelector("h2"); // Adicionado para mudar o título do modal

    // Modal para visualização de faltas (o "olhinho")
    const faltasDetailsModal = document.getElementById("faltasDetailsModal");
    const closeFaltasDetailsModalButton = document.getElementById(
      "closeFaltasDetailsModal"
    );
    const crismandoNomeFaltasSpan = document.getElementById(
      "crismandoNomeFaltas"
    );
    const faltasListDiv = document.getElementById("faltasList");

    let alunos = [];
    let encontros = [];
    let currentCrismandoId = null;
    let currentActionType = null; // 'addFalta' ou 'removeFalta'

    // Função para buscar e renderizar todos os dados
    async function fetchAndRenderData() {
      try {
        const [alunosResponse, encontrosResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/crismandos`),
          fetch(`${API_BASE_URL}/encontros`),
        ]);

        if (!alunosResponse.ok) throw new Error("Erro ao carregar crismandos");
        if (!encontrosResponse.ok)
          throw new Error("Erro ao carregar encontros");

        alunos = await alunosResponse.json();
        encontros = await encontrosResponse.json();

        renderTabelaAlunos();
        qtdEncontrosEl.textContent = encontros.length;
        qtdAlunosEl.textContent = alunos.length;
      } catch (error) {
        console.error("Erro ao carregar dados do servidor:", error);
        alert(
          "Erro ao carregar dados do servidor. Verifique se o servidor está rodando e a conexão com o banco de dados."
        );
      }
    }

    // Renderiza a tabela de alunos
    function renderTabelaAlunos() {
      tbody.innerHTML = ""; // Limpa a tabela
      if (alunos.length === 0) {
        tbody.insertAdjacentHTML(
          "beforeend",
          `
          <tr><td colspan="4">Nenhum crismando cadastrado.</td></tr>
        `
        );
        return;
      }

      alunos.forEach((aluno, i) => {
        const presencasCalculadas = encontros.length - aluno.faltas;
        const linhaClass = i % 2 ? "tr-1" : "tr-2";

        tbody.insertAdjacentHTML(
          "beforeend",
          `
          <tr data-id="${aluno.id}" class="${linhaClass}">
            <td>${aluno.nome}</td>
            <td>
              <button class="icon diminuir-faltas" data-crismando-id="${
                aluno.id
              }" ${aluno.faltas <= 0 ? "disabled" : ""}>-</button>
              <span class="faltas-valor">${
                aluno.faltas
              }</span> <button class="icon aumentar-faltas" data-crismando-id="${
            aluno.id
          }">+</button>
            </td>
            <td>${Math.max(0, presencasCalculadas)}</td>
            <td>
              <button class="icon view-faltas" data-crismando-id="${
                aluno.id
              }">👁️</button>
              <button class="icon edit-crismando" data-crismando-id="${
                aluno.id
              }">✏️</button>
              <button class="icon del-crismando" data-crismando-id="${
                aluno.id
              }">🗑️</button>
            </td>
          </tr>
        `
        );
      });
    }

    // Função para buscar TODOS os encontros e popular o modal (para Adicionar falta)
    async function fetchAllEncontrosAndPopulateModal() {
      encontrosCheckboxesDiv.innerHTML = "";
      if (encontros.length === 0) {
        encontrosCheckboxesDiv.innerHTML =
          "<p>Nenhum encontro cadastrado. Cadastre encontros na página de Encontros.</p>";
        confirmSelectionBtn.disabled = true;
      } else {
        confirmSelectionBtn.disabled = false;
        encontros.forEach((encontro) => {
          const dataFormatada = new Date(encontro.data).toLocaleDateString(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }
          );
          const label = document.createElement("label");
          label.innerHTML = `
                    <input type="radio" name="encontro" value="${encontro.id}">
                    ${encontro.assunto} (${dataFormatada}) - ${encontro.local}
                `;
          encontrosCheckboxesDiv.appendChild(label);
        });
      }
    }

    // Função para buscar SOMENTE as faltas do crismando e popular o modal (para Remover falta)
    // Função para buscar SOMENTE as faltas do crismando e popular o modal (para Remover falta)
    async function fetchFaltasDoCrismandoAndPopulateModal(crismandoId) {
      encontrosCheckboxesDiv.innerHTML = "";
      confirmSelectionBtn.disabled = true; // Desabilita por padrão até ter faltas

      try {
        const response = await fetch(
          `${API_BASE_URL}/crismandos/${crismandoId}/faltas`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Erro ao carregar faltas específicas do crismando para remoção: ${response.status} - ${errorText}`
          );
        }
        const faltasDoCrismando = await response.json();
        console.log(
          `Faltas do crismando ${crismandoId} para remoção:`,
          faltasDoCrismando
        ); // LOG DE DEBUG
        if (faltasDoCrismando.length === 0) {
          encontrosCheckboxesDiv.innerHTML =
            "<p>Este crismando não possui faltas registradas individualmente que possam ser removidas.</p>";
          confirmSelectionBtn.disabled = true; // Garante que o botão continue desabilitado
        } else {
          confirmSelectionBtn.disabled = false; // Habilita o botão se houver faltas
          faltasDoCrismando.forEach((falta) => {
            const dataFormatada = new Date(falta.data).toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }
            );
            const label = document.createElement("label");
            label.innerHTML = `
                    <input type="checkbox" name="encontro" value="${falta.encontro_id}">
                    ${falta.assunto} (${dataFormatada}) - ${falta.local}
                `;
            encontrosCheckboxesDiv.appendChild(label);
          });
        }
      } catch (error) {
        console.error("Erro ao buscar faltas para remoção:", error);
        encontrosCheckboxesDiv.innerHTML = `<p>Erro ao carregar faltas para remoção: ${error.message}. Tente novamente.</p>`;
        confirmSelectionBtn.disabled = true; // Em caso de erro, desabilita
      }
    }

    // async function fetchFaltasDoCrismandoAndPopulateModal(crismandoId) {
    //     encontrosCheckboxesDiv.innerHTML = '';
    //     confirmSelectionBtn.disabled = true; // Desabilita por padrão até ter faltas

    //     try {
    //         const response = await fetch(`${API_BASE_URL}/crismandos/${crismandoId}/faltas`);
    //         if (!response.ok) {
    //             const errorText = await response.text();
    //             throw new Error(`Erro ao carregar faltas específicas do crismando para remoção: ${response.status} - ${errorText}`);
    //         }
    //         const faltasDoCrismando = await response.json();
    //         console.log(`Faltas do crismando ${crismandoId} para remoção:`, faltasDoCrismando); // LOG DE DEBUG

    //         if (faltasDoCrismando.length === 0) {
    //             encontrosCheckboxesDiv.innerHTML = '<p>Este crismando não possui faltas registradas individualmente que possam ser removidas.</p>';
    //             confirmSelectionBtn.disabled = true; // Garante que o botão continue desabilitado
    //         } else {
    //             confirmSelectionBtn.disabled = false; // Habilita o botão se houver faltas
    //             faltasDoCrismando.forEach(falta => {
    //                 const dataFormatada = new Date(falta.data).toLocaleDateString('pt-BR', {
    //                     day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    //                 });
    //                 const label = document.createElement('label');
    //                 label.innerHTML = `
    //                     <input type="radio" name="encontro" value="${falta.encontro_id}">
    //                     ${falta.assunto} (${dataFormatada}) - ${falta.local}
    //                 `;
    //                 encontrosCheckboxesDiv.appendChild(label);
    //             });
    //         }
    //     } catch (error) {
    //         console.error('Erro ao buscar faltas para remoção:', error);
    //         encontrosCheckboxesDiv.innerHTML = `<p>Erro ao carregar faltas para remoção: ${error.message}. Tente novamente.</p>`;
    //         confirmSelectionBtn.disabled = true; // Em caso de erro, desabilita
    //     }
    // }

    // Abre o formulário para adicionar/editar crismando
    btnNovoCrismando.addEventListener("click", () => {
      crismandoForm.reset();
      crismandoFormTitulo.textContent = "Novo Crismando";
      crismandoForm.dataset.id = "";
      // faltasCrismandoInput.value = 0;

      // Ensure faltas input is visible and enabled when adding new crismando
      // faltasCrismandoInput.style.display = "block";
      // document.getElementById("labelFaltasCrismando").style.display = "block";
      // faltasCrismandoInput.disabled = false;

      crismandoDialog.showModal();
    });

    // Salva Crismando (novo ou edição)
    crismandoForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = crismandoForm.dataset.id;
      const nome = nomeCrismandoInput.value.trim();
      if (!nome) {
        alert("O nome do crismando é obrigatório!");
        return;
      }

      try {
        let response;
        if (id) {
          // Edição de crismando
          const crismandoOriginal = alunos.find((a) => a.id == id);
          if (crismandoOriginal.nome === nome) {
            alert("Nenhuma alteração foi feita.");
            crismandoFormDialog.close();
            return;
          }
          response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              nome: nome,
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error ||
              `Erro ao ${id ? "atualizar" : "adicionar"} crismando: ${
                response.status
              }`
          );
        }

        crismandoFormDialog.close();
        fetchAndRenderData(); // Recarrega a tabela
        alert(`Crismando ${id ? "atualizado" : "adicionado"} com sucesso!`);
      } catch (error) {
        console.error(`Erro ao salvar crismando:`, error);
        alert(`Erro ao salvar crismando: ${error.message}`);
      }
    });

    // crismandoForm.addEventListener("submit", async (event) => {
    //   event.preventDefault();
    //   const id = crismandoForm.dataset.id;
    //   const nome = nomeCrismandoInput.value.trim();
    //   // let faltas = parseInt(faltasCrismandoInput.value, 10) || 0;

    //   if (!nome) {
    //     alert("O nome do crismando é obrigatório!");
    //     return;
    //   }

    //   try {
    //     let response;
    //     if (id) {
    //       // Edição de crismando: ONLY SEND NOME
    //       response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
    //         method: "PUT",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify({ nome: nome }),
    //       });
    //     } else {
    //       // Novo crismando: Send nome and initial faltas
    //       response = await fetch(`${API_BASE_URL}/crismandos`, {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify({
    //           nome : nome,
    //         }),
    //       });
    //     }

    //     if (!response.ok) {
    //       const errorData = await response.json();
    //       throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
    //     }

    //     crismandoDialog.close();
    //     await fetchAndRenderData();
    //   } catch (error) {
    //     console.error("Erro ao salvar crismando:", error);
    //     alert(`Erro ao salvar crismando: ${error.message}`);
    //   }
    // });

    // Cancelar formulário
    cancelarCrismandoBtn.addEventListener("click", () => {
      crismandoDialog.close();
    });

    // Lidar com ações na tabela (aumentar/diminuir faltas, editar, deletar, ver faltas)
    tbody.addEventListener("click", async (event) => {
      const target = event.target;
      const crismandoId = target.dataset.crismandoId;
      if (!crismandoId) return;

      const crismando = alunos.find((a) => a.id == crismandoId);
      if (!crismando) return;

      if (target.classList.contains("aumentar-faltas")) {
        currentCrismandoId = crismandoId;
        currentActionType = "addFalta";

        document.body.classList.add("modal-open");
        encontroSelectionModal.classList.add("modal-open");

        encontroSelectionModalTitle.textContent =
          "Adicionar Falta - Selecione o Encontro";

          document.querySelector("#encontroSelectionModal .mdl-p").textContent = "Selecione um encontro";

        await fetchAllEncontrosAndPopulateModal();
        encontroSelectionModal.style.display = "block"; // CORRIGIDO AQUI
      } else if (target.classList.contains("diminuir-faltas")) {
        currentCrismandoId = crismandoId;
        currentActionType = "removeFalta";

        document.body.classList.add("modal-open");
        encontroSelectionModal.classList.add("modal-open");

        encontroSelectionModalTitle.textContent =
          "Selecione a Falta para Remover"; // Título para remoção

          document.querySelector("#encontroSelectionModal .mdl-p").textContent = "Selecione uma ou mais faltas para remover:";

        await fetchFaltasDoCrismandoAndPopulateModal(crismandoId); // Mostra SOMENTE as faltas do crismando
        encontroSelectionModal.style.display = "block";
      } else if (target.classList.contains("view-faltas")) {
        currentCrismandoId = crismandoId;
        // Linha removida: toggleFaltasCountVisibility(crismandoId, true);
        await displayFaltasDetails(crismandoId, crismando.nome);
      } else if (target.classList.contains("edit-crismando")) {
        crismandoFormTitulo.textContent = "Editar Crismando";
        crismandoForm.dataset.id = crismando.id;
        nomeCrismandoInput.value = crismando.nome;

        // Hide and disable faltas input when editing
        // faltasCrismandoInput.value = crismando.faltas; // Still set value for consistency

        // faltasCrismandoInput.style.display = "none";
        // document.getElementById("labelFaltasCrismando").style.display = "none";
        // faltasCrismandoInput.disabled = true;

        crismandoDialog.showModal();
      } else if (target.classList.contains("del-crismando")) {
        if (
          confirm(
            `Tem certeza que deseja deletar o crismando ${crismando.nome}?`
          )
        ) {
          await deleteCrismando(crismandoId);
        }
      }
    });

    // Fechar modal de seleção de encontros
    closeEncontroSelectionButton.addEventListener("click", () => {
      encontroSelectionModal.style.display = "none";

      document.body.classList.remove("modal-open");
      encontroSelectionModal.classList.remove("modal-open");

      currentCrismandoId = null;
      currentActionType = null;
    });

    // Fechar modal de seleção de encontros ao clicar fora
    window.addEventListener("click", (e) => {
      if (e.target === encontroSelectionModal) {
        encontroSelectionModal.style.display = "none";
        currentCrismandoId = null;
        currentActionType = null;
      }
    });

    // Lógica para o modal de seleção de encontros (Adicionar/Retirar falta)
    confirmSelectionBtn.addEventListener("click", async () => {
      // Encontra o crismando pelo ID
      const crismando = alunos.find((a) => a.id == currentCrismandoId);
      if (!crismando) {
        alert("Crismando não encontrado.");
        return;
      }

      if (currentActionType === "addFalta") {
        const selectedRadio = $('input[name="encontro"]:checked');
        if (!selectedRadio) {
          alert("Por favor, selecione um encontro para adicionar a falta.");
          return;
        }
        const encontroId = selectedRadio.value;
        try {
          const response = await fetch(`${API_BASE_URL}/faltas`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              crismando_id: parseInt(currentCrismandoId),
              encontro_id: parseInt(encontroId),
            }),
          });

          if (!response.ok) {
            const data = await response.json();
            // O servidor envia uma propriedade 'message', não 'error', para esta situação
            alert(
              `Erro ao adicionar falta: ${
                data.message || data.error || "Erro desconhecido."
              }`
            );
            return;
          }

          // if (!response.ok) {
          //   const errorData = await response.json();
          //   // O servidor está retornando status 409 quando a falta já existe.
          //   if (response.status === 409) {
          //     alert(errorData.message);
          //   } else {
          //     throw new Error(
          //       errorData.message ||
          //         `Erro ao adicionar falta: ${response.status}`
          //     );
          //   }
          //   return;
          // }

          alert(`Falta adicionada com sucesso para ${crismando.nome}!`);
          encontroSelectionModal.style.display = "none"; // CORRIGIDO AQUI
          fetchAndRenderData();
        } catch (error) {
          console.error("Erro ao adicionar falta:", error);
          alert(`Erro ao adicionar falta: ${error.message}`);
        }
      } else if (currentActionType === "removeFalta") {
        const selectedCheckboxes = $$('input[name="encontro"]:checked');
        const encontrosIds = selectedCheckboxes.map((cb) => parseInt(cb.value));

        if (encontrosIds.length === 0) {
          alert(
            "Por favor, selecione pelo menos um encontro para retirar a falta."
          );
          return;
        }

        try {
          // ALTERAÇÃO CRUCIAL: Mudar o método para 'POST' e a URL para a nova rota
          const response = await fetch(`${API_BASE_URL}/faltas/remover`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              crismando_id: parseInt(currentCrismandoId),
              encontros_ids: encontrosIds,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || `Erro ao retirar falta: ${response.status}`
            );
          }

          alert(
            `${encontrosIds.length} falta(s) removida(s) com sucesso para ${crismando.nome}!`
          );
          encontroSelectionModal.style.display = "none";
          fetchAndRenderData();
        } catch (error) {
          console.error("Erro ao retirar falta:", error);
          alert(`Erro ao retirar falta: ${error.message}`);
        }
      }
    });

    // confirmSelectionBtn.addEventListener("click", async () => {
    //   const crismando = alunos.find((a) => a.id == currentCrismandoId);
    //   if (!crismando) {
    //     alert("Crismando não encontrado.");
    //     return;
    //   }

    //   if (currentActionType === "addFalta") {
    //     const selectedEncontro = $('input[name="encontro"]:checked');
    //     if (!selectedEncontro) {
    //       alert("Por favor, selecione um encontro para adicionar a falta.");
    //       return;
    //     }
    //     const encontroId = selectedEncontro.value;
    //     try {
    //       const response = await fetch(`${API_BASE_URL}/faltas`, {
    //         method: "POST",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           crismando_id: parseInt(currentCrismandoId),
    //           encontro_id: parseInt(encontroId),
    //         }),
    //       });

    //       if (!response.ok) {
    //         const errorData = await response.json();
    //         throw new Error(
    //           errorData.message || `Erro ao adicionar falta: ${response.status}`
    //         );
    //       }

    //       alert(`Falta adicionada com sucesso para ${crismando.nome}!`);
    //       encontroSelectionModal.close();
    //       fetchAndRenderData();
    //     } catch (error) {
    //       console.error("Erro ao adicionar falta:", error);
    //       alert(`Erro ao adicionar falta: ${error.message}`);
    //     }
    //   } else if (currentActionType === "removeFalta") {
    //     const selectedCheckboxes = $$('input[name="encontro"]:checked');
    //     const encontrosIds = selectedCheckboxes.map((cb) => parseInt(cb.value));

    //     if (encontrosIds.length === 0) {
    //       alert(
    //         "Por favor, selecione pelo menos um encontro para retirar a falta."
    //       );
    //       return;
    //     }

    //     try {
    //       const response = await fetch(`${API_BASE_URL}/faltas`, {
    //         method: "DELETE",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({
    //           crismando_id: parseInt(currentCrismandoId),
    //           encontros_ids: encontrosIds,
    //         }),
    //       });

    //       if (!response.ok) {
    //         const errorData = await response.json();
    //         throw new Error(
    //           errorData.error || `Erro ao retirar falta: ${response.status}`
    //         );
    //       }

    //       alert(
    //         `${encontrosIds.length} falta(s) removida(s) com sucesso para ${crismando.nome}!`
    //       );
    //       encontroSelectionModal.close();
    //       fetchAndRenderData();
    //     } catch (error) {
    //       console.error("Erro ao retirar falta:", error);
    //       alert(`Erro ao retirar falta: ${error.message}`);
    //     }
    //   }

    //   currentCrismandoId = null;
    //   currentActionType = null;
    // });

    // confirmSelectionBtn.addEventListener('click', async () => {
    //   const selectedRadio = document.querySelector('input[name="encontro"]:checked');
    //   if (!selectedRadio) {
    //     alert('Por favor, selecione um encontro.');
    //     return;
    //   }
    //   const encontroId = selectedRadio.value;

    //   if (!currentCrismandoId || !currentActionType) {
    //     alert('Erro interno: Crismando ou ação não definidos.');
    //     return;
    //   }

    //   try {
    //     let response;
    //     if (currentActionType === 'addFalta') {
    //       response = await fetch(`${API_BASE_URL}/faltas`, {
    //         method: 'POST',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ crismando_id: currentCrismandoId, encontro_id: encontroId })
    //       });
    //     } else if (currentActionType === 'removeFalta') {
    //       response = await fetch(`${API_BASE_URL}/faltas`, {
    //         method: 'DELETE',
    //         headers: { 'Content-Type': 'application/json' },
    //         body: JSON.stringify({ crismando_id: currentCrismandoId, encontro_id: encontroId })
    //       });
    //     }

    //     const data = await response.json();
    //     if (response.ok) {
    //       alert(data.message);
    //       encontroSelectionModal.style.display = 'none';
    //       await fetchAndRenderData(); // Atualiza a lista de crismandos e a tabela completa
    //     } else {
    //       alert(`Erro: ${data.error || 'Erro desconhecido'}`);
    //     }
    //   } catch (error) {
    //     console.error('Erro ao registrar/remover falta:', error);
    //     alert('Erro de conexão ao processar falta.');
    //   } finally {
    //     currentCrismandoId = null;
    //     currentActionType = null;
    //   }
    // });

    // Função para exibir os detalhes das faltas (para o "olhinho" 👁️)
    async function displayFaltasDetails(crismandoId, crismandoNome) {
      crismandoNomeFaltasSpan.textContent = crismandoNome;
      faltasListDiv.innerHTML = "<p>Carregando faltas...</p>"; // Mensagem de carregamento
      faltasDetailsModal.style.display = "block"; // Abre o modal

      try {
        const response = await fetch(
          `${API_BASE_URL}/crismandos/${crismandoId}/faltas`
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Erro ao carregar detalhes das faltas: ${response.status} - ${errorText}`
          );
        }

        const faltas = await response.json();

        faltasListDiv.innerHTML = ""; // Limpa o conteúdo anterior

        if (faltas.length === 0) {
          faltasListDiv.innerHTML =
            "<p>Este crismando não possui faltas registradas individualmente.</p>";
        } else {
          const ul = document.createElement("ul");
          faltas.forEach((falta) => {
            // Cria um objeto Date seguro para formatação
            const dataObj = new Date(falta.data);
            const dataFaltaFormatada = dataObj.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const li = document.createElement("li");
            // Garante que o texto da lista seja claro
            li.textContent = `Assunto: ${falta.assunto || "N/A"}, Data: ${
              dataFaltaFormatada || "N/A"
            }, Local: ${falta.local || "N/A"}`;
            ul.appendChild(li);
          });
          faltasListDiv.appendChild(ul);
        }
      } catch (error) {
        console.error(
          "Erro ao buscar detalhes das faltas para o olhinho:",
          error
        );
        faltasListDiv.innerHTML = `<p style="color: red;">Erro ao carregar detalhes das faltas: ${error.message}. Verifique o console para mais detalhes.</p>`;
      }
    }

    // Fechar modal de detalhes das faltas
    closeFaltasDetailsModalButton.addEventListener("click", () => {
      faltasDetailsModal.style.display = "none";
      if (currentCrismandoId) {
        // Linha removida: toggleFaltasCountVisibility(currentCrismandoId, false);
        currentCrismandoId = null;
      }
    });

    // Fechar modal de detalhes das faltas ao clicar fora
    window.addEventListener("click", (e) => {
      if (e.target === faltasDetailsModal) {
        faltasDetailsModal.style.display = "none";
      }
    });

    // Funções de API (mantidas como estão)
    async function updateCrismando(id, nome, faltas, presencas) {
      try {
        const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, faltas, presencas }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderData();
      } catch (error) {
        console.error("Erro ao atualizar crismando:", error);
        alert(`Erro ao atualizar crismando: ${error.message}`);
      }
    }

    async function deleteCrismando(id) {
      try {
        const response = await fetch(`${API_BASE_URL}/crismandos/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderData();
      } catch (error) {
        console.error("Erro ao deletar crismando:", error);
        alert(`Erro ao deletar crismando: ${error.message}`);
      }
    }

    // Lidar com o botão de gerar relatório
    generateReportBtn.addEventListener("click", async () => {
      try {
        alert("Gerando relatório... Isso pode levar alguns segundos.");
        const response = await fetch(`${API_BASE_URL}/report/pdf`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "relatorio_crisma.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        alert(
          "Relatório PDF gerado e download iniciado/concluído com sucesso!"
        );
      } catch (error) {
        console.error("Erro ao gerar relatório:", error);
        alert(`Erro ao gerar relatório: ${error.message}`);
      }
    });

    // Inicia o carregamento dos dados ao entrar na página
    fetchAndRenderData();

    // Adiciona listener para a página de encontros avisar sobre mudanças
    window.addEventListener("storage", (event) => {
      if (event.key === "crisma_encontros" || !event.key) {
        fetchAndRenderData();
      }
    });
  } // Fim da página INDEX

  /* ----------  página ENCONTROS (mantido como estava) ---------- */
  if (document.body.classList.contains("page-encontros")) {
    const tbody = $("#encontrosTbody");
    const btnNovoEncontro = $("#novoEncontroBtn");
    const dialog = $("#formDialog");
    const encontroForm = $("#encontroForm");
    const assuntoInput = $("#assuntoInput");
    const localInput = $("#localInput");
    const dataInput = $("#dataInput");
    const horaInput = $("#horaInput");
    const dataPreview = $("#dataPreview");
    const formTitulo = $("#formTitulo");
    const cancelarBtn = $("#cancelarBtn");
    const qtdEncontrosEncontrosPageEl = $("#qtdEncontrosEncontrosPage");

    let encontros = [];

    async function fetchAndRenderEncontros() {
      try {
        const response = await fetch(`${API_BASE_URL}/encontros`);
        if (!response.ok) throw new Error("Erro ao carregar encontros");
        encontros = await response.json();
        renderEncontros();
        qtdEncontrosEncontrosPageEl.textContent = encontros.length;
      } catch (error) {
        console.error("Erro ao carregar encontros:", error);
        alert(
          "Erro ao carregar encontros do servidor. Verifique se o servidor está rodando."
        );
      }
    }

    btnNovoEncontro.addEventListener("click", () => {
      encontroForm.reset();
      formTitulo.textContent = "Novo Encontro";
      encontroForm.dataset.id = "";
      dataPreview.textContent =
        "* OBS: caso não seja escolhido uma data/hora, é gerado um automática no momento do cadastro do encontro!";
      dialog.showModal();
    });

    encontroForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const id = encontroForm.dataset.id;
      const assunto = assuntoInput.value.trim();
      const local = localInput.value.trim();
      let data = dataInput.value;
      let hora = horaInput.value;

      if (!data) {
        const now = new Date();
        data = now.toISOString().split("T")[0];
        hora = now.toTimeString().split(" ")[0].substring(0, 5);
      }

      const dataHoraCompleta = `${data}T${hora}:00`;

      if (!assunto || !local) {
        alert("Assunto e Local são obrigatórios!");
        return;
      }

      try {
        let response;
        if (id) {
          response = await fetch(`${API_BASE_URL}/encontros/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: dataHoraCompleta, assunto, local }),
          });
        } else {
          response = await fetch(`${API_BASE_URL}/encontros`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: dataHoraCompleta, assunto, local }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }

        dialog.close();
        await fetchAndRenderEncontros();
        window.dispatchEvent(new Event("storage"));
      } catch (error) {
        console.error("Erro ao salvar encontro:", error);
        alert(`Erro ao salvar encontro: ${error.message}`);
      }
    });

    cancelarBtn.addEventListener("click", () => {
      dialog.close();
    });

    tbody.addEventListener("click", async (event) => {
      const target = event.target;
      const row = target.closest("tr");
      if (!row) return;

      const encontroId = row.dataset.id;
      const encontro = encontros.find((e) => e.id == encontroId);
      if (!encontro) return;

      if (target.classList.contains("edit")) {
        formTitulo.textContent = "Editar Encontro";
        encontroForm.dataset.id = encontro.id;
        assuntoInput.value = encontro.assunto;
        localInput.value = encontro.local;

        const encontroDate = new Date(encontro.data);
        const formattedDate = encontroDate.toISOString().split("T")[0];
        const formattedTime = encontroDate
          .toTimeString()
          .split(" ")[0]
          .substring(0, 5);

        dataInput.value = formattedDate;
        horaInput.value = formattedTime;
        dataPreview.textContent = `Data/Hora atual: ${formatDate(
          encontroDate
        )}`;
        dialog.showModal();
      } else if (target.classList.contains("del")) {
        if (
          confirm(
            `Tem certeza que deseja deletar o encontro sobre "${encontro.assunto}"?`
          )
        ) {
          await deleteEncontro(encontro.id);
        }
      }
    });

    function renderEncontros() {
      tbody.innerHTML = "";
      if (encontros.length === 0) {
        tbody.insertAdjacentHTML(
          "beforeend",
          `
          <tr><td colspan="4">Nenhum encontro cadastrado.</td></tr>
        `
        );
        return;
      }
      encontros.forEach((e, i) => {
        const linhaClass = i % 2 ? "tr-1" : "tr-2";
        tbody.insertAdjacentHTML(
          "beforeend",
          `
          <tr data-id="${e.id}" class="${linhaClass}">
            <td>${formatDate(new Date(e.data))}</td>
            <td>${e.assunto}</td>
            <td>${e.local}</td>
            <td>
              <button class="icon edit">✏️</button>
              <button class="icon del">🗑️</button>
            </td>
          </tr>
        `
        );
      });
    }

    async function deleteEncontro(id) {
      try {
        const response = await fetch(`${API_BASE_URL}/encontros/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        await fetchAndRenderEncontros();
        window.dispatchEvent(new Event("storage"));
      } catch (error) {
        console.error("Erro ao deletar encontro:", error);
        alert(`Erro ao deletar encontro: ${error.message}`);
      }
    }

    function formatDate(d) {
      if (!d || isNaN(d.getTime())) {
        return "Automático";
      }
      return (
        d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }) +
        " " +
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
      );
    }

    fetchAndRenderEncontros();
  }

  // --- Lógica para o tema persistente ---
  document.addEventListener("DOMContentLoaded", () => {
    // Seleciona os elementos essenciais uma única vez para melhor performance
    const themeButton = document.getElementById("theme");
    const arrowIcon = document.getElementById("arrowIcon");
    const logoCapela = document.getElementById("logoCapela");

    // Seleciona todos os outros elementos que precisam ter a classe 'dark' alternada
    const elementosParaAlterar = document.querySelectorAll(
      "a, body, label, th, td, .titulo, .tr-1, .tr-2, .td2, .circle, " +
        ".moon-icon, .sun-icon, .encont-label, #crismandoFormDialog, #formDialog, " +
        "#dataPreview, #faltasList, .modal-content, .close-button, .h2-login, .toggle-password-icon"
    );

    // --- Caminhos para as imagens ---
    const imagens = {
      light: {
        arrow: "/assets/images/icons/arrow-dark-icon.svg", // Imagem para fundo claro
        logo: "/assets/images/capela-dark.png", // Imagem para fundo claro
      },
      dark: {
        arrow: "/assets/images/icons/arrow-light-icon.svg", // Imagem para fundo escuro
        logo: "/assets/images/logo-capela.png", // Imagem para fundo escuro
      },
    };

    /**
     * Função centralizada para aplicar o tema (claro ou escuro) na página.
     * Esta é a única função responsável por todas as alterações visuais.
     * @param {string} tema - O tema a ser aplicado ('light' ou 'dark').
     */
    const aplicarTema = (tema) => {
      // Adiciona ou remove a classe 'dark' de todos os elementos necessários.
      // O segundo argumento de 'toggle' força o estado: true para adicionar, false para remover.
      const ehDark = tema === "dark";
      elementosParaAlterar.forEach((elemento) => {
        elemento.classList.toggle("dark", ehDark);
      });

      // Troca as imagens com base no tema, de forma segura
      if (arrowIcon) {
        arrowIcon.src = ehDark ? imagens.dark.arrow : imagens.light.arrow;
      }
      if (logoCapela) {
        logoCapela.src = ehDark ? imagens.dark.logo : imagens.light.logo;
      }

      // Bônus: Atualiza o atributo no body para estilização via CSS, se necessário
      document.body.setAttribute("data-theme", tema);
    };

    /**
     * Lógica do clique no botão de tema.
     */
    themeButton.addEventListener("click", () => {
      // Verifica qual é o tema atual lendo o atributo do body ou o localStorage
      const temaAtual = localStorage.getItem("themePreference") || "light";
      const novoTema = temaAtual === "dark" ? "light" : "dark";

      // Salva a nova preferência no localStorage para persistir entre as sessões
      localStorage.setItem("themePreference", novoTema);

      // Aplica o novo tema visualmente
      aplicarTema(novoTema);
    });

    /**
     * Lógica de Carregamento Inicial.
     * Executa assim que a página é carregada para aplicar o tema salvo.
     */
    const inicializarTema = () => {
      // Pega o tema salvo pelo usuário, ou usa 'light' como padrão
      const temaSalvo = localStorage.getItem("themePreference") || "light";
      aplicarTema(temaSalvo);
    };

    // Inicia o tema da página
    inicializarTema();
  });

  // document.addEventListener('DOMContentLoaded', () => {
  //   let themeButton = document.getElementById('theme');
  //   let elementosParaAlterar = document.querySelectorAll('a, body, label, th, td, .titulo, .tr-1, .tr-2, .td2, .circle, .moon-icon, .sun-icon, .encont-label, .logo-capela, #crismandoFormDialog, #formDialog, #dataPreview, #faltasList, .modal-content, .close-button, .h2-login, .toggle-password-icon');

  //   let arrowIcon = document.getElementById('arrowIcon');
  //   let logoCapela = document.getElementById('logoCapela');

  //   const savedTheme = localStorage.getItem('themePreference');

  //   if (savedTheme === 'dark') {
  //     themeButton.classList.add('dark');
  //     elementosParaAlterar.forEach(elemento => {
  //       elemento.classList.add('dark');
  //     });

  //   } else {
  //     themeButton.classList.remove('dark');
  //     elementosParaAlterar.forEach(elemento => {
  //       elemento.classList.remove('dark');
  //     });
  //   }

  //   themeButton.addEventListener('click', () => {
  //     themeButton.classList.toggle('dark');
  //     elementosParaAlterar.forEach(elemento => {
  //       elemento.classList.toggle('dark');
  //     });

  //     if (themeButton.classList.contains('dark')) {
  //       localStorage.setItem('themePreference', 'dark');

  //       if (arrowIcon) arrowIcon.src = arrowIcon.src.replace("arrow-dark-icon.svg", "arrow-light-icon.svg");
  //       if (logoCapela) logoCapela.src = logoCapela.src.replace("capela-dark.png", "logo-capela.png");
  //     } else {
  //       localStorage.setItem('themePreference', 'light');

  //       if (arrowIcon) arrowIcon.src = arrowIcon.src.replace("arrow-light-icon.svg", "arrow-dark-icon.svg");
  //       if (logoCapela) logoCapela.src = logoCapela.src.replace("logo-capela.png", "capela-dark.png");
  //     }
  //   });
  // });
})();


