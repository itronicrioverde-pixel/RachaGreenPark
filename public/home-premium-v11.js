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
  getFirestore,
  doc,
  onSnapshot
} from
  'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';


/* GREENPARK_HOME_PREMIUM_V11 */
/* GREENPARK_HOME_SCREENSHOT_LOCK_V12 */
/* GREENPARK_PLAYER_CARD_STATUS_V14 */


const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';


const EMOJIS = {

  openConfirmedListQuick:
    '📋',

  openRankingQuick:
    '🥇',

  openStatsQuick:
    '📊',

  openTeamsQuick:
    '👥',

  openGalleryQuick:
    '📸',

  openNoticesQuick:
    '📢',

  openSponsorsQuick:
    '🤝',

  openTournamentsQuick:
    '🏆'

};


let currentUser =
  null;


let playerCloud =
  null;


let temporarySelfie =
  '';


let unsubscribePlayer =
  null;


/* ==========================================================
   UTIL
   ========================================================== */

function wait(ms){

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );

}


function validImage(value){

  const source =
    String(
      value ||
      ''
    ).trim();


  return (
    source.startsWith(
      'https://'
    ) ||
    source.startsWith(
      'http://'
    ) ||
    source.startsWith(
      'data:image/'
    )
  );

}


/* ==========================================================
   EMOJIS
   ========================================================== */

function applyEmojis(){

  Object
    .entries(
      EMOJIS
    )
    .forEach(
      ([id,emoji]) => {

        const button =
          document.getElementById(
            id
          );


        if(!button){
          return;
        }


        const icon =
          button.querySelector(
            'b'
          );


        if(icon){

          icon.textContent =
            emoji;

        }

      }
    );

}


/* ==========================================================
   CARD
   ========================================================== */

function ensureCard(){

  let card =
    document.getElementById(
      'gphv11PlayerCard'
    );


  if(card){
    return card;
  }


  const home =
    document.getElementById(
      'homeView'
    );


  if(!home){
    return null;
  }


  card =
    document.createElement(
      'section'
    );


  card.id =
    'gphv11PlayerCard';


  card.innerHTML = `

    <div class="gphv14-card-copy">

      <div class="gphv11-card-kicker">
        SEU CARD
      </div>


      <div
        id="gphv11PlayerName"
        class="gphv14-player-name"
      >
        JOGADOR GREEN PARK
      </div>


      <div
        id="gphv14PlayerStatus"
        class="gphv14-player-status neutral"
      >
        CADASTRO CONCLUÍDO
      </div>


      <div class="gphv14-player-club">
        GREEN PARK FC
      </div>

    </div>


    <div class="gphv11-portrait-wrap">

      <div class="gphv11-portrait">

        <img
          id="gphv11PlayerPhoto"
          alt="Seu card Green Park"
        >

      </div>


      <div
        id="gphv14CardCheck"
        class="gphv11-card-check"
      >
        ✓
      </div>

    </div>
  `;


  const statusCard =
    home.querySelector(
      '.status-card'
    );


  const quickTitle =
    home.querySelector(
      '.quick-title'
    );


  if(statusCard){

    statusCard.after(
      card
    );

  }else if(quickTitle){

    quickTitle.before(
      card
    );

  }else{

    home.appendChild(
      card
    );

  }


  return card;

}


function getPhoto(){

  if(
    validImage(
      temporarySelfie
    )
  ){

    return temporarySelfie;

  }


  const possibilities = [

    playerCloud?.photoURL,
    playerCloud?.photoUrl,
    playerCloud?.photo,
    playerCloud?.selfieURL,
    playerCloud?.selfieUrl

  ];


  return (
    possibilities.find(
      validImage
    ) ||
    ''
  );

}


function getName(){

  const cloud =
    String(
      playerCloud?.name ||
      ''
    ).trim();


  if(cloud){
    return cloud;
  }


  const form =
    String(
      document
        .getElementById(
          'playerName'
        )
        ?.value ||
      ''
    ).trim();


  return (
    form ||
    'JOGADOR GREEN PARK'
  );

}


function getPlayerCardStatus(){

  let raw =
    String(
      playerCloud?.status ||
      'registered'
    )
      .trim()
      .toLowerCase();


  if(
    raw === 'approved' ||
    raw === 'paid'
  ){

    raw =
      'confirmed';

  }


  const monthly =
    playerCloud?.monthlyActive ===
      true;


  if(
    raw === 'confirmed'
  ){

    return {
      text:
        monthly ?
          '✓ CONFIRMADO • MENSALISTA' :
          '✓ CONFIRMADO',

      tone:
        'confirmed'
    };

  }


  if(
    raw === 'requested'
  ){

    return {
      text:
        '⏳ AGUARDANDO CONFIRMAÇÃO',

      tone:
        'pending'
    };

  }


  if(
    raw === 'rejected'
  ){

    return {
      text:
        'NÃO APROVADO',

      tone:
        'rejected'
    };

  }


  if(
    raw === 'no'
  ){

    return {
      text:
        'NÃO VOU',

      tone:
        'no'
    };

  }


  if(
    raw === 'maybe'
  ){

    return {
      text:
        'AINDA NÃO SEI',

      tone:
        'maybe'
    };

  }


  /*
   * Caso tenha mensalidade ativa,
   * mas o status semanal ainda não
   * tenha sincronizado.
   */
  if(monthly){

    return {
      text:
        'MENSALISTA ATIVO',

      tone:
        'monthly'
    };

  }


  /*
   * Pagamento informado,
   * aguardando o administrador.
   */
  if(
    playerCloud?.paymentReported ===
      true
  ){

    return {
      text:
        '⏳ AGUARDANDO CONFIRMAÇÃO',

      tone:
        'pending'
    };

  }


  /*
   * Terminou cadastro, mas ainda
   * não entrou no fluxo do racha.
   */
  return {
    text:
      'CADASTRO CONCLUÍDO',

    tone:
      'registered'
  };

}


