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

import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js';


/* GREENPARK_TOURNAMENT_TEAMS_V5 */

const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';

let firebaseUser = null;
let storage = null;

let currentTournament = null;
let teams = [];
let players = [];
let teamsLimit = 10;

let selectedTeamId = '';
let editingTeamId = '';
let removeLogoRequested = false;
let localPreviewURL = '';

let loading = false;

let obterTorneioAtualCall = null;
let listarEquipesTorneioCall = null;
let listarJogadoresTorneioCall = null;
let salvarEquipeTorneioCall = null;
let removerEquipeTorneioCall = null;
let atribuirJogadorEquipeTorneioCall = null;


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


function initials(name){
  return String(name || 'GP')
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(
      part =>
        part.charAt(0)
    )
    .join('')
    .toUpperCase() || 'GP';
}


function firstTwoNames(name){
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .join(' ');
}


function safeFileName(value){
  const cleaned =
    String(value || 'escudo.jpg')
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[^a-zA-Z0-9._-]+/g,
        '_'
      )
      .slice(0,100);

  return cleaned ||
    'escudo.jpg';
}


function teamById(teamId){
  return teams.find(
    team =>
      String(team.id) ===
      String(teamId)
  ) || null;
}


function teamPlayers(teamId){
  return players.filter(
    player =>
      String(player.teamId || '') ===
      String(teamId)
  );
}


function teamStatus(
  message = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv5Status'
    );

  if(!el){
    return;
  }

  el.textContent =
    message;

  el.className =
    'gptv5-status' +
    (type ? ' ' + type : '');
}


