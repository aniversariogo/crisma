// server.js
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");
const PDFDocument = require("pdfkit");

// Configuração para carregar variáveis de ambiente de um arquivo .env localmente
// (útil para testar com o DB do Render na sua máquina)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

function stripHtmlTags(str) {
  if (!str) return "";
  // Expressão regular para remover tags HTML (ex: <b>, </b>, <p>)
  return str.replace(/<[^>]*>/g, "");
}

const app = express();
const PORT = process.env.PORT || 10000; // Use a porta 10000 como o Render sugere ou 3000 localmente

app.use(cors()); // Habilita o CORS para que seu front-end possa se conectar
app.use(express.json()); // Habilita o Express a ler JSON no corpo das requisições

// Serve arquivos estáticos (HTML, CSS, JS)
// Assumindo que seus arquivos HTML estão na raiz do projeto ou em um subdiretório.
// Se seus HTMLs estão na raiz, `__dirname` é suficiente.
// Se estão em uma pasta `public`, seria `express.static(path.join(__dirname, 'public'))`
// Com base no seu `index.html` e `encontros.html` referenciando `assets/`,
// vamos servir a pasta raiz do projeto.
app.use(express.static(path.join(__dirname, "")));

// Configuração de conexão com o PostgreSQL
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Necessário para o Render (ou se não estiver usando certificado verificado)
  },
});

db.connect()
  .then(() => console.log("Conectado ao PostgreSQL no Neon!"))
  .catch((err) =>
    console.error("Erro na conexão com o PostgreSQL:", err.stack)
  );

// ---------- Rotas da API ----------

// ---------- Credenciais de Login (SIMPLES) ----------
const USERS = {
  crismacapela25: "202526crisma",
};

// ---------- Rotas da API ----------

// Rota de Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (USERS[username] && USERS[username] === password) {
    // Em um sistema real, aqui você geraria um token JWT ou uma sessão.
    // Para simplicidade, apenas indicamos sucesso.
    res.json({ success: true, message: "Login bem-sucedido!" });
  } else {
    res
      .status(401)
      .json({ success: false, message: "Usuário ou senha inválidos." });
  }
});

// GET /api/crismandos - Retorna todos os crismandos
app.get("/api/crismandos", async (req, res) => {
  try {
    const result = await db.query(`
            SELECT
                c.id,
                c.nome,
                COALESCE(COUNT(fc.encontro_id), 0) AS faltas,
                (SELECT COUNT(*) FROM encontros) - COALESCE(COUNT(fc.encontro_id), 0) AS presencas
            FROM
                crismandos c
            LEFT JOIN
                faltas_crismandos fc ON c.id = fc.crismando_id
            GROUP BY
                c.id, c.nome
            ORDER BY
                c.nome ASC;
        `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar crismandos" });
  }
});

// GET /api/crismandos/:id - Retorna um crismando específico
app.get("/api/crismandos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM crismandos WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Crismando não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar crismando" });
  }
});

// NOVO: GET /api/crismandos/:crismando_id/faltas - Retorna os detalhes das faltas de um crismando
app.get("/api/crismandos/:crismando_id/faltas", async (req, res) => {
  const { crismando_id } = req.params;
  try {
    const result = await db.query(
      `
            SELECT
                e.id AS encontro_id, -- ADICIONE ESTA LINHA SE NÃO ESTIVER LÁ
                e.assunto,
                e.data,
                e.local
            FROM
                faltas_crismandos fc
            JOIN
                encontros e ON fc.encontro_id = e.id
            WHERE
                fc.crismando_id = $1
            ORDER BY
                e.data ASC;
        `,
      [crismando_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erro ao buscar faltas do crismando:", err);
    res.status(500).json({ error: "Erro ao buscar faltas do crismando." });
  }
});

// POST /api/crismandos - Adiciona um novo crismando
app.post("/api/crismandos", async (req, res) => {
  const { nome } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO crismandos (nome, faltas, presencas) VALUES ($1, 0, 0) RETURNING *",
      [nome]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar crismando" });
  }
});
// app.post('/api/crismandos', async (req, res) => {
//     const { nome, faltas = 0, presencas = 0 } = req.body;
//     try {
//         const result = await db.query(
//             'INSERT INTO crismandos (nome, faltas, presencas) VALUES ($1, $2, $3) RETURNING *',
//             [nome, faltas, presencas]
//         );
//         res.status(201).json(result.rows[0]);
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: 'Erro ao adicionar crismando' });
//     }
// });

