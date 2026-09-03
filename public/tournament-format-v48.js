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


/* GREENPARK_TOURNAMENT_ADAPTIVE_FORMAT_V48 */

let firebaseUser = null;

let obterTorneioAtualCall = null;
let obterConfiguracaoEquipesTorneioCall = null;


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


function normalizeTeams(value){
  const number =
    Number(value);

  if(
    !Number.isInteger(number) ||
    number < 3
  ){
    return 3;
  }

  return Math.min(
    32,
    number
  );
}


function balancedGroups(
  total,
  groupCount
){
  const base =
    Math.floor(
      total / groupCount
    );

  const rest =
    total % groupCount;

  return Array.from(
    {
      length:groupCount
    },
    (_,index) =>
      base +
      (
        index < rest ?
          1 :
          0
      )
  );
}


/*
 * REGRA DE FORMATO
 *
 * 3-4:
 * grupo unico + final
 *
 * 5:
 * grupo unico + semifinais
 *
 * 6-10:
 * 2 grupos + semifinais
 *
 * 11-16:
 * 2 grupos + quartas
 *
 * 17-32:
 * 4 grupos + quartas
 */
function tournamentFormat(
  rawTeams
){
  const teams =
    normalizeTeams(
      rawTeams
    );


  if(teams <= 4){

    return {
      teams,
      groupCount:1,
      groupSizes:[
        teams
      ],

      shortLabel:
        'Grupo único + final',

      summary:
        'Grupo único • todos contra todos • ' +
        '1º e 2º fazem a final',

      standingsLabel:
        'Grupo único',

      advanceText:
        '1º e 2º vão à final'
    };

  }


  if(teams === 5){

    return {
      teams,
      groupCount:1,
      groupSizes:[
        5
      ],

      shortLabel:
        'Grupo único + semifinais + final',

      summary:
        'Grupo único • todos contra todos • ' +
        '4 melhores nas semifinais • final',

      standingsLabel:
        'Grupo único',

      advanceText:
        '1º ao 4º avançam'
    };

  }


  if(teams <= 10){

    const sizes =
      balancedGroups(
        teams,
        2
      );

    return {
      teams,
      groupCount:2,
      groupSizes:
        sizes,

      shortLabel:
        '2 grupos + semifinais + final',

      summary:
        '2 grupos (' +
        sizes.join(' + ') +
        ') • 2 por grupo avançam • ' +
        'semifinais • final',

      standingsLabel:
        'Grupo A + Grupo B',

      advanceText:
        '1º e 2º avançam'
    };

  }


  if(teams <= 16){

    const sizes =
      balancedGroups(
        teams,
        2
      );

    return {
      teams,
      groupCount:2,
      groupSizes:
        sizes,

      shortLabel:
        '2 grupos + quartas + final',

      summary:
        '2 grupos (' +
        sizes.join(' + ') +
        ') • 4 por grupo avançam • ' +
        'quartas • semifinais • final',

      standingsLabel:
        'Grupo A + Grupo B',

      advanceText:
        '1º ao 4º avançam'
    };

  }


  const sizes =
    balancedGroups(
      teams,
      4
    );

  return {
    teams,
    groupCount:4,
    groupSizes:
      sizes,

    shortLabel:
      '4 grupos + quartas + final',

    summary:
      '4 grupos (' +
      sizes.join(' + ') +
      ') • 2 por grupo avançam • ' +
      'quartas • semifinais • final',

    standingsLabel:
      'Grupos A + B + C + D',

    advanceText:
      '1º e 2º avançam'
  };
}


function groupName(
  index,
  total
){
  if(total === 1){
    return 'GRUPO ÚNICO';
  }

  return (
    'GRUPO ' +
    String.fromCharCode(
      65 + index
    )
  );
}


function renderGroups(
  format
){
  const preview =
    document.querySelector(
      '#tournamentsView ' +
      '.gptournament-groups-preview'
    );

  if(!preview){
    return;
  }


  preview.innerHTML =
    '';


  if(format.groupCount === 1){

    preview.style
      .gridTemplateColumns =
      '1fr';

  }else{

    preview.style
      .gridTemplateColumns =
      'repeat(2,minmax(0,1fr))';

  }


  format.groupSizes
    .forEach(
      (size,index) => {

        const card =
          document.createElement(
            'div'
          );

        card.className =
          'gptournament-group';


        const strong =
          document.createElement(
            'strong'
          );

        strong.textContent =
          groupName(
            index,
            format.groupCount
          );


        const span =
          document.createElement(
            'span'
          );

        span.textContent =
          size +
          (
            size === 1 ?
              ' equipe' :
              ' equipes'
          );


        const small =
          document.createElement(
            'small'
          );

        small.textContent =
          format.advanceText;


        card.append(
          strong,
          span,
          small
        );


        preview.appendChild(
          card
        );
      }
    );
}


