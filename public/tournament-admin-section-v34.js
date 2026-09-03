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


/* GREENPARK_TOURNAMENT_ADMIN_SECTION_V34 */


const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';


let firebaseUser = null;

let obterTorneioAtualCall = null;
let obterConfiguracaoEquipesTorneioCall = null;

let hydrating = false;
let adminOpened = false;


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid === ADMIN_UID
  );
}


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
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


function statusLabel(value){
  const labels = {
    draft:
      'Planejamento',

    open:
      'Inscrições abertas',

    in_progress:
      'Em andamento',

    finished:
      'Encerrado'
  };

  return (
    labels[value] ||
    'Planejamento'
  );
}


function statusHeroLabel(value){
  const labels = {
    draft:
      'EM CONFIGURAÇÃO',

    open:
      'INSCRIÇÕES ABERTAS',

    in_progress:
      'EM ANDAMENTO',

    finished:
      'ENCERRADO'
  };

  return (
    labels[value] ||
    'EM CONFIGURAÇÃO'
  );
}


function adaptiveConfig(teams){

  if(teams <= 4){
    return {
      groupCount:1,
      qualifyPerGroup:2,
      formatLabel:
        'Grupo único + final'
    };
  }

  if(teams === 5){
    return {
      groupCount:1,
      qualifyPerGroup:4,
      formatLabel:
        'Grupo único + semifinais + final'
    };
  }

  if(teams <= 10){
    return {
      groupCount:2,
      qualifyPerGroup:2,
      formatLabel:
        '2 grupos + semifinais + final'
    };
  }

  if(teams <= 16){
    return {
      groupCount:2,
      qualifyPerGroup:4,
      formatLabel:
        '2 grupos + quartas + final'
    };
  }

  return {
    groupCount:4,
    qualifyPerGroup:2,
    formatLabel:
      '4 grupos + quartas + final'
  };
}


function addStyle(){

  if(
    document.getElementById(
      'greenpark-admin-section-v34-style'
    )
  ){
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'greenpark-admin-section-v34-style';


  style.textContent = `

/* GREENPARK_TOURNAMENT_ADMIN_SECTION_V34 */


/* ==========================================================
   CARD DE ACESSO
   ========================================================== */

#gptv34AdminEntry{
  margin:0 0 12px;
}

.gptv34-entry-button{
  width:100%;
  min-height:66px;

  padding:10px 12px;

  display:grid;
  grid-template-columns:
    42px
    minmax(0,1fr)
    22px;

  gap:9px;

  align-items:center;

  border:
    1px solid #2d4338;

  border-radius:13px;

  background:#0c1713;

  color:#fff;

  text-align:left;
}


.gptv34-entry-icon{
  width:42px;
  height:42px;

  display:flex;
  align-items:center;
  justify-content:center;

  border:
    1px solid
    rgba(86,213,46,.26);

  border-radius:11px;

  background:#12251a;

  color:var(--green2);

  font-size:12px;
  font-weight:950;
}


.gptv34-entry-main{
  min-width:0;
}


.gptv34-entry-main strong{
  display:block;

  color:#fff;

  font-size:10px;
  font-weight:950;
}


.gptv34-entry-main span{
  display:block;

  margin-top:4px;

  overflow:hidden;

  color:#788a80;

  font-size:7px;
  line-height:1.35;

  text-overflow:ellipsis;
  white-space:nowrap;
}


.gptv34-entry-arrow{
  color:var(--green2);

  font-size:20px;

  text-align:right;
}


/* ==========================================================
   ABRIR / FECHAR
   ========================================================== */

#tournamentAdminPanel.gptv34-collapsed{
  display:none!important;
}


#gptv34AdminEntry.gptv34-hidden{
  display:none!important;
}


/* ==========================================================
   CABECALHO INTERNO
   ========================================================== */

.gptv34-backbar{
  display:grid;

  grid-template-columns:
    40px
    minmax(0,1fr);

  gap:8px;

  align-items:center;

  margin:0 0 10px;
}


.gptv34-back{
  width:40px;
  height:40px;

  border:
    1px solid #344a3f;

  border-radius:10px;

  background:#111c17;

  color:#fff;

  font-size:19px;
}


.gptv34-back-title strong{
  display:block;

  color:#fff;

  font-size:11px;
  font-weight:950;
}


.gptv34-back-title span{
  display:block;

  margin-top:3px;

  color:#74867c;

  font-size:7px;
}


/*
 * O titulo antigo fica redundante,
 * pois agora temos um cabecalho com VOLTAR.
 */
#tournamentAdminPanel
> .gptournament-admin-title{
  display:none!important;
}


/* ==========================================================
   ESTADO DE SINCRONIZACAO
   ========================================================== */

#gptv34Sync{
  min-height:12px;

  margin:0 0 6px;

  color:#74867c;

  font-size:6.5px;
  line-height:1.35;

  text-align:center;
}


#gptv34Sync.ok{
  color:var(--green2);
}


#gptv34Sync.error{
  color:#ff9696;
}

`;


  document.head.appendChild(
    style
  );
}


function setSync(
  text = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv34Sync'
    );

  if(!el){
    return;
  }

  el.textContent =
    text;

  el.className =
    type || '';
}


