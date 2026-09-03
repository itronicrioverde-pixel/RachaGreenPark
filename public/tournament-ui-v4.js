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

let firebaseUser = null;
let currentTournament = null;

let obterTorneioAtualCall = null;
let obterConfiguracaoEquipesTorneioCall = null;
let salvarQuantidadeEquipesTorneioCall = null;


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid === ADMIN_UID
  );
}


function addStyle(){
  if(
    document.getElementById(
      'greenpark-tournament-ui-v4'
    )
  ){
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'greenpark-tournament-ui-v4';

  style.textContent = `
/* GREENPARK_TOURNAMENT_UI_V4 */


/* =========================================
   ABAS DO TORNEIO
   nunca ficam uma em cima da outra
   ========================================= */

#tournamentsView .gptournament-tabs{
  display:flex!important;
  grid-template-columns:none!important;

  width:100%;

  gap:7px!important;

  overflow-x:auto!important;
  overflow-y:hidden!important;

  padding:2px 1px 7px!important;

  scroll-snap-type:x proximity;
  scrollbar-width:none;

  -webkit-overflow-scrolling:touch;
}

#tournamentsView .gptournament-tabs::-webkit-scrollbar{
  display:none;
}

#tournamentsView .gptournament-tab{
  flex:0 0 auto!important;

  width:auto!important;
  min-width:94px!important;
  min-height:44px!important;

  padding:0 11px!important;

  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;

  white-space:nowrap!important;

  line-height:1!important;

  scroll-snap-align:start;
}


/* =========================================
   ADMIN DO TORNEIO
   ========================================= */

#tournamentsView .gptournament-admin-grid{
  min-width:0;
}

#tournamentsView .gptournament-admin-field{
  min-width:0;
}

#tournamentsView .gptournament-admin-field input,
#tournamentsView .gptournament-admin-field select{
  max-width:100%!important;
  min-width:0!important;
}


/* QUANTIDADE DE EQUIPES */

.gptv4-team-control{
  margin-top:6px;

  display:grid;
  grid-template-columns:minmax(0,1fr) 77px;
  gap:7px;
}

.gptv4-team-control input{
  width:100%!important;
  height:44px!important;

  padding:0 10px!important;

  text-align:center;

  border:1px solid #34464e!important;
  border-radius:10px!important;

  background:#111a21!important;
  color:#fff!important;

  font-size:15px!important;
  font-weight:900!important;

  outline:none;
}

.gptv4-team-save{
  min-height:44px;

  border:0;
  border-radius:10px;

  background:var(--green);
  color:#0b180d;

  font-size:8px;
  font-weight:950;
}

.gptv4-team-save:disabled{
  opacity:.5;
}

.gptv4-team-help{
  display:block;

  margin-top:5px;

  color:#74867d;

  font-size:7px;
  line-height:1.35;
}

.gptv4-team-status{
  min-height:14px;

  margin-top:6px;

  color:#819188;

  font-size:8px;
  line-height:1.35;
}

.gptv4-team-status.ok{
  color:var(--green2);
}

.gptv4-team-status.error{
  color:#ff9696;
}


/* =========================================
   JOGADORES - BOTOES
   ========================================= */

#tournamentsView .gptv3-actions{
  width:100%;

  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;

  gap:6px!important;

  margin-top:10px!important;
}

#tournamentsView .gptv3-actions button{
  width:100%!important;
  min-width:0!important;

  min-height:35px!important;

  margin:0!important;

  padding:0 4px!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  white-space:nowrap!important;

  line-height:1!important;

  font-size:6.5px!important;
}

#tournamentsView .gptv3-actions .remove{
  grid-column:1/-1!important;

  min-height:36px!important;

  margin:0!important;
}


/* =========================================
   BUSCA DE JOGADOR
   ========================================= */

#tournamentsView .gptv3-search-row{
  min-width:0!important;

  grid-template-columns:
    40px
    minmax(0,1fr)
    88px!important;

  gap:7px!important;
}

#tournamentsView .gptv3-search-row strong{
  min-width:0!important;
}

#tournamentsView .gptv3-search-row button{
  width:88px!important;
  min-width:0!important;

  padding:0 5px!important;

  white-space:nowrap!important;
}


/* =========================================
   CARD DO JOGADOR
   ========================================= */

#tournamentsView .gptv3-row{
  min-width:0!important;
}

#tournamentsView .gptv3-main{
  min-width:0!important;
  overflow:hidden!important;
}

#tournamentsView .gptv3-top{
  min-width:0!important;
}

#tournamentsView .gptv3-top strong{
  min-width:0!important;
}


/* =========================================
   IPHONE / TELAS MENORES
   ========================================= */


/* =========================================
   GREENPARK_TOURNAMENT_TEAMS_INPUT_V41
   ========================================= */

.gptv41-team-field{
  min-width:0;
}

.gptv41-team-stepper{
  width:100%;

  display:grid;
  grid-template-columns:
    52px
    minmax(70px,1fr)
    52px;

  gap:7px;

  margin-top:6px;
}

.gptv41-step-button{
  min-width:0;
  height:48px;

  border:
    1px solid rgba(86,213,46,.48);

  border-radius:11px;

  background:#14291a;
  color:var(--green2);

  font-size:23px;
  line-height:1;
  font-weight:800;

  touch-action:manipulation;
}

.gptv41-step-button:active{
  transform:scale(.97);
  background:#1b3a21;
}

.gptv41-team-input{
  width:100%!important;
  min-width:0!important;
  height:48px!important;

  padding:0 8px!important;

  border:
    1px solid #3c515a!important;

  border-radius:11px!important;

  background:#111a21!important;
  color:#fff!important;

  outline:none!important;

  text-align:center!important;

  font-size:18px!important;
  font-weight:950!important;
}

.gptv41-team-input:focus{
  border-color:
    var(--green)!important;

  box-shadow:
    0 0 0 2px
    rgba(86,213,46,.12);
}

.gptv41-save-full{
  width:100%!important;
  min-height:45px!important;

  margin-top:8px!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  font-size:9px!important;
  font-weight:950!important;
}


/* evita qualquer sobreposicao */
#tournamentsView
.gptv41-team-field,
#tournamentsView
.gptv41-team-field *{
  box-sizing:border-box;
}


@media(max-width:390px){

  #tournamentsView .gptournament-admin-grid{
    grid-template-columns:1fr!important;
  }

  #tournamentsView .gptournament-admin-field,
  #tournamentsView .gptournament-admin-field.wide{
    grid-column:1!important;
  }

  #tournamentsView .gptournament-tab{
    min-width:92px!important;
  }

  #tournamentsView .gptv3-search-row{
    grid-template-columns:
      38px
      minmax(0,1fr)!important;
  }

  #tournamentsView .gptv3-search-row button{
    grid-column:2!important;

    width:100%!important;
    min-height:34px!important;
  }

  #tournamentsView .gptv3-actions{
    grid-template-columns:
      repeat(3,minmax(0,1fr))!important;
  }

  #tournamentsView .gptv3-actions button{
    font-size:6px!important;
  }

  .gptv4-team-control{
    grid-template-columns:
      minmax(0,1fr)
      74px;
  }
}


@media(max-width:340px){

  #tournamentsView .gptv3-actions{
    grid-template-columns:1fr!important;
  }

  #tournamentsView .gptv3-actions .remove{
    grid-column:1!important;
  }

  #tournamentsView .gptournament-tab{
    min-width:88px!important;
  }
}
`;

  document.head.appendChild(
    style
  );
}


function status(
  message = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv4TeamStatus'
    );

  if(!el) return;

  el.textContent =
    message;

  el.className =
    'gptv4-team-status' +
    (type ? ' ' + type : '');
}