// PUT /api/crismandos/:id - Atualiza um crismando existente
app.put("/api/crismandos/:id", async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body; // Only expecting nome from frontend for edits

  if (!nome) {
    return res
      .status(400)
      .json({ error: "Nome do crismando é obrigatório para atualização." });
  }

  try {
    // Only update the 'nome' field
    const result = await db.query(
      "UPDATE crismandos SET nome = $1 WHERE id = $2 RETURNING *",
      [nome, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Crismando não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar crismando" });
  }
});

// DELETE /api/crismandos/:id - Deleta um crismando
app.delete("/api/crismandos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Primeiro, deletar as faltas associadas a este crismando
    await db.query("DELETE FROM faltas_crismandos WHERE crismando_id = $1", [
      id,
    ]);
    // Em seguida, deletar o crismando
    const result = await db.query(
      "DELETE FROM crismandos WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Crismando não encontrado" });
    }
    res.json({ message: "Crismando e suas faltas deletados com sucesso!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar crismando" });
  }
});

// POST /api/faltas - Adicionar uma falta para um crismando em um encontro específico
app.post("/api/faltas", async (req, res) => {
  const { crismando_id, encontro_id } = req.body;

  if (!crismando_id || !encontro_id) {
    return res
      .status(400)
      .json({ error: "crismando_id e encontro_id são obrigatórios." });
  }

  try {
    // 1. Verificar se a falta já existe
    const existingFalta = await db.query(
      "SELECT * FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = $2",
      [crismando_id, encontro_id]
    );

    if (existingFalta.rows.length > 0) {
      return res.status(409).json({
        error: "Falta para este encontro já registrada para este crismando.",
      });
    }

    // 2. Inserir a falta na tabela faltas_crismandos
    await db.query(
      "INSERT INTO faltas_crismandos (crismando_id, encontro_id) VALUES ($1, $2)",
      [crismando_id, encontro_id]
    );

    // 3. Atualizar o contador de faltas na tabela crismandos
    const updatedCrismando = await db.query(
      "UPDATE crismandos SET faltas = faltas + 1 WHERE id = $1 RETURNING *",
      [crismando_id]
    );

    if (updatedCrismando.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Crismando não encontrado para atualizar faltas." });
    }

    res.status(201).json({
      message: "Falta registrada com sucesso!",
      crismando: updatedCrismando.rows[0],
    });
  } catch (err) {
    console.error("Erro ao registrar falta:", err);
    res.status(500).json({ error: "Erro interno ao registrar falta." });
  }
});

// DELETE /api/faltas - Remover uma falta para um crismando em um encontro específico
app.post('/api/faltas/remover', async (req, res) => {
  const { crismando_id, encontros_ids } = req.body;

  if (!crismando_id || !Array.isArray(encontros_ids) || encontros_ids.length === 0) {
    return res.status(400).json({ error: 'crismando_id e um array de encontros_ids são obrigatórios.' });
  }

  try {
    // 1. Deletar as faltas
    const deleteResult = await db.query(
      'DELETE FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = ANY($2::int[]) RETURNING *',
      [crismando_id, encontros_ids]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma falta encontrada para ser removida.' });
    }

    // 2. Atualizar o contador de faltas e presenças do crismando (diminui o número de faltas removidas)
    await db.query(
      'UPDATE crismandos SET faltas = faltas - $1 WHERE id = $2',
      [deleteResult.rows.length, crismando_id]
    );

    res.json({
      message: `${deleteResult.rows.length} falta(s) removida(s) com sucesso!`,
      removed_faltas: deleteResult.rows
    });
  } catch (err) {
    console.error('Erro ao remover falta:', err);
    res.status(500).json({ error: 'Erro ao remover falta' });
  }
});