function addStyle(){
  if(
    document.getElementById(
      'greenpark-tournament-teams-v5-style'
    )
  ){
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'greenpark-tournament-teams-v5-style';

  style.textContent = `

/* GREENPARK_TOURNAMENT_TEAMS_V5 */

.gptv5-root{
  display:flex;
  flex-direction:column;
  gap:12px;
}

.gptv5-summary{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:6px;
}

.gptv5-summary-card{
  min-width:0;
  padding:10px 5px;
  border:1px solid #294438;
  border-radius:10px;
  background:#0b1712;
  text-align:center;
}

.gptv5-summary-card strong{
  display:block;
  color:#fff;
  font-size:17px;
}

.gptv5-summary-card span{
  display:block;
  margin-top:4px;
  color:#819188;
  font-size:6px;
  font-weight:950;
}

.gptv5-admin{
  display:none;
  padding:12px;
  border:1px solid rgba(86,213,46,.24);
  border-radius:14px;
  background:#0b1712;
}

.gptv5-admin.show{
  display:block;
}

.gptv5-admin-title{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:10px;
}

.gptv5-admin-title strong{
  color:#fff;
  font-size:11px;
}

.gptv5-admin-title span{
  color:var(--green2);
  font-size:7px;
  font-weight:950;
}

.gptv5-form{
  display:grid;
  grid-template-columns:64px minmax(0,1fr);
  gap:9px;
}

.gptv5-logo-preview{
  width:64px;
  height:64px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border:1px dashed #456052;
  border-radius:14px;
  background:#111c16;
  color:#809087;
  font-size:9px;
  font-weight:950;
  text-align:center;
}

.gptv5-logo-preview img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv5-fields{
  min-width:0;
  display:flex;
  flex-direction:column;
  gap:7px;
}

.gptv5-name{
  width:100%;
  min-width:0;
  height:43px;
  padding:0 10px;
  border:1px solid #34464e;
  border-radius:10px;
  background:#111a21;
  color:#fff;
  outline:none;
}

.gptv5-name:focus{
  border-color:var(--green);
}

.gptv5-logo-row{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
}

.gptv5-logo-button,
.gptv5-remove-logo{
  min-height:34px;
  border:1px solid #34464e;
  border-radius:8px;
  background:#111a20;
  color:#a9b5ae;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:0 6px;
  font-size:7px;
  font-weight:950;
  text-align:center;
}

.gptv5-logo-button{
  border-color:#3c713f;
  color:var(--green2);
}

.gptv5-file{
  display:none;
}

.gptv5-form-actions{
  grid-column:1/-1;
  display:grid;
  grid-template-columns:minmax(0,1fr) 86px;
  gap:7px;
}

.gptv5-save{
  min-height:43px;
  border:0;
  border-radius:10px;
  background:var(--green);
  color:#0d1a0e;
  font-size:9px;
  font-weight:950;
}

.gptv5-save:disabled{
  opacity:.5;
}

.gptv5-cancel{
  min-height:43px;
  border:1px solid #3b4d45;
  border-radius:10px;
  background:#141d19;
  color:#a0aca5;
  font-size:8px;
  font-weight:950;
}

.gptv5-cancel.hidden{
  display:none;
}

.gptv5-status{
  min-height:13px;
  margin-top:8px;
  color:#809087;
  font-size:8px;
  line-height:1.35;
  text-align:center;
}

.gptv5-status.ok{
  color:var(--green2);
}

.gptv5-status.error{
  color:#ff9898;
}

.gptv5-team-list{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.gptv5-empty{
  min-height:105px;
  padding:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px dashed #324a3e;
  border-radius:13px;
  background:#0b1612;
  color:#829188;
  font-size:9px;
  line-height:1.4;
  text-align:center;
}

.gptv5-team{
  padding:10px;
  display:grid;
  grid-template-columns:54px minmax(0,1fr);
  gap:9px;
  border:1px solid #2c4036;
  border-radius:13px;
  background:#0c1713;
}

.gptv5-team.selected{
  border-color:rgba(86,213,46,.66);
  box-shadow:0 0 0 1px rgba(86,213,46,.12);
}

.gptv5-team-logo{
  width:54px;
  height:54px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border:1px solid rgba(86,213,46,.25);
  border-radius:14px;
  background:#17231d;
  color:#fff;
  font-size:11px;
  font-weight:950;
}

.gptv5-team-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv5-team-main{
  min-width:0;
}

.gptv5-team-top{
  min-width:0;
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:7px;
}

.gptv5-team-top strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:11px;
  line-height:1.2;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv5-team-count{
  flex:0 0 auto;
  min-height:23px;
  padding:0 7px;
  display:flex;
  align-items:center;
  border-radius:999px;
  background:#15281b;
  color:var(--green2);
  font-size:6px;
  font-weight:950;
}

.gptv5-team-meta{
  display:block;
  margin-top:4px;
  color:#74867d;
  font-size:7px;
}

.gptv5-team-actions{
  margin-top:8px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
}

.gptv5-team-actions button{
  width:100%;
  min-width:0;
  min-height:32px;
  border:1px solid #34464e;
  border-radius:8px;
  background:#111a20;
  color:#9ba9a2;
  font-size:6.5px;
  font-weight:950;
}

.gptv5-team-actions .players{
  grid-column:1/-1;
  border-color:#396a3c;
  color:var(--green2);
}

.gptv5-team-actions .remove{
  border-color:rgba(219,73,73,.5);
  color:#ff9696;
}

.gptv5-roster{
  display:none;
  padding:12px;
  border:1px solid #2b4337;
  border-radius:14px;
  background:#0a1511;
}

.gptv5-roster.show{
  display:block;
}

.gptv5-roster-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:8px;
}

.gptv5-roster-head strong{
  display:block;
  color:#fff;
  font-size:11px;
}

.gptv5-roster-head span{
  display:block;
  margin-top:3px;
  color:#7e8e85;
  font-size:7px;
}

.gptv5-close{
  min-width:30px;
  height:30px;
  border:1px solid #34464e;
  border-radius:8px;
  background:#111a20;
  color:#fff;
}

.gptv5-player-search{
  width:100%;
  height:40px;
  margin-top:9px;
  padding:0 10px;
  border:1px solid #34464e;
  border-radius:9px;
  background:#111a21;
  color:#fff;
  outline:none;
}

.gptv5-player-list{
  display:flex;
  flex-direction:column;
  gap:5px;
  margin-top:9px;
}

.gptv5-player{
  min-width:0;
  display:grid;
  grid-template-columns:38px minmax(0,1fr) 82px;
  gap:7px;
  align-items:center;
  padding:7px;
  border:1px solid #273a31;
  border-radius:10px;
  background:#0c1713;
}

.gptv5-player-avatar{
  width:38px;
  height:38px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border-radius:50%;
  background:#17231d;
  color:#fff;
  font-size:8px;
  font-weight:950;
}

.gptv5-player-avatar img{
  width:100%;
  height:100%;
  object-fit:cover;
}

.gptv5-player-main{
  min-width:0;
}

.gptv5-player-main strong{
  display:block;
  overflow:hidden;
  color:#fff;
  font-size:8.5px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv5-player-main span{
  display:block;
  margin-top:3px;
  color:#74867d;
  font-size:6.5px;
}

.gptv5-player button{
  width:82px;
  min-height:31px;
  padding:0 4px;
  border:1px solid #3c713f;
  border-radius:7px;
  background:#14291a;
  color:var(--green2);
  font-size:6px;
  font-weight:950;
}

.gptv5-player button.remove{
  border-color:#5c4b31;
  background:#272016;
  color:#e6bd68;
}

.gptv5-player button.move{
  border-color:#405866;
  background:#17222a;
  color:#b7c9d2;
}

@media(max-width:350px){

  .gptv5-form{
    grid-template-columns:54px minmax(0,1fr);
  }

  .gptv5-logo-preview{
    width:54px;
    height:54px;
  }

  .gptv5-player{
    grid-template-columns:36px minmax(0,1fr);
  }

  .gptv5-player button{
    grid-column:2;
    width:100%;
  }
}

`;

  document.head.appendChild(
    style
  );
}


function makeImageBox(
  className,
  url,
  fallback,
  alt
){
  const box =
    document.createElement(
      'div'
    );

  box.className =
    className;

  const source =
    String(url || '').trim();

  if(
    source.startsWith('https://') ||
    source.startsWith('http://')
  ){
    const image =
      document.createElement(
        'img'
      );

    image.src =
      source;

    image.alt =
      alt || '';

    image.loading =
      'lazy';

    image.addEventListener(
      'error',
      () => {
        box.innerHTML = '';
        box.textContent =
          fallback;
      },
      {
        once:true
      }
    );

    box.appendChild(
      image
    );
  }else{
    box.textContent =
      fallback;
  }

  return box;
}


function playerAvatar(player){
  return makeImageBox(
    'gptv5-player-avatar',
    player?.photoURL,
    initials(player?.name),
    player?.name || 'Jogador'
  );
}


function teamLogo(team){
  return makeImageBox(
    'gptv5-team-logo',
    team?.logoURL,
    initials(team?.name),
    team?.name || 'Equipe'
  );
}


function ensureUI(){
  addStyle();

  const panel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="teams"]'
    );

  if(!panel){
    return false;
  }

  if(
    document.getElementById(
      'gptv5Root'
    )
  ){
    updateAdminVisibility();
    return true;
  }

  const head =
    panel.querySelector(
      '.gptournament-panel-head'
    );

  if(!head){
    return false;
  }

  Array.from(
    panel.children
  )
    .forEach(child => {
      if(child !== head){
        child.remove();
      }
    });

  const root =
    document.createElement(
      'div'
    );

  root.id =
    'gptv5Root';

  root.className =
    'gptv5-root';

  root.innerHTML = `
    <div class="gptv5-summary">
      <div class="gptv5-summary-card">
        <strong id="gptv5TeamsCount">0</strong>
        <span>EQUIPES</span>
      </div>

      <div class="gptv5-summary-card">
        <strong id="gptv5PlayersCount">0</strong>
        <span>JOGADORES</span>
      </div>

      <div class="gptv5-summary-card">
        <strong id="gptv5WithoutTeam">0</strong>
        <span>SEM EQUIPE</span>
      </div>
    </div>

    <div
      id="gptv5Admin"
      class="gptv5-admin"
    >
      <div class="gptv5-admin-title">
        <strong id="gptv5FormTitle">
          NOVA EQUIPE
        </strong>

        <span id="gptv5LimitLabel">
          0 / 0
        </span>
      </div>

      <div class="gptv5-form">

        <div
          id="gptv5LogoPreview"
          class="gptv5-logo-preview"
        >
          ESCUDO
        </div>

        <div class="gptv5-fields">
          <input
            id="gptv5Name"
            class="gptv5-name"
            type="text"
            maxlength="40"
            autocomplete="off"
            placeholder="Nome da equipe"
          >

          <div class="gptv5-logo-row">

            <label
              class="gptv5-logo-button"
              for="gptv5LogoFile"
            >
              ESCOLHER ESCUDO
            </label>

            <button
              id="gptv5RemoveLogo"
              class="gptv5-remove-logo"
              type="button"
            >
              REMOVER ESCUDO
            </button>

          </div>

          <input
            id="gptv5LogoFile"
            class="gptv5-file"
            type="file"
            accept="image/*"
          >
        </div>

        <div class="gptv5-form-actions">

          <button
            id="gptv5Save"
            class="gptv5-save"
            type="button"
          >
            SALVAR EQUIPE
          </button>

          <button
            id="gptv5Cancel"
            class="gptv5-cancel hidden"
            type="button"
          >
            CANCELAR
          </button>

        </div>

      </div>

      <div
        id="gptv5Status"
        class="gptv5-status"
      ></div>
    </div>

    <div
      id="gptv5TeamList"
      class="gptv5-team-list"
    ></div>

    <div
      id="gptv5Roster"
      class="gptv5-roster"
    >
      <div class="gptv5-roster-head">
        <div>
          <strong id="gptv5RosterTitle">
            Jogadores
          </strong>

          <span id="gptv5RosterMeta"></span>
        </div>

        <button
          id="gptv5RosterClose"
          class="gptv5-close"
          type="button"
        >
          ×
        </button>
      </div>

      <input
        id="gptv5PlayerSearch"
        class="gptv5-player-search"
        type="search"
        autocomplete="off"
        placeholder="Buscar jogador..."
      >

      <div
        id="gptv5PlayerList"
        class="gptv5-player-list"
      ></div>
    </div>
  `;

  panel.appendChild(
    root
  );

  document
    .getElementById(
      'gptv5Save'
    )
    ?.addEventListener(
      'click',
      saveTeam
    );

  document
    .getElementById(
      'gptv5Cancel'
    )
    ?.addEventListener(
      'click',
      resetForm
    );

  document
    .getElementById(
      'gptv5RemoveLogo'
    )
    ?.addEventListener(
      'click',
      requestRemoveLogo
    );

  document
    .getElementById(
      'gptv5LogoFile'
    )
    ?.addEventListener(
      'change',
      previewSelectedLogo
    );

  document
    .getElementById(
      'gptv5RosterClose'
    )
    ?.addEventListener(
      'click',
      () => {
        selectedTeamId = '';
        renderAll();
      }
    );

  document
    .getElementById(
      'gptv5PlayerSearch'
    )
    ?.addEventListener(
      'input',
      renderRoster
    );

  updateAdminVisibility();

  return true;
}