function findTeamsAdminField(){
  const panel =
    document.getElementById(
      'tournamentAdminPanel'
    );

  if(!panel){
    return null;
  }

  const fields =
    Array.from(
      panel.querySelectorAll(
        '.gptournament-admin-field'
      )
    );

  return fields.find(field => {
    const title =
      String(
        field
          .querySelector('span')
          ?.textContent ||
        ''
      )
        .trim()
        .toLocaleLowerCase(
          'pt-BR'
        );

    return title === 'equipes';
  }) || null;
}


function ensureTeamsControl(){
  // GREENPARK_TOURNAMENT_TEAMS_INPUT_V41

  const oldField =
    findTeamsAdminField();

  if(!oldField){
    return false;
  }

  if(
    document.getElementById(
      'gptv4TeamsCountInput'
    )
  ){
    return true;
  }

  /*
   * O campo original do HTML e readonly.
   * Nao usamos mais esse input.
   * Criamos um controle independente como
   * irmao do campo original.
   */
  oldField.style.display =
    'none';

  const field =
    document.createElement(
      'div'
    );

  field.className =
    'gptournament-admin-field ' +
    'gptv41-team-field';

  field.innerHTML = `
    <span>Equipes</span>

    <div class="gptv41-team-stepper">

      <button
        id="gptv41TeamsMinus"
        class="gptv41-step-button"
        type="button"
        aria-label="Diminuir equipes"
      >
        −
      </button>

      <input
        id="gptv4TeamsCountInput"
        class="gptv41-team-input"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength="2"
        value="10"
        autocomplete="off"
        aria-label="Quantidade de equipes"
      >

      <button
        id="gptv41TeamsPlus"
        class="gptv41-step-button"
        type="button"
        aria-label="Aumentar equipes"
      >
        +
      </button>

    </div>

    <button
      class="gptv4-team-save gptv41-save-full"
      id="gptv4TeamsSave"
      type="button"
    >
      SALVAR QUANTIDADE
    </button>

    <small class="gptv4-team-help">
      Escolha entre 8 e 32 equipes.
    </small>

    <div
      id="gptv4TeamStatus"
      class="gptv4-team-status"
    ></div>
  `;

  oldField.after(
    field
  );


  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );


  /*
   * No iPhone usamos inputmode numeric
   * em vez de type=number.
   */
  input?.addEventListener(
    'input',
    () => {
      input.value =
        String(input.value || '')
          .replace(
            /[^0-9]/g,
            ''
          )
          .slice(
            0,
            2
          );

      status('');
    }
  );


  input?.addEventListener(
    'blur',
    () => {
      if(!input.value){
        return;
      }

      let value =
        Number(input.value);

      if(
        !Number.isFinite(value)
      ){
        value = 10;
      }

      value =
        Math.max(
          8,
          Math.min(
            32,
            Math.round(value)
          )
        );

      input.value =
        String(value);
    }
  );


  document
    .getElementById(
      'gptv41TeamsMinus'
    )
    ?.addEventListener(
      'click',
      () =>
        changeTeamsCount(-1)
    );


  document
    .getElementById(
      'gptv41TeamsPlus'
    )
    ?.addEventListener(
      'click',
      () =>
        changeTeamsCount(1)
    );


  document
    .getElementById(
      'gptv4TeamsSave'
    )
    ?.addEventListener(
      'click',
      saveTeamsCount
    );


  return true;
}