// app.delete('/api/faltas', async (req, res) => {
//     const { crismando_id, encontros_ids } = req.body;
//     if (!crismando_id || !Array.isArray(encontros_ids) || encontros_ids.length === 0) {
//         return res.status(400).json({ error: 'crismando_id e um array de encontros_ids são obrigatórios.' });
//     }
//     try {
//         // 1. Deletar as faltas
//         const deleteResult = await db.query(
//             'DELETE FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = ANY($2::int[]) RETURNING *',
//             [crismando_id, encontros_ids]
//         );

//         if (deleteResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Nenhuma falta encontrada para ser removida.' });
//         }

//         // 2. Atualizar o contador de faltas e presenças do crismando (diminui o número de faltas removidas)
//         await db.query(
//             'UPDATE crismandos SET faltas = faltas - $1 WHERE id = $2',
//             [deleteResult.rows.length, crismando_id]
//         );

//         res.json({
//             message: `${deleteResult.rows.length} falta(s) removida(s) com sucesso!`,
//             removed_faltas: deleteResult.rows
//         });
//     } catch (err) {
//         console.error('Erro ao remover falta:', err);
//         res.status(500).json({ error: 'Erro ao remover falta' });
//     }
// });

// app.delete('/api/faltas', async (req, res) => {
//     const { crismando_id, encontros_ids } = req.body;
//     if (!crismando_id || !Array.isArray(encontros_ids) || encontros_ids.length === 0) {
//         return res.status(400).json({ error: 'crismando_id e um array de encontros_ids são obrigatórios.' });
//     }
//     try {
//         // 1. Deletar as faltas
//         const deleteResult = await db.query(
//             'DELETE FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = ANY($2::int[]) RETURNING *',
//             [crismando_id, encontros_ids]
//         );

//         if (deleteResult.rows.length === 0) {
//             return res.status(404).json({ error: 'Nenhuma falta encontrada para ser removida.' });
//         }

//         // 2. Atualizar o contador de faltas e presenças do crismando (diminui o número de faltas removidas)
//         await db.query(
//             'UPDATE crismandos SET faltas = faltas - $1 WHERE id = $2',
//             [deleteResult.rows.length, crismando_id]
//         );

//         res.json({
//             message: `${deleteResult.rows.length} falta(s) removida(s) com sucesso!`,
//             removed_faltas: deleteResult.rows
//         });
//     } catch (err) {
//         console.error('Erro ao remover falta:', err);
//         res.status(500).json({ error: 'Erro ao remover falta' });
//     }
// });

// app.delete('/api/faltas', async (req, res) => {
//     const { crismando_id, encontro_id } = req.body;

//     if (!crismando_id || !encontro_id) {
//         return res.status(400).json({ error: 'crismando_id e encontro_id são obrigatórios.' });
//     }

//     try {
//         // 1. Verificar se a falta existe antes de deletar
//         const existingFalta = await db.query(
//             'SELECT * FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = $2',
//             [crismando_id, encontro_id]
//         );

//         if (existingFalta.rows.length === 0) {
//             return res.status(404).json({ error: 'Falta não encontrada para este crismando neste encontro.' });
//         }

//         // 2. Deletar a falta da tabela faltas_crismandos
//         await db.query(
//             'DELETE FROM faltas_crismandos WHERE crismando_id = $1 AND encontro_id = $2',
//             [crismando_id, encontro_id]
//         );

//         // 3. Atualizar o contador de faltas na tabela crismandos (diminuir)
//         const updatedCrismando = await db.query(
//             'UPDATE crismandos SET faltas = GREATEST(0, faltas - 1) WHERE id = $1 RETURNING *', // Garante que faltas não seja negativo
//             [crismando_id]
//         );

//         if (updatedCrismando.rows.length === 0) {
//             return res.status(404).json({ error: 'Crismando não encontrado para atualizar faltas.' });
//         }

//         res.status(200).json({ message: 'Falta removida com sucesso!', crismando: updatedCrismando.rows[0] });

//     } catch (err) {
//         console.error('Erro ao remover falta:', err);
//         res.status(500).json({ error: 'Erro interno ao remover falta.' });
//     }
// });

// GET /api/encontros - Retorna todos os encontros
app.get("/api/encontros", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM encontros ORDER BY data ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar encontros" });
  }
});

// GET /api/encontros/:id - Retorna um encontro específico
app.get("/api/encontros/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query("SELECT * FROM encontros WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Encontro não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar encontro" });
  }
});

