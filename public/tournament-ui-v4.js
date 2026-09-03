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
  const field =
    findTeamsAdminField();

  if(!field){
    return false;
  }

  if(
    document.getElementById(
      'gptv4TeamsCountInput'
    )
  ){
    return true;
  }

  const oldInput =
    field.querySelector('input');

  if(oldInput){
    oldInput.style.display =
      'none';
  }

  const control =
    document.createElement(
      'div'
    );

  control.className =
    'gptv4-team-control';

  control.innerHTML = `
    <input
      id="gptv4TeamsCountInput"
      type="number"
      min="8"
      max="32"
      step="1"
      inputmode="numeric"
      value="10"
      aria-label="Quantidade de equipes"
    >

    <button
      class="gptv4-team-save"
      id="gptv4TeamsSave"
      type="button"
    >
      SALVAR
    </button>
  `;

  const help =
    document.createElement(
      'small'
    );

  help.className =
    'gptv4-team-help';

  help.textContent =
    'Escolha entre 8 e 32 equipes.';

  const feedback =
    document.createElement(
      'div'
    );

  feedback.id =
    'gptv4TeamStatus';

  feedback.className =
    'gptv4-team-status';

  field.append(
    control,
    help,
    feedback
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