function updateBaseTournamentUi(
  config
){
  const teamsCount =
    Number(
      config?.teamsCount ||
      10
    );

  const groupA =
    Number(
      config?.groupA ||
      Math.ceil(teamsCount / 2)
    );

  const groupB =
    Number(
      config?.groupB ||
      Math.floor(teamsCount / 2)
    );


  /* CARD PRINCIPAL */

  const numbers =
    document.querySelectorAll(
      '#tournamentsView ' +
      '.gptournament-numbers > div'
    );

  if(numbers[0]){
    const strong =
      numbers[0].querySelector(
        'strong'
      );

    if(strong){
      strong.textContent =
        String(teamsCount);
    }
  }


  /* FORMATO */

  const format =
    document.querySelector(
      '#tournamentsView ' +
      '.gptournament-format span'
    );

  if(format){
    format.textContent =
      '2 grupos • Grupo A: ' +
      groupA +
      ' equipes • Grupo B: ' +
      groupB +
      ' equipes • 4 classificam por grupo • ' +
      'quartas • semifinais • final';
  }


  /* ABA EQUIPES */

  const teamsPanel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="teams"]'
    );

  if(teamsPanel){
    const subtitle =
      teamsPanel.querySelector(
        '.gptournament-panel-head span'
      );

    const total =
      teamsPanel.querySelector(
        '.gptournament-panel-head b'
      );

    if(subtitle){
      subtitle.textContent =
        teamsCount +
        ' vagas disponíveis';
    }

    if(total){
      total.textContent =
        String(teamsCount);
    }

    const emptyText =
      teamsPanel.querySelector(
        '.gptournament-empty span:last-child'
      );

    if(emptyText){
      emptyText.textContent =
        'Aqui serão cadastradas as ' +
        teamsCount +
        ' equipes, seus escudos e jogadores.';
    }
  }


  /* GRUPOS */

  const groups =
    document.querySelectorAll(
      '#tournamentsView .gptournament-group'
    );

  if(groups[0]){
    const span =
      groups[0].querySelector(
        'span'
      );

    if(span){
      span.textContent =
        groupA +
        ' equipes';
    }
  }

  if(groups[1]){
    const span =
      groups[1].querySelector(
        'span'
      );

    if(span){
      span.textContent =
        groupB +
        ' equipes';
    }
  }


  /* INPUT ADMIN */

  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  if(input){
    input.value =
      String(teamsCount);
  }
}


