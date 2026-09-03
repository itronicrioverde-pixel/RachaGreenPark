import {
  getApps,
  getApp
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js';


const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';

let auth = null;
let firebaseUser = null;
let currentTournament = null;
let players = [];
let catalog = [];
let catalogLoaded = false;
let loadRunning = false;

let obterTorneioAtualCall;
let listarJogadoresTorneioCall;
let listarCatalogoJogadoresTorneioCall;
let adicionarJogadorTorneioCall;
let removerJogadorTorneioCall;
let definirPagamentoJogadorTorneioCall;
let salvarTaxaInscricaoTorneioCall;


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid === ADMIN_UID
  );
}


function moneyBR(value){
  const amount = Number(value || 0);

  if(
    !Number.isFinite(amount) ||
    amount <= 0
  ){
    return 'A DEFINIR';
  }

  return amount.toLocaleString(
    'pt-BR',
    {
      style:'currency',
      currency:'BRL'
    }
  );
}


function initials(name){
  return String(name || 'J')
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase() || 'J';
}


function avatar(player){
  const el =
    document.createElement('div');

  el.className =
    'gptv3-avatar';

  const url =
    String(
      player?.photoURL ||
      ''
    ).trim();

  if(
    url.startsWith('https://') ||
    url.startsWith('http://')
  ){
    const img =
      document.createElement('img');

    img.src = url;
    img.alt =
      player?.name ||
      'Jogador';

    img.loading = 'lazy';

    img.addEventListener(
      'error',
      () => {
        el.innerHTML = '';
        el.textContent =
          initials(player?.name);
      },
      {once:true}
    );

    el.appendChild(img);
  }else{
    el.textContent =
      initials(player?.name);
  }

  return el;
}


function statusBox(
  message = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv3Status'
    );

  if(!el) return;

  el.textContent = message;

  el.className =
    'gptv3-status' +
    (type ? ' ' + type : '');
}


