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


/* GREENPARK_TOURNAMENT_ADMIN_CLEAN_V44 */
/* GREENPARK_TOURNAMENT_MIN_THREE_V47 */

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


function wait(ms){
  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


function isoToBR(value){
  const match =
    String(value || '')
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if(!match){
    return '';
  }

  return (
    match[3] +
    '/' +
    match[2] +
    '/' +
    match[1]
  );
}


function brToISO(value){
  const match =
    String(value || '')
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );

  if(!match){
    return '';
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if(
    year < 2020 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ){
    return '';
  }

  return (
    String(year).padStart(4,'0') +
    '-' +
    String(month).padStart(2,'0') +
    '-' +
    String(day).padStart(2,'0')
  );
}


function maskDate(value){
  const digits =
    String(value || '')
      .replace(/\D/g,'')
      .slice(0,8);

  if(digits.length <= 2){
    return digits;
  }

  if(digits.length <= 4){
    return (
      digits.slice(0,2) +
      '/' +
      digits.slice(2)
    );
  }

  return (
    digits.slice(0,2) +
    '/' +
    digits.slice(2,4) +
    '/' +
    digits.slice(4)
  );
}


function addStyle(){
  if(
    document.getElementById(
      'greenpark-form-clean-v44-style'
    )
  ){
    return;
  }

  const style =
    document.createElement('style');

  style.id =
    'greenpark-form-clean-v44-style';

  style.textContent = `

/* GREENPARK_TOURNAMENT_ADMIN_CLEAN_V44 */

#tournamentsView #tournamentAdminPanel{
  width:100%!important;
  padding:16px!important;
  overflow:hidden!important;
  box-sizing:border-box!important;
}


/* TITULO */

#tournamentsView
#tournamentAdminPanel
.gptournament-admin-title{
  width:100%!important;

  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;

  margin:0 0 18px!important;
}


/* GRID */

#tournamentsView .gptv44-grid{
  width:100%!important;
  min-width:0!important;

  display:flex!important;
  flex-direction:column!important;

  gap:15px!important;

  margin:0!important;
  padding:0!important;
}


/* CAMPO */

#tournamentsView .gptv44-field{
  display:block!important;

  width:100%!important;
  min-width:0!important;

  margin:0!important;
  padding:0!important;

  box-sizing:border-box!important;
}

#tournamentsView .gptv44-label{
  display:block!important;

  width:100%!important;

  margin:0 0 7px!important;

  color:#96a49d!important;

  font-size:9px!important;
  line-height:1.2!important;
  font-weight:900!important;

  text-align:center!important;
}


/* INPUT PADRAO */

#tournamentsView .gptv44-control{
  display:block!important;

  width:100%!important;
  min-width:0!important;
  max-width:100%!important;

  height:52px!important;
  min-height:52px!important;
  max-height:52px!important;

  margin:0!important;
  padding:0 14px!important;

  border:
    1px solid #344951!important;

  border-radius:12px!important;

  background:#111a21!important;
  color:#fff!important;

  box-sizing:border-box!important;

  outline:none!important;

  font-family:inherit!important;

  font-size:15px!important;
  line-height:normal!important;
  font-weight:700!important;

  text-align:center!important;
  text-align-last:center!important;
}

#tournamentsView
.gptv44-control::placeholder{
  color:#808a86!important;
  opacity:1!important;
}

#tournamentsView
.gptv44-control:focus{
  border-color:
    var(--green)!important;

  box-shadow:
    0 0 0 2px
    rgba(86,213,46,.11)!important;
}


/* STATUS */

#tournamentsView #tournamentStatusInput{
  -webkit-appearance:menulist!important;
  appearance:auto!important;

  padding:
    0 38px!important;

  text-align:center!important;
  text-align-last:center!important;
}


/* DATA REAL FICA ESCONDIDA */

#tournamentsView
#tournamentDateInput{
  display:none!important;
}


/* EQUIPES */

#tournamentsView .gptv44-team-row{
  width:100%!important;

  display:grid!important;

  grid-template-columns:
    52px
    minmax(0,1fr)
    52px!important;

  gap:8px!important;

  align-items:center!important;
}

#tournamentsView .gptv44-team-step{
  width:52px!important;
  height:52px!important;

  min-width:52px!important;

  margin:0!important;
  padding:0!important;

  border:
    1px solid rgba(86,213,46,.55)!important;

  border-radius:12px!important;

  background:#102519!important;
  color:var(--green2)!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  font-size:25px!important;
  line-height:1!important;
  font-weight:900!important;

  touch-action:manipulation!important;
}

#tournamentsView .gptv44-team-step:active{
  transform:scale(.97);
}

#tournamentsView #gptv4TeamsCountInput{
  display:block!important;

  width:100%!important;
  min-width:0!important;

  height:52px!important;

  margin:0!important;
  padding:0 8px!important;

  border:
    1px solid #344951!important;

  border-radius:12px!important;

  background:#111a21!important;
  color:#fff!important;

  box-sizing:border-box!important;

  outline:none!important;

  text-align:center!important;

  font-size:20px!important;
  line-height:normal!important;
  font-weight:950!important;
}


/* SALVAR QUANTIDADE */

#tournamentsView #gptv44TeamsSave{
  width:100%!important;

  min-height:46px!important;

  margin:8px 0 0!important;

  border:0!important;
  border-radius:11px!important;

  background:var(--green)!important;
  color:#0c190d!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  font-size:9px!important;
  font-weight:950!important;
}

#tournamentsView
#gptv44TeamsSave:disabled{
  opacity:.5!important;
}


/* FORMATO */

#tournamentsView .gptv44-static{
  width:100%!important;

  min-height:52px!important;

  padding:0 14px!important;

  border:
    1px solid #344951!important;

  border-radius:12px!important;

  background:#111a21!important;
  color:#9ba8a1!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  box-sizing:border-box!important;

  font-size:14px!important;
  font-weight:700!important;

  text-align:center!important;
}


/* MENSAGENS */

#tournamentsView .gptv44-help{
  display:block!important;

  width:100%!important;

  min-height:11px!important;

  margin:6px 0 0!important;

  color:#74847c!important;

  font-size:7.5px!important;
  line-height:1.35!important;

  text-align:center!important;
}

#tournamentsView .gptv44-help.ok{
  color:var(--green2)!important;
}

#tournamentsView .gptv44-help.error{
  color:#ff9696!important;
}


/* SALVAR TORNEIO */

#tournamentsView #tournamentSaveButton{
  width:100%!important;

  min-height:50px!important;

  margin-top:18px!important;

  display:flex!important;
  align-items:center!important;
  justify-content:center!important;

  border-radius:12px!important;

  font-size:11px!important;
}


/* MOBILE */

@media(max-width:430px){

  #tournamentsView #tournamentAdminPanel{
    padding:14px!important;
  }

  #tournamentsView .gptv44-grid{
    gap:13px!important;
  }

  #tournamentsView .gptv44-control,
  #tournamentsView #gptv4TeamsCountInput,
  #tournamentsView .gptv44-static{
    height:50px!important;
    min-height:50px!important;
    max-height:50px!important;
  }

  #tournamentsView .gptv44-team-step{
    width:50px!important;
    min-width:50px!important;
    height:50px!important;
  }

  #tournamentsView .gptv44-team-row{
    grid-template-columns:
      50px
      minmax(0,1fr)
      50px!important;
  }
}

`;

  document.head.appendChild(style);
}


function message(
  id,
  text = '',
  type = ''
){
  const el =
    document.getElementById(id);

  if(!el){
    return;
  }

  el.textContent = text;

  el.className =
    'gptv44-help' +
    (type ? ' ' + type : '');
}


function rebuildForm(){
  const panel =
    document.getElementById(
      'tournamentAdminPanel'
    );

  if(!panel){
    return false;
  }

  const oldGrid =
    panel.querySelector(
      '.gptournament-admin-grid'
    );

  if(!oldGrid){
    return false;
  }

  if(
    oldGrid.dataset.v44 ===
    '1'
  ){
    return true;
  }


  const oldName =
    document.getElementById(
      'tournamentNameInput'
    )?.value || '';

  const oldDate =
    document.getElementById(
      'tournamentDateInput'
    )?.value || '';

  const oldStatus =
    document.getElementById(
      'tournamentStatusInput'
    )?.value || 'draft';

  const oldLocation =
    document.getElementById(
      'tournamentLocationInput'
    )?.value || '';

  const oldTeams =
    Number(
      document.getElementById(
        'gptv4TeamsCountInput'
      )?.value || 10
    );


  oldGrid.dataset.v44 =
    '1';

  oldGrid.className =
    'gptv44-grid';

  oldGrid.innerHTML = `

    <label class="gptv44-field">

      <span class="gptv44-label">
        NOME DO TORNEIO
      </span>

      <input
        id="tournamentNameInput"
        class="gptv44-control"
        type="text"
        maxlength="80"
        placeholder="Ex.: Copa dos Amigos 2026"
        autocomplete="off"
      >

    </label>


    <label class="gptv44-field">

      <span class="gptv44-label">
        DATA
      </span>

      <input
        id="gptv44DateDisplay"
        class="gptv44-control"
        type="text"
        inputmode="numeric"
        maxlength="10"
        placeholder="DD/MM/AAAA"
        autocomplete="off"
      >

      <input
        id="tournamentDateInput"
        type="hidden"
      >

      <small
        id="gptv44DateMessage"
        class="gptv44-help"
      ></small>

    </label>


    <label class="gptv44-field">

      <span class="gptv44-label">
        STATUS
      </span>

      <select
        id="tournamentStatusInput"
        class="gptv44-control"
      >
        <option value="draft">
          Planejamento
        </option>

        <option value="open">
          Inscrições abertas
        </option>

        <option value="in_progress">
          Em andamento
        </option>

        <option value="finished">
          Encerrado
        </option>
      </select>

    </label>


    <label class="gptv44-field">

      <span class="gptv44-label">
        LOCAL
      </span>

      <input
        id="tournamentLocationInput"
        class="gptv44-control"
        type="text"
        maxlength="120"
        placeholder="Local do torneio"
        autocomplete="off"
      >

    </label>


    <div class="gptv44-field">

      <span class="gptv44-label">
        EQUIPES
      </span>

      <div class="gptv44-team-row">

        <button
          id="gptv44Minus"
          class="gptv44-team-step"
          type="button"
        >
          −
        </button>

        <input
          id="gptv4TeamsCountInput"
          type="text"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          value="10"
        >

        <button
          id="gptv44Plus"
          class="gptv44-team-step"
          type="button"
        >
          +
        </button>

      </div>

      <button
        id="gptv44TeamsSave"
        type="button"
      >
        SALVAR QUANTIDADE
      </button>

      <small class="gptv44-help">
        Escolha entre 3 e 32 equipes.
      </small>

      <small
        id="gptv44TeamsMessage"
        class="gptv44-help"
      ></small>

    </div>


    <div class="gptv44-field">

      <span class="gptv44-label">
        FORMATO
      </span>

      <div class="gptv44-static">
        2 grupos + mata-mata
      </div>

    </div>

  `;


  document.getElementById(
    'tournamentNameInput'
  ).value =
    oldName;


  document.getElementById(
    'tournamentDateInput'
  ).value =
    oldDate;


  document.getElementById(
    'gptv44DateDisplay'
  ).value =
    isoToBR(oldDate);


  document.getElementById(
    'tournamentStatusInput'
  ).value =
    oldStatus;


  document.getElementById(
    'tournamentLocationInput'
  ).value =
    oldLocation;


  document.getElementById(
    'gptv4TeamsCountInput'
  ).value =
    String(
      Number.isFinite(oldTeams) &&
      oldTeams >= 3 &&
      oldTeams <= 32 ?
        oldTeams :
        10
    );


  bindForm();

  return true;
}


function bindForm(){

  const visibleDate =
    document.getElementById(
      'gptv44DateDisplay'
    );

  const hiddenDate =
    document.getElementById(
      'tournamentDateInput'
    );


  visibleDate?.addEventListener(
    'input',
    () => {

      visibleDate.value =
        maskDate(
          visibleDate.value
        );

      const iso =
        brToISO(
          visibleDate.value
        );

      if(hiddenDate){
        hiddenDate.value = iso;
      }

      if(
        visibleDate.value.length === 10 &&
        !iso
      ){
        message(
          'gptv44DateMessage',
          'Data inválida.',
          'error'
        );
      }else{
        message(
          'gptv44DateMessage'
        );
      }
    }
  );


  document
    .getElementById(
      'gptv44Minus'
    )
    ?.addEventListener(
      'click',
      () => changeTeams(-1)
    );


  document
    .getElementById(
      'gptv44Plus'
    )
    ?.addEventListener(
      'click',
      () => changeTeams(1)
    );


  document
    .getElementById(
      'gptv44TeamsSave'
    )
    ?.addEventListener(
      'click',
      saveTeams
    );


  const saveTournament =
    document.getElementById(
      'tournamentSaveButton'
    );

  /*
   * Se a data visível estiver preenchida
   * mas for inválida, bloqueamos o clique
   * antes da função principal.
   */
  saveTournament?.addEventListener(
    'click',
    event => {

      const visible =
        String(
          document.getElementById(
            'gptv44DateDisplay'
          )?.value || ''
        ).trim();

      const hidden =
        String(
          document.getElementById(
            'tournamentDateInput'
          )?.value || ''
        ).trim();

      if(
        visible &&
        !hidden
      ){
        event.preventDefault();
        event.stopImmediatePropagation();

        message(
          'gptv44DateMessage',
          'Corrija a data antes de salvar.',
          'error'
        );
      }

    },
    true
  );
}


function changeTeams(delta){
  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  if(!input){
    return;
  }

  let value =
    Number(
      input.value ||
      10
    );

  if(!Number.isFinite(value)){
    value = 10;
  }

  value =
    Math.max(
      3,
      Math.min(
        32,
        Math.round(value) +
        Number(delta || 0)
      )
    );

  input.value =
    String(value);

  message(
    'gptv44TeamsMessage'
  );
}


function applyTeams(config = {}){

  const teams =
    Number(
      config.teamsCount || 10
    );

  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  if(input){
    input.value =
      String(teams);
  }


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
        String(teams);
    }
  }
}