async function loadTournamentConfig(){
  addStyle();

  if(
    !firebaseUser ||
    !ensureTeamsControl()
  ){
    return;
  }

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
      return;
    }

    currentTournament =
      currentResponse
        .data
        .tournament;

    const response =
      await obterConfiguracaoEquipesTorneioCall({
        tournamentId:
          currentTournament.id
      });

    updateBaseTournamentUi(
      response.data || {}
    );

    status('');

  }catch(error){
    console.error(
      'Configuração de equipes:',
      error
    );

    status(
      error?.message ||
      'Não foi possível carregar a quantidade.',
      'error'
    );
  }
}


function changeTeamsCount(
  delta
){
  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  if(!input){
    return;
  }

  let current =
    Number(
      input.value ||
      10
    );

  if(
    !Number.isFinite(current)
  ){
    current = 10;
  }

  current =
    Math.round(current) +
    Number(delta || 0);

  current =
    Math.max(
      8,
      Math.min(
        32,
        current
      )
    );

  input.value =
    String(current);

  status('');
}


async function saveTeamsCount(){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    status(
      'Salve o campeonato primeiro.',
      'error'
    );

    return;
  }

  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  const teamsCount =
    Number(
      input?.value
    );

  if(
    !Number.isInteger(teamsCount) ||
    teamsCount < 8 ||
    teamsCount > 32
  ){
    status(
      'Informe de 8 a 32 equipes.',
      'error'
    );

    return;
  }

  const button =
    document.getElementById(
      'gptv4TeamsSave'
    );

  if(button){
    button.disabled =
      true;

    button.textContent =
      '...';
  }

  status(
    'Salvando quantidade...'
  );

  try{
    const response =
      await salvarQuantidadeEquipesTorneioCall({
        tournamentId:
          currentTournament.id,
        teamsCount
      });

    updateBaseTournamentUi(
      response.data || {}
    );

    status(
      'Quantidade de equipes salva.',
      'ok'
    );

  }catch(error){
    console.error(
      'Salvar equipes:',
      error
    );

    status(
      error?.message ||
      'Não foi possível salvar.',
      'error'
    );

  }finally{
    if(button){
      button.disabled =
        false;

      button.textContent =
        'SALVAR';
    }
  }
}


async function waitForApp(){
  for(
    let i = 0;
    i < 60;
    i += 1
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
  addStyle();

  const app =
    await waitForApp();

  const auth =
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

  obterConfiguracaoEquipesTorneioCall =
    httpsCallable(
      functions,
      'obterConfiguracaoEquipesTorneio'
    );

  salvarQuantidadeEquipesTorneioCall =
    httpsCallable(
      functions,
      'salvarQuantidadeEquipesTorneio'
    );


  onAuthStateChanged(
    auth,
    user => {
      firebaseUser = user;

      setTimeout(
        loadTournamentConfig,
        250
      );
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
          loadTournamentConfig,
          450
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
          loadTournamentConfig,
          1100
        );
      }
    );


  const view =
    document.getElementById(
      'tournamentsView'
    );

  if(view){
    const observer =
      new MutationObserver(() => {
        if(
          view.classList.contains(
            'active'
          )
        ){
          setTimeout(
            loadTournamentConfig,
            150
          );
        }
      });

    observer.observe(
      view,
      {
        attributes:true,
        attributeFilter:[
          'class'
        ]
      }
    );
  }


  ensureTeamsControl();
}


init().catch(error => {
  console.error(
    'Tournament UI V4:',
    error
  );
});