function ensureStyle(){
  if(
    document.getElementById(
      'greenpark-tournament-players-v3-style'
    )
  ){
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'greenpark-tournament-players-v3-style';

  style.textContent = `
/* GREENPARK_TOURNAMENT_PLAYERS_V3 */

.gptournament-tabs{
  display:flex!important;
  grid-template-columns:none!important;
  gap:6px!important;
  overflow-x:auto;
  scrollbar-width:none;
  padding-bottom:2px;
}
.gptournament-tabs::-webkit-scrollbar{display:none}
.gptournament-tab{
  flex:0 0 auto!important;
  min-width:82px;
  padding-left:9px!important;
  padding-right:9px!important;
}

.gptv3-fee{
  min-height:54px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-bottom:10px;
  padding:11px 12px;
  border:1px solid rgba(86,213,46,.24);
  border-radius:12px;
  background:#0b1912;
}
.gptv3-fee span{
  color:#84958c;
  font-size:8px;
  font-weight:950;
}
.gptv3-fee strong{
  color:var(--green2);
  font-size:15px;
}

.gptv3-admin{
  display:none;
  margin-bottom:11px;
  padding:12px;
  border:1px solid rgba(86,213,46,.22);
  border-radius:14px;
  background:#0b1712;
}
.gptv3-admin.show{display:block}

.gptv3-metrics{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:5px;
  margin-bottom:13px;
}
.gptv3-metrics div{
  min-width:0;
  padding:9px 3px;
  border:1px solid #2a4035;
  border-radius:9px;
  background:#101b16;
  text-align:center;
}
.gptv3-metrics strong{
  display:block;
  color:#fff;
  font-size:16px;
}
.gptv3-metrics span{
  display:block;
  margin-top:4px;
  color:#819188;
  font-size:6px;
  font-weight:950;
}

.gptv3-label{
  margin:12px 0 6px;
  color:#a9b5ae;
  font-size:8px;
  font-weight:950;
  letter-spacing:.06em;
}

.gptv3-fee-editor{
  display:grid;
  grid-template-columns:minmax(0,1fr) 82px;
  gap:7px;
}
.gptv3-money{
  height:44px;
  display:grid;
  grid-template-columns:35px minmax(0,1fr);
  align-items:center;
  overflow:hidden;
  border:1px solid #34464e;
  border-radius:10px;
  background:#111a21;
}
.gptv3-money span{
  height:100%;
  display:grid;
  place-items:center;
  border-right:1px solid #34464e;
  color:#8a9991;
  font-size:9px;
  font-weight:950;
}
.gptv3-money input{
  width:100%;
  min-width:0;
  height:100%;
  padding:0 10px;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
}
#gptv3FeeSave{
  border:0;
  border-radius:10px;
  background:var(--green);
  color:#0d1a0e;
  font-size:8px;
  font-weight:950;
}

.gptv3-search{
  height:45px;
  display:grid;
  grid-template-columns:34px minmax(0,1fr);
  align-items:center;
  border:1px solid #34464e;
  border-radius:10px;
  background:#111a21;
}
.gptv3-search span{
  text-align:center;
  color:var(--green2);
  font-size:18px;
}
.gptv3-search input{
  width:100%;
  min-width:0;
  height:100%;
  padding:0 10px 0 0;
  border:0;
  outline:none;
  background:transparent;
  color:#fff;
}

.gptv3-results{
  max-height:250px;
  margin-top:7px;
  overflow:auto;
  border:1px solid #283a31;
  border-radius:10px;
  background:#0d1713;
}
.gptv3-help{
  padding:12px;
  color:#7d8d85;
  font-size:9px;
  line-height:1.4;
  text-align:center;
}
.gptv3-search-row{
  min-height:58px;
  display:grid;
  grid-template-columns:40px minmax(0,1fr) auto;
  gap:8px;
  align-items:center;
  padding:8px;
  border-bottom:1px solid #22342b;
}
.gptv3-search-row:last-child{border-bottom:0}
.gptv3-search-row strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:9.5px;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.gptv3-search-row button{
  min-height:34px;
  padding:0 8px;
  border:1px solid var(--green);
  border-radius:8px;
  background:#15351a;
  color:var(--green2);
  font-size:7px;
  font-weight:950;
}

.gptv3-note{
  margin-top:8px;
  color:#75877d;
  font-size:8px;
  line-height:1.45;
}

.gptv3-status{
  min-height:14px;
  margin-top:8px;
  color:#85958c;
  font-size:8px;
}
.gptv3-status.ok{color:var(--green2)}
.gptv3-status.error{color:#ff9b9b}

.gptv3-list{
  display:flex;
  flex-direction:column;
  gap:7px;
}
.gptv3-empty{
  min-height:110px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  border:1px dashed #344b3f;
  border-radius:12px;
  background:#0b1612;
  color:#829188;
  font-size:9px;
  text-align:center;
}

.gptv3-row{
  display:grid;
  grid-template-columns:44px minmax(0,1fr);
  gap:9px;
  align-items:start;
  padding:10px;
  border:1px solid #2c4036;
  border-radius:12px;
  background:#0c1713;
}
.gptv3-avatar{
  width:44px;
  height:44px;
  display:grid;
  place-items:center;
  overflow:hidden;
  border:1px solid rgba(86,213,46,.24);
  border-radius:50%;
  background:#17231d;
  color:#fff;
  font-size:10px;
  font-weight:950;
}
.gptv3-avatar img{
  width:100%;
  height:100%;
  object-fit:cover;
}
.gptv3-main{min-width:0}
.gptv3-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:6px;
}
.gptv3-top strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:10px;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.gptv3-meta{
  display:block;
  margin-top:4px;
  color:#75857c;
  font-size:7px;
}

.gptv3-badge{
  flex:0 0 auto;
  min-height:21px;
  display:inline-flex;
  align-items:center;
  padding:0 7px;
  border-radius:999px;
  font-size:6px;
  font-weight:950;
}
.gptv3-badge.pending{
  border:1px solid #735d28;
  background:#2d2718;
  color:#f2ca63;
}
.gptv3-badge.paid{
  border:1px solid #317447;
  background:#12331d;
  color:#7bea98;
}
.gptv3-badge.exempt{
  border:1px solid #4c5e69;
  background:#17222a;
  color:#b8c6ce;
}

.gptv3-actions{
  display:flex;
  flex-wrap:wrap;
  gap:4px;
  margin-top:8px;
}
.gptv3-actions button{
  min-height:29px;
  padding:0 7px;
  border:1px solid #34464e;
  border-radius:7px;
  background:#111a20;
  color:#8f9d96;
  font-size:6px;
  font-weight:950;
}
.gptv3-actions .active.paid{
  border-color:#3b8f50;
  background:#15361d;
  color:#83ed99;
}
.gptv3-actions .active.pending{
  border-color:#8b6d2c;
  background:#342b17;
  color:#f1ca64;
}
.gptv3-actions .active.exempt{
  border-color:#61727f;
  background:#1b2831;
  color:#c0ccd3;
}
.gptv3-actions .remove{
  margin-left:auto;
  border-color:rgba(219,73,73,.54);
  background:rgba(100,25,29,.16);
  color:#ff9292;
}

@media(max-width:370px){
  .gptv3-metrics{
    grid-template-columns:repeat(2,1fr);
  }
  .gptournament-tab{
    min-width:78px;
  }
}
`;

  document.head.appendChild(style);
}


function ensureUi(){
  ensureStyle();

  const view =
    document.getElementById(
      'tournamentsView'
    );

  if(!view) return false;

  const tabs =
    view.querySelector(
      '.gptournament-tabs'
    );

  if(!tabs) return false;

  if(
    !document.getElementById(
      'gptv3PlayersTab'
    )
  ){
    tabs
      .querySelectorAll(
        '[data-tournament-tab]'
      )
      .forEach(
        button =>
          button.classList.remove(
            'active'
          )
      );

    const button =
      document.createElement(
        'button'
      );

    button.type = 'button';
    button.id =
      'gptv3PlayersTab';

    button.className =
      'gptournament-tab active';

    button.dataset.tournamentTab =
      'players-v3';

    button.textContent =
      'JOGADORES';

    tabs.prepend(button);

    button.addEventListener(
      'click',
      () => {
        view
          .querySelectorAll(
            '[data-tournament-tab]'
          )
          .forEach(item => {
            item.classList.toggle(
              'active',
              item === button
            );
          });

        view
          .querySelectorAll(
            '[data-tournament-panel]'
          )
          .forEach(item => {
            item.classList.toggle(
              'active',
              item.dataset
                .tournamentPanel ===
                'players-v3'
            );
          });

        loadTournamentPlayers();
      }
    );
  }

  if(
    !document.getElementById(
      'gptv3Panel'
    )
  ){
    const firstPanel =
      view.querySelector(
        '.gptournament-panel'
      );

    if(!firstPanel) return false;

    firstPanel.classList.remove(
      'active'
    );

    const panel =
      document.createElement(
        'section'
      );

    panel.id = 'gptv3Panel';

    panel.className =
      'gptournament-panel active';

    panel.dataset.tournamentPanel =
      'players-v3';

    panel.innerHTML = `
      <div class="gptournament-panel-head">
        <div>
          <strong>Jogadores do torneio</strong>
          <span>Separado do racha semanal</span>
        </div>
        <b id="gptv3Count">0</b>
      </div>

      <div class="gptv3-fee">
        <span>VALOR DA INSCRIÇÃO</span>
        <strong id="gptv3FeeLabel">
          A DEFINIR
        </strong>
      </div>

      <div class="gptv3-admin" id="gptv3Admin">
        <div class="gptv3-metrics">
          <div>
            <strong id="gptv3Total">0</strong>
            <span>INSCRITOS</span>
          </div>
          <div>
            <strong id="gptv3Paid">0</strong>
            <span>PAGOS</span>
          </div>
          <div>
            <strong id="gptv3Pending">0</strong>
            <span>PENDENTES</span>
          </div>
          <div>
            <strong id="gptv3Exempt">0</strong>
            <span>ISENTOS</span>
          </div>
        </div>

        <div class="gptv3-label">
          VALOR POR JOGADOR
        </div>

        <div class="gptv3-fee-editor">
          <div class="gptv3-money">
            <span>R$</span>
            <input
              id="gptv3FeeInput"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              inputmode="decimal"
              placeholder="0,00"
            >
          </div>

          <button id="gptv3FeeSave" type="button">
            SALVAR
          </button>
        </div>

        <div class="gptv3-label">
          ADICIONAR JOGADOR
        </div>

        <div class="gptv3-search">
          <span>⌕</span>
          <input
            id="gptv3Search"
            type="search"
            autocomplete="off"
            placeholder="Buscar jogador cadastrado..."
          >
        </div>

        <div class="gptv3-results" id="gptv3Results">
          <div class="gptv3-help">
            Digite pelo menos 2 letras.
          </div>
        </div>

        <div class="gptv3-note">
          Jogador novo? Ele faz o cadastro normal no
          Green Park e depois aparece nesta busca.
        </div>

        <div class="gptv3-status" id="gptv3Status"></div>
      </div>

      <div class="gptv3-list" id="gptv3List">
        <div class="gptv3-empty">
          Carregando jogadores...
        </div>
      </div>
    `;

    firstPanel.before(panel);

    document
      .getElementById(
        'gptv3FeeSave'
      )
      ?.addEventListener(
        'click',
        saveFee
      );

    document
      .getElementById(
        'gptv3Search'
      )
      ?.addEventListener(
        'input',
        renderSearch
      );
  }

  refreshAdminVisibility();

  return true;
}


function refreshAdminVisibility(){
  const box =
    document.getElementById(
      'gptv3Admin'
    );

  if(box){
    box.classList.toggle(
      'show',
      isAdmin()
    );
  }
}


function setMetrics(counts = {}){
  const map = {
    gptv3Total:
      Number(counts.total || 0),
    gptv3Paid:
      Number(counts.paid || 0),
    gptv3Pending:
      Number(counts.pending || 0),
    gptv3Exempt:
      Number(counts.exempt || 0)
  };

  Object.entries(map)
    .forEach(([id,value]) => {
      const el =
        document.getElementById(id);

      if(el){
        el.textContent =
          String(value);
      }
    });
}


function renderList(
  fee = 0,
  counts = {}
){
  const list =
    document.getElementById(
      'gptv3List'
    );

  if(!list) return;

  const count =
    document.getElementById(
      'gptv3Count'
    );

  if(count){
    count.textContent =
      String(players.length);
  }

  const feeLabel =
    document.getElementById(
      'gptv3FeeLabel'
    );

  if(feeLabel){
    feeLabel.textContent =
      moneyBR(fee);
  }

  const feeInput =
    document.getElementById(
      'gptv3FeeInput'
    );

  if(
    feeInput &&
    isAdmin()
  ){
    feeInput.value =
      Number(fee || 0) > 0 ?
        String(Number(fee)) :
        '';
  }

  setMetrics(counts);

  list.innerHTML = '';

  if(players.length === 0){
    list.innerHTML =
      '<div class="gptv3-empty">' +
      'Nenhum jogador inscrito neste campeonato.' +
      '</div>';

    renderSearch();
    return;
  }

  players.forEach(player => {
    const row =
      document.createElement(
        'article'
      );

    row.className =
      'gptv3-row';

    row.appendChild(
      avatar(player)
    );

    const main =
      document.createElement(
        'div'
      );

    main.className =
      'gptv3-main';

    const top =
      document.createElement(
        'div'
      );

    top.className =
      'gptv3-top';

    const name =
      document.createElement(
        'strong'
      );

    name.textContent =
      String(
        player?.name ||
        'Jogador'
      ).toLocaleUpperCase(
        'pt-BR'
      );

    top.appendChild(name);

    if(isAdmin()){
      const status =
        String(
          player
            ?.paymentStatus ||
          'pending'
        );

      const badge =
        document.createElement(
          'span'
        );

      badge.className =
        'gptv3-badge ' +
        status;

      badge.textContent =
        status === 'paid' ?
          'PAGO' :
          status === 'exempt' ?
            'ISENTO' :
            'PENDENTE';

      top.appendChild(badge);
    }

    const meta =
      document.createElement(
        'span'
      );

    meta.className =
      'gptv3-meta';

    meta.textContent =
      player?.teamId ?
        'EQUIPE DEFINIDA' :
        'SEM EQUIPE DEFINIDA';

    main.append(
      top,
      meta
    );

    if(isAdmin()){
      const actions =
        document.createElement(
          'div'
        );

      actions.className =
        'gptv3-actions';

      [
        ['pending','PENDENTE'],
        ['paid','PAGO'],
        ['exempt','ISENTO']
      ].forEach(
        ([status,label]) => {
          const button =
            document.createElement(
              'button'
            );

          button.type =
            'button';

          button.textContent =
            label;

          if(
            player.paymentStatus ===
            status
          ){
            button.classList.add(
              'active',
              status
            );
          }

          button.addEventListener(
            'click',
            () => setPayment(
              player.id,
              status
            )
          );

          actions.appendChild(
            button
          );
        }
      );

      const remove =
        document.createElement(
          'button'
        );

      remove.type = 'button';

      remove.className =
        'remove';

      remove.textContent =
        'REMOVER';

      remove.addEventListener(
        'click',
        () => removePlayer(
          player
        )
      );

      actions.appendChild(remove);
      main.appendChild(actions);
    }

    row.appendChild(main);
    list.appendChild(row);
  });

  renderSearch();
}


async function loadCatalog(){
  if(
    !isAdmin() ||
    catalogLoaded
  ){
    return;
  }

  try{
    const response =
      await listarCatalogoJogadoresTorneioCall(
        {}
      );

    catalog =
      Array.isArray(
        response.data?.players
      ) ?
        response.data.players :
        [];

    catalogLoaded = true;

  }catch(error){
    console.error(
      'Catálogo torneio:',
      error
    );

    statusBox(
      'Não foi possível carregar os jogadores cadastrados.',
      'error'
    );
  }
}


function renderSearch(){
  const box =
    document.getElementById(
      'gptv3Results'
    );

  const input =
    document.getElementById(
      'gptv3Search'
    );

  if(
    !box ||
    !input ||
    !isAdmin()
  ){
    return;
  }

  box.innerHTML = '';

  const query =
    String(input.value || '')
      .trim()
      .toLocaleLowerCase(
        'pt-BR'
      );

  if(query.length < 2){
    box.innerHTML =
      '<div class="gptv3-help">' +
      'Digite pelo menos 2 letras.' +
      '</div>';

    return;
  }

  const currentIds =
    new Set(
      players.map(
        player =>
          String(player.id)
      )
    );

  const result =
    catalog
      .filter(player => {
        const name =
          String(
            player.name || ''
          )
            .toLocaleLowerCase(
              'pt-BR'
            );

        return (
          !currentIds.has(
            String(player.id)
          ) &&
          name.includes(query)
        );
      })
      .slice(0,20);

  if(!result.length){
    box.innerHTML =
      '<div class="gptv3-help">' +
      'Nenhum jogador disponível com esse nome.' +
      '</div>';

    return;
  }

  result.forEach(player => {
    const row =
      document.createElement(
        'div'
      );

    row.className =
      'gptv3-search-row';

    row.appendChild(
      avatar(player)
    );

    const name =
      document.createElement(
        'strong'
      );

    name.textContent =
      String(
        player.name ||
        'Jogador'
      ).toLocaleUpperCase(
        'pt-BR'
      );

    const button =
      document.createElement(
        'button'
      );

    button.type = 'button';

    button.textContent =
      '+ ADICIONAR';

    button.addEventListener(
      'click',
      async () => {
        button.disabled = true;

        button.textContent =
          '...';

        await addPlayer(
          player.id
        );
      }
    );

    row.append(
      name,
      button
    );

    box.appendChild(row);
  });
}


async function loadTournamentPlayers(){
  if(
    loadRunning ||
    !firebaseUser
  ){
    return;
  }

  if(!ensureUi()) return;

  loadRunning = true;

  try{
    const currentResponse =
      await obterTorneioAtualCall(
        {}
      );

    if(
      currentResponse
        .data
        ?.exists !== true
    ){
      currentTournament = null;
      players = [];

      renderList(
        0,
        {}
      );

      const list =
        document.getElementById(
          'gptv3List'
        );

      if(list){
        list.innerHTML =
          '<div class="gptv3-empty">' +
          'Salve um campeonato primeiro.' +
          '</div>';
      }

      return;
    }

    currentTournament =
      currentResponse
        .data
        .tournament;

    const response =
      await listarJogadoresTorneioCall({
        tournamentId:
          currentTournament.id
      });

    players =
      Array.isArray(
        response.data?.players
      ) ?
        response.data.players :
        [];

    renderList(
      Number(
        response
          .data
          ?.registrationFee ||
        0
      ),
      response.data?.counts || {}
    );

    if(isAdmin()){
      await loadCatalog();
      renderSearch();
    }

    statusBox('');

  }catch(error){
    console.error(
      'Jogadores do torneio:',
      error
    );

    statusBox(
      error?.message ||
      'Não foi possível carregar.',
      'error'
    );

  }finally{
    loadRunning = false;
  }
}


async function addPlayer(playerId){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  statusBox(
    'Adicionando jogador...'
  );

  try{
    await adicionarJogadorTorneioCall({
      tournamentId:
        currentTournament.id,
      playerId
    });

    const search =
      document.getElementById(
        'gptv3Search'
      );

    if(search){
      search.value = '';
    }

    await loadTournamentPlayers();

    statusBox(
      'Jogador adicionado ao campeonato.',
      'ok'
    );

  }catch(error){
    console.error(
      'Adicionar jogador:',
      error
    );

    statusBox(
      error?.message ||
      'Não foi possível adicionar.',
      'error'
    );
  }
}


async function removePlayer(player){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  const name =
    String(
      player?.name ||
      'Jogador'
    ).toLocaleUpperCase(
      'pt-BR'
    );

  if(
    !confirm(
      'REMOVER DO CAMPEONATO?\n\n' +
      name +
      '\n\nO cadastro permanente e o racha ' +
      'semanal serão preservados.'
    )
  ){
    return;
  }

  try{
    statusBox(
      'Removendo jogador...'
    );

    await removerJogadorTorneioCall({
      tournamentId:
        currentTournament.id,
      playerId:
        player.id
    });

    await loadTournamentPlayers();

    statusBox(
      'Jogador removido somente deste campeonato.',
      'ok'
    );

  }catch(error){
    statusBox(
      error?.message ||
      'Não foi possível remover.',
      'error'
    );
  }
}


async function setPayment(
  playerId,
  status
){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  try{
    statusBox(
      'Atualizando pagamento...'
    );

    await definirPagamentoJogadorTorneioCall({
      tournamentId:
        currentTournament.id,
      playerId,
      status
    });

    await loadTournamentPlayers();

    statusBox(
      'Pagamento atualizado.',
      'ok'
    );

  }catch(error){
    statusBox(
      error?.message ||
      'Não foi possível atualizar.',
      'error'
    );
  }
}


async function saveFee(){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    statusBox(
      'Salve um campeonato primeiro.',
      'error'
    );

    return;
  }

  const input =
    document.getElementById(
      'gptv3FeeInput'
    );

  const value =
    Number(
      String(
        input?.value ||
        ''
      ).replace(',','.')
    );

  if(
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10000
  ){
    statusBox(
      'Informe um valor válido.',
      'error'
    );

    return;
  }

  try{
    statusBox(
      'Salvando valor...'
    );

    await salvarTaxaInscricaoTorneioCall({
      tournamentId:
        currentTournament.id,
      registrationFee:
        value
    });

    await loadTournamentPlayers();

    statusBox(
      'Valor da inscrição salvo.',
      'ok'
    );

  }catch(error){
    statusBox(
      error?.message ||
      'Não foi possível salvar o valor.',
      'error'
    );
  }
}