function updateAdminVisibility(){
  const box =
    document.getElementById(
      'gptv5Admin'
    );

  if(box){
    box.classList.toggle(
      'show',
      isAdmin()
    );
  }
}


function setPreview(
  url = '',
  fallback = 'ESCUDO'
){
  const box =
    document.getElementById(
      'gptv5LogoPreview'
    );

  if(!box){
    return;
  }

  box.innerHTML = '';

  const source =
    String(url || '').trim();

  if(source){
    const img =
      document.createElement(
        'img'
      );

    img.src =
      source;

    img.alt =
      'Escudo';

    box.appendChild(
      img
    );
  }else{
    box.textContent =
      fallback;
  }
}


function revokeLocalPreview(){
  if(localPreviewURL){
    URL.revokeObjectURL(
      localPreviewURL
    );

    localPreviewURL = '';
  }
}


function resetForm(){
  editingTeamId = '';
  removeLogoRequested = false;

  revokeLocalPreview();

  const input =
    document.getElementById(
      'gptv5Name'
    );

  const file =
    document.getElementById(
      'gptv5LogoFile'
    );

  const title =
    document.getElementById(
      'gptv5FormTitle'
    );

  const cancel =
    document.getElementById(
      'gptv5Cancel'
    );

  if(input){
    input.value = '';
  }

  if(file){
    file.value = '';
  }

  if(title){
    title.textContent =
      'NOVA EQUIPE';
  }

  cancel?.classList.add(
    'hidden'
  );

  setPreview();

  teamStatus('');

  renderAdminState();
}


