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


/* GREENPARK_TOURNAMENT_SCHEDULE_V6 */
/* GREENPARK_TOURNAMENT_SCHEDULE_COUNT_SYNC_V62 */
/* GREENPARK_TOURNAMENT_RESULTS_V7 */
/* GREENPARK_TOURNAMENT_TABLE_COMPLETE_V71 */

const ADMIN_UID =
  'd3nVt6SbQlO6lYnOcCUDbLBhoU02';

let firebaseUser = null;

let currentTournament = null;

let structure = {
  teams:[],
  matches:[],
  teamsCount:0,
  generated:false,
  stale:false,
  hasResults:false,
  format:{}
};

let loading = false;

let matchViewMode =
  'cards';

let obterTorneioAtualCall = null;
let listarEstruturaTorneioCall = null;
let gerarEstruturaTorneioCall = null;

let salvarResultadoJogoTorneioCall = null;
let limparResultadoJogoTorneioCall = null;


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


function teamById(id){
  return (
    structure
      .teams
      .find(
        team =>
          String(team.id) ===
          String(id)
      ) ||
    null
  );
}


function status(
  message = '',
  type = ''
){
  const el =
    document.getElementById(
      'gptv6Status'
    );

  if(!el){
    return;
  }

  el.textContent =
    message;

  el.className =
    'gptv6-status' +
    (type ? ' ' + type : '');
}


