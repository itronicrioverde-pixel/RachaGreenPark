import {
  getApps,
  getApp
} from
  'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

import {
  getAuth,
  onAuthStateChanged
} from
  'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';

import {
  getFunctions,
  httpsCallable
} from
  'https://www.gstatic.com/firebasejs/12.11.0/firebase-functions.js';


/* GREENPARK_RULES_ADMIN_V1 */


const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';


let firebaseUser = null;

let obterRegrasCall = null;
let salvarRegrasCall = null;

let defaultRules = null;

let currentRules = {
  rachaRules:'',
  internalRules:'',
  tournamentRules:''
};


function wait(ms){
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function isAdmin(){
  return (
    firebaseUser &&
    firebaseUser.uid ===
      ADMIN_UID
  );
}


function cleanText(value){
  return String(value || '')
    .replace(/\r\n/g,'\n')
    .trim();
}


function detailsList(){

  return Array.from(
    document.querySelectorAll(
      '#rulesView .rules-section'
    )
  );
}


function readExistingRules(
  details
){

  if(!details){
    return '';
  }


  return Array.from(
    details.querySelectorAll(
      '.rules-list li'
    )
  )
    .map(
      item =>
        String(
          item.textContent ||
          ''
        ).trim()
    )
    .filter(Boolean)
    .join('\n');
}


function captureDefaults(){

  if(defaultRules){
    return;
  }


  const sections =
    detailsList();


  defaultRules = {

    rachaRules:
      readExistingRules(
        sections[0]
      ),

    internalRules:
      readExistingRules(
        sections[1]
      ),

    tournamentRules:''
  };


  currentRules = {
    ...defaultRules
  };
}


function ensureTournamentRules(){

  const shell =
    document.querySelector(
      '#rulesView .rules-shell'
    );


  if(!shell){
    return false;
  }


  const sections =
    detailsList();


  if(sections.length >= 3){
    return true;
  }


  const details =
    document.createElement(
      'details'
    );


  details.className =
    'rules-section';


  const summary =
    document.createElement(
      'summary'
    );


  summary.textContent =
    'Regras do campeonato';


  const body =
    document.createElement(
      'div'
    );


  body.className =
    'rules-section-body';


  const list =
    document.createElement(
      'ol'
    );


  list.className =
    'rules-list';


  body.appendChild(
    list
  );


  details.append(
    summary,
    body
  );


  shell.appendChild(
    details
  );


  return true;
}


function renderTextRules(
  details,
  text,
  emptyText
){

  if(!details){
    return;
  }


  let list =
    details.querySelector(
      '.rules-list'
    );


  if(!list){

    list =
      document.createElement(
        'ol'
      );

    list.className =
      'rules-list';


    const body =
      details.querySelector(
        '.rules-section-body'
      ) ||
      details;


    body.appendChild(
      list
    );

  }


  list.innerHTML = '';


  const lines =
    cleanText(text)
      .split('\n')
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);


  if(!lines.length){

    const item =
      document.createElement(
        'li'
      );

    item.className =
      'gprv1-empty';

    item.textContent =
      emptyText;

    list.appendChild(
      item
    );

    return;
  }


  lines.forEach(
    line => {

      const item =
        document.createElement(
          'li'
        );

      item.textContent =
        line;

      list.appendChild(
        item
      );

    }
  );
}


function renderRules(){

  ensureTournamentRules();


  const sections =
    detailsList();


  renderTextRules(
    sections[0],
    currentRules.rachaRules,
    'Regras do racha ainda não publicadas.'
  );


  renderTextRules(
    sections[1],
    currentRules.internalRules,
    'Regulamento interno ainda não publicado.'
  );


  renderTextRules(
    sections[2],
    currentRules.tournamentRules,
    'Regras do campeonato ainda não publicadas.'
  );

}


function setMessage(
  text = '',
  type = ''
){

  const element =
    document.getElementById(
      'gprv1Message'
    );


  if(!element){
    return;
  }


  element.textContent =
    text;


  element.className =
    'gprv1-message' +
    (
      type ?
        ' ' + type :
        ''
    );

}


function fillEditor(){

  const map = {
    gprv1Racha:
      currentRules.rachaRules,

    gprv1Internal:
      currentRules.internalRules,

    gprv1Tournament:
      currentRules.tournamentRules
  };


  Object.entries(map)
    .forEach(
      ([id,value]) => {

        const textarea =
          document.getElementById(
            id
          );


        if(textarea){
          textarea.value =
            value;
        }

      }
    );

}


function closeEditor(){

  document
    .getElementById(
      'gprv1Editor'
    )
    ?.classList
    .remove(
      'show'
    );


  setMessage('');

}


function openEditor(){

  if(!isAdmin()){
    return;
  }


  fillEditor();


  document
    .getElementById(
      'gprv1Editor'
    )
    ?.classList
    .add(
      'show'
    );


  document
    .getElementById(
      'gprv1Editor'
    )
    ?.scrollIntoView({
      behavior:'smooth',
      block:'start'
    });

}


