const fetch = require('node-fetch');
require('dotenv').config();

async function resumir(texto) {
    console.log('🟡 Resumindo texto: ', texto);
    const url = 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn?wait_for_model=true';
    const headers = {
    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
    'Content-Type': 'application/json'
    };

    const body = JSON.stringify({
    inputs: `Summarize briefly: ${texto}`
    });

    const res = await fetch(url, { method: 'POST', headers, body });
    const data = await res.json();

    if (Array.isArray(data) && data[0].summary_text) {
    return data[0].summary_text;
    } else {
    console.error('Erro ao resumir:', data);
    return 'Erro ao gerar resumo.\nErro interno: ' + data.error;
    }
}

module.exports = { resumir };