function editTeam(teamId){
  const team =
    teamById(teamId);

  if(!team || !isAdmin()){
    return;
  }

  editingTeamId =
    team.id;

  removeLogoRequested =
    false;

  revokeLocalPreview();

  const name =
    document.getElementById(
      'gptv5Name'
    );

  const file =
    document.getElementById(
      'gptv5LogoFile'
    );

  const title =
    document.getElementById(
      'gptv5FormTitle'
    );

  if(name){
    name.value =
      team.name || '';
  }

  if(file){
    file.value = '';
  }

  if(title){
    title.textContent =
      'EDITAR EQUIPE';
  }

  document
    .getElementById(
      'gptv5Cancel'
    )
    ?.classList
    .remove(
      'hidden'
    );

  setPreview(
    team.logoURL,
    initials(team.name)
  );

  teamStatus('');

  renderAdminState();

  name?.focus();

  document
    .getElementById(
      'gptv5Admin'
    )
    ?.scrollIntoView({
      behavior:'smooth',
      block:'center'
    });
}


function requestRemoveLogo(){
  if(!isAdmin()){
    return;
  }

  removeLogoRequested =
    true;

  revokeLocalPreview();

  const file =
    document.getElementById(
      'gptv5LogoFile'
    );

  if(file){
    file.value = '';
  }

  setPreview();

  teamStatus(
    'O escudo será removido ao salvar.',
    'ok'
  );
}


function previewSelectedLogo(){
  const input =
    document.getElementById(
      'gptv5LogoFile'
    );

  const file =
    input?.files?.[0];

  if(!file){
    return;
  }

  if(
    !String(file.type || '')
      .startsWith('image/')
  ){
    input.value = '';

    teamStatus(
      'Escolha um arquivo de imagem.',
      'error'
    );

    return;
  }

  if(file.size > 10 * 1024 * 1024){
    input.value = '';

    teamStatus(
      'O escudo deve ter no máximo 10 MB.',
      'error'
    );

    return;
  }

  removeLogoRequested =
    false;

  revokeLocalPreview();

  localPreviewURL =
    URL.createObjectURL(
      file
    );

  setPreview(
    localPreviewURL
  );

  teamStatus('');
}