function addStyle(){
  if(
    document.getElementById(
      'greenpark-tournament-schedule-v6-style'
    )
  ){
    return;
  }

  const style =
    document.createElement(
      'style'
    );

  style.id =
    'greenpark-tournament-schedule-v6-style';

  style.textContent = `

/* GREENPARK_TOURNAMENT_SCHEDULE_V6 */

.gptv6-root{
  display:flex;
  flex-direction:column;
  gap:10px;
}

.gptv6-admin{
  display:none;
  padding:12px;
  border:1px solid rgba(86,213,46,.25);
  border-radius:13px;
  background:#0b1712;
}

.gptv6-admin.show{
  display:block;
}

.gptv6-admin strong{
  display:block;
  color:#fff;
  font-size:10px;
  text-align:center;
}

.gptv6-admin span{
  display:block;
  margin-top:4px;
  color:#819188;
  font-size:7px;
  line-height:1.4;
  text-align:center;
}

.gptv6-generate{
  width:100%;
  min-height:46px;
  margin-top:9px;
  border:0;
  border-radius:11px;
  background:var(--green);
  color:#102011;
  font-size:9px;
  font-weight:950;
}

.gptv6-generate:disabled{
  opacity:.5;
}

.gptv6-status{
  min-height:14px;
  color:#829188;
  font-size:8px;
  line-height:1.4;
  text-align:center;
}

.gptv6-status.ok{
  color:var(--green2);
}

.gptv6-status.error{
  color:#ff9696;
}

.gptv6-alert{
  padding:10px;
  border:1px solid #725a27;
  border-radius:10px;
  background:#292316;
  color:#e7c66d;
  font-size:8px;
  line-height:1.4;
  text-align:center;
}

.gptv6-summary{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:6px;
}

.gptv6-summary div{
  min-width:0;
  padding:9px 4px;
  border:1px solid #2c4036;
  border-radius:9px;
  background:#0c1713;
  text-align:center;
}

.gptv6-summary strong{
  display:block;
  color:#fff;
  font-size:15px;
}

.gptv6-summary span{
  display:block;
  margin-top:3px;
  color:#7e8e85;
  font-size:6px;
  font-weight:950;
}

.gptv6-empty{
  min-height:105px;
  padding:18px;
  display:flex;
  align-items:center;
  justify-content:center;
  border:1px dashed #344a3e;
  border-radius:12px;
  background:#0b1612;
  color:#829188;
  font-size:9px;
  line-height:1.4;
  text-align:center;
}

.gptv6-section{
  display:flex;
  flex-direction:column;
  gap:7px;
}

.gptv6-section-title{
  margin:4px 0 1px;
  color:var(--green2);
  font-size:8px;
  font-weight:950;
  letter-spacing:.05em;
}

.gptv6-match{
  padding:9px;
  border:1px solid #2b4036;
  border-radius:11px;
  background:#0c1713;
}

.gptv6-match-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:8px;
  color:#73847b;
  font-size:6.5px;
  font-weight:950;
}

.gptv6-side{
  min-width:0;
  display:grid;
  grid-template-columns:38px minmax(0,1fr) 24px;
  gap:7px;
  align-items:center;
}

.gptv6-side + .gptv6-side{
  margin-top:6px;
}

.gptv6-logo{
  width:38px;
  height:38px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border:1px solid rgba(86,213,46,.22);
  border-radius:10px;
  background:#17231d;
  color:#fff;
  font-size:8px;
  font-weight:950;
}

.gptv6-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv6-team-name{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:9px;
  font-weight:900;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv6-score{
  color:#839089;
  font-size:16px;
  font-weight:950;
  text-align:center;
}

.gptv6-source{
  min-height:32px;
  padding:0 8px;
  display:flex;
  align-items:center;
  border:1px dashed #344a3e;
  border-radius:8px;
  color:#9ba8a1;
  font-size:7px;
  font-weight:850;
}

.gptv6-groups{
  display:flex;
  flex-direction:column;
  gap:9px;
}

.gptv6-group{
  overflow:hidden;
  border:1px solid #2c4036;
  border-radius:12px;
  background:#0c1713;
}

.gptv6-group-title{
  padding:9px 10px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  border-bottom:1px solid #26382f;
}

.gptv6-group-title strong{
  color:#fff;
  font-size:9px;
}

.gptv6-group-title span{
  color:var(--green2);
  font-size:7px;
  font-weight:950;
}

.gptv6-table-head,
.gptv6-table-row{
  display:grid;
  grid-template-columns:22px minmax(0,1fr) 28px 35px;
  gap:5px;
  align-items:center;
}

.gptv6-table-head{
  padding:7px 9px;
  color:#708179;
  font-size:6px;
  font-weight:950;
}

.gptv6-table-row{
  min-height:45px;
  padding:6px 9px;
  border-top:1px solid #22342b;
}

.gptv6-position{
  color:#7e8d85;
  font-size:8px;
  font-weight:950;
  text-align:center;
}

.gptv6-table-team{
  min-width:0;
  display:grid;
  grid-template-columns:30px minmax(0,1fr);
  gap:6px;
  align-items:center;
}

.gptv6-table-logo{
  width:30px;
  height:30px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border-radius:8px;
  background:#17231d;
  color:#fff;
  font-size:6px;
  font-weight:950;
}

.gptv6-table-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv6-table-team strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:8px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv6-number{
  color:#96a39c;
  font-size:8px;
  font-weight:900;
  text-align:center;
}

.gptv6-points{
  color:var(--green2);
  font-size:9px;
  font-weight:950;
  text-align:center;
}

.gptv6-bracket{
  display:flex;
  flex-direction:column;
  gap:7px;
}



/* ==========================================================
   GREEN PARK - RESULTADOS MANUAIS V7
   ========================================================== */

.gptv7-result-button{
  width:100%;
  min-height:35px;
  margin-top:8px;
  border:1px solid rgba(86,213,46,.46);
  border-radius:8px;
  background:#13291a;
  color:var(--green2);
  font-size:7px;
  font-weight:950;
}

.gptv7-result-button.edit{
  border-color:#465b50;
  background:#121d18;
  color:#b7c3bc;
}

.gptv7-editor{
  display:none;
  margin-top:8px;
  padding:9px;
  border:1px solid #34483e;
  border-radius:9px;
  background:#09130f;
}

.gptv7-editor.show{
  display:block;
}

.gptv7-editor-title{
  margin-bottom:7px;
  color:#8d9c94;
  font-size:6.5px;
  font-weight:950;
  text-align:center;
}

.gptv7-score-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
}

.gptv7-score-field{
  min-width:0;
}

.gptv7-score-field strong{
  display:block;
  min-height:19px;
  overflow:hidden;
  margin-bottom:4px;
  color:#fff;
  font-size:7px;
  line-height:1.25;
  text-align:center;
}

.gptv7-score-field input{
  width:100%;
  height:42px;
  border:1px solid #34464e;
  border-radius:8px;
  outline:none;
  background:#111a21;
  color:#fff;
  font-size:19px;
  font-weight:950;
  text-align:center;
}

.gptv7-score-field input:focus{
  border-color:var(--green);
}

.gptv7-penalty-title{
  margin:9px 0 5px;
  color:#74867c;
  font-size:6px;
  font-weight:950;
  text-align:center;
}

.gptv7-editor-actions{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:8px;
}

.gptv7-editor-actions button{
  min-height:34px;
  border:1px solid #3a4c43;
  border-radius:8px;
  background:#111b16;
  color:#a6b2ab;
  font-size:6.5px;
  font-weight:950;
}

.gptv7-editor-actions .save{
  border-color:var(--green);
  background:var(--green);
  color:#102011;
}

.gptv7-clear{
  width:100%;
  min-height:31px;
  margin-top:6px;
  border:1px solid rgba(220,79,79,.45);
  border-radius:7px;
  background:rgba(100,25,29,.13);
  color:#ff9696;
  font-size:6px;
  font-weight:950;
}

.gptv6-match-head .finished{
  color:var(--green2);
}

.gptv6-score.finished{
  color:#fff;
}

.gptv7-table-head,
.gptv7-table-row{
  display:grid;
  grid-template-columns:
    20px
    minmax(0,1fr)
    24px
    28px
    31px;
  gap:4px;
  align-items:center;
}

.gptv7-table-head{
  padding:7px 8px;
  color:#708179;
  font-size:5.5px;
  font-weight:950;
}

.gptv7-table-row{
  min-height:49px;
  padding:6px 8px;
  border-top:1px solid #22342b;
}

.gptv7-table-row.qualified{
  background:rgba(86,213,46,.035);
}

.gptv7-table-row.qualified
.gptv6-position{
  color:var(--green2);
}

.gptv7-team-wrap{
  min-width:0;
}

.gptv7-team-main{
  min-width:0;
  display:grid;
  grid-template-columns:28px minmax(0,1fr);
  gap:6px;
  align-items:center;
}

.gptv7-team-main strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:7.5px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv7-team-meta{
  display:block;
  margin:3px 0 0 34px;
  color:#697b71;
  font-size:5.5px;
  line-height:1.2;
}

.gptv7-number{
  color:#9aa7a0;
  font-size:7px;
  font-weight:900;
  text-align:center;
}

.gptv7-points{
  color:var(--green2);
  font-size:9px;
  font-weight:950;
  text-align:center;
}




/* ==========================================================
   GREEN PARK - TABELA + CLASSIFICACAO V7.1
   ========================================================== */

.gptv71-view-switch{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
  padding:4px;
  margin:2px 0 5px;
  border:1px solid #2b4036;
  border-radius:10px;
  background:#0a1511;
}

.gptv71-view-switch button{
  min-height:35px;
  border:0;
  border-radius:7px;
  background:transparent;
  color:#75867d;
  font-size:7px;
  font-weight:950;
}

.gptv71-view-switch button.active{
  background:#18301d;
  color:var(--green2);
}


/* TABELA DOS JOGOS */

.gptv71-games-table{
  display:flex;
  flex-direction:column;
  gap:9px;
}

.gptv71-games-stage{
  overflow:hidden;
  border:1px solid #2c4036;
  border-radius:11px;
  background:#0b1712;
}

.gptv71-games-title{
  padding:8px 9px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  border-bottom:1px solid #25382f;
  color:#fff;
  font-size:7px;
  font-weight:950;
}

.gptv71-games-title span{
  color:var(--green2);
  font-size:6px;
}

.gptv71-game-row{
  display:grid;
  grid-template-columns:
    minmax(0,1fr)
    52px
    minmax(0,1fr);
  gap:5px;
  align-items:center;
  min-height:49px;
  padding:7px 8px;
  border-top:1px solid #203229;
}

.gptv71-game-row:first-of-type{
  border-top:0;
}

.gptv71-game-team{
  min-width:0;
  display:flex;
  align-items:center;
  gap:5px;
}

.gptv71-game-team.away{
  flex-direction:row-reverse;
  text-align:right;
}

.gptv71-game-logo{
  width:27px;
  height:27px;
  flex:0 0 27px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border-radius:7px;
  background:#17231d;
  color:#fff;
  font-size:6px;
  font-weight:950;
}

.gptv71-game-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv71-game-name{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:7px;
  font-weight:900;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv71-game-score{
  min-width:52px;
  text-align:center;
}

.gptv71-game-score strong{
  display:block;
  color:#fff;
  font-size:13px;
  font-weight:950;
}

.gptv71-game-score span{
  display:block;
  margin-top:2px;
  color:#74867c;
  font-size:5.5px;
  font-weight:900;
}


/* CLASSIFICACAO COMPLETA */

.gptv71-ranking-info{
  margin-bottom:7px;
  padding:8px 9px;
  border:1px solid #293d33;
  border-radius:9px;
  background:#0b1712;
  color:#7f9087;
  font-size:6px;
  line-height:1.45;
  text-align:center;
}

.gptv71-ranking-info strong{
  color:var(--green2);
}

.gptv71-scroll-hint{
  padding:0 2px 5px;
  color:#64766d;
  font-size:5.5px;
  text-align:right;
}

.gptv71-table-scroll{
  width:100%;
  overflow-x:auto;
  overflow-y:hidden;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
}

.gptv71-table-scroll::-webkit-scrollbar{
  display:none;
}

.gptv71-ranking-table{
  min-width:650px;
}

.gptv71-ranking-head,
.gptv71-ranking-row{
  display:grid;

  grid-template-columns:
    27px
    155px
    repeat(7,42px)
    48px;

  gap:0;

  align-items:center;
}

.gptv71-ranking-head{
  min-height:30px;
  padding:0 5px;
  color:#708179;
  font-size:6px;
  font-weight:950;
}

.gptv71-ranking-row{
  min-height:47px;
  padding:0 5px;
  border-top:1px solid #22342b;
}

.gptv71-ranking-row.qualified{
  background:
    linear-gradient(
      90deg,
      rgba(86,213,46,.08),
      rgba(86,213,46,.015)
    );
}

.gptv71-ranking-pos{
  color:#8c9992;
  font-size:8px;
  font-weight:950;
  text-align:center;
}

.gptv71-ranking-row.qualified
.gptv71-ranking-pos{
  color:var(--green2);
}

.gptv71-ranking-team{
  min-width:0;
  display:grid;
  grid-template-columns:29px minmax(0,1fr);
  gap:6px;
  align-items:center;
  padding-right:5px;
}

.gptv71-ranking-logo{
  width:29px;
  height:29px;
  overflow:hidden;
  display:grid;
  place-items:center;
  border-radius:7px;
  background:#17231d;
  color:#fff;
  font-size:6px;
  font-weight:950;
}

.gptv71-ranking-logo img{
  width:100%;
  height:100%;
  object-fit:contain;
}

.gptv71-ranking-team strong{
  min-width:0;
  overflow:hidden;
  color:#fff;
  font-size:7px;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.gptv71-stat{
  font-size:7px;
  font-weight:850;
  text-align:center;
  color:#9aa7a0;
}

.gptv71-sg.positive{
  color:var(--green2);
}

.gptv71-sg.negative{
  color:#e48d8d;
}

.gptv71-pts{
  color:var(--green2);
  font-size:9px;
  font-weight:950;
  text-align:center;
}

.gptv71-qualified-note{
  padding:7px 9px;
  border-top:1px solid #22342b;
  color:#788a80;
  font-size:6px;
  line-height:1.4;
}

.gptv71-qualified-note strong{
  color:var(--green2);
}



/* ==========================================================
   GREENPARK_TOURNAMENT_CLASSIFICATION_FIT_V72

   A CLASSIFICACAO INTEIRA CABE NA TELA.
   SEM ROLAGEM HORIZONTAL.
   ========================================================== */


/* remove a mensagem de deslizar */
.gptv71-scroll-hint{
  display:none!important;
}


/* nao deixa a tabela aumentar a pagina */
.gptv71-table-scroll{
  width:100%!important;
  max-width:100%!important;

  overflow-x:hidden!important;
  overflow-y:hidden!important;
}


/* remove os 650px da versao anterior */
.gptv71-ranking-table{
  width:100%!important;
  min-width:0!important;
  max-width:100%!important;
}


/*
 * 10 COLUNAS:
 *
 * POS | EQUIPE | J | V | E | D | GP | GC | SG | PTS
 *
 * Tudo dentro da largura real do celular.
 */
.gptv71-ranking-head,
.gptv71-ranking-row{

  width:100%!important;

  grid-template-columns:
    18px
    minmax(72px,1fr)
    repeat(7,22px)
    30px!important;

  gap:0!important;

  box-sizing:border-box!important;
}


/* CABECALHO */

.gptv71-ranking-head{
  min-height:25px!important;

  padding:0 2px!important;

  font-size:5.2px!important;

  letter-spacing:-.01em!important;
}


/* LINHA */

.gptv71-ranking-row{
  min-height:39px!important;

  padding:0 2px!important;
}


/* POSICAO */

.gptv71-ranking-pos{
  font-size:6.5px!important;
}


/* EQUIPE */

.gptv71-ranking-team{

  min-width:0!important;

  grid-template-columns:
    22px
    minmax(0,1fr)!important;

  gap:3px!important;

  padding-right:2px!important;
}


/* ESCUDO */

.gptv71-ranking-logo{
  width:22px!important;
  height:22px!important;

  border-radius:6px!important;

  font-size:5px!important;
}


/* NOME */

.gptv71-ranking-team strong{

  min-width:0!important;

  font-size:6px!important;

  line-height:1.05!important;

  overflow:hidden!important;

  text-overflow:ellipsis!important;

  white-space:nowrap!important;
}


/* ESTATISTICAS */

.gptv71-stat{
  font-size:5.8px!important;
  font-weight:900!important;
}


/* PONTOS */

.gptv71-pts{
  font-size:7.5px!important;
}


/* CARD DO GRUPO */

.gptv6-group-title{
  padding:7px 8px!important;
}


.gptv6-group-title strong{
  font-size:8px!important;
}


.gptv6-group-title span{
  font-size:5.8px!important;
}


/* CRITERIOS */

.gptv71-ranking-info{
  margin-bottom:6px!important;

  padding:6px 7px!important;

  font-size:5.5px!important;

  line-height:1.3!important;
}


/* TEXTO DO RODAPE */

.gptv71-qualified-note{
  padding:6px 7px!important;

  font-size:5.5px!important;
}


/* ==========================================================
   IPHONES MAIS ESTREITOS
   ========================================================== */

@media(max-width:350px){

  .gptv71-ranking-head,
  .gptv71-ranking-row{

    grid-template-columns:
      16px
      minmax(60px,1fr)
      repeat(7,20px)
      27px!important;

  }


  .gptv71-ranking-team{

    grid-template-columns:
      20px
      minmax(0,1fr)!important;

    gap:2px!important;
  }


  .gptv71-ranking-logo{
    width:20px!important;
    height:20px!important;
  }


  .gptv71-ranking-team strong{
    font-size:5.5px!important;
  }


  .gptv71-stat{
    font-size:5.4px!important;
  }


  .gptv71-pts{
    font-size:7px!important;
  }

}


@media(max-width:350px){
  .gptv6-summary{
    grid-template-columns:1fr;
  }
}

`;

  document.head.appendChild(
    style
  );
}