function ensureUI(){

  addStyle();


  const panel =
    document.getElementById(
      'tournamentAdminPanel'
    );


  if(!panel){
    return false;
  }


  if(
    document.getElementById(
      'gptv34AdminEntry'
    )
  ){
    return true;
  }


  /*
   * CARD COMPACTO
   */
  const entry =
    document.createElement(
      'section'
    );

  entry.id =
    'gptv34AdminEntry';

  entry.className =
    'content-admin-only';


  const button =
    document.createElement(
      'button'
    );

  button.type =
    'button';

  button.id =
    'gptv34OpenAdmin';

  button.className =
    'gptv34-entry-button';


  button.innerHTML = `
    <span class="gptv34-entry-icon">
      AJ
    </span>

    <span class="gptv34-entry-main">
      <strong>
        CONFIGURAR TORNEIO
      </strong>

      <span id="gptv34EntryMeta">
        Carregando configuração...
      </span>
    </span>

    <span class="gptv34-entry-arrow">
      ›
    </span>
  `;


  entry.appendChild(
    button
  );


  panel.parentNode.insertBefore(
    entry,
    panel
  );


  /*
   * CABECALHO DA TELA INTERNA
   */
  const backbar =
    document.createElement(
      'div'
    );

  backbar.className =
    'gptv34-backbar';


  const back =
    document.createElement(
      'button'
    );

  back.type =
    'button';

  back.id =
    'gptv34Back';

  back.className =
    'gptv34-back';

  back.textContent =
    '←';


  const backTitle =
    document.createElement(
      'div'
    );

  backTitle.className =
    'gptv34-back-title';

  backTitle.innerHTML = `
    <strong>
      CONFIGURAR TORNEIO
    </strong>

    <span>
      Dados gerais e formato
    </span>
  `;


  backbar.append(
    back,
    backTitle
  );


  panel.prepend(
    backbar
  );


  const sync =
    document.createElement(
      'div'
    );

  sync.id =
    'gptv34Sync';


  backbar.after(
    sync
  );


  button.addEventListener(
    'click',
    async () => {

      adminOpened =
        true;

      entry.classList.add(
        'gptv34-hidden'
      );

      panel.classList.remove(
        'gptv34-collapsed'
      );


      await hydrateFromFirebase(
        true
      );


      panel.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });

    }
  );


  back.addEventListener(
    'click',
    async () => {

      adminOpened =
        false;

      panel.classList.add(
        'gptv34-collapsed'
      );

      entry.classList.remove(
        'gptv34-hidden'
      );


      await hydrateFromFirebase(
        false
      );


      entry.scrollIntoView({
        behavior:'smooth',
        block:'center'
      });

    }
  );


  /*
   * CONFIGURACAO FECHADA POR PADRAO.
   */
  panel.classList.add(
    'gptv34-collapsed'
  );


  return true;
}


async function waitForForm(){

  for(
    let attempt = 0;
    attempt < 60;
    attempt += 1
  ){

    const ready =
      document.getElementById(
        'tournamentNameInput'
      ) &&
      document.getElementById(
        'gptv44DateDisplay'
      ) &&
      document.getElementById(
        'tournamentDateInput'
      ) &&
      document.getElementById(
        'tournamentStatusInput'
      ) &&
      document.getElementById(
        'tournamentLocationInput'
      ) &&
      document.getElementById(
        'gptv4TeamsCountInput'
      );


    if(ready){
      return true;
    }


    await wait(
      100
    );
  }


  return false;
}