function renderAdminState(){
  const label =
    document.getElementById(
      'gptv5LimitLabel'
    );

  const button =
    document.getElementById(
      'gptv5Save'
    );

  if(label){
    label.textContent =
      teams.length +
      ' / ' +
      teamsLimit;
  }

  if(!button || !isAdmin()){
    return;
  }

  const atLimit =
    teams.length >=
      teamsLimit;

  if(
    atLimit &&
    !editingTeamId
  ){
    button.disabled =
      true;

    button.textContent =
      'LIMITE DE EQUIPES ATINGIDO';
  }else{
    button.disabled =
      false;

    button.textContent =
      editingTeamId ?
        'SALVAR ALTERAÇÕES' :
        'SALVAR EQUIPE';
  }
}


function updateHeader(){
  const panel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="teams"]'
    );

  const head =
    panel?.querySelector(
      '.gptournament-panel-head'
    );

  const subtitle =
    head?.querySelector(
      'span'
    );

  const total =
    head?.querySelector(
      'b'
    );

  if(subtitle){
    subtitle.textContent =
      teams.length +
      ' de ' +
      teamsLimit +
      ' equipes cadastradas';
  }

  if(total){
    total.textContent =
      teams.length +
      '/' +
      teamsLimit;
  }
}


function renderSummary(){
  const withoutTeam =
    players.filter(
      player =>
        !String(
          player.teamId || ''
        )
    ).length;

  const values = {
    gptv5TeamsCount:
      teams.length +
      '/' +
      teamsLimit,

    gptv5PlayersCount:
      players.length,

    gptv5WithoutTeam:
      withoutTeam
  };

  Object.entries(
    values
  )
    .forEach(
      ([id,value]) => {
        const el =
          document.getElementById(
            id
          );

        if(el){
          el.textContent =
            String(value);
        }
      }
    );
}


function renderTeamList(){
  const list =
    document.getElementById(
      'gptv5TeamList'
    );

  if(!list){
    return;
  }

  list.innerHTML = '';

  if(
    !currentTournament?.id
  ){
    list.innerHTML =
      '<div class="gptv5-empty">' +
      'Salve um campeonato primeiro.' +
      '</div>';

    return;
  }

  if(!teams.length){
    list.innerHTML =
      '<div class="gptv5-empty">' +
      (
        isAdmin() ?
          'Nenhuma equipe cadastrada. Use o formulário acima para criar a primeira.' :
          'As equipes ainda não foram cadastradas.'
      ) +
      '</div>';

    return;
  }

  teams.forEach(
    team => {
      const card =
        document.createElement(
          'article'
        );

      card.className =
        'gptv5-team';

      if(
        team.id ===
        selectedTeamId
      ){
        card.classList.add(
          'selected'
        );
      }

      card.appendChild(
        teamLogo(team)
      );

      const main =
        document.createElement(
          'div'
        );

      main.className =
        'gptv5-team-main';

      const top =
        document.createElement(
          'div'
        );

      top.className =
        'gptv5-team-top';

      const name =
        document.createElement(
          'strong'
        );

      name.textContent =
        String(
          team.name || 'Equipe'
        ).toLocaleUpperCase(
          'pt-BR'
        );

      const count =
        document.createElement(
          'span'
        );

      const totalPlayers =
        teamPlayers(
          team.id
        ).length;

      count.className =
        'gptv5-team-count';

      count.textContent =
        totalPlayers +
        (
          totalPlayers === 1 ?
            ' JOGADOR' :
            ' JOGADORES'
        );

      top.append(
        name,
        count
      );

      const meta =
        document.createElement(
          'span'
        );

      meta.className =
        'gptv5-team-meta';

      meta.textContent =
        team.logoURL ?
          'Escudo cadastrado' :
          'Sem escudo';

      const actions =
        document.createElement(
          'div'
        );

      actions.className =
        'gptv5-team-actions';

      const playersButton =
        document.createElement(
          'button'
        );

      playersButton.type =
        'button';

      playersButton.className =
        'players';

      playersButton.textContent =
        selectedTeamId ===
          team.id ?
          'JOGADORES ABERTOS' :
          'VER / ORGANIZAR JOGADORES';

      playersButton.addEventListener(
        'click',
        () => {
          selectedTeamId =
            selectedTeamId ===
              team.id ?
              '' :
              team.id;

          renderAll();

          if(selectedTeamId){
            setTimeout(
              () => {
                document
                  .getElementById(
                    'gptv5Roster'
                  )
                  ?.scrollIntoView({
                    behavior:'smooth',
                    block:'start'
                  });
              },
              40
            );
          }
        }
      );

      actions.appendChild(
        playersButton
      );

      if(isAdmin()){
        const edit =
          document.createElement(
            'button'
          );

        edit.type =
          'button';

        edit.textContent =
          'EDITAR';

        edit.addEventListener(
          'click',
          () => editTeam(
            team.id
          )
        );

        const remove =
          document.createElement(
            'button'
          );

        remove.type =
          'button';

        remove.className =
          'remove';

        remove.textContent =
          'REMOVER';

        remove.addEventListener(
          'click',
          () => removeTeam(
            team
          )
        );

        actions.append(
          edit,
          remove
        );
      }

      main.append(
        top,
        meta,
        actions
      );

      card.appendChild(
        main
      );

      list.appendChild(
        card
      );
    }
  );
}