function imageBox(
  className,
  team
){
  const box =
    document.createElement(
      'div'
    );

  box.className =
    className;

  const url =
    String(
      team?.logoURL || ''
    ).trim();

  if(
    url.startsWith('https://') ||
    url.startsWith('http://')
  ){
    const img =
      document.createElement(
        'img'
      );

    img.src = url;
    img.alt =
      team?.name || 'Equipe';

    img.loading =
      'lazy';

    img.addEventListener(
      'error',
      () => {
        box.innerHTML = '';
        box.textContent =
          initials(
            team?.name
          );
      },
      {once:true}
    );

    box.appendChild(
      img
    );
  }else{
    box.textContent =
      initials(
        team?.name
      );
  }

  return box;
}


function cleanPanel(
  panelName,
  rootId
){
  const panel =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="' +
      panelName +
      '"]'
    );

  if(!panel){
    return null;
  }

  const head =
    panel.querySelector(
      '.gptournament-panel-head'
    );

  if(!head){
    return null;
  }

  if(
    document.getElementById(
      rootId
    )
  ){
    return panel;
  }

  Array.from(
    panel.children
  ).forEach(
    child => {
      if(child !== head){
        child.remove();
      }
    }
  );

  const root =
    document.createElement(
      'div'
    );

  root.id =
    rootId;

  root.className =
    'gptv6-root';

  panel.appendChild(
    root
  );

  return panel;
}