async function waitForDefaultApp(){
  for(
    let attempt = 0;
    attempt < 60;
    attempt += 1
  ){
    if(getApps().length){
      return getApp();
    }

    await new Promise(
      resolve =>
        setTimeout(
          resolve,
          100
        )
    );
  }

  throw new Error(
    'Firebase principal não iniciou.'
  );
}


async function init(){
  ensureUi();

  const app =
    await waitForDefaultApp();

  auth =
    getAuth(app);

  const functions =
    getFunctions(
      app,
      'southamerica-east1'
    );

  obterTorneioAtualCall =
    httpsCallable(
      functions,
      'obterTorneioAtual'
    );

  listarJogadoresTorneioCall =
    httpsCallable(
      functions,
      'listarJogadoresTorneio'
    );

  listarCatalogoJogadoresTorneioCall =
    httpsCallable(
      functions,
      'listarCatalogoJogadoresTorneio'
    );

  adicionarJogadorTorneioCall =
    httpsCallable(
      functions,
      'adicionarJogadorTorneio'
    );

  removerJogadorTorneioCall =
    httpsCallable(
      functions,
      'removerJogadorTorneio'
    );

  definirPagamentoJogadorTorneioCall =
    httpsCallable(
      functions,
      'definirPagamentoJogadorTorneio'
    );

  salvarTaxaInscricaoTorneioCall =
    httpsCallable(
      functions,
      'salvarTaxaInscricaoTorneio'
    );

  onAuthStateChanged(
    auth,
    async user => {
      firebaseUser = user;

      catalogLoaded = false;
      catalog = [];

      refreshAdminVisibility();

      const view =
        document.getElementById(
          'tournamentsView'
        );

      if(
        user &&
        view?.classList.contains(
          'active'
        )
      ){
        await loadTournamentPlayers();
      }
    }
  );


  document
    .getElementById(
      'openTournamentsQuick'
    )
    ?.addEventListener(
      'click',
      () => {
        setTimeout(
          loadTournamentPlayers,
          250
        );
      }
    );


  document
    .getElementById(
      'tournamentSaveButton'
    )
    ?.addEventListener(
      'click',
      () => {
        setTimeout(
          loadTournamentPlayers,
          1000
        );
      }
    );


  const tournamentView =
    document.getElementById(
      'tournamentsView'
    );

  if(tournamentView){
    const observer =
      new MutationObserver(() => {
        if(
          tournamentView
            .classList
            .contains('active')
        ){
          loadTournamentPlayers();
        }
      });

    observer.observe(
      tournamentView,
      {
        attributes:true,
        attributeFilter:[
          'class'
        ]
      }
    );
  }
}


init().catch(error => {
  console.error(
    'Tournament Players V3:',
    error
  );
});
