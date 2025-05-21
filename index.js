const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const cheerio = require("cheerio");
const qrcode = require('qrcode-terminal');
const { resumir } = require("./services/summarizer");
require("dotenv").config();
const { URL } = require("url");
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function extrairDadosDaMateria(url) {
    let browser;
    const chromeLauncher = await import('chrome-launcher');

    try {
        const chromePaths = await chromeLauncher.Launcher.getInstallations();
        const executablePath = chromePaths.length > 0 ? chromePaths[0] : null;

        if (!executablePath) {
            throw new Error('Chrome não encontrado no sistema.');
        }

        browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36');

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
        await new Promise(resolve => setTimeout(resolve, 5000));

        const html = await page.content();
        const $ = cheerio.load(html);

        if (html.includes("captcha") || html.includes("datadome")) {
            console.warn("⚠️ Página protegida por CAPTCHA/DataDome.");
            return null;
        }

        const titulo = $("meta[property='og:title']").attr("content") || $("title").text() || "Título não encontrado";
        const paragrafos = $("p").map((i, el) => $(el).text()).get();
        const texto = paragrafos.join(" ").substring(0, 3000);

        const dataHoraRaw = $("time").first().attr("datetime") || $("meta[property='article:published_time']").attr("content");
        const dataHoraFormatada = formatarDataBrasilia(dataHoraRaw);

        const portal = new URL(url).hostname.replace("www.", "").split(".")[0];

        return { titulo, texto, dataHora: dataHoraFormatada, portal };

    } catch (err) {
        console.error("❌ Erro ao extrair dados da matéria:", err.message);
        return null;
    } finally {
        if (browser) await browser.close();
    }
}


function getTextoMensagem(msg) {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message?.ephemeralMessage?.message) {
        return getTextoMensagem({ message: msg.message.ephemeralMessage.message });
    }
    return null;
}

function formatarDataBrasilia(datetime) {
    if (!datetime) return "Data/hora não disponível";

    const data = new Date(datetime);
    data.setHours(data.getHours() - 3);

    const dia = String(data.getDate()).padStart(2, "0");
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, "0");
    const min = String(data.getMinutes()).padStart(2, "0");

    return `${dia}/${mes}/${ano} - ${hora}:${min} Horário de Brasília`;
}

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const sock = makeWASocket({ auth: state });

    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log('Escaneie este QR Code:\n');
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'open') {
            console.log('✅ Conectado ao WhatsApp!');
        }
        if (connection === 'close') {
            console.log('❌ Conexão fechada, reiniciando...');
            iniciarBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify" || !messages || !messages[0]) return;

        const msg = messages[0];
        const jid = msg.key.remoteJid;

        if (jid !== process.env.GRUPO_PERMITIDO) return;

        const texto = getTextoMensagem(msg);
        if (!texto) return;

        console.log("📝 Texto recebido:", texto);

        if (texto.startsWith("http")) {
            await sock.sendMessage(jid, { text: "⏳ Lendo a matéria..." });
            const conteudo = await extrairDadosDaMateria(texto);

            if (!conteudo) {
                return sock.sendMessage(jid, { text: "❌ Não consegui ler a página por algum motivo, verifique o log nos servidor." });
            }

            await sock.sendMessage(jid, { text: "🧠 Gerando resumo..." });

            const resumo = await resumir(conteudo.texto);

            const mensagemFinal = [
                `🕑: ${conteudo.dataHora.toString().trim()}`,
                `✍️: ${conteudo.portal.trim()}`,
                `📰: ${conteudo.titulo.trim()}`,
                '',
                `✒️ Resumo:\n${resumo.trim()}`
            ].join('\n');


            console.log('📝 Texto resumido e traduzido: ', mensagemFinal);

            await sock.sendMessage(jid, { text: mensagemFinal });
        }
    });

    sock.ev.on("creds.update", saveCreds);
}

iniciarBot();