function ensureUI(){
  addStyle();

  const matchesPanel =
    cleanPanel(
      'matches',
      'gptv6MatchesRoot'
    );

  const standingsPanel =
    cleanPanel(
      'standings',
      'gptv6StandingsRoot'
    );

  const bracketPanel =
    cleanPanel(
      'bracket',
      'gptv6BracketRoot'
    );

  if(
    !matchesPanel ||
    !standingsPanel ||
    !bracketPanel
  ){
    return false;
  }

  const matchesRoot =
    document.getElementById(
      'gptv6MatchesRoot'
    );

  if(
    matchesRoot &&
    !document.getElementById(
      'gptv6Generate'
    )
  ){
    matchesRoot.innerHTML = `
      <div
        id="gptv6Admin"
        class="gptv6-admin"
      >
        <strong>
          SORTEIO E TABELA OFICIAL
        </strong>

        <span id="gptv6AdminInfo">
          Cadastre todas as equipes antes de gerar.
        </span>

        <button
          id="gptv6Generate"
          class="gptv6-generate"
          type="button"
        >
          SORTEAR GRUPOS E GERAR JOGOS
        </button>
      </div>

      <div
        id="gptv6Status"
        class="gptv6-status"
      ></div>

      <div
        id="gptv6MatchesContent"
      ></div>
    `;

    document
      .getElementById(
        'gptv6Generate'
      )
      ?.addEventListener(
        'click',
        generateStructure
      );
  }

  updateAdminVisibility();

  return true;
}


function updateAdminVisibility(){
  const admin =
    document.getElementById(
      'gptv6Admin'
    );

  if(admin){
    admin.classList.toggle(
      'show',
      isAdmin()
    );
  }
}


function teamName(team){
  return String(
    team?.name ||
    'Equipe'
  ).toLocaleUpperCase(
    'pt-BR'
  );
}


function renderTeamSide(
  teamId,
  source,
  score,
  penalties,
  finished
){
  if(teamId){
    const team =
      teamById(
        teamId
      );

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'gptv6-side';

    row.appendChild(
      imageBox(
        'gptv6-logo',
        team
      )
    );

    const name =
      document.createElement(
        'div'
      );

    name.className =
      'gptv6-team-name';

    name.textContent =
      teamName(team);

    const scoreBox =
      document.createElement(
        'div'
      );

    scoreBox.className =
      'gptv6-score';

    if(
      finished &&
      Number.isInteger(
        Number(score)
      )
    ){
      scoreBox.classList.add(
        'finished'
      );

      scoreBox.textContent =
        String(score) +
        (
          penalties !== null &&
          penalties !== undefined ?
            ' (' +
            String(penalties) +
            ')' :
            ''
        );

    }else{
      scoreBox.textContent =
        '–';
    }

    row.append(
      name,
      scoreBox
    );

    return row;
  }


  const sourceBox =
    document.createElement(
      'div'
    );

  sourceBox.className =
    'gptv6-source';

  sourceBox.textContent =
    source ||
    'A DEFINIR';

  return sourceBox;
}


function resultField(
  team,
  value,
  role
){
  const field =
    document.createElement(
      'label'
    );

  field.className =
    'gptv7-score-field';

  const name =
    document.createElement(
      'strong'
    );

  name.textContent =
    teamName(team);

  const input =
    document.createElement(
      'input'
    );

  input.type =
    'number';

  input.inputMode =
    'numeric';

  input.min =
    '0';

  input.max =
    '99';

  input.step =
    '1';

  input.dataset.role =
    role;

  input.value =
    value !== null &&
    value !== undefined ?
      String(value) :
      '';

  field.append(
    name,
    input
  );

  return field;
}


async function refreshAfterResult(){
  for(
    let attempt = 0;
    attempt < 30;
    attempt += 1
  ){
    if(!loading){
      break;
    }

    await wait(50);
  }

  await loadStructure();
}


async function saveManualResult(
  match,
  editor
){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  const read =
    role =>
      editor
        .querySelector(
          '[data-role="' +
          role +
          '"]'
        )
        ?.value ??
      '';

  const homeScore =
    Number(
      read('home-score')
    );

  const awayScore =
    Number(
      read('away-score')
    );

  if(
    !Number.isInteger(homeScore) ||
    homeScore < 0 ||
    homeScore > 99 ||
    !Number.isInteger(awayScore) ||
    awayScore < 0 ||
    awayScore > 99
  ){
    status(
      'Informe os dois placares.',
      'error'
    );

    return;
  }

  let homePenalties =
    null;

  let awayPenalties =
    null;

  if(
    match.stage !== 'group' &&
    homeScore === awayScore
  ){
    homePenalties =
      Number(
        read('home-penalties')
      );

    awayPenalties =
      Number(
        read('away-penalties')
      );

    if(
      !Number.isInteger(
        homePenalties
      ) ||
      homePenalties < 0 ||
      homePenalties > 99 ||
      !Number.isInteger(
        awayPenalties
      ) ||
      awayPenalties < 0 ||
      awayPenalties > 99 ||
      homePenalties ===
        awayPenalties
    ){
      status(
        'Em empate no mata-mata, informe os pênaltis com um vencedor.',
        'error'
      );

      return;
    }
  }

  const button =
    editor.querySelector(
      '.save'
    );

  if(button){
    button.disabled =
      true;

    button.textContent =
      'SALVANDO...';
  }

  try{
    await salvarResultadoJogoTorneioCall({
      tournamentId:
        currentTournament.id,

      matchId:
        match.id,

      homeScore,

      awayScore,

      homePenalties,

      awayPenalties
    });

    await refreshAfterResult();

    status(
      'Resultado salvo. Classificação atualizada.',
      'ok'
    );

  }catch(error){
    console.error(
      'Resultado torneio V7:',
      error
    );

    status(
      error?.message ||
      'Não foi possível salvar o resultado.',
      'error'
    );

  }finally{
    if(button){
      button.disabled =
        false;

      button.textContent =
        'SALVAR RESULTADO';
    }
  }
}


async function clearManualResult(
  match
){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  if(
    !confirm(
      'APAGAR RESULTADO?\n\n' +
      'A classificação será recalculada e ' +
      'confrontos seguintes podem ser alterados.'
    )
  ){
    return;
  }

  try{
    status(
      'Apagando resultado...'
    );

    await limparResultadoJogoTorneioCall({
      tournamentId:
        currentTournament.id,

      matchId:
        match.id
    });

    await refreshAfterResult();

    status(
      'Resultado apagado e tabela recalculada.',
      'ok'
    );

  }catch(error){
    status(
      error?.message ||
      'Não foi possível apagar o resultado.',
      'error'
    );
  }
}