// POST /api/encontros - Adiciona um novo encontro
app.post("/api/encontros", async (req, res) => {
  const { data, assunto, local } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO encontros (data, assunto, local) VALUES ($1, $2, $3) RETURNING *",
      [data, assunto, local]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar encontro" });
  }
});

// PUT /api/encontros/:id - Atualiza um encontro existente
app.put("/api/encontros/:id", async (req, res) => {
  const { id } = req.params;
  const { data, assunto, local } = req.body;
  try {
    const result = await db.query(
      "UPDATE encontros SET data = $1, assunto = $2, local = $3 WHERE id = $4 RETURNING *",
      [data, assunto, local, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Encontro não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar encontro" });
  }
});

// DELETE /api/encontros/:id - Deleta um encontro
app.delete("/api/encontros/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Primeiro, deletar todas as faltas associadas a este encontro
    await db.query("DELETE FROM faltas_crismandos WHERE encontro_id = $1", [
      id,
    ]);
    // Em seguida, deletar o encontro
    const result = await db.query(
      "DELETE FROM encontros WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Encontro não encontrado" });
    }
    res.json({
      message: "Encontro e faltas associadas deletados com sucesso!",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar encontro" });
  }
});

function printFormattedText(
  doc,
  text,
  defaultFont,
  boldFont,
  fontSize,
  continued = false
) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  let isContinued = continued;

  parts.forEach((part, index) => {
    if (!part) return;

    const isBold = part.startsWith("<b>") && part.endsWith("</b>");
    const isLastPart = index === parts.length - 1;

    const options = { continued: isContinued || !isLastPart };

    if (isBold) {
      const boldText = part.slice(3, -4);
      doc.font(boldFont).fontSize(fontSize);
      doc.text(boldText, options);

    } else {
      doc.font(defaultFont).fontSize(fontSize);
      doc.text(part, options);
    }

    isContinued = options.continued;
  });
}

