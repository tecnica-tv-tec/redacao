// =============================================================== TRANSCRIÇÃO (transcribe.so)
// O áudio vai direto do navegador para o transcribe.so, com a chave de API da própria pessoa.
// A chave fica guardada só neste aparelho: nunca entra no banco do sistema nem no repositório.
const TSO_API = 'https://transcribe.so/api/v1';
const TSO_MAX = 1024 * 1024 * 1024;            // 1 GB no envio direto
const TSO_USD_HORA = 1;                        // preço avulso informado pelo serviço
const TSO_TIPOS = {
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  flac: 'audio/flac', weba: 'audio/webm', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', avi: 'video/x-msvideo',
};
const tsoKeyName = () => `redacao:tso-key:${S.me.id}`;
const tsoPendName = (id) => `redacao:tso-job:${S.me.id}:${id || 'nova'}`;
const tsoLer = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const tsoGravar = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* armazenamento indisponível */ } };

async function tsoApi(key, method, path, body) {
  let r;
  try {
    r = await fetch(TSO_API + path, { method, headers: Object.assign({ Authorization: 'Bearer ' + key }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error('Sem comunicação com o transcribe.so. Verifique a internet.'), { rede: true }); }
  let data = null; try { data = await r.json(); } catch { /* vazio */ }
  if (r.ok) return data || {};
  const code = (data && data.error && data.error.code) || '';
  const msg = r.status === 401 ? 'Chave do transcribe.so inválida ou revogada.'
    : code === 'scope_forbidden' ? 'Esta chave é só de leitura. Crie uma chave com acesso completo.'
    : code === 'max_charge_exceeded' ? 'O custo calculado passou do valor estimado. Nada foi cobrado.'
    : r.status === 402 ? 'Saldo, horas incluídas ou limite de gastos insuficiente no transcribe.so.'
    : r.status === 429 ? 'Muitos pedidos ao transcribe.so. Aguarde um minuto.'
    : `transcribe.so: ${(data && data.error && data.error.message) || 'erro ' + r.status}`;
  throw Object.assign(new Error(msg), { status: r.status, code });
}
// duração em segundos lida no próprio navegador (0 quando o formato não permite)
function tsoDuracao(file) {
  return new Promise((ok) => {
    const m = document.createElement('video'), url = URL.createObjectURL(file);
    const fim = (v) => { clearTimeout(t); URL.revokeObjectURL(url); ok(Number.isFinite(v) && v > 0 ? Math.ceil(v) : 0); };
    const t = setTimeout(() => fim(0), 8000);
    m.preload = 'metadata'; m.onloadedmetadata = () => fim(m.duration); m.onerror = () => fim(0); m.src = url;
  });
}
function tsoEnviarArquivo(url, file, tipo, progresso) {
  return new Promise((ok, falha) => {
    const x = new XMLHttpRequest(); x.open('PUT', url); x.setRequestHeader('Content-Type', tipo);
    x.upload.onprogress = (e) => { if (e.lengthComputable) progresso(Math.round(e.loaded * 100 / e.total)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? ok() : falha(new Error('O envio do arquivo falhou (' + x.status + ').')));
    x.onerror = () => falha(new Error('O envio do arquivo foi interrompido. Verifique a internet.'));
    x.send(file);
  });
}
async function tsoSegmentos(key, id) {
  let todos = [], offset = 0, mais = true;
  while (mais) {
    const r = await tsoApi(key, 'GET', `/transcriptions/${encodeURIComponent(id)}/result?include=segments&segments_limit=1000&segments_offset=${offset}`);
    const s = r.segments || [];
    todos = todos.concat(s); offset += s.length;
    mais = !!(r.segments_meta && r.segments_meta.has_more && s.length);
  }
  return todos;
}
const tsoTempo = (s) => { const t = Math.floor(s || 0), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
// junta falas seguidas da mesma pessoa; formato 'sonoras' usa a marcação de roteiro do sistema
function tsoTexto(segs, formato) {
  const blocos = [], nomes = new Map();
  segs.forEach(s => {
    const texto = String(s.text || '').trim(); if (!texto) return;
    const quem = s.speaker || '';
    if (quem && !nomes.has(quem)) nomes.set(quem, nomes.size + 1);
    const u = blocos[blocos.length - 1];
    if (u && u.quem === quem) u.texto.push(texto); else blocos.push({ quem, inicio: s.start_seconds, texto: [texto] });
  });
  if (formato === 'corrido') return blocos.map(b => b.texto.join(' ')).join('\n\n');
  return blocos.map(b => `[SONORA] FALANTE${b.quem ? ' ' + nomes.get(b.quem) : ''} (${tsoTempo(b.inicio)})\n${b.texto.join(' ')}`).join('\n\n');
}

// pautaId: pauta que vai receber o texto; textarea(): campo da matéria que está na tela
function abrirTranscricao(pautaId, textarea) {
  const md = modal('Transcrever áudio ou vídeo', `
    <div class="tso">
      <div id="tso-chave-box">
        <div class="field"><label for="tso-chave">Sua chave de API do transcribe.so</label>
          <input type="password" id="tso-chave" autocomplete="off" placeholder="tsk_live_…" value="${esc(tsoLer(tsoKeyName()))}">
          <span class="hint">Crie em <a href="https://transcribe.so/settings/api-keys" target="_blank" rel="noopener">transcribe.so → API keys</a>, com acesso completo e um limite de gastos mensal. A chave fica guardada só neste aparelho.</span></div>
        <button class="btn sm" id="tso-esquecer" type="button">Esquecer a chave</button>
      </div>
      <div class="field"><label for="tso-arq">Arquivo de áudio ou vídeo (até 1 GB)</label>
        <input type="file" id="tso-arq" accept="audio/*,video/*,.${Object.keys(TSO_TIPOS).join(',.')}"></div>
      <div class="field" id="tso-min-box" hidden><label for="tso-min">Duração aproximada em minutos</label><input type="number" id="tso-min" min="1" step="1"></div>
      <p class="hint" id="tso-custo"></p>
      <p class="hint">O arquivo é enviado ao transcribe.so, um serviço externo e pago (cerca de US$ ${TSO_USD_HORA} por hora de áudio, ou as horas do seu plano). Confirme se o material pode sair da emissora.</p>
      <p class="tso-status" id="tso-status" role="status"></p>
      <div id="tso-res" hidden>
        <div class="field"><label for="tso-fmt">Formato</label><select id="tso-fmt"><option value="sonoras">Sonoras separadas por falante</option><option value="corrido">Texto corrido</option></select></div>
        <div class="field"><label for="tso-txt">Transcrição (confira antes de usar: pode conter erros)</label><textarea id="tso-txt" rows="12"></textarea></div>
      </div>
    </div>`,
    { wide: true, footer: '<button class="btn" data-close>Fechar</button><button class="btn" id="tso-retomar" hidden>Retomar transcrição anterior</button><button class="btn primary" id="tso-enviar" disabled>Enviar e transcrever</button><button class="btn primary" id="tso-inserir" hidden>Inserir na matéria</button>' });
  const q = (s) => $(s, md.el);
  const chave = q('#tso-chave'), arq = q('#tso-arq'), enviar = q('#tso-enviar'), retomar = q('#tso-retomar'), status = q('#tso-status');
  let dur = 0, ocupado = false, segs = [], escolha = 0;
  const aberto = () => md.el.isConnected;
  const diz = (t, erro) => { status.textContent = t; status.classList.toggle('e', !!erro); };
  const segundos = () => dur || Math.round((+q('#tso-min').value || 0) * 60);
  const botoes = () => {
    enviar.disabled = ocupado || !chave.value.trim() || !arq.files[0] || !segundos();
    retomar.hidden = !tsoLer(tsoPendName(pautaId)) || !!segs.length;
    retomar.disabled = ocupado || !chave.value.trim();
  };
  const custo = () => { const s = segundos(); q('#tso-custo').textContent = s ? `Duração: ${tsoTempo(s)} · custo avulso estimado: US$ ${(s / 3600 * TSO_USD_HORA).toFixed(2)}` : ''; botoes(); };
  chave.oninput = () => { tsoGravar(tsoKeyName(), chave.value.trim()); botoes(); };
  q('#tso-esquecer').onclick = () => { chave.value = ''; chave.oninput(); toast('Chave removida deste aparelho.'); };
  q('#tso-min').oninput = custo;
  arq.onchange = async () => {
    const f = arq.files[0], vez = ++escolha; dur = 0; q('#tso-min').value = ''; q('#tso-min-box').hidden = true; diz(''); custo();
    if (!f) return;
    if (!TSO_TIPOS[(f.name.split('.').pop() || '').toLowerCase()]) { arq.value = ''; diz('Formato não aceito. Use MP3, WAV, M4A, AAC, OGG, FLAC, MP4, WEBM, MOV ou AVI.', true); return botoes(); }
    if (f.size > TSO_MAX) { arq.value = ''; diz('Arquivo maior que 1 GB. Exporte só o áudio (MP3) e envie de novo.', true); return botoes(); }
    const d = await tsoDuracao(f);
    if (vez !== escolha) return;
    dur = d; q('#tso-min-box').hidden = !!d; custo();
  };
  const aguardar = async (key, id) => {
    diz('Transcrevendo… pode fechar esta janela e usar "Retomar" depois.');
    while (aberto()) {
      const r = await tsoApi(key, 'GET', `/transcriptions/${encodeURIComponent(id)}/wait?timeout=30`);
      if (r.status === 'failed' || r.status === 'cancelled') { tsoGravar(tsoPendName(pautaId), ''); throw new Error('O transcribe.so não conseguiu transcrever este arquivo.'); }
      if (r.status === 'completed') break;
      if (!r._timed_out) await new Promise(ok => setTimeout(ok, 4000));
    }
    if (!aberto()) return;
    segs = await tsoSegmentos(key, id);
    q('#tso-res').hidden = false; q('#tso-txt').value = tsoTexto(segs, q('#tso-fmt').value);
    q('#tso-inserir').hidden = !segs.length; enviar.hidden = true;
    diz(segs.length ? 'Transcrição pronta.' : 'Nenhuma fala foi encontrada no arquivo.');
  };
  const rodar = async (tarefa) => {
    ocupado = true; botoes();
    try { await tarefa(); } catch (e) { diz(e.message, true); }
    ocupado = false; botoes();
  };
  enviar.onclick = () => rodar(async () => {
    const key = chave.value.trim(), f = arq.files[0], s = segundos();
    const tipo = TSO_TIPOS[f.name.split('.').pop().toLowerCase()];
    if (tsoLer(tsoPendName(pautaId)) && !confirm('Já existe uma transcrição desta pauta que não foi inserida. Enviar outro arquivo mesmo assim? Isso gera nova cobrança.')) return;
    diz('Preparando o envio…');
    const up = await tsoApi(key, 'POST', '/uploads', { filename: f.name, content_type: tipo, file_size: f.size });
    await tsoEnviarArquivo(up.upload_url, f, tipo, (pct) => diz(`Enviando o arquivo… ${pct}%`));
    if (!aberto()) return;   // fechou durante o envio: não inicia (nem cobra) a transcrição
    const pedido = { source: 'upload', upload_id: up.upload_id, original_filename: f.name, duration_seconds: s, language: 'pt',
      max_charge_usd: Math.ceil((s / 3600 * TSO_USD_HORA * 1.1 + 0.05) * 100) / 100 };
    let job;
    try { job = await tsoApi(key, 'POST', '/transcriptions', pedido); }
    catch (e) { if (e.code !== 'unsupported_language') throw e; job = await tsoApi(key, 'POST', '/transcriptions', Object.assign(pedido, { language: 'auto' })); }
    tsoGravar(tsoPendName(pautaId), job.id);
    await aguardar(key, job.id);
  });
  retomar.onclick = () => rodar(() => aguardar(chave.value.trim(), tsoLer(tsoPendName(pautaId))));
  q('#tso-fmt').onchange = (e) => { q('#tso-txt').value = tsoTexto(segs, e.target.value); };
  q('#tso-inserir').onclick = () => {
    const ta = textarea(), texto = q('#tso-txt').value.trim();
    if (!ta || ta.readOnly || ta.disabled) return diz('A matéria não está liberada para edição. Copie o texto acima.', true);
    ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n\n' : '') + texto;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    tsoGravar(tsoPendName(pautaId), ''); md.close(); toast('Transcrição inserida na matéria.');
  };
  botoes();
}