function matchCard(match){
  const card =
    document.createElement(
      'article'
    );

  card.className =
    'gptv6-match';


  const finished =
    match.status ===
      'finished' &&
    match.homeScore !==
      null &&
    match.awayScore !==
      null;


  const head =
    document.createElement(
      'div'
    );

  head.className =
    'gptv6-match-head';


  const stage =
    document.createElement(
      'span'
    );

  stage.textContent =
    match.stage === 'group' ?
      (
        match.groupLabel +
        ' • RODADA ' +
        match.round
      ) :
      match.stageLabel;


  const state =
    document.createElement(
      'span'
    );

  state.textContent =
    finished ?
      'FINALIZADO' :
      'AGENDADO';

  if(finished){
    state.classList.add(
      'finished'
    );
  }


  head.append(
    stage,
    state
  );

  card.appendChild(
    head
  );


  card.appendChild(
    renderTeamSide(
      match.homeTeamId,
      match.homeSource,
      match.homeScore,
      match.homePenalties,
      finished
    )
  );


  card.appendChild(
    renderTeamSide(
      match.awayTeamId,
      match.awaySource,
      match.awayScore,
      match.awayPenalties,
      finished
    )
  );


  if(
    isAdmin() &&
    match.homeTeamId &&
    match.awayTeamId
  ){
    const toggle =
      document.createElement(
        'button'
      );

    toggle.type =
      'button';

    toggle.className =
      'gptv7-result-button' +
      (
        finished ?
          ' edit' :
          ''
      );

    toggle.textContent =
      finished ?
        'EDITAR RESULTADO' :
        'LANÇAR RESULTADO';


    const editor =
      document.createElement(
        'div'
      );

    editor.className =
      'gptv7-editor';


    const title =
      document.createElement(
        'div'
      );

    title.className =
      'gptv7-editor-title';

    title.textContent =
      'PLACAR DO JOGO';

    editor.appendChild(
      title
    );


    const scoreGrid =
      document.createElement(
        'div'
      );

    scoreGrid.className =
      'gptv7-score-grid';


    scoreGrid.appendChild(
      resultField(
        teamById(
          match.homeTeamId
        ),
        match.homeScore,
        'home-score'
      )
    );


    scoreGrid.appendChild(
      resultField(
        teamById(
          match.awayTeamId
        ),
        match.awayScore,
        'away-score'
      )
    );


    editor.appendChild(
      scoreGrid
    );


    if(
      match.stage !==
      'group'
    ){
      const penaltyTitle =
        document.createElement(
          'div'
        );

      penaltyTitle.className =
        'gptv7-penalty-title';

      penaltyTitle.textContent =
        'PÊNALTIS — PREENCHA SOMENTE SE O JOGO EMPATAR';

      editor.appendChild(
        penaltyTitle
      );


      const penaltyGrid =
        document.createElement(
          'div'
        );

      penaltyGrid.className =
        'gptv7-score-grid';


      penaltyGrid.appendChild(
        resultField(
          teamById(
            match.homeTeamId
          ),
          match.homePenalties,
          'home-penalties'
        )
      );


      penaltyGrid.appendChild(
        resultField(
          teamById(
            match.awayTeamId
          ),
          match.awayPenalties,
          'away-penalties'
        )
      );


      editor.appendChild(
        penaltyGrid
      );
    }


    const actions =
      document.createElement(
        'div'
      );

    actions.className =
      'gptv7-editor-actions';


    const cancel =
      document.createElement(
        'button'
      );

    cancel.type =
      'button';

    cancel.textContent =
      'CANCELAR';

    cancel.addEventListener(
      'click',
      () => {
        editor.classList.remove(
          'show'
        );
      }
    );


    const save =
      document.createElement(
        'button'
      );

    save.type =
      'button';

    save.className =
      'save';

    save.textContent =
      'SALVAR RESULTADO';

    save.addEventListener(
      'click',
      () =>
        saveManualResult(
          match,
          editor
        )
    );


    actions.append(
      cancel,
      save
    );


    editor.appendChild(
      actions
    );


    if(finished){
      const clear =
        document.createElement(
          'button'
        );

      clear.type =
        'button';

      clear.className =
        'gptv7-clear';

      clear.textContent =
        'APAGAR RESULTADO';

      clear.addEventListener(
        'click',
        () =>
          clearManualResult(
            match
          )
      );

      editor.appendChild(
        clear
      );
    }


    toggle.addEventListener(
      'click',
      () => {
        editor.classList.toggle(
          'show'
        );
      }
    );


    card.append(
      toggle,
      editor
    );
  }


  return card;
}


function renderAdmin(){
  const button =
    document.getElementById(
      'gptv6Generate'
    );

  const info =
    document.getElementById(
      'gptv6AdminInfo'
    );

  if(
    !button ||
    !info
  ){
    return;
  }

  const total =
    structure.teams.length;

  const required =
    Number(
      structure.teamsCount || 0
    );

  if(
    total !== required
  ){
    button.disabled =
      true;

    button.textContent =
      'CADASTRE TODAS AS EQUIPES';

    info.textContent =
      total +
      ' de ' +
      required +
      ' equipes cadastradas.';

    return;
  }

  if(
    structure.hasResults
  ){
    button.disabled =
      true;

    button.textContent =
      'SORTEIO BLOQUEADO';

    info.textContent =
      'Já existem resultados lançados.';

    return;
  }

  button.disabled =
    false;

  if(
    structure.generated
  ){
    button.textContent =
      structure.stale ?
        'ATUALIZAR GRUPOS E JOGOS' :
        'REFAZER SORTEIO E JOGOS';

    info.textContent =
      structure.stale ?
        'As equipes ou o formato mudaram desde o último sorteio.' :
        'Estrutura já gerada. Você pode refazer enquanto não houver resultados.';
  }else{
    button.textContent =
      'SORTEAR GRUPOS E GERAR JOGOS';

    info.textContent =
      required +
      ' equipes prontas para o sorteio.';
  }
}


function renderSummary(
  container
){
  const groupMatches =
    structure.matches.filter(
      match =>
        match.stage ===
        'group'
    ).length;

  const knockoutMatches =
    structure.matches.length -
    groupMatches;

  const summary =
    document.createElement(
      'div'
    );

  summary.className =
    'gptv6-summary';

  [
    [
      structure.teams.length,
      'EQUIPES'
    ],
    [
      groupMatches,
      'FASE DE GRUPOS'
    ],
    [
      knockoutMatches,
      'MATA-MATA'
    ]
  ].forEach(
    ([value,label]) => {
      const card =
        document.createElement(
          'div'
        );

      const strong =
        document.createElement(
          'strong'
        );

      strong.textContent =
        String(value);

      const span =
        document.createElement(
          'span'
        );

      span.textContent =
        label;

      card.append(
        strong,
        span
      );

      summary.appendChild(
        card
      );
    }
  );

  container.appendChild(
    summary
  );
}


function gameTableScore(match){

  const finished =
    match.status ===
      'finished' &&
    match.homeScore !==
      null &&
    match.awayScore !==
      null;


  if(!finished){
    return {
      score:'×',
      state:
        (
          match.homeTeamId &&
          match.awayTeamId
        ) ?
          'AGENDADO' :
          'A DEFINIR'
    };
  }


  let score =
    String(
      match.homeScore
    ) +
    ' × ' +
    String(
      match.awayScore
    );


  if(
    match.homePenalties !==
      null &&
    match.homePenalties !==
      undefined &&
    match.awayPenalties !==
      null &&
    match.awayPenalties !==
      undefined
  ){
    score +=
      ' (' +
      match.homePenalties +
      '×' +
      match.awayPenalties +
      ')';
  }


  return {
    score,
    state:'FINAL'
  };
}