function updateHero(
  tournament,
  config,
  teams
){

  const name =
    document.getElementById(
      'tournamentName'
    );

  const date =
    document.getElementById(
      'tournamentDate'
    );

  const location =
    document.getElementById(
      'tournamentLocation'
    );

  const status =
    document.getElementById(
      'tournamentStatus'
    );


  if(name){
    name.textContent =
      String(
        tournament.name ||
        'TORNEIO'
      )
        .toLocaleUpperCase(
          'pt-BR'
        );
  }


  if(date){
    date.textContent =
      isoToBR(
        tournament.date
      ) ||
      'A DEFINIR';
  }


  if(location){
    location.textContent =
      String(
        tournament.location ||
        'A DEFINIR'
      )
        .toLocaleUpperCase(
          'pt-BR'
        );
  }


  if(status){

    const statusValue =
      String(
        tournament.status ||
        'draft'
      );

    status.className =
      'gptournament-status ' +
      statusValue;

    status.textContent =
      statusHeroLabel(
        statusValue
      );
  }


  const adaptive =
    adaptiveConfig(
      teams
    );


  const groupCount =
    Number(
      config.groupCount ||
      tournament.groupCount ||
      adaptive.groupCount
    );


  const qualify =
    Number(
      config.qualifyPerGroup ||
      tournament.qualifyPerGroup ||
      adaptive.qualifyPerGroup
    );


  const cards =
    document.querySelectorAll(
      '#tournamentsView ' +
      '.gptournament-numbers > div'
    );


  const values = [
    teams,
    groupCount,
    qualify
  ];


  values.forEach(
    (value,index) => {

      const strong =
        cards[index]
          ?.querySelector(
            'strong'
          );

      if(strong){
        strong.textContent =
          String(value);
      }

    }
  );
}


function updateForm(
  tournament,
  config,
  teams
){

  const name =
    document.getElementById(
      'tournamentNameInput'
    );

  const visibleDate =
    document.getElementById(
      'gptv44DateDisplay'
    );

  const hiddenDate =
    document.getElementById(
      'tournamentDateInput'
    );

  const status =
    document.getElementById(
      'tournamentStatusInput'
    );

  const location =
    document.getElementById(
      'tournamentLocationInput'
    );

  const teamsInput =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  const format =
    document.getElementById(
      'gptv44FormatValue'
    );


  if(name){
    name.value =
      tournament.name ||
      '';
  }


  if(hiddenDate){
    hiddenDate.value =
      tournament.date ||
      '';
  }


  if(visibleDate){
    visibleDate.value =
      isoToBR(
        tournament.date
      );
  }


  if(status){
    status.value =
      tournament.status ||
      'draft';
  }


  if(location){
    location.value =
      tournament.location ||
      '';
  }


  if(teamsInput){
    teamsInput.value =
      String(teams);
  }


  if(format){

    const adaptive =
      adaptiveConfig(
        teams
      );

    format.textContent =
      config.formatLabel ||
      tournament.formatLabel ||
      adaptive.formatLabel;
  }
}


function updateEntry(
  tournament,
  teams
){

  const meta =
    document.getElementById(
      'gptv34EntryMeta'
    );


  if(!meta){
    return;
  }


  if(!tournament?.id){
    meta.textContent =
      'Criar ou configurar campeonato';

    return;
  }


  const parts = [];


  const date =
    isoToBR(
      tournament.date
    );


  if(date){
    parts.push(
      date
    );
  }


  parts.push(
    teams +
    (
      teams === 1 ?
        ' equipe' :
        ' equipes'
    )
  );


  parts.push(
    statusLabel(
      tournament.status
    )
  );


  meta.textContent =
    parts.join(
      ' • '
    );
}