function renderCard(){

  const card =
    ensureCard();


  if(!card){
    return;
  }


  /*
   * Admin nao recebe card pessoal.
   */
  if(
    !currentUser ||
    currentUser.uid ===
      ADMIN_UID
  ){

    card.classList.remove(
      'show'
    );

    return;
  }


  const photo =
    getPhoto();


  if(
    !validImage(
      photo
    )
  ){

    card.classList.remove(
      'show'
    );

    return;
  }


  const image =
    document.getElementById(
      'gphv11PlayerPhoto'
    );


  const name =
    document.getElementById(
      'gphv11PlayerName'
    );


  const status =
    document.getElementById(
      'gphv14PlayerStatus'
    );


  const check =
    document.getElementById(
      'gphv14CardCheck'
    );


  if(image){

    if(
      image.getAttribute(
        'src'
      ) !== photo
    ){

      image.src =
        photo;

    }

  }


  if(name){

    name.textContent =
      getName()
        .toLocaleUpperCase(
          'pt-BR'
        );

  }


  const cardStatus =
    getPlayerCardStatus();


  if(status){

    status.textContent =
      cardStatus.text;


    status.className =
      'gphv14-player-status ' +
      cardStatus.tone;

  }


  if(check){

    if(
      cardStatus.tone ===
        'confirmed' ||
      cardStatus.tone ===
        'monthly'
    ){

      check.style.display =
        'grid';

      check.textContent =
        '✓';

    }else{

      check.style.display =
        'none';

    }

  }


  card.classList.add(
    'show'
  );

}


/* ==========================================================
   NOVA SELFIE
   ========================================================== */

function observeSelfie(){

  const selfie =
    document.getElementById(
      'selfieImage'
    );


  if(!selfie){
    return;
  }


  const read = () => {

    const source =
      selfie.getAttribute(
        'src'
      ) ||
      '';


    if(
      validImage(
        source
      )
    ){

      temporarySelfie =
        source;


      renderCard();

    }

  };


  selfie.addEventListener(
    'load',
    read
  );


  const observer =
    new MutationObserver(
      read
    );


  observer.observe(
    selfie,
    {
      attributes:true,
      attributeFilter:[
        'src'
      ]
    }
  );


  read();

}


/* ==========================================================
   FIREBASE
   ========================================================== */

function stopPlayer(){

  if(
    unsubscribePlayer
  ){

    unsubscribePlayer();

    unsubscribePlayer =
      null;

  }

}


function watchPlayer(
  db,
  user
){

  stopPlayer();


  playerCloud =
    null;


  if(
    !user ||
    user.uid ===
      ADMIN_UID
  ){

    renderCard();

    return;
  }


  unsubscribePlayer =
    onSnapshot(

      doc(
        db,
        'players',
        user.uid
      ),

      snapshot => {

        playerCloud =
          snapshot.exists() ?
            snapshot.data() :
            null;


        renderCard();

      },

      error => {

        console.warn(
          'Player Card:',
          error
        );


        playerCloud =
          null;


        renderCard();

      }

    );

}


/* ==========================================================
   FIREBASE PRINCIPAL
   ========================================================== */

async function waitFirebase(){

  for(
    let i = 0;
    i < 80;
    i += 1
  ){

    if(
      getApps().length
    ){

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


/* ==========================================================
   INIT
   ========================================================== */

async function init(){

  applyEmojis();

  ensureCard();

  observeSelfie();


  const app =
    await waitFirebase();


  const auth =
    getAuth(
      app
    );


  const db =
    getFirestore(
      app
    );


  onAuthStateChanged(
    auth,
    user => {

      currentUser =
        user;


      watchPlayer(
        db,
        user
      );


      applyEmojis();

      renderCard();

    }
  );


  window.addEventListener(
    'pageshow',
    () => {

      applyEmojis();

      renderCard();

    }
  );


  document.addEventListener(
    'visibilitychange',
    () => {

      if(
        document.visibilityState ===
        'visible'
      ){

        applyEmojis();

        renderCard();

      }

    }
  );

}


init().catch(
  error => {

    console.error(
      'Home Premium V1.1:',
      error
    );

  }
);