// GET /api/report/pdf - Gera e envia um relatório PDF
app.get("/api/report/pdf", async (req, res) => {
  try {
    // 1. Buscar todos os crismandos e encontros do banco de dados
    const alunosResult = await db.query(
      "SELECT * FROM crismandos ORDER BY nome ASC"
    );
    const encontrosResult = await db.query(
      "SELECT * FROM encontros ORDER BY data ASC"
    );

    const alunos = alunosResult.rows;
    const encontros = encontrosResult.rows;

    const dataGeracaoRelatorioFormatada = new Date().toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }
    );

    // Buscar as faltas específicas para cada crismando
    const faltasDetalhesResult = await db.query(`
            SELECT
                fc.crismando_id,
                e.assunto,
                e.data,
                e.local
            FROM
                faltas_crismandos fc
            JOIN
                encontros e ON fc.encontro_id = e.id
            ORDER BY
                fc.crismando_id, e.data ASC;
        `);

    const faltasPorCrismando = faltasDetalhesResult.rows.reduce(
      (acc, falta) => {
        if (!acc[falta.crismando_id]) {
          acc[falta.crismando_id] = [];
        }
        acc[falta.crismando_id].push(falta);
        return acc;
      },
      {}
    );

    // 2. Criar um novo documento PDF
    const doc = new PDFDocument({ margin: 50 });

    // Formata a data e hora para o nome do arquivo (sem caracteres especiais)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Mês começa do 0
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const filenameDate = `${year}-${month}-${day}_${hours}-${minutes}`;

    const filename = `relatorio_crisma_capela_${filenameDate}.pdf`;

    // Configurar cabeçalhos da resposta para download do PDF
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // 3. Enviar o PDF gerado diretamente para o cliente
    doc.pipe(res);

    // 4. Adicionar conteúdo ao PDF
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .text("Relatório de Crismandos - Capela N. Sra. Aparecida", {
        align: "center",
      });

    doc.moveDown(1.5);

    doc.font("Helvetica-Bold").fontSize(12).text(`Gerado em: `);

    doc.font("Helvetica").fontSize(12).text(`${dataGeracaoRelatorioFormatada}`);

    doc
      .text(
        "____________________________________________________________________________"
      )
      .moveDown(1.5);

    // Informações sobre Encontros
    doc
      .fontSize("Helvetica-Bold")
      .fontSize(15)
      .text("Encontros Cadastrados", { underline: true })
      .moveDown(0.5);

    if (encontros.length === 0) {
      doc.fontSize(12).text("Nenhum encontro cadastrado.");
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(`Total de encontros: `, { continued: true });

      doc.font("Helvetica").fontSize(12).text(`${encontros.length}`).moveDown();

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
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Assunto: `, { continued: true });

        doc
          .font("Helvetica-Oblique")
          .fontSize(12)
          .text(stripHtmlTags(encontro.assunto));

        // doc
        //   .font("Helvetica")
        //   .fontSize(12)
        //   .text(`${encontro.assunto}`)
        //   .moveDown(0.2);

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Local: `, { continued: true });

        doc
          .font("Helvetica")
          .fontSize(12)
          .text(`${encontro.local}`)
          .moveDown(0.2);

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Data/Hora: `, { continued: true });

        doc
          .font("Helvetica")
          .fontSize(12)
          .text(`${dataFormatada}`)
          .moveDown(0.8);
      });
    }
    doc.moveDown();

    // Informações sobre Crismandos
    doc
      .font("Helvetica")
      .fontSize(15)
      .text("Crismandos Cadastrados", { underline: true })
      .moveDown(0.5);

    if (alunos.length === 0) {
      doc.fontSize(14).text("Nenhum crismando cadastrado.");
    } else {
      doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text(`Total de crismandos: `, { continued: true });

      doc.font("Helvetica").fontSize(14).text(`${alunos.length}`).moveDown();

      for (const aluno of alunos) {
        const presencasCalculadas = encontros.length - aluno.faltas;

        // Print Name, Presences, Faltas first for the current crismando
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Nome: `, { continued: true });

        doc.font("Helvetica").fontSize(12).text(`${aluno.nome}`).moveDown(0.2);

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Presenças: `, { continued: true });

        doc
          .font("Helvetica")
          .fontSize(12)
          .text(`${Math.max(0, presencasCalculadas)}`)
          .moveDown(0.2); // Small moveDown

        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .text(`Faltas: `, { continued: true });

        doc
          .font("Helvetica")
          .fontSize(12)
          .text(`${aluno.faltas}`)
          .moveDown(0.2); // Small moveDown

        const faltasDoAluno = faltasPorCrismando[aluno.id] || [];
        if (faltasDoAluno.length > 0) {
          doc
            .font("Helvetica-BoldOblique")
            .fontSize(11)
            .text("Detalhes das Faltas:", { underline: true })
            .moveDown(0.2);

          faltasDoAluno.forEach((falta) => {
            const dataFaltaFormatada = new Date(falta.data).toLocaleDateString(
              "pt-BR",
              {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }
            );

            // const assuntoLimpo = stripHtmlTags(falta.assunto);

            doc
              .font("Helvetica-Bold")
              .fontSize(11)
              .text(`   - Assunto: `, { continued: true });

            // doc
            //   .font("Helvetica-Oblique")
            //   .fontSize(11)
            //   .text(`${falta.assunto}, `, { continued: true });
            doc
              .font("Helvetica-Oblique")
              .fontSize(11)
              .text(`${stripHtmlTags(falta.assunto)}, `, { continued: true });

            doc
              .font("Helvetica-Bold")
              .fontSize(11)
              .text(`Data: `, { continued: true });

            doc
              .font("Helvetica-Oblique")
              .fontSize(11)
              .text(`${dataFaltaFormatada}, `, { continued: true });

            doc
              .font("Helvetica-Bold")
              .fontSize(11)
              .text(`Local: `, { continued: true });

            doc
              .font("Helvetica-Oblique")
              .fontSize(11)
              .text(`${falta.local}`)
              .moveDown(0.1);
          });
          doc.moveDown(0.8);
        } else {
          doc.moveDown(0.8);
        }
      }
    }

    // 5. Finalizar o documento PDF
    doc.end();
  } catch (error) {
    console.error("Erro ao gerar relatório PDF:", error.message);
    res.status(500).json({ error: "Erro ao gerar relatório PDF." });
  }
});

// Rota de fallback para servir index.html em qualquer rota não encontrada
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});