function playerAssignmentText(
  player,
  selectedTeam
){
  const position =
    player.position ===
      'goalkeeper' ?
      'Goleiro' :
      'Linha';

  const playerTeam =
    teamById(
      player.teamId
    );

  if(
    player.teamId ===
      selectedTeam.id
  ){
    return (
      position +
      ' • Nesta equipe'
    );
  }

  if(playerTeam){
    return (
      position +
      ' • ' +
      playerTeam.name
    );
  }

  return (
    position +
    ' • Sem equipe'
  );
}


function renderRoster(){
  const box =
    document.getElementById(
      'gptv5Roster'
    );

  const list =
    document.getElementById(
      'gptv5PlayerList'
    );

  if(
    !box ||
    !list
  ){
    return;
  }

  const team =
    teamById(
      selectedTeamId
    );

  if(!team){
    box.classList.remove(
      'show'
    );

    return;
  }

  box.classList.add(
    'show'
  );

  const currentPlayers =
    teamPlayers(
      team.id
    );

  const title =
    document.getElementById(
      'gptv5RosterTitle'
    );

  const meta =
    document.getElementById(
      'gptv5RosterMeta'
    );

  if(title){
    title.textContent =
      team.name;
  }

  if(meta){
    meta.textContent =
      currentPlayers.length +
      (
        currentPlayers.length === 1 ?
          ' jogador nesta equipe' :
          ' jogadores nesta equipe'
      );
  }

  const search =
    String(
      document
        .getElementById(
          'gptv5PlayerSearch'
        )
        ?.value ||
      ''
    )
      .trim()
      .toLocaleLowerCase(
        'pt-BR'
      );

  let visiblePlayers =
    isAdmin() ?
      [...players] :
      currentPlayers;

  visiblePlayers =
    visiblePlayers
      .filter(
        player =>
          String(
            player.name || ''
          )
            .toLocaleLowerCase(
              'pt-BR'
            )
            .includes(
              search
            )
      )
      .sort(
        (a,b) => {
          const rank = player => {
            if(
              player.teamId ===
              team.id
            ){
              return 0;
            }

            if(!player.teamId){
              return 1;
            }

            return 2;
          };

          const diff =
            rank(a) -
            rank(b);

          if(diff){
            return diff;
          }

          return String(
            a.name || ''
          ).localeCompare(
            String(
              b.name || ''
            ),
            'pt-BR',
            {
              sensitivity:'base'
            }
          );
        }
      );

  list.innerHTML = '';

  if(!visiblePlayers.length){
    list.innerHTML =
      '<div class="gptv5-empty">' +
      (
        search ?
          'Nenhum jogador encontrado.' :
          'Nenhum jogador nesta equipe.'
      ) +
      '</div>';

    return;
  }

  visiblePlayers.forEach(
    player => {
      const row =
        document.createElement(
          'div'
        );

      row.className =
        'gptv5-player';

      row.appendChild(
        playerAvatar(
          player
        )
      );

      const main =
        document.createElement(
          'div'
        );

      main.className =
        'gptv5-player-main';

      const name =
        document.createElement(
          'strong'
        );

      name.textContent =
        firstTwoNames(
          player.name
        ).toLocaleUpperCase(
          'pt-BR'
        );

      const assignment =
        document.createElement(
          'span'
        );

      assignment.textContent =
        playerAssignmentText(
          player,
          team
        );

      main.append(
        name,
        assignment
      );

      row.appendChild(
        main
      );

      if(isAdmin()){
        const action =
          document.createElement(
            'button'
          );

        action.type =
          'button';

        if(
          player.teamId ===
          team.id
        ){
          action.textContent =
            'REMOVER';

          action.className =
            'remove';

          action.addEventListener(
            'click',
            () => assignPlayer(
              player,
              ''
            )
          );
        }else if(
          player.teamId
        ){
          action.textContent =
            'MOVER';

          action.className =
            'move';

          action.addEventListener(
            'click',
            () => movePlayer(
              player,
              team
            )
          );
        }else{
          action.textContent =
            '+ ADICIONAR';

          action.addEventListener(
            'click',
            () => assignPlayer(
              player,
              team.id
            )
          );
        }

        row.appendChild(
          action
        );
      }

      list.appendChild(
        row
      );
    }
  );
}


function renderAll(){
  if(!ensureUI()){
    return;
  }

  updateAdminVisibility();
  updateHeader();
  renderSummary();
  renderAdminState();
  renderTeamList();
  renderRoster();
}