async function loadCurrent(){

  if(
    !firebaseUser ||
    !rebuildForm()
  ){
    return;
  }

  try{

    const result =
      await obterTorneioAtualCall({});

    if(
      result.data?.exists !==
      true
    ){
      currentTournament = null;
      return;
    }

    currentTournament =
      result.data.tournament;


    const name =
      document.getElementById(
        'tournamentNameInput'
      );

    const hiddenDate =
      document.getElementById(
        'tournamentDateInput'
      );

    const visibleDate =
      document.getElementById(
        'gptv44DateDisplay'
      );

    const status =
      document.getElementById(
        'tournamentStatusInput'
      );

    const location =
      document.getElementById(
        'tournamentLocationInput'
      );


    if(name){
      name.value =
        currentTournament.name || '';
    }

    if(hiddenDate){
      hiddenDate.value =
        currentTournament.date || '';
    }

    if(visibleDate){
      visibleDate.value =
        isoToBR(
          currentTournament.date
        );
    }

    if(status){
      status.value =
        currentTournament.status ||
        'draft';
    }

    if(location){
      location.value =
        currentTournament.location ||
        '';
    }


    const config =
      await obterConfiguracaoEquipesTorneioCall({
        tournamentId:
          currentTournament.id
      });

    applyTeams(
      config.data || {}
    );

  }catch(error){
    console.error(
      'Tournament clean V44:',
      error
    );
  }
}