function applyFormat(
  rawTeams
){
  const format =
    tournamentFormat(
      rawTeams
    );


  /*
   * FORMATO NO ADMIN
   */
  const adminFormat =
    document.querySelector(
      '#tournamentsView ' +
      '.gptv44-static'
    );

  if(adminFormat){

    adminFormat.textContent =
      format.shortLabel;

  }


  /*
   * CARD PRINCIPAL DO TORNEIO
   */
  const mainFormat =
    document.querySelector(
      '#tournamentsView ' +
      '.gptournament-format span'
    );

  if(mainFormat){

    mainFormat.textContent =
      format.summary;

  }


  /*
   * SUBTITULO DA CLASSIFICACAO
   */
  const standingsSubtitle =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="standings"] ' +
      '.gptournament-panel-head span'
    );

  if(standingsSubtitle){

    standingsSubtitle.textContent =
      format.standingsLabel;

  }


  /*
   * CARDS DOS GRUPOS
   */
  renderGroups(
    format
  );


  return format;
}


function updateFromInput(){

  const input =
    document.getElementById(
      'gptv4TeamsCountInput'
    );

  if(!input){
    return;
  }

  const teams =
    Number(
      input.value
    );

  if(
    Number.isInteger(teams) &&
    teams >= 3 &&
    teams <= 32
  ){
    applyFormat(
      teams
    );
  }
}


async function loadSavedFormat(){

  if(
    !firebaseUser ||
    !obterTorneioAtualCall ||
    !obterConfiguracaoEquipesTorneioCall
  ){
    updateFromInput();
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
      updateFromInput();
      return;
    }


    const tournament =
      currentResponse
        .data
        .tournament;


    if(!tournament?.id){
      updateFromInput();
      return;
    }


    const configResponse =
      await obterConfiguracaoEquipesTorneioCall({
        tournamentId:
          tournament.id
      });


    const teams =
      Number(
        configResponse
          .data
          ?.teamsCount
      );


    if(
      Number.isInteger(teams) &&
      teams >= 3 &&
      teams <= 32
    ){
      applyFormat(
        teams
      );
    }else{
      updateFromInput();
    }


  }catch(error){

    console.warn(
      'Formato adaptativo:',
      error
    );

    updateFromInput();

  }
}


function bindUI(){

  /*
   * O formulario V4.4 e criado dinamicamente.
   * Event delegation evita interferir nele.
   */
  document.addEventListener(
    'input',
    event => {

      if(
        event.target?.id ===
        'gptv4TeamsCountInput'
      ){
        updateFromInput();
      }

    }
  );


  document.addEventListener(
    'click',
    event => {

      const button =
        event.target
          ?.closest?.(
            'button'
          );

      const id =
        button?.id ||
        '';


      /*
       * Espera o V4.4 alterar o numero primeiro.
       */
      if(
        id === 'gptv44Minus' ||
        id === 'gptv44Plus' ||
        id === 'gptv41TeamsMinus' ||
        id === 'gptv41TeamsPlus'
      ){

        setTimeout(
          updateFromInput,
          0
        );

        return;
      }


      /*
       * Depois de salvar quantidade,
       * relê o valor gravado.
       */
      if(
        id === 'gptv44TeamsSave' ||
        id === 'gptv4TeamsSave'
      ){

        setTimeout(
          loadSavedFormat,
          700
        );

        return;
      }


      if(
        id === 'openTournamentsQuick'
      ){

        setTimeout(
          loadSavedFormat,
          400
        );

        return;
      }


      if(
        id === 'tournamentSaveButton'
      ){

        setTimeout(
          loadSavedFormat,
          1000
        );
      }

    }
  );
}


async function waitForApp(){

  for(
    let attempt = 0;
    attempt < 70;
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

  bindUI();


  /*
   * Primeiros ajustes, mesmo antes do Firebase.
   */
  [
    100,
    300,
    700,
    1200
  ].forEach(
    delay => {

      setTimeout(
        updateFromInput,
        delay
      );

    }
  );


  const app =
    await waitForApp();


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


      setTimeout(
        loadSavedFormat,
        250
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
              loadSavedFormat,
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


init().catch(
  error => {

    console.error(
      'Tournament Format V48:',
      error
    );

  }
);