async function uploadTeamLogo(
  file,
  tournamentId,
  teamId
){
  if(!storage){
    throw new Error(
      'Firebase Storage não iniciou.'
    );
  }

  if(
    !String(file?.type || '')
      .startsWith('image/')
  ){
    throw new Error(
      'O escudo precisa ser uma imagem.'
    );
  }

  if(
    Number(file.size || 0) >
    10 * 1024 * 1024
  ){
    throw new Error(
      'O escudo deve ter no máximo 10 MB.'
    );
  }

  const path =
    'tournaments/' +
    tournamentId +
    '/teams/' +
    teamId +
    '/' +
    Date.now() +
    '_' +
    safeFileName(
      file.name
    );

  const reference =
    storageRef(
      storage,
      path
    );

  return new Promise(
    (resolve,reject) => {
      const task =
        uploadBytesResumable(
          reference,
          file,
          {
            contentType:
              file.type
          }
        );

      task.on(
        'state_changed',

        snapshot => {
          const total =
            Number(
              snapshot.totalBytes || 0
            );

          const sent =
            Number(
              snapshot.bytesTransferred || 0
            );

          const percent =
            total > 0 ?
              Math.round(
                sent /
                total *
                100
              ) :
              0;

          const button =
            document.getElementById(
              'gptv5Save'
            );

          if(button){
            button.textContent =
              'ENVIANDO ESCUDO ' +
              percent +
              '%';
          }
        },

        reject,

        async () => {
          try{
            const url =
              await getDownloadURL(
                task.snapshot.ref
              );

            resolve({
              url,
              storagePath:path
            });
          }catch(error){
            reject(error);
          }
        }
      );
    }
  );
}


async function saveTeam(){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    teamStatus(
      'Salve o campeonato primeiro.',
      'error'
    );

    return;
  }

  const name =
    String(
      document
        .getElementById(
          'gptv5Name'
        )
        ?.value ||
      ''
    ).trim();

  if(name.length < 2){
    teamStatus(
      'Informe o nome da equipe.',
      'error'
    );

    return;
  }

  const file =
    document
      .getElementById(
        'gptv5LogoFile'
      )
      ?.files?.[0] ||
    null;

  const button =
    document.getElementById(
      'gptv5Save'
    );

  if(button){
    button.disabled =
      true;

    button.textContent =
      'SALVANDO...';
  }

  let baseSaved =
    false;

  try{
    const firstResponse =
      await salvarEquipeTorneioCall({
        tournamentId:
          currentTournament.id,

        teamId:
          editingTeamId,

        name,

        removeLogo:
          removeLogoRequested &&
          !file
      });

    baseSaved =
      true;

    const teamId =
      firstResponse
        .data
        ?.team
        ?.id;

    if(!teamId){
      throw new Error(
        'Equipe salva sem identificador.'
      );
    }

    if(file){
      const uploaded =
        await uploadTeamLogo(
          file,
          currentTournament.id,
          teamId
        );

      await salvarEquipeTorneioCall({
        tournamentId:
          currentTournament.id,

        teamId,

        name,

        logoURL:
          uploaded.url,

        logoStoragePath:
          uploaded.storagePath
      });
    }

    resetForm();

    await loadData();

    teamStatus(
      'Equipe salva com sucesso.',
      'ok'
    );

  }catch(error){
    console.error(
      'Salvar equipe:',
      error
    );

    if(baseSaved){
      await loadData();

      teamStatus(
        'A equipe foi salva, mas houve erro no escudo: ' +
        (
          error?.message ||
          'erro'
        ),
        'error'
      );
    }else{
      teamStatus(
        error?.message ||
        'Não foi possível salvar a equipe.',
        'error'
      );
    }

  }finally{
    renderAdminState();

    if(
      button &&
      !button.disabled
    ){
      return;
    }

    if(button){
      button.disabled =
        false;

      renderAdminState();
    }
  }
}


async function removeTeam(team){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  const count =
    teamPlayers(
      team.id
    ).length;

  const message =
    'REMOVER EQUIPE?\n\n' +
    String(
      team.name || 'Equipe'
    ).toLocaleUpperCase(
      'pt-BR'
    ) +
    '\n\n' +
    (
      count > 0 ?
        count +
        ' jogador(es) ficarão SEM EQUIPE.\n\n' :
        ''
    ) +
    'Os jogadores continuarão inscritos no campeonato.';

  if(!confirm(message)){
    return;
  }

  try{
    teamStatus(
      'Removendo equipe...'
    );

    await removerEquipeTorneioCall({
      tournamentId:
        currentTournament.id,

      teamId:
        team.id
    });

    if(
      selectedTeamId ===
      team.id
    ){
      selectedTeamId = '';
    }

    if(
      editingTeamId ===
      team.id
    ){
      resetForm();
    }

    await loadData();

    teamStatus(
      'Equipe removida. Jogadores preservados.',
      'ok'
    );

  }catch(error){
    teamStatus(
      error?.message ||
      'Não foi possível remover a equipe.',
      'error'
    );
  }
}


