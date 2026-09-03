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


/* GREENPARK_TOURNAMENT_PERSISTENCE_V32 */


const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';


let firebaseUser = null;
let saving = false;

let obterTorneioAtualCall = null;
let salvarTorneioCall = null;
let salvarQuantidadeEquipesTorneioCall = null;
let obterConfiguracaoEquipesTorneioCall = null;


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid ===
      ADMIN_UID
  );
}


function maskDate(value){

  const digits =
    String(value || '')
      .replace(
        /\D/g,
        ''
      )
      .slice(
        0,
        8
      );


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


function brToISO(value){

  const match =
    String(value || '')
      .trim()
      .match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );


  if(!match){
    return '';
  }


  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  const year =
    Number(match[3]);


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
    String(year)
      .padStart(4,'0') +
    '-' +
    String(month)
      .padStart(2,'0') +
    '-' +
    String(day)
      .padStart(2,'0')
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


function ensureMessage(){

  let message =
    document.getElementById(
      'gptv32SaveMessage'
    );


  if(message){
    return message;
  }


  const button =
    document.getElementById(
      'tournamentSaveButton'
    );


  if(!button){
    return null;
  }


  message =
    document.createElement(
      'div'
    );

  message.id =
    'gptv32SaveMessage';

  message.style.cssText = `
    min-height:16px;
    margin-top:8px;
    font-size:8px;
    line-height:1.4;
    text-align:center;
    color:#839188;
  `;


  button.after(
    message
  );


  return message;
}


function setMessage(
  text = '',
  type = ''
){

  const message =
    ensureMessage();


  if(!message){
    return;
  }


  message.textContent =
    text;


  if(type === 'ok'){
    message.style.color =
      'var(--green2)';
  }else if(type === 'error'){
    message.style.color =
      '#ff9696';
  }else{
    message.style.color =
      '#839188';
  }
}


function syncVisibleDate(){

  const visible =
    document.getElementById(
      'gptv44DateDisplay'
    );

  const hidden =
    document.getElementById(
      'tournamentDateInput'
    );


  if(
    !visible ||
    !hidden
  ){
    return '';
  }


  visible.value =
    maskDate(
      visible.value
    );


  const iso =
    brToISO(
      visible.value
    );


  hidden.value =
    iso;


  return iso;
}


function readForm(){

  const name =
    String(
      document
        .getElementById(
          'tournamentNameInput'
        )
        ?.value ||
      ''
    )
      .trim()
      .slice(
        0,
        80
      );


  const visibleDate =
    String(
      document
        .getElementById(
          'gptv44DateDisplay'
        )
        ?.value ||
      ''
    ).trim();


  const date =
    syncVisibleDate();


  const status =
    String(
      document
        .getElementById(
          'tournamentStatusInput'
        )
        ?.value ||
      'draft'
    ).trim();


  const location =
    String(
      document
        .getElementById(
          'tournamentLocationInput'
        )
        ?.value ||
      ''
    )
      .trim()
      .slice(
        0,
        120
      );


  const teamsCount =
    Number(
      document
        .getElementById(
          'gptv4TeamsCountInput'
        )
        ?.value
    );


  if(name.length < 2){
    throw new Error(
      'Informe o nome do torneio.'
    );
  }


  if(
    visibleDate &&
    !date
  ){
    throw new Error(
      'Informe uma data válida no formato DD/MM/AAAA.'
    );
  }


  if(
    !Number.isInteger(
      teamsCount
    ) ||
    teamsCount < 3 ||
    teamsCount > 32
  ){
    throw new Error(
      'Informe de 3 a 32 equipes.'
    );
  }


  return {
    name,
    date,
    status,
    location,
    teamsCount
  };
}


function adaptiveConfig(
  teams
){

  if(teams <= 4){
    return {
      groupCount:1,
      qualifyPerGroup:2
    };
  }


  if(teams === 5){
    return {
      groupCount:1,
      qualifyPerGroup:4
    };
  }


  if(teams <= 10){
    return {
      groupCount:2,
      qualifyPerGroup:2
    };
  }


  if(teams <= 16){
    return {
      groupCount:2,
      qualifyPerGroup:4
    };
  }


  return {
    groupCount:4,
    qualifyPerGroup:2
  };
}


function updateNumbers(
  teams,
  config
){

  const cards =
    document.querySelectorAll(
      '#tournamentsView ' +
      '.gptournament-numbers > div'
    );


  const adaptive =
    adaptiveConfig(
      teams
    );


  const values = [
    teams,

    Number(
      config.groupCount ||
      adaptive.groupCount
    ),

    Number(
      config.qualifyPerGroup ||
      adaptive.qualifyPerGroup
    )
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


async function saveEverything(){

  if(
    saving ||
    !isAdmin()
  ){
    return;
  }


  const button =
    document.getElementById(
      'tournamentSaveButton'
    );


  saving =
    true;


  if(button){
    button.disabled =
      true;

    button.textContent =
      'SALVANDO...';
  }


  setMessage(
    'Salvando campeonato...'
  );


  try{

    const form =
      readForm();


    /*
     * 1. Descobre o torneio atual.
     */
    const before =
      await obterTorneioAtualCall(
        {}
      );


    const currentId =
      before.data?.exists === true ?
        String(
          before.data
            ?.tournament
            ?.id ||
          ''
        ) :
        '';


    /*
     * 2. Salva dados principais.
     * A DATA sai diretamente do campo visível,
     * convertida aqui antes da chamada.
     */
    const tournamentResponse =
      await salvarTorneioCall({

        id:
          currentId,

        name:
          form.name,

        date:
          form.date,

        location:
          form.location,

        status:
          form.status
      });


    let tournamentId =
      String(
        tournamentResponse
          .data
          ?.tournament
          ?.id ||
        ''
      );


    /*
     * Para campeonato novo, confirmamos qual
     * se tornou o atual.
     */
    if(!tournamentId){

      const current =
        await obterTorneioAtualCall(
          {}
        );


      tournamentId =
        String(
          current.data
            ?.tournament
            ?.id ||
          ''
        );
    }


    if(!tournamentId){
      throw new Error(
        'O servidor não retornou o campeonato salvo.'
      );
    }


    /*
     * 3. Salva a quantidade NO MESMO FLUXO.
     * O backend V6.2 grava no documento principal
     * e também settings/format.
     */
    await salvarQuantidadeEquipesTorneioCall({

      tournamentId,

      teamsCount:
        form.teamsCount
    });


    /*
     * 4. Lê tudo novamente do Firebase.
     * Só mostramos "salvo" se os valores
     * realmente estiverem persistidos.
     */
    const [
      verificationTournament,
      verificationConfig
    ] =
      await Promise.all([

        obterTorneioAtualCall(
          {}
        ),

        obterConfiguracaoEquipesTorneioCall({
          tournamentId
        })

      ]);


    const savedTournament =
      verificationTournament
        .data
        ?.tournament ||
      {};


    const savedConfig =
      verificationConfig
        .data ||
      {};


    const savedDate =
      String(
        savedTournament.date ||
        ''
      );


    const savedTeams =
      Number(
        savedConfig.teamsCount
      );


    if(
      savedDate !==
      form.date
    ){
      throw new Error(
        'A data não ficou gravada no servidor.'
      );
    }


    if(
      savedTeams !==
      form.teamsCount
    ){
      throw new Error(
        'A quantidade de equipes não ficou gravada no servidor.'
      );
    }


    /*
     * 5. Sincroniza a tela com o que
     * acabou de ser confirmado no Firebase.
     */
    const hidden =
      document.getElementById(
        'tournamentDateInput'
      );

    const visible =
      document.getElementById(
        'gptv44DateDisplay'
      );

    const teamsInput =
      document.getElementById(
        'gptv4TeamsCountInput'
      );


    if(hidden){
      hidden.value =
        savedDate;
    }


    if(visible){
      visible.value =
        isoToBR(
          savedDate
        );
    }


    if(teamsInput){
      teamsInput.value =
        String(
          savedTeams
        );
    }


    updateNumbers(
      savedTeams,
      savedConfig
    );


    window.dispatchEvent(
      new CustomEvent(
        'greenpark:tournament-teams-count-saved',
        {
          detail:{
            tournamentId,

            teamsCount:
              savedTeams,

            groupCount:
              Number(
                savedConfig.groupCount ||
                1
              ),

            qualifyPerGroup:
              Number(
                savedConfig.qualifyPerGroup ||
                2
              )
          }
        }
      )
    );


    setMessage(
      'Campeonato salvo no Firebase: ' +
      isoToBR(savedDate) +
      ' • ' +
      savedTeams +
      ' equipes.',
      'ok'
    );


    if(button){
      button.textContent =
        'SALVO ✓';
    }


  }catch(error){

    console.error(
      'Tournament Persistence V3.2:',
      error
    );


    setMessage(
      error?.message ||
      'Não foi possível salvar o campeonato.',
      'error'
    );


    if(button){
      button.textContent =
        'ERRO AO SALVAR';
    }


  }finally{

    saving =
      false;


    setTimeout(
      () => {

        if(button){

          button.disabled =
            false;

          button.textContent =
            'SALVAR CAMPEONATO';
        }

      },
      1300
    );

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


  salvarTorneioCall =
    httpsCallable(
      functions,
      'salvarTorneio'
    );


  salvarQuantidadeEquipesTorneioCall =
    httpsCallable(
      functions,
      'salvarQuantidadeEquipesTorneio'
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

    }
  );


  /*
   * Mantém o hidden da data sempre sincronizado.
   */
  document.addEventListener(
    'input',
    event => {

      if(
        event.target?.id ===
        'gptv44DateDisplay'
      ){
        syncVisibleDate();
      }

    },
    true
  );


  document.addEventListener(
    'change',
    event => {

      if(
        event.target?.id ===
        'gptv44DateDisplay'
      ){
        syncVisibleDate();
      }

    },
    true
  );


  document.addEventListener(
    'blur',
    event => {

      if(
        event.target?.id ===
        'gptv44DateDisplay'
      ){
        syncVisibleDate();
      }

    },
    true
  );


  /*
   * ESTE MODULO PASSA A SER O DONO DO
   * BOTAO SALVAR CAMPEONATO.
   *
   * Captura no document ocorre antes dos listeners
   * existentes no botão. Assim não temos dois saves
   * concorrendo entre si.
   */
  document.addEventListener(
    'click',
    event => {

      const button =
        event.target
          ?.closest?.(
            '#tournamentSaveButton'
          );


      if(!button){
        return;
      }


      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();


      saveEverything();

    },
    true
  );


  ensureMessage();
}


init().catch(
  error => {

    console.error(
      'Tournament Persistence V3.2 init:',
      error
    );

  }
);