async function hydrateFromFirebase(
  showStatus = false
){

  if(
    hydrating ||
    !isAdmin()
  ){
    return;
  }


  hydrating =
    true;


  try{

    ensureUI();


    if(showStatus){
      setSync(
        'Carregando dados salvos...'
      );
    }


    const formReady =
      await waitForForm();


    if(!formReady){
      throw new Error(
        'Formulário do torneio não ficou disponível.'
      );
    }


    /*
     * FONTE OFICIAL:
     * Firebase.
     *
     * Não usamos valores antigos do HTML
     * nem valores deixados em memória.
     */
    const currentResponse =
      await obterTorneioAtualCall(
        {}
      );


    if(
      currentResponse
        .data
        ?.exists !==
      true
    ){

      updateEntry(
        null,
        0
      );


      if(showStatus){
        setSync(
          'Nenhum campeonato salvo.'
        );
      }


      return;
    }


    const tournament =
      currentResponse
        .data
        .tournament ||
      {};


    const tournamentId =
      String(
        tournament.id ||
        ''
      );


    if(!tournamentId){
      throw new Error(
        'Campeonato atual sem identificador.'
      );
    }


    const configResponse =
      await obterConfiguracaoEquipesTorneioCall({
        tournamentId
      });


    const config =
      configResponse
        .data ||
      {};


    let teams =
      Number(
        config.teamsCount
      );


    if(
      !Number.isInteger(teams) ||
      teams < 3 ||
      teams > 32
    ){
      teams =
        Number(
          tournament.teamsCount
        );
    }


    if(
      !Number.isInteger(teams) ||
      teams < 3 ||
      teams > 32
    ){
      teams = 10;
    }


    /*
     * REHIDRATA TODA A TELA.
     */
    updateForm(
      tournament,
      config,
      teams
    );


    updateHero(
      tournament,
      config,
      teams
    );


    updateEntry(
      tournament,
      teams
    );


    /*
     * Também avisa Jogos/Equipes qual é
     * a quantidade REAL recuperada do Firebase.
     */
    window.dispatchEvent(
      new CustomEvent(
        'greenpark:tournament-teams-count-saved',
        {
          detail:{
            source:
              'v34-hydration',

            tournamentId,

            teamsCount:
              teams,

            groupCount:
              Number(
                config.groupCount ||
                adaptiveConfig(
                  teams
                ).groupCount
              ),

            qualifyPerGroup:
              Number(
                config.qualifyPerGroup ||
                adaptiveConfig(
                  teams
                ).qualifyPerGroup
              )
          }
        }
      )
    );


    if(showStatus){

      setSync(
        'Dados carregados do Firebase.',
        'ok'
      );

    }


  }catch(error){

    console.error(
      'Tournament Admin V3.4:',
      error
    );


    if(showStatus){

      setSync(
        error?.message ||
        'Não foi possível carregar os dados.',
        'error'
      );

    }


  }finally{

    hydrating =
      false;

  }
}


async function waitForFirebase(){

  for(
    let attempt = 0;
    attempt < 80;
    attempt += 1
  ){

    if(getApps().length){
      return getApp();
    }


    await wait(
      100
    );

  }


  throw new Error(
    'Firebase principal não iniciou.'
  );
}


async function init(){

  addStyle();


  for(
    let attempt = 0;
    attempt < 70;
    attempt += 1
  ){

    if(ensureUI()){
      break;
    }


    await wait(
      100
    );

  }


  const app =
    await waitForFirebase();


  const auth =
    getAuth(
      app
    );


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


  onAuthStateChanged(
    auth,
    user => {

      firebaseUser =
        user;


      const entry =
        document.getElementById(
          'gptv34AdminEntry'
        );


      if(
        entry &&
        !isAdmin()
      ){
        entry.style.display =
          'none';
      }else if(entry){
        entry.style.display =
          '';
      }


      if(isAdmin()){

        /*
         * Duas leituras controladas.
         * A segunda ocorre depois dos scripts antigos
         * terminarem de montar o formulário.
         */
        setTimeout(
          () =>
            hydrateFromFirebase(
              false
            ),
          300
        );


        setTimeout(
          () =>
            hydrateFromFirebase(
              false
            ),
          1200
        );

      }

    }
  );


  /*
   * Quando o PWA volta do segundo plano.
   */
  window.addEventListener(
    'pageshow',
    () => {

      setTimeout(
        () =>
          hydrateFromFirebase(
            false
          ),
        250
      );

    }
  );


  document.addEventListener(
    'visibilitychange',
    () => {

      if(
        document.visibilityState ===
        'visible'
      ){

        setTimeout(
          () =>
            hydrateFromFirebase(
              false
            ),
          250
        );

      }

    }
  );


  /*
   * Depois do SALVAR da V3.2,
   * ela dispara este evento.
   *
   * Ignoramos somente o evento que
   * a própria V3.4 criou para não gerar loop.
   */
  window.addEventListener(
    'greenpark:tournament-teams-count-saved',
    event => {

      if(
        event.detail?.source ===
        'v34-hydration'
      ){
        return;
      }


      setTimeout(
        () =>
          hydrateFromFirebase(
            adminOpened
          ),
        200
      );

    }
  );


  /*
   * Ao entrar novamente em TORNEIOS.
   */
  document.addEventListener(
    'click',
    event => {

      const id =
        event.target
          ?.closest?.(
            'button'
          )
          ?.id ||
        '';


      if(
        id ===
        'openTournamentsQuick'
      ){

        setTimeout(
          () =>
            hydrateFromFirebase(
              false
            ),
          500
        );

      }

    }
  );

}


init().catch(
  error => {

    console.error(
      'Tournament Admin V3.4 init:',
      error
    );

  }
);