function tableTeamCell(
  teamId,
  source,
  away = false
){
  const wrapper =
    document.createElement(
      'div'
    );

  wrapper.className =
    'gptv71-game-team' +
    (
      away ?
        ' away' :
        ''
    );


  const team =
    teamById(
      teamId
    );


  if(team){
    wrapper.appendChild(
      imageBox(
        'gptv71-game-logo',
        team
      )
    );
  }


  const name =
    document.createElement(
      'div'
    );

  name.className =
    'gptv71-game-name';


  name.textContent =
    team ?
      teamName(team) :
      (
        source ||
        'A DEFINIR'
      );


  wrapper.appendChild(
    name
  );


  return wrapper;
}


function renderGamesTable(
  container
){

  const table =
    document.createElement(
      'div'
    );

  table.className =
    'gptv71-games-table';


  const stageGroups =
    [];


  const groupMatches =
    structure.matches
      .filter(
        match =>
          match.stage ===
          'group'
      );


  const groupKeys =
    [
      ...new Set(
        groupMatches.map(
          match =>
            (
              match.groupLabel ||
              'FASE DE GRUPOS'
            ) +
            '|' +
            String(
              match.round ||
              1
            )
        )
      )
    ];


  groupKeys.forEach(
    key => {

      const [
        label,
        round
      ] =
        key.split('|');


      stageGroups.push({
        title:
          label +
          ' • RODADA ' +
          round,

        matches:
          groupMatches.filter(
            match =>
              (
                match.groupLabel ||
                'FASE DE GRUPOS'
              ) +
              '|' +
              String(
                match.round ||
                1
              ) ===
              key
          )
      });

    }
  );


  [
    [
      'quarterfinal',
      'QUARTAS DE FINAL'
    ],
    [
      'semifinal',
      'SEMIFINAIS'
    ],
    [
      'final',
      'FINAL'
    ]
  ].forEach(
    ([stage,label]) => {

      const matches =
        structure.matches
          .filter(
            match =>
              match.stage ===
              stage
          );


      if(matches.length){
        stageGroups.push({
          title:label,
          matches
        });
      }

    }
  );


  stageGroups.forEach(
    group => {

      const section =
        document.createElement(
          'section'
        );

      section.className =
        'gptv71-games-stage';


      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv71-games-title';


      const strong =
        document.createElement(
          'strong'
        );

      strong.textContent =
        group.title;


      const total =
        document.createElement(
          'span'
        );

      total.textContent =
        group.matches.length +
        (
          group.matches.length === 1 ?
            ' JOGO' :
            ' JOGOS'
        );


      title.append(
        strong,
        total
      );


      section.appendChild(
        title
      );


      group.matches.forEach(
        match => {

          const row =
            document.createElement(
              'div'
            );

          row.className =
            'gptv71-game-row';


          row.appendChild(
            tableTeamCell(
              match.homeTeamId,
              match.homeSource,
              false
            )
          );


          const score =
            gameTableScore(
              match
            );


          const center =
            document.createElement(
              'div'
            );

          center.className =
            'gptv71-game-score';


          const value =
            document.createElement(
              'strong'
            );

          value.textContent =
            score.score;


          const state =
            document.createElement(
              'span'
            );

          state.textContent =
            score.state;


          center.append(
            value,
            state
          );


          row.appendChild(
            center
          );


          row.appendChild(
            tableTeamCell(
              match.awayTeamId,
              match.awaySource,
              true
            )
          );


          section.appendChild(
            row
          );

        }
      );


      table.appendChild(
        section
      );

    }
  );


  container.appendChild(
    table
  );
}


function renderMatchViewSwitch(
  container
){

  const switcher =
    document.createElement(
      'div'
    );

  switcher.className =
    'gptv71-view-switch';


  [
    [
      'cards',
      'PARTIDAS'
    ],
    [
      'table',
      'TABELA'
    ]
  ].forEach(
    ([mode,label]) => {

      const button =
        document.createElement(
          'button'
        );

      button.type =
        'button';

      button.textContent =
        label;


      if(
        matchViewMode ===
        mode
      ){
        button.classList.add(
          'active'
        );
      }


      button.addEventListener(
        'click',
        () => {

          matchViewMode =
            mode;

          renderMatches();

        }
      );


      switcher.appendChild(
        button
      );

    }
  );


  container.appendChild(
    switcher
  );
}


function renderMatches(){

  const container =
    document.getElementById(
      'gptv6MatchesContent'
    );


  if(!container){
    return;
  }


  container.innerHTML = '';


  if(
    structure.stale
  ){

    const alert =
      document.createElement(
        'div'
      );

    alert.className =
      'gptv6-alert';

    alert.textContent =
      'A estrutura está desatualizada. O Admin precisa gerar novamente os grupos e jogos.';

    container.appendChild(
      alert
    );

  }


  if(
    !structure.generated
  ){

    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'gptv6-empty';

    empty.textContent =
      'Os grupos e jogos ainda não foram gerados.';

    container.appendChild(
      empty
    );

    return;
  }


  renderSummary(
    container
  );


  renderMatchViewSwitch(
    container
  );


  if(
    matchViewMode ===
    'table'
  ){

    renderGamesTable(
      container
    );

    return;
  }


  const groupMatches =
    structure.matches.filter(
      match =>
        match.stage ===
        'group'
    );


  const groups =
    [
      ...new Set(
        groupMatches.map(
          match =>
            match.groupId
        )
      )
    ];


  groups.forEach(
    id => {

      const section =
        document.createElement(
          'section'
        );

      section.className =
        'gptv6-section';


      const matches =
        groupMatches.filter(
          match =>
            match.groupId ===
            id
        );


      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv6-section-title';

      title.textContent =
        matches[0]
          ?.groupLabel ||
        'FASE DE GRUPOS';


      section.appendChild(
        title
      );


      matches.forEach(
        match =>
          section.appendChild(
            matchCard(
              match
            )
          )
      );


      container.appendChild(
        section
      );

    }
  );


  const knockout =
    structure.matches.filter(
      match =>
        match.stage !==
        'group'
    );


  if(knockout.length){

    const section =
      document.createElement(
        'section'
      );

    section.className =
      'gptv6-section';


    const title =
      document.createElement(
        'div'
      );

    title.className =
      'gptv6-section-title';

    title.textContent =
      'MATA-MATA';


    section.appendChild(
      title
    );


    knockout.forEach(
      match =>
        section.appendChild(
          matchCard(
            match
          )
        )
    );


    container.appendChild(
      section
    );

  }

}


function qualifierCount(){
  const total =
    Number(
      structure.teamsCount ||
      structure.teams.length ||
      3
    );

  if(total <= 4){
    return 2;
  }

  if(total === 5){
    return 4;
  }

  if(total <= 10){
    return 2;
  }

  if(total <= 16){
    return 4;
  }

  return 2;
}


function groupIsFinished(
  groupId
){
  const matches =
    structure.matches.filter(
      match =>
        match.stage ===
          'group' &&
        (
          match.groupId ||
          'U'
        ) === groupId
    );

  return (
    matches.length > 0 &&
    matches.every(
      match =>
        match.status ===
          'finished' &&
        match.homeScore !==
          null &&
        match.awayScore !==
          null
    )
  );
}


