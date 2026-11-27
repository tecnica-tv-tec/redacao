// =============================================================== SAÍDA DOS OPERADORES (espelho em tela cheia)
// Só leitura: acompanha o espelho e os OKs do modo "No ar", atualizando sozinho.
function abrirSaida() {
  if (!S.rundown || $('#saida')) return;
  const ov = document.createElement('div'); ov.id = 'saida'; ov.className = 'saida';
  ov.innerHTML = '<header class="sd-top"></header><div class="sd-lista"></div><footer class="sd-base"></footer>';
  document.body.appendChild(ov);
  if (document.activeElement) document.activeElement.blur();
  const topo = $('.sd-top', ov), lista = $('.sd-lista', ov), base = $('.sd-base', ov);
  const id = S.rundown.id;
  let rd = S.rundown, seguindo = '', ultima = Date.now(), vivo = true, trava = null, cheia = false;
  const segs = (iso) => new Date(iso).getTime() / 1000;
  const calc = () => {
    const C = computeRundown(rd), validas = C.rows.filter(r => !r.dead);
    const comecou = !!rd.noArInicio, acabou = rd.status === 'encerrado', noAr = comecou && !acabou;
    const i = validas.findIndex(r => !r.it.aoArAt);
    const atual = i >= 0 && !acabou ? validas[i] : null, proxima = atual ? validas[i + 1] : null;
    const oks = validas.map(r => r.it.aoArAt).filter(Boolean).map(segs);
    const desde = noAr ? Math.max(segs(rd.noArInicio), ...oks) : 0;
    const decorrido = noAr && atual ? Math.max(0, Date.now() / 1000 - desde) : 0;
    const falta = i < 0 ? 0 : validas.slice(i).reduce((a, r) => a + r.total, 0) - Math.min(decorrido, atual ? atual.total : 0);
    const d = new Date(), agora = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    const fimPrevisto = C.start + C.previsto, fim = noAr ? agora + falta : C.fim;
    return { C, atual, proxima, comecou, acabou, noAr, decorrido, fim, saldo: fimPrevisto - fim };
  };
  const quadro = (rotulo, valor, cls = '') => `<div class="sd-q ${cls}"><span>${rotulo}</span><b>${valor}</b></div>`;
  // relógio e barra de baixo mudam a cada segundo; a tabela só quando o espelho muda
  const relogio = () => {
    const K = calc(), { atual, proxima } = K;
    const situacao = K.acabou ? ['enc', 'ENCERRADO'] : K.comecou ? ['live', 'NO AR'] : ['pre', 'PRÉ-AR'];
    const atraso = Date.now() - ultima > 10000;
    topo.innerHTML = `<span class="oa-badge ${situacao[0]}">● ${situacao[1]}</span>
      <div class="sd-prog"><b>${esc(rd.program.name)}</b><span>${esc(weekday(rd.data))}, ${fmtDate(rd.data)}</span>${atraso ? '<span class="sd-alerta">⚠ Sem atualização — verifique a internet</span>' : ''}</div>
      <div class="sd-qs">${quadro('Relógio', new Date().toLocaleTimeString('pt-BR'), 'hora')}${quadro('Início', fmtClock(K.C.start))}${quadro('Total', fmtDur(K.C.total, true))}${quadro('Término', fmtClock(K.fim))}${quadro(K.saldo >= 0 ? 'Sobra' : 'Estouro', fmtDur(Math.abs(K.saldo)), K.saldo < 0 ? 'estouro' : 'sobra')}</div>
      <button class="btn" data-sd="fechar" title="Esc">Fechar</button>`;
    const passou = atual && atual.total && K.decorrido > atual.total;
    base.innerHTML = atual ? `
      <div class="sd-agora"><span>${K.noAr ? 'NO AR' : 'PRIMEIRA'}</span><b>${atual.pagina} · ${esc(atual.it.retranca)}</b></div>
      <div class="sd-tempo ${passou ? 'estouro' : ''}"><b>${K.noAr ? fmtDur(K.decorrido) : '00:00'}</b><small>/ ${fmtDur(atual.total)}</small></div>
      <div class="sd-deixa"><span>DEIXA</span><b>${atual.it.deixa ? esc(atual.it.deixa) : '—'}</b></div>
      <div class="sd-seguir"><span>A SEGUIR</span><b>${proxima ? `${proxima.pagina} · ${esc(proxima.it.retranca)}` : 'fim do espelho'}</b></div>`
      : `<div class="sd-agora"><b>${K.acabou ? 'Jornal encerrado.' : 'Todas as retrancas foram ao ar.'}</b></div>`;
  };
  const tabela = () => {
    const { C, atual, proxima, noAr } = calc(); let bloco = 0;
    lista.innerHTML = `<table><thead><tr><th>Pág</th><th class="sd-ret">Retranca</th><th>Tipo</th><th class="sd-opc">Apresentador</th><th class="sd-opc">Repórter</th><th class="num sd-opc">Cab</th><th class="num sd-opc">VT</th><th class="num">Total</th><th class="num">No ar</th><th>Status</th></tr></thead><tbody>
      ${C.rows.map(r => {
        const it = r.it; let cab = '';
        if (!r.isBreak && r.block !== bloco) { bloco = r.block; cab = `<tr class="sd-bloco"><td colspan="10">BLOCO ${r.block}</td></tr>`; }
        const marca = atual && atual.it.id === it.id ? 'atual' : noAr && proxima && proxima.it.id === it.id ? 'proxima' : '';
        const status = it.aoArAt ? '✓ Exibida' : r.dead ? 'Caiu' : marca === 'atual' && noAr ? '● No ar' : r.isBreak ? '' : label(ITEM_STATUS, it.status);
        return `${cab}<tr class="${marca} ${it.aoArAt ? 'exibida' : ''} ${r.dead ? 'caiu' : ''} ${r.isBreak ? 'intervalo' : ''}"><td>${r.pagina}</td><td class="sd-ret">${esc(it.retranca)}</td><td>${esc(it.tipo)}</td><td class="sd-opc">${esc(it.apresentador)}</td><td class="sd-opc">${esc(it.reporter)}</td><td class="num sd-opc">${r.isBreak ? '' : fmtDur(r.cab)}</td><td class="num sd-opc">${fmtDur(r.vt)}</td><td class="num"><b>${fmtDur(r.total)}</b></td><td class="num">${fmtClock(r.hora)}</td><td>${esc(status)}</td></tr>`;
      }).join('') || '<tr><td colspan="10">Espelho vazio.</td></tr>'}</tbody></table>`;
    // acompanha a retranca atual quando ela muda; no resto do tempo a rolagem é livre
    const chave = atual ? atual.it.id : '';
    if (chave !== seguindo) { seguindo = chave; const tr = $('tr.atual', lista); if (tr) tr.scrollIntoView({ block: 'center' }); }
  };
  const buscar = async () => {
    try {
      const novo = await api('GET', '/api/rundowns/' + id);
      if (!vivo) return;
      ultima = Date.now();
      const mudou = JSON.stringify(novo) !== JSON.stringify(rd); rd = novo;
      if (mudou) { tabela(); relogio(); }
    } catch { /* o aviso de atraso aparece no topo */ }
  };
  // mantém a tela acesa enquanto a saída está aberta (quando o navegador permite)
  const acender = async () => { try { if (vivo && navigator.wakeLock && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen'); } catch { /* sem suporte */ } };
  const tick = setInterval(relogio, 1000), poll = setInterval(buscar, 2000);
  const tecla = (e) => { if (e.key === 'Escape') { e.preventDefault(); fechar(); } };
  const mudouTela = () => { if (document.fullscreenElement === ov) cheia = true; else if (cheia) fechar(); };
  function fechar() {
    if (!vivo) return; vivo = false;
    clearInterval(tick); clearInterval(poll);
    document.removeEventListener('keydown', tecla); document.removeEventListener('fullscreenchange', mudouTela); document.removeEventListener('visibilitychange', acender); window.removeEventListener('hashchange', fechar);
    if (trava) trava.release().catch(() => {});
    if (document.fullscreenElement === ov) document.exitFullscreen().catch(() => {});
    ov.remove();
  }
  ov.onclick = (e) => { if (e.target.closest('[data-sd=fechar]')) fechar(); };
  // o topo é redesenhado a cada segundo: o botão responde já ao apertar
  ov.onpointerdown = (e) => { if (e.target.closest('[data-sd=fechar]')) fechar(); };
  document.addEventListener('keydown', tecla); document.addEventListener('fullscreenchange', mudouTela); document.addEventListener('visibilitychange', acender); window.addEventListener('hashchange', fechar);
  tabela(); relogio(); acender(); buscar();
  if (ov.requestFullscreen) ov.requestFullscreen().catch(() => { /* sem tela cheia (ex.: iPhone): a saída ocupa a janela */ });
}