async function saveTeams(){

  if(!isAdmin()){
    return;
  }

  if(!currentTournament?.id){
    await loadCurrent();
  }

  if(!currentTournament?.id){
    message(
      'gptv44TeamsMessage',
      'Salve o campeonato primeiro.',
      'error'
    );

    return;
  }

  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  const teams =
    Number(input?.value);

  if(
    !Number.isInteger(teams) ||
    teams < 3 ||
    teams > 32
  ){
    message(
      'gptv44TeamsMessage',
      'Informe de 3 a 32 equipes.',
      'error'
    );

    return;
  }

  const button =
    document.getElementById(
      'gptv44TeamsSave'
    );

  if(button){
    button.disabled = true;
    button.textContent =
      'SALVANDO...';
  }

  try{

    const response =
      await salvarQuantidadeEquipesTorneioCall({
        tournamentId:
          currentTournament.id,
        teamsCount:
          teams
      });

    applyTeams(
      response.data || {}
    );

    message(
      'gptv44TeamsMessage',
      'Quantidade salva.',
      'ok'
    );

  }catch(error){

    message(
      'gptv44TeamsMessage',
      error?.message ||
      'Não foi possível salvar.',
      'error'
    );

  }finally{

    if(button){
      button.disabled = false;
      button.textContent =
        'SALVAR QUANTIDADE';
    }
  }
}


async function init(){

  addStyle();

  for(
    let i = 0;
    i < 60;
    i += 1
  ){
    if(rebuildForm()){
      break;
    }

    await wait(100);
  }


  for(
    let i = 0;
    i < 60;
    i += 1
  ){
    if(getApps().length){
      break;
    }

    await wait(100);
  }


  if(!getApps().length){
    throw new Error(
      'Firebase nao iniciou.'
    );
  }


  const app =
    getApp();

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
        loadCurrent,
        300
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
          loadCurrent,
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
          loadCurrent,
          1000
        );
      }
    );


  const view =
    document.getElementById(
      'tournamentsView'
    );

  if(view){

    const observer =
      new MutationObserver(
        () => {

          if(
            view.classList
              .contains('active')
          ){
            setTimeout(
              loadCurrent,
              200
            );
          }

        }
      );

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
}


init().catch(error => {
  console.error(
    'Tournament V44:',
    error
  );
});