function groupStandings(
  groupId
){
  const teams =
    structure.teams
      .filter(
        team =>
          String(
            team.groupId ||
            'U'
          ) === groupId
      )
      .map(
        team => ({
          team,
          played:0,
          wins:0,
          draws:0,
          losses:0,
          goalsFor:0,
          goalsAgainst:0,
          goalDiff:0,
          points:0
        })
      );


  const byId =
    new Map(
      teams.map(
        row => [
          String(row.team.id),
          row
        ]
      )
    );


  structure.matches
    .filter(
      match =>
        match.stage ===
          'group' &&
        (
          match.groupId ||
          'U'
        ) === groupId &&
        match.status ===
          'finished' &&
        match.homeScore !==
          null &&
        match.awayScore !==
          null
    )
    .forEach(
      match => {
        const home =
          byId.get(
            String(
              match.homeTeamId
            )
          );

        const away =
          byId.get(
            String(
              match.awayTeamId
            )
          );

        if(
          !home ||
          !away
        ){
          return;
        }

        const hg =
          Number(
            match.homeScore
          );

        const ag =
          Number(
            match.awayScore
          );

        home.played += 1;
        away.played += 1;

        home.goalsFor += hg;
        home.goalsAgainst += ag;

        away.goalsFor += ag;
        away.goalsAgainst += hg;

        if(hg > ag){
          home.wins += 1;
          home.points += 3;
          away.losses += 1;

        }else if(ag > hg){
          away.wins += 1;
          away.points += 3;
          home.losses += 1;

        }else{
          home.draws += 1;
          away.draws += 1;
          home.points += 1;
          away.points += 1;
        }
      }
    );


  teams.forEach(
    row => {
      row.goalDiff =
        row.goalsFor -
        row.goalsAgainst;
    }
  );


  teams.sort(
    (a,b) =>
      b.points -
        a.points ||

      b.wins -
        a.wins ||

      b.goalDiff -
        a.goalDiff ||

      b.goalsFor -
        a.goalsFor ||

      a.goalsAgainst -
        b.goalsAgainst ||

      Number(
        a.team.groupOrder ||
        0
      ) -
      Number(
        b.team.groupOrder ||
        0
      ) ||

      String(
        a.team.name ||
        ''
      ).localeCompare(
        String(
          b.team.name ||
          ''
        ),
        'pt-BR',
        {
          sensitivity:'base'
        }
      )
  );


  return teams;
}


function renderStandings(){

  const root =
    document.getElementById(
      'gptv6StandingsRoot'
    );


  if(!root){
    return;
  }


  root.innerHTML = '';


  if(
    !structure.generated
  ){

    root.innerHTML =
      '<div class="gptv6-empty">' +
      'A classificação aparecerá depois do sorteio dos grupos.' +
      '</div>';

    return;
  }


  const info =
    document.createElement(
      'div'
    );

  info.className =
    'gptv71-ranking-info';

  info.innerHTML =
    '<strong>CRITÉRIOS:</strong> ' +
    'Pontos → Vitórias → Saldo de gols → ' +
    'Gols pró → Menor número de gols contra.';


  root.appendChild(
    info
  );


  const groupIds =
    [
      ...new Set(
        structure.teams.map(
          team =>
            String(
              team.groupId ||
              'U'
            )
        )
      )
    ]
      .sort();


  const wrap =
    document.createElement(
      'div'
    );

  wrap.className =
    'gptv6-groups';


  const qualify =
    qualifierCount();


  groupIds.forEach(
    groupId => {

      const rows =
        groupStandings(
          groupId
        );


      const finished =
        groupIsFinished(
          groupId
        );


      const card =
        document.createElement(
          'section'
        );

      card.className =
        'gptv6-group';


      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv6-group-title';


      const strong =
        document.createElement(
          'strong'
        );


      strong.textContent =
        groupId === 'U' ?
          'GRUPO ÚNICO' :
          'GRUPO ' +
          groupId;


      const state =
        document.createElement(
          'span'
        );


      state.textContent =
        finished ?
          'CLASSIFICAÇÃO FINAL' :
          'CLASSIFICAÇÃO';


      title.append(
        strong,
        state
      );


      card.appendChild(
        title
      );


      const hint =
        document.createElement(
          'div'
        );

      hint.className =
        'gptv71-scroll-hint';

      hint.textContent =
        'Deslize para ver todas as estatísticas →';


      card.appendChild(
        hint
      );


      const scroll =
        document.createElement(
          'div'
        );

      scroll.className =
        'gptv71-table-scroll';


      const table =
        document.createElement(
          'div'
        );

      table.className =
        'gptv71-ranking-table';


      const head =
        document.createElement(
          'div'
        );

      head.className =
        'gptv71-ranking-head';


      [
        '#',
        'EQUIPE',
        'J',
        'V',
        'E',
        'D',
        'GP',
        'GC',
        'SG',
        'PTS'
      ].forEach(
        label => {

          const cell =
            document.createElement(
              'span'
            );

          cell.textContent =
            label;

          head.appendChild(
            cell
          );

        }
      );


      table.appendChild(
        head
      );


      rows.forEach(
        (row,index) => {

          const line =
            document.createElement(
              'div'
            );

          line.className =
            'gptv71-ranking-row';


          if(
            index < qualify
          ){
            line.classList.add(
              'qualified'
            );
          }


          const position =
            document.createElement(
              'div'
            );

          position.className =
            'gptv71-ranking-pos';

          position.textContent =
            String(
              index + 1
            );


          const team =
            document.createElement(
              'div'
            );

          team.className =
            'gptv71-ranking-team';


          team.appendChild(
            imageBox(
              'gptv71-ranking-logo',
              row.team
            )
          );


          const name =
            document.createElement(
              'strong'
            );

          name.textContent =
            teamName(
              row.team
            );


          team.appendChild(
            name
          );


          const values = [
            row.played,
            row.wins,
            row.draws,
            row.losses,
            row.goalsFor,
            row.goalsAgainst,
            row.goalDiff
          ];


          line.append(
            position,
            team
          );


          values.forEach(
            (
              value,
              valueIndex
            ) => {

              const cell =
                document.createElement(
                  'div'
                );

              cell.className =
                'gptv71-stat';


              if(
                valueIndex === 6
              ){

                cell.classList.add(
                  'gptv71-sg'
                );


                if(value > 0){
                  cell.classList.add(
                    'positive'
                  );
                }


                if(value < 0){
                  cell.classList.add(
                    'negative'
                  );
                }


                cell.textContent =
                  value > 0 ?
                    '+' +
                    value :
                    String(value);

              }else{

                cell.textContent =
                  String(value);

              }


              line.appendChild(
                cell
              );

            }
          );


          const points =
            document.createElement(
              'div'
            );

          points.className =
            'gptv71-pts';

          points.textContent =
            String(
              row.points
            );


          line.appendChild(
            points
          );


          table.appendChild(
            line
          );

        }
      );


      scroll.appendChild(
        table
      );


      card.appendChild(
        scroll
      );


      const note =
        document.createElement(
          'div'
        );

      note.className =
        'gptv71-qualified-note';


      note.innerHTML =
        '<strong>' +
        qualify +
        '</strong> ' +
        (
          qualify === 1 ?
            'equipe classifica' :
            'equipes classificam'
        ) +
        (
          finished ?
            ' para a próxima fase.' :
            ' atualmente.'
        );


      card.appendChild(
        note
      );


      wrap.appendChild(
        card
      );

    }
  );


  root.appendChild(
    wrap
  );

}