async function assignPlayer(
  player,
  teamId
){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  try{
    await atribuirJogadorEquipeTorneioCall({
      tournamentId:
        currentTournament.id,

      playerId:
        player.id,

      teamId
    });

    const current =
      players.find(
        item =>
          item.id ===
          player.id
      );

    if(current){
      current.teamId =
        teamId;
    }

    renderAll();

    teamStatus(
      teamId ?
        'Jogador adicionado à equipe.' :
        'Jogador removido da equipe.',
      'ok'
    );

  }catch(error){
    teamStatus(
      error?.message ||
      'Não foi possível alterar a equipe do jogador.',
      'error'
    );
  }
}


async function movePlayer(
  player,
  targetTeam
){
  const oldTeam =
    teamById(
      player.teamId
    );

  if(
    oldTeam &&
    !confirm(
      'MOVER JOGADOR?\n\n' +
      firstTwoNames(
        player.name
      ) +
      '\n\n' +
      oldTeam.name +
      ' → ' +
      targetTeam.name
    )
  ){
    return;
  }

  await assignPlayer(
    player,
    targetTeam.id
  );
}


async function loadData(){
  if(
    loading ||
    !firebaseUser
  ){
    return;
  }

  if(!ensureUI()){
    return;
  }

  loading = true;

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
      currentTournament =
        null;

      teams = [];
      players = [];
      teamsLimit = 10;

      renderAll();

      return;
    }

    currentTournament =
      currentResponse
        .data
        .tournament;

    const [
      teamsResponse,
      playersResponse
    ] =
      await Promise.all([
        listarEquipesTorneioCall({
          tournamentId:
            currentTournament.id
        }),

        listarJogadoresTorneioCall({
          tournamentId:
            currentTournament.id
        })
      ]);

    teams =
      Array.isArray(
        teamsResponse
          .data
          ?.teams
      ) ?
        teamsResponse
          .data
          .teams :
        [];

    teamsLimit =
      Number(
        teamsResponse
          .data
          ?.teamsLimit ||
        10
      );

    players =
      Array.isArray(
        playersResponse
          .data
          ?.players
      ) ?
        playersResponse
          .data
          .players :
        [];

    if(
      selectedTeamId &&
      !teamById(
        selectedTeamId
      )
    ){
      selectedTeamId = '';
    }

    renderAll();

  }catch(error){
    console.error(
      'Equipes torneio V5:',
      error
    );

    teamStatus(
      error?.message ||
      'Não foi possível carregar as equipes.',
      'error'
    );

  }finally{
    loading = false;
  }
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
  addStyle();

  for(
    let attempt = 0;
    attempt < 50;
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
    await waitForApp();

  const auth =
    getAuth(
      app
    );

  storage =
    getStorage(
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

  listarEquipesTorneioCall =
    httpsCallable(
      functions,
      'listarEquipesTorneio'
    );

  listarJogadoresTorneioCall =
    httpsCallable(
      functions,
      'listarJogadoresTorneio'
    );

  salvarEquipeTorneioCall =
    httpsCallable(
      functions,
      'salvarEquipeTorneio'
    );

  removerEquipeTorneioCall =
    httpsCallable(
      functions,
      'removerEquipeTorneio'
    );

  atribuirJogadorEquipeTorneioCall =
    httpsCallable(
      functions,
      'atribuirJogadorEquipeTorneio'
    );

  onAuthStateChanged(
    auth,
    user => {
      firebaseUser =
        user;

      updateAdminVisibility();

      setTimeout(
        loadData,
        300
      );
    }
  );

  document.addEventListener(
    'click',
    event => {
      const tab =
        event.target
          ?.closest?.(
            '[data-tournament-tab]'
          );

      if(
        tab?.dataset
          ?.tournamentTab ===
        'teams'
      ){
        setTimeout(
          loadData,
          150
        );
      }

      const id =
        event.target
          ?.closest?.(
            'button'
          )
          ?.id ||
        '';

      if(
        id ===
          'gptv44TeamsSave' ||
        id ===
          'tournamentSaveButton' ||
        id ===
          'openTournamentsQuick'
      ){
        setTimeout(
          loadData,
          1000
        );
      }
    }
  );

  const teamsPanel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="teams"]'
    );

  if(teamsPanel){
    const observer =
      new MutationObserver(
        () => {
          if(
            teamsPanel
              .classList
              .contains(
                'active'
              )
          ){
            setTimeout(
              loadData,
              120
            );
          }
        }
      );

    observer.observe(
      teamsPanel,
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
    'Tournament Teams V5:',
    error
  );
});