async function saveRules(){

  if(!isAdmin()){
    return;
  }


  const button =
    document.getElementById(
      'gprv1Save'
    );


  const payload = {

    rachaRules:
      cleanText(
        document
          .getElementById(
            'gprv1Racha'
          )
          ?.value
      ),

    internalRules:
      cleanText(
        document
          .getElementById(
            'gprv1Internal'
          )
          ?.value
      ),

    tournamentRules:
      cleanText(
        document
          .getElementById(
            'gprv1Tournament'
          )
          ?.value
      )
  };


  if(button){

    button.disabled =
      true;

    button.textContent =
      'SALVANDO...';

  }


  setMessage(
    'Salvando regras...'
  );


  try{

    const response =
      await salvarRegrasCall(
        payload
      );


    currentRules = {

      rachaRules:
        response.data
          ?.rachaRules ||
        '',

      internalRules:
        response.data
          ?.internalRules ||
        '',

      tournamentRules:
        response.data
          ?.tournamentRules ||
        ''
    };


    renderRules();


    setMessage(
      'Regras publicadas com sucesso.',
      'ok'
    );


    setTimeout(
      closeEditor,
      900
    );


  }catch(error){

    console.error(
      'Rules Admin V1:',
      error
    );


    setMessage(
      error?.message ||
      'Não foi possível salvar as regras.',
      'error'
    );


  }finally{

    if(button){

      button.disabled =
        false;

      button.textContent =
        'PUBLICAR REGRAS';

    }

  }
}


function ensureAdminEditor(){

  const shell =
    document.querySelector(
      '#rulesView .rules-shell'
    );


  const intro =
    shell?.querySelector(
      '.rules-intro'
    );


  if(
    !shell ||
    !intro
  ){
    return false;
  }


  if(
    document.getElementById(
      'gprv1Admin'
    )
  ){
    return true;
  }


  const admin =
    document.createElement(
      'section'
    );


  admin.id =
    'gprv1Admin';

  admin.className =
    'gprv1-admin';


  admin.innerHTML = `

    <button
      id="gprv1Open"
      class="gprv1-open"
      type="button"
    >
      EDITAR REGRAS
    </button>


    <div
      id="gprv1Editor"
      class="gprv1-editor"
    >

      <div class="gprv1-editor-head">
        <strong>
          EDITAR REGRAS
        </strong>

        <span>
          Coloque uma regra por linha.
        </span>
      </div>


      <label class="gprv1-field">
        <span>
          REGRAS DO RACHA
        </span>

        <textarea
          id="gprv1Racha"
          rows="8"
        ></textarea>
      </label>


      <label class="gprv1-field">
        <span>
          REGULAMENTO INTERNO
        </span>

        <textarea
          id="gprv1Internal"
          rows="8"
        ></textarea>
      </label>


      <label class="gprv1-field">
        <span>
          REGRAS DO CAMPEONATO
        </span>

        <textarea
          id="gprv1Tournament"
          rows="8"
          placeholder="Digite aqui as regras dos campeonatos..."
        ></textarea>
      </label>


      <div class="gprv1-actions">

        <button
          id="gprv1Cancel"
          type="button"
        >
          CANCELAR
        </button>

        <button
          id="gprv1Save"
          class="save"
          type="button"
        >
          PUBLICAR REGRAS
        </button>

      </div>


      <div
        id="gprv1Message"
        class="gprv1-message"
      ></div>

    </div>
  `;


  intro.after(
    admin
  );


  document
    .getElementById(
      'gprv1Open'
    )
    ?.addEventListener(
      'click',
      openEditor
    );


  document
    .getElementById(
      'gprv1Cancel'
    )
    ?.addEventListener(
      'click',
      closeEditor
    );


  document
    .getElementById(
      'gprv1Save'
    )
    ?.addEventListener(
      'click',
      saveRules
    );


  return true;
}


function updateAdminVisibility(){

  const admin =
    document.getElementById(
      'gprv1Admin'
    );


  if(!admin){
    return;
  }


  admin.style.display =
    isAdmin() ?
      '' :
      'none';

}


async function loadRules(){

  try{

    const response =
      await obterRegrasCall(
        {}
      );


    if(
      response.data
        ?.exists ===
      true
    ){

      currentRules = {

        rachaRules:
          response.data
            ?.rachaRules ||
          '',

        internalRules:
          response.data
            ?.internalRules ||
          '',

        tournamentRules:
          response.data
            ?.tournamentRules ||
          ''
      };


    }else{

      currentRules = {
        ...defaultRules
      };

    }


    renderRules();


  }catch(error){

    console.error(
      'Carregar regras:',
      error
    );


    currentRules = {
      ...defaultRules
    };


    renderRules();

  }
}


async function waitForFirebase(){

  for(
    let i = 0;
    i < 80;
    i += 1
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

  captureDefaults();

  ensureTournamentRules();
  ensureAdminEditor();

  renderRules();


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


  obterRegrasCall =
    httpsCallable(
      functions,
      'obterRegrasGreenPark'
    );


  salvarRegrasCall =
    httpsCallable(
      functions,
      'salvarRegrasGreenPark'
    );


  onAuthStateChanged(
    auth,
    user => {

      firebaseUser =
        user;


      updateAdminVisibility();


      if(user){

        loadRules();

      }

    }
  );

}


init().catch(
  error => {

    console.error(
      'Rules Admin V1 init:',
      error
    );

  }
);