function renderBracket(){
  const root =
    document.getElementById(
      'gptv6BracketRoot'
    );

  if(!root){
    return;
  }

  root.innerHTML = '';

  const knockout =
    structure.matches.filter(
      match =>
        match.stage !==
        'group'
    );

  if(!knockout.length){
    root.innerHTML =
      '<div class="gptv6-empty">' +
      'O mata-mata aparecerá depois da geração da tabela.' +
      '</div>';

    return;
  }

  const stages = [
    [
      'quarterfinal',
      'QUARTAS DE FINAL'
    ],
    [
      'semifinal',
      'SEMIFINAIS'
    ],
    [
      'final',
      'FINAL'
    ]
  ];

  const wrap =
    document.createElement(
      'div'
    );

  wrap.className =
    'gptv6-bracket';

  stages.forEach(
    ([stage,label]) => {
      const matches =
        knockout.filter(
          match =>
            match.stage ===
            stage
        );

      if(!matches.length){
        return;
      }

      const title =
        document.createElement(
          'div'
        );

      title.className =
        'gptv6-section-title';

      title.textContent =
        label;

      wrap.appendChild(
        title
      );

      matches.forEach(
        match =>
          wrap.appendChild(
            matchCard(match)
          )
      );
    }
  );

  root.appendChild(
    wrap
  );
}


function renderAll(){
  if(!ensureUI()){
    return;
  }

  updateAdminVisibility();
  renderAdmin();
  renderMatches();
  renderStandings();
  renderBracket();

  const standingsHead =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="standings"] ' +
      '.gptournament-panel-head span'
    );

  if(
    standingsHead &&
    structure.generated
  ){
    standingsHead.textContent =
      structure.format?.label ||
      'Classificação';
  }

  const matchesHead =
    document.querySelector(
      '#tournamentsView ' +
      '[data-tournament-panel="matches"] ' +
      '.gptournament-panel-head span'
    );

  if(
    matchesHead &&
    structure.generated
  ){
    matchesHead.textContent =
      structure.matches.length +
      ' jogos gerados';
  }
}


async function loadStructure(){
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
    const current =
      await obterTorneioAtualCall(
        {}
      );

    if(
      current.data?.exists !==
      true
    ){
      currentTournament =
        null;

      structure = {
        teams:[],
        matches:[],
        teamsCount:0,
        generated:false,
        stale:false,
        hasResults:false,
        format:{}
      };

      renderAll();
      return;
    }

    currentTournament =
      current.data.tournament;

    const response =
      await listarEstruturaTorneioCall({
        tournamentId:
          currentTournament.id
      });

    structure = {
      teams:
        Array.isArray(
          response.data?.teams
        ) ?
          response.data.teams :
          [],

      matches:
        Array.isArray(
          response.data?.matches
        ) ?
          response.data.matches :
          [],

      teamsCount:
        Number(
          response.data
            ?.teamsCount ||
          0
        ),

      generated:
        response.data
          ?.generated ===
        true,

      stale:
        response.data
          ?.stale ===
        true,

      hasResults:
        response.data
          ?.hasResults ===
        true,

      format:
        response.data
          ?.format ||
        {}
    };

    status('');

    renderAll();

  }catch(error){
    console.error(
      'Estrutura torneio V6:',
      error
    );

    status(
      error?.message ||
      'Não foi possível carregar a tabela.',
      'error'
    );

  }finally{
    loading = false;
  }
}


async function generateStructure(){
  if(
    !isAdmin() ||
    !currentTournament?.id
  ){
    return;
  }

  if(
    structure.hasResults
  ){
    status(
      'Já existem resultados. O sorteio está protegido.',
      'error'
    );

    return;
  }

  let force =
    false;

  if(
    structure.generated
  ){
    const message =
      structure.stale ?
        (
          'ATUALIZAR GRUPOS E JOGOS?\n\n' +
          'A estrutura atual será substituída pelo novo sorteio.'
        ) :
        (
          'REFAZER O SORTEIO?\n\n' +
          'Os grupos e jogos atuais serão sorteados novamente.'
        );

    if(!confirm(message)){
      return;
    }

    force = true;
  }

  const button =
    document.getElementById(
      'gptv6Generate'
    );

  if(button){
    button.disabled =
      true;

    button.textContent =
      'SORTEANDO...';
  }

  status(
    'Sorteando equipes e gerando os jogos...'
  );

  try{
    const response =
      await gerarEstruturaTorneioCall({
        tournamentId:
          currentTournament.id,
        force
      });

    const data =
      response.data || {};

    await loadStructure();

    status(
      'Sorteio concluído: ' +
      Number(
        data.totalMatches || 0
      ) +
      ' jogos gerados.',
      'ok'
    );

  }catch(error){
    console.error(
      'Gerar torneio V6:',
      error
    );

    status(
      error?.message ||
      'Não foi possível gerar os grupos.',
      'error'
    );

  }finally{
    renderAdmin();
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

    await wait(100);
  }

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

  listarEstruturaTorneioCall =
    httpsCallable(
      functions,
      'listarEstruturaTorneio'
    );

  gerarEstruturaTorneioCall =
    httpsCallable(
      functions,
      'gerarEstruturaTorneio'
    );

  salvarResultadoJogoTorneioCall =
    httpsCallable(
      functions,
      'salvarResultadoJogoTorneio'
    );


  limparResultadoJogoTorneioCall =
    httpsCallable(
      functions,
      'limparResultadoJogoTorneio'
    );


  onAuthStateChanged(
    auth,
    user => {
      firebaseUser =
        user;

      updateAdminVisibility();

      setTimeout(
        loadStructure,
        300
      );
    }
  );

  window.addEventListener(
    'greenpark:tournament-teams-count-saved',
    event => {

      const savedTeams =
        Number(
          event.detail?.teamsCount
        );

      if(
        Number.isInteger(savedTeams) &&
        savedTeams >= 3 &&
        savedTeams <= 32
      ){
        structure.teamsCount =
          savedTeams;

        renderAll();
      }

      setTimeout(
        loadStructure,
        150
      );

      setTimeout(
        loadStructure,
        900
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

      const tabName =
        tab?.dataset
          ?.tournamentTab ||
        '';

      if(
        [
          'matches',
          'standings',
          'bracket'
        ].includes(
          tabName
        )
      ){
        setTimeout(
          loadStructure,
          120
        );
      }

      const buttonId =
        event.target
          ?.closest?.(
            'button'
          )
          ?.id ||
        '';

      if(
        [
          'gptv5Save',
          'gptv44TeamsSave',
          'tournamentSaveButton',
          'openTournamentsQuick'
        ].includes(
          buttonId
        )
      ){
        setTimeout(
          loadStructure,
          1000
        );
      }
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
              .contains(
                'active'
              )
          ){
            setTimeout(
              loadStructure,
              180
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
    'Tournament Schedule V6:',
    error
  );
